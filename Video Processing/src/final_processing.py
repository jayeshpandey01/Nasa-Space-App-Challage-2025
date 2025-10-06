# final_processing_fixed.py
import spacepy.pycdf as pycdf
import pandas as pd
import numpy as np
import os

# Constants
FILL_VALUE = -1.0e31
k_B = 1.381e-23
m_p = 1.673e-27


def cdf_to_csv(cdf_path, max_rows=None, pad_value=np.nan):
    """
    Convert a CDF to pandas DataFrame handling multi-dimensional variables.
    Keeps object dtype for mixed content; numeric arrays remain numeric.
    """
    cdf = pycdf.CDF(cdf_path)

    # read all variables first
    raw_vars = {}
    for var in cdf:
        arr = cdf[var][...]
        if hasattr(arr, 'filled'):
            arr = arr.filled(np.nan)
        arr = np.asarray(arr)
        raw_vars[var] = arr

    # determine primary length
    lengths = []
    for arr in raw_vars.values():
        if arr.ndim == 0:
            lengths.append(1)
        else:
            lengths.append(arr.shape[0])
    primary_len = int(max(lengths)) if lengths else 0
    if primary_len == 0:
        raise ValueError("No data found in CDF.")

    # build columns
    columns = {}
    for name, arr in raw_vars.items():
        if arr.ndim == 0:
            columns[name] = np.full(primary_len, arr.item(), dtype=object)
        elif arr.ndim == 1:
            col = np.full(primary_len, pad_value, dtype=object)
            length = min(primary_len, arr.shape[0])
            col[:length] = arr[:length]
            columns[name] = col
        else:
            # multi-dim: if first axis equals primary_len, flatten remaining dims
            if arr.shape[0] == primary_len:
                rest_shape = arr.shape[1:]
                ncols = int(np.prod(rest_shape))
                reshaped = arr.reshape((primary_len, ncols))
                for i in range(ncols):
                    columns[f"{name}_{i}"] = reshaped[:, i]
            elif arr.shape[-1] == primary_len:
                # if time axis is last, move it to first then flatten
                reshaped = np.moveaxis(arr, -1, 0)
                ncols = int(np.prod(reshaped.shape[1:]))
                reshaped = reshaped.reshape((primary_len, ncols))
                for i in range(ncols):
                    columns[f"{name}_{i}"] = reshaped[:, i]
            else:
                # fallback: store each row as list/object
                col = np.full(primary_len, pad_value, dtype=object)
                for i in range(min(arr.shape[0], primary_len)):
                    col[i] = arr[i].tolist()
                columns[name] = col

    df = pd.DataFrame(columns)
    if max_rows:
        df = df.head(max_rows)
    return df


def calculate_cme_score(proton_density, proton_bulk_speed, proton_thermal, alpha_density):
    """
    Vectorized CME score calculator that accepts pandas Series or numpy arrays.
    Returns a pandas Series if input was pandas Series, else numpy array.
    """
    is_series = isinstance(proton_density, (pd.Series, pd.Index))
    idx = proton_density.index if is_series else None

    pd_arr = np.asarray(proton_density, dtype=float)
    v_arr = np.asarray(proton_bulk_speed, dtype=float)
    t_arr = np.asarray(proton_thermal, dtype=float)
    a_arr = np.asarray(alpha_density, dtype=float)

    # Validity masks (exclude fill values and non-finite)
    valid_proton = (pd_arr > FILL_VALUE) & np.isfinite(pd_arr) & (v_arr > FILL_VALUE) & np.isfinite(v_arr)
    valid_alpha = (a_arr > FILL_VALUE) & np.isfinite(a_arr)
    valid_thermal = (t_arr > FILL_VALUE) & np.isfinite(t_arr)

    score = np.zeros_like(pd_arr, dtype=float)

    # Alpha ratio score (0.4)
    denom_ok = pd_arr > 0
    mask_alpha = valid_proton & valid_alpha & denom_ok
    alpha_ratio = np.zeros_like(pd_arr, dtype=float)
    alpha_ratio[mask_alpha] = a_arr[mask_alpha] / pd_arr[mask_alpha]
    alpha_scaled = np.clip((alpha_ratio - 0.003) / 0.008, 0, 1)
    score += 0.4 * alpha_scaled

    # Speed score (0.4)
    mask_speed = valid_proton
    speed_scaled = np.zeros_like(pd_arr, dtype=float)
    speed_scaled[mask_speed] = np.clip((v_arr[mask_speed] - 380.0) / 200.0, 0.0, 1.0)
    score += 0.4 * speed_scaled

    # Temperature score (0.1)
    mask_temp = valid_proton & valid_thermal & (v_arr > 0)
    if np.any(mask_temp):
        v_masked = v_arr[mask_temp]
        t_masked = t_arr[mask_temp]
        # expected temperature (avoid fractional power on negative values by masking v>0)
        T_exp = 3.0 * (v_masked / 100.0) ** 0.67 * 1e4
        T_obs = ((t_masked * 1000.0) ** 2) * m_p / (2.0 * k_B)
        # avoid divide-by-zero or nan
        safe_T_exp = np.where(T_exp > 0, T_exp, np.nan)
        T_ratio = T_obs / safe_T_exp
        temp_contrib = np.zeros_like(T_ratio)
        cond = (T_ratio < 0.5) & np.isfinite(T_ratio)
        temp_contrib[cond] = np.maximum(0.0, 1.0 - 2.0 * T_ratio[cond])
        score[mask_temp] += 0.1 * temp_contrib

    # Quality score (0.1)
    valid_count = valid_proton.astype(int) + valid_alpha.astype(int) + valid_thermal.astype(int)
    score += 0.1 * (valid_count / 3.0)

    if idx is not None:
        return pd.Series(score, index=idx)
    return score


def detect_cme_speed_signatures(proton_speeds):
    """
    Returns:
      - enhancement_scores : float array in [0,1]
      - rapid_increases : boolean array (True where speed change > threshold relative to previous sample)
      - accelerations : boolean array (True where second diff > threshold)
      - acceleration_changes : numeric array of speed second-differences (same length)
    All arrays have same length as proton_speeds. Handles empty input.
    """
    ps = np.asarray(proton_speeds, dtype=float)
    n = ps.size
    if n == 0:
        return np.zeros(0, dtype=float), np.zeros(0, dtype=bool), np.zeros(0, dtype=bool), np.zeros(0, dtype=float)

    # enhancement score mapping
    valid = (ps > FILL_VALUE) & np.isfinite(ps)
    enhancement_scores = np.zeros(n, dtype=float)
    enhancement_scores[valid] = np.clip((ps[valid] - 380.0) / 200.0, 0.0, 1.0)

    # speed first differences (aligned so diff[i] = ps[i] - ps[i-1], diff[0]=0)
    speed_changes = np.empty(n, dtype=float)
    speed_changes[0] = 0.0
    speed_changes[1:] = ps[1:] - ps[:-1]

    rapid_increases = (speed_changes > 5.0) & np.isfinite(speed_changes)

    # second diff (acceleration): accel[i] = speed_changes[i] - speed_changes[i-1], accel[0]=0
    acceleration_changes = np.empty(n, dtype=float)
    acceleration_changes[0] = 0.0
    acceleration_changes[1:] = speed_changes[1:] - speed_changes[:-1]

    accelerations = (acceleration_changes > 2.0) & np.isfinite(acceleration_changes)

    return enhancement_scores, rapid_increases, accelerations, acceleration_changes


def detect_cme_thresholds(alpha_density, proton_density, proton_bulk_speed, proton_thermal):
    """
    Detect CME ejection based on threshold values. All inputs may be pandas Series or arrays.
    Returns boolean arrays (alpha_flag, speed_flag, temp_flag) aligned to input length.
    """
    a = np.asarray(alpha_density, dtype=float)
    p = np.asarray(proton_density, dtype=float)
    v = np.asarray(proton_bulk_speed, dtype=float)
    t = np.asarray(proton_thermal, dtype=float)

    n = max(a.size, p.size, v.size, t.size)
    # Broadcast to same length when needed (if they are same length usually)
    def _broadcast(arr):
        if arr.size == n:
            return arr
        if arr.size == 1:
            return np.full(n, arr.item(), dtype=float)
        # attempt to pad/truncate
        out = np.full(n, np.nan, dtype=float)
        out[:min(arr.size, n)] = arr[:min(arr.size, n)]
        return out

    a = _broadcast(a)
    p = _broadcast(p)
    v = _broadcast(v)
    t = _broadcast(t)

    # Masks for valid (exclude fill and non-finite)
    valid_a = (a > FILL_VALUE) & np.isfinite(a)
    valid_p = (p > FILL_VALUE) & np.isfinite(p)
    valid_v = (v > FILL_VALUE) & np.isfinite(v)
    valid_t = (t > FILL_VALUE) & np.isfinite(t)

    # Alpha/proton ratio (avoid division by zero)
    alpha_proton_ratio = np.zeros(n, dtype=float)
    denom = p != 0
    valid_ratio = denom & valid_a & valid_p
    alpha_proton_ratio[valid_ratio] = a[valid_ratio] / p[valid_ratio]
    alpha_flag = np.zeros(n, dtype=bool)
    alpha_flag[valid_ratio] = alpha_proton_ratio[valid_ratio] > 0.08

    # Bulk speed threshold
    speed_flag = np.zeros(n, dtype=bool)
    speed_flag[valid_v] = v[valid_v] > 450.0

    # Temperature depression: compute only where v>0 and t valid
    temp_flag = np.zeros(n, dtype=bool)
    mask_temp = valid_v & (v > 0) & valid_t
    if np.any(mask_temp):
        v_masked = v[mask_temp]
        t_masked = t[mask_temp]
        T_exp = 3.0 * (v_masked / 100.0) ** 0.67 * 1e4
        T_obs = ((t_masked * 1000.0) ** 2) * m_p / (2.0 * k_B)
        finite_mask = np.isfinite(T_exp) & (T_exp > 0) & np.isfinite(T_obs)
        compare_mask = finite_mask & (T_obs < 0.5 * T_exp)
        temp_indices = np.nonzero(mask_temp)[0]
        temp_flag[temp_indices[compare_mask]] = True

    return alpha_flag, speed_flag, temp_flag


def compute_empirical_threshold(data, method='percentile', param=95, nan_fill_value=FILL_VALUE):
    """
    Compute an empirical threshold for a 1D data array or pandas Series.
    - method: 'percentile' or 'mean_sigma'
    - param: percentile (0-100) or number of sigma
    """
    arr = np.asarray(data, dtype=float)
    valid = (~np.isnan(arr)) & (arr != nan_fill_value) & np.isfinite(arr)
    clean = arr[valid]
    if clean.size == 0:
        raise ValueError("No valid data points for threshold computation.")

    if method == 'percentile':
        return np.percentile(clean, param)
    elif method == 'mean_sigma':
        mu = clean.mean()
        sigma = clean.std()
        return mu + param * sigma
    else:
        raise ValueError("method must be 'percentile' or 'mean_sigma'")

def _align_series_to_index(series_like, target_index):
    """
    Align a Series/1D-array to target_index length:
      - If series_like has same index (pandas Series): reindex to target_index
      - If it's a numpy array or Series with different length: pad with NaN or truncate
    Returns a pandas Series indexed by target_index.
    """
    # If pandas Series and index matches/overlaps, reindex (keeps values where possible)
    if isinstance(series_like, pd.Series):
        try:
            return series_like.reindex(target_index)
        except Exception:
            # fallback to length-based alignment
            arr = series_like.to_numpy()
    else:
        arr = np.asarray(series_like)

    n_target = len(target_index)
    out = np.full(n_target, np.nan, dtype=float)
    take = min(len(arr), n_target)
    out[:take] = arr[:take]
    return pd.Series(out, index=target_index)

def main(L1_AUX_path, L2_BLK_path, out_csv='final_output_01.csv'):
    # Load dataframes from CDFs
    print("Reading CDFs (this may take a moment)...")
    L1_AUX_data = cdf_to_csv(L1_AUX_path)
    L2_BLK_data = cdf_to_csv(L2_BLK_path)

    # Ensure required columns exist in L2_BLK_data (warn if missing but keep going)
    required = ['proton_density', 'proton_bulk_speed', 'proton_thermal', 'alpha_density']
    missing = [c for c in required if c not in L2_BLK_data.columns]
    if missing:
        raise KeyError(f"Missing required variables in L2_BLK CDF/converted DataFrame: {missing}")

    # Build results container indexed by L2_BLK (we treat L2 as the main timeline)
    final_output = pd.DataFrame(index=L2_BLK_data.index)

    # Continuous CME-like score (0-1-ish)
    final_output['score'] = calculate_cme_score(
        L2_BLK_data['proton_density'],
        L2_BLK_data['proton_bulk_speed'],
        L2_BLK_data['proton_thermal'],
        L2_BLK_data['alpha_density']
    )

    # Speed-based signatures (returns 4 items)
    scores, rapid_increases, accelerations, acceleration_changes = detect_cme_speed_signatures(
        L2_BLK_data['proton_bulk_speed']
    )
    final_output['speed_enhancement'] = scores
    final_output['rapid_increase'] = rapid_increases
    final_output['acceleration_flag'] = accelerations
    final_output['acceleration_changes'] = acceleration_changes

    # Threshold-based flags
    alpha_flag, speed_flag, temp_flag = detect_cme_thresholds(
        L2_BLK_data['alpha_density'],
        L2_BLK_data['proton_density'],
        L2_BLK_data['proton_bulk_speed'],
        L2_BLK_data['proton_thermal']
    )
    final_output['alpha_flag'] = alpha_flag
    final_output['speed_flag'] = speed_flag
    final_output['temp_flag'] = temp_flag

    # Compute empirical thresholds for sensible variables (returns dict)
    thresholds = {}
    for var in ['alpha_density', 'proton_density', 'proton_bulk_speed', 'proton_thermal']:
        if var in L2_BLK_data.columns:
            try:
                thresholds[var] = compute_empirical_threshold(L2_BLK_data[var], method='percentile', param=95)
            except ValueError:
                thresholds[var] = None

    # Requested AUX and BLK columns (de-duplicate lists)
    AUX_column = [
        'ESA1_HV_mon', 'ESA2_HV_mon', 'MCP2_HV_mon', 'DC_temp_mon', 'HV_PCB_temp_mon',
        'fpga_temp_mon', 'spacecraft_xpos', 'spacecraft_ypos', 'spacecraft_zpos',
        'spacecraft_xvel', 'spacecraft_yvel', 'spacecraft_zvel', 'MCP1_curr_mon',
        'MCP1_HV_mon', 'MCP2_HV_mon', 'FEE_volt_mon', 'operating_mode', 'auto_ctrl_mode'
    ]
    BLK_column = ['proton_bulk_speed', 'alpha_bulk_speed', 'proton_density', 'alpha_density', 'thermal_p_uncer']

    AUX_column_unique = list(dict.fromkeys(AUX_column))
    BLK_column_unique = list(dict.fromkeys(BLK_column))

    # Select columns from AUX and BLK (use NaN for missing columns)
    aux_sel = pd.DataFrame(index=L2_BLK_data.index)  # align to L2 index
    blk_sel = pd.DataFrame(index=L2_BLK_data.index)

    for col in AUX_column_unique:
        if col in L1_AUX_data.columns:
            # try to align by index; if lengths differ, broadcast/pad/truncate safely
            aux_sel[col] = _align_series_to_index(L1_AUX_data[col], L2_BLK_data.index)
        else:
            aux_sel[col] = np.nan

    for col in BLK_column_unique:
        if col in L2_BLK_data.columns:
            blk_sel[col] = _align_series_to_index(L2_BLK_data[col], L2_BLK_data.index)
        else:
            blk_sel[col] = np.nan

    # Combine everything: BLK selections, AUX selections, and the computed flags/scores
    # Note: final_output already carries the computed metrics and is indexed by L2_BLK_data.index
    combined = pd.concat([blk_sel, aux_sel, final_output], axis=1)

    # Reset index so time/index is saved as a column in CSV (rename 'index' -> 'timestamp' if desired)
    combined = combined.reset_index()

    # Save to CSV
    combined.to_csv(out_csv, index=False)

    return combined, thresholds


if __name__ == "__main__":
    # Example usage - update paths to your local files if needed
    L1_AUX = 'swis_2025Oct02T114501986/AL1_ASW91_L1_AUX_20250930_UNP_9999_999999_V01.cdf'
    L2_BLK = 'swis_2025Oct02T114501986/AL1_ASW91_L2_BLK_20250930_UNP_9999_999999_V02.cdf'
    try:
        result, threshold = main(L1_AUX, L2_BLK)
        print("Processing completed. Output saved to final_output_01.csv")
        print(f"Output shape: {result.shape}")
        print(f"Columns: {list(result.columns)}")
        print("Thresholds (95th percentile):", threshold)
    except Exception as e:
        print("Error during processing:", type(e).__name__, e)
