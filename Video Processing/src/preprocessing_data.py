import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from spacepy import pycdf


def cdf_to_csv(cdf_path, csv_path, max_rows=None, pad_value=np.nan):
    """
    Convert a CDF to CSV handling multi-dimensional variables.
    - If a variable is 2D with shape (N, M) and N equals the chosen primary length, it expands to M columns.
    - If shapes don't match the primary length, shorter arrays are padded, longer arrays truncated.
    - mask arrays are filled with NaN.
    - max_rows: if set, will truncate the final DataFrame to that many rows.
    """
    cdf = pycdf.CDF(cdf_path)
    
    # read all variables first
    raw_vars = {}
    for var in cdf:
        arr = cdf[var][...]
        # convert masked arrays to normal arrays with NaN
        if hasattr(arr, 'filled'):
            arr = arr.filled(np.nan)
        arr = np.asarray(arr)
        raw_vars[var] = arr

    # determine a "primary length" (most likely the time dimension)
    lengths = []
    for arr in raw_vars.values():
        if arr.ndim == 0:
            lengths.append(1)
        else:
            # take first axis length
            lengths.append(arr.shape[0])
    primary_len = int(max(lengths)) if lengths else 0
    if primary_len == 0:
        raise ValueError("No data found in CDF.")

    # build columns
    columns = {}
    for name, arr in raw_vars.items():
        if arr.ndim == 0:
            # scalar: repeat to primary_len
            columns[name] = np.full(primary_len, arr.item(), dtype=object)
        elif arr.ndim == 1:
            # 1-D: pad or truncate to primary_len
            col = np.full(primary_len, pad_value, dtype=object)
            length = min(primary_len, arr.shape[0])
            col[:length] = arr[:length]
            columns[name] = col
        else:
            # multi-d array: try to align first axis with primary_len
            # if arr.shape[0] == primary_len, expand columns along axis 1
            if arr.shape[0] == primary_len:
                # expand second axis into separate columns
                # if more than 2 dims, flatten trailing dims into single dimension
                rest_shape = arr.shape[1:]
                ncols = int(np.prod(rest_shape))
                reshaped = arr.reshape((primary_len, ncols))
                for i in range(ncols):
                    col_name = f"{name}_{i}"
                    col = np.full(primary_len, pad_value, dtype=object)
                    col[:] = reshaped[:, i]
                    columns[col_name] = col
            elif arr.shape[-1] == primary_len:
                # maybe the time axis is the last axis; transpose then expand
                reshaped = np.moveaxis(arr, -1, 0)  # bring time axis to front
                ncols = int(np.prod(reshaped.shape[1:]))
                reshaped = reshaped.reshape((primary_len, ncols))
                for i in range(ncols):
                    col_name = f"{name}_{i}"
                    col = np.full(primary_len, pad_value, dtype=object)
                    col[:] = reshaped[:, i]
                    columns[col_name] = col
            else:
                # fallback: flatten whole array for each top index if possible
                # We'll create one column per row if first axis is >1 and <= primary_len,
                # else serialize each row to a string (safer).
                if arr.shape[0] <= primary_len:
                    # for row i, convert row to tuple/list and store
                    col = np.full(primary_len, pad_value, dtype=object)
                    for i in range(arr.shape[0]):
                        col[i] = arr[i].tolist()
                    columns[name] = col
                else:
                    # too many rows: truncate and serialize rows to lists
                    col = np.full(primary_len, pad_value, dtype=object)
                    for i in range(primary_len):
                        col[i] = arr[i].tolist()
                    columns[name] = col

    # build DataFrame
    df = pd.DataFrame(columns)

    # optional truncate to max_rows
    if max_rows is not None:
        df = df.iloc[:max_rows]

    # try to convert numpy datetime64 to pandas datetime if present
    for col in df.columns:
        if np.issubdtype(df[col].dtype, np.datetime64):
            df[col] = pd.to_datetime(df[col])

    # save to csv
    df.head(100).to_csv(csv_path, index=False)
    print(f"Saved CSV to: {csv_path} (rows: {len(df)})")


def calculate_cme_score(proton_density, proton_bulk_speed, proton_thermal, alpha_density):
    FILL_VALUE = -1.0e31
    k_B, m_p = 1.381e-23, 1.673e-27
    
    # Validity checks
    valid_proton = (proton_density > FILL_VALUE) & (proton_bulk_speed > FILL_VALUE)
    valid_alpha = alpha_density > FILL_VALUE
    valid_thermal = proton_thermal > FILL_VALUE
    
    # Initialize score
    cme_score = 0.0
    
    # Alpha ratio score (0.4 weight)
    if valid_proton and valid_alpha:
        alpha_ratio = alpha_density / proton_density
        cme_score += 0.4 * max(0, min(1, (alpha_ratio - 0.003) / 0.008))
    
    # Speed score (0.4 weight)
    if valid_proton:
        cme_score += 0.4 * max(0, min(1, (proton_bulk_speed - 380) / 200))
    
    # Temperature score (0.1 weight)
    if valid_proton and valid_thermal:
        T_exp = 3.0 * (proton_bulk_speed/100)**0.67 * 1e4
        T_obs = (proton_thermal * 1000)**2 * m_p / (2 * k_B)
        T_ratio = T_obs / T_exp
        if T_ratio < 0.5:
            cme_score += 0.1 * max(0, 1 - 2 * T_ratio)
    
    # Quality score (0.1 weight)
    valid_count = sum([valid_proton, valid_alpha, valid_thermal])
    cme_score += 0.1 * (valid_count / 3.0)
    
    return cme_score

def calculate_cme_score(proton_density, proton_bulk_speed, proton_thermal, alpha_density):
    """
    Vectorized CME score calculator that accepts pandas Series or numpy arrays.
    Returns a pandas Series of scores (same index as input if inputs are Series).
    """
    # convert to numpy arrays (keep index if pandas supplied)
    is_series = isinstance(proton_density, (pd.Series, pd.Index))
    idx = proton_density.index if is_series else None

    pd_arr = np.asarray(proton_density, dtype=float)
    v_arr = np.asarray(proton_bulk_speed, dtype=float)
    t_arr = np.asarray(proton_thermal, dtype=float)
    a_arr = np.asarray(alpha_density, dtype=float)

    FILL_VALUE = -1.0e31
    k_B, m_p = 1.381e-23, 1.673e-27

    # Validity masks
    valid_proton = (pd_arr > FILL_VALUE) & (v_arr > FILL_VALUE)
    valid_alpha  = (a_arr  > FILL_VALUE) 
    valid_thermal= (t_arr  > FILL_VALUE)

    # Start with zeros
    score = np.zeros_like(pd_arr, dtype=float)

    # --- Alpha ratio score (0.4 weight) ---
    # Avoid divide-by-zero: require proton_density > 0
    denom_ok = pd_arr > 0
    mask_alpha = valid_proton & valid_alpha & denom_ok
    alpha_ratio = np.zeros_like(pd_arr, dtype=float)
    alpha_ratio[mask_alpha] = a_arr[mask_alpha] / pd_arr[mask_alpha]
    # scaled into [0,1] where 0.003->0 and 0.011->1 (as in your original)
    alpha_scaled = np.clip((alpha_ratio - 0.003) / 0.008, 0, 1)
    score += 0.4 * alpha_scaled

    # --- Speed score (0.4 weight) ---
    mask_speed = valid_proton
    speed_scaled = np.zeros_like(pd_arr, dtype=float)
    speed_scaled[mask_speed] = np.clip((v_arr[mask_speed] - 380) / 200, 0, 1)
    score += 0.4 * speed_scaled

    # --- Temperature score (0.1 weight) ---
    # Use vector formulas; compute only where valid_proton & valid_thermal
    mask_temp = valid_proton & valid_thermal
    if np.any(mask_temp):
        # Expected temperature (T_exp) (matches your formula)
        T_exp = 3.0 * (v_arr[mask_temp] / 100.0) ** 0.67 * 1e4  # same units as original
        # Observed temperature (T_obs) using given relation
        # (proton_thermal * 1000)**2 * m_p / (2 * k_B)
        T_obs = ((t_arr[mask_temp] * 1000.0) ** 2) * m_p / (2.0 * k_B)
        # Avoid negative/zero T_exp
        safe_T_exp = np.where(T_exp > 0, T_exp, np.nan)
        T_ratio = T_obs / safe_T_exp
        # condition from original: if T_ratio < 0.5 then add 0.1 * (1 - 2*T_ratio) clipped to [0,0.1]
        temp_contrib = np.zeros_like(T_ratio)
        cond = T_ratio < 0.5
        temp_contrib[cond] = np.maximum(0.0, 1.0 - 2.0 * T_ratio[cond])  # in [0,1]
        score[mask_temp] += 0.1 * temp_contrib

    # --- Quality score (0.1 weight) ---
    valid_count = valid_proton.astype(int) + valid_alpha.astype(int) + valid_thermal.astype(int)
    score += 0.1 * (valid_count / 3.0)

    # Return pandas Series if input was Series, else numpy array
    if idx is not None:
        return pd.Series(score, index=idx)
    return score

def detect_cme_speed_signatures(proton_speeds):
    # Enhancement scores (same length)
    scores = np.maximum(0, np.minimum(1, (proton_speeds - 380) / 200))

    # Speed changes
    speed_changes = np.diff(proton_speeds, prepend=proton_speeds[0])
    rapid_increases = speed_changes > 5

    # Acceleration
    acceleration_changes = np.diff(speed_changes, prepend=speed_changes[0])
    accelerations = acceleration_changes > 2

    return scores

import numpy as np

def compute_empirical_threshold(BLK_data, method='percentile', param=95, nan_fill_value=-1e31):
    """
    Compute an empirical threshold for CME detection from a 1D data array.

    Parameters
    ----------
    data : array-like
        Input measurement array (e.g. alpha/proton ratio, proton speed).
    method : str, optional
        'percentile' or 'mean_sigma'. Default is 'percentile'.
    param : float, optional
        If method=='percentile', the percentile (0–100) to use.
        If method=='mean_sigma', the number of standard deviations (sigma).
    nan_fill_value : float, optional
        Value in data that indicates missing or fill; these are ignored.

    Returns
    -------
    threshold : float
        Computed threshold value.
    """
    arr = np.array(data, dtype=float)
    # Mask out fill values and NaNs
    valid = (~np.isnan(arr)) & (arr != nan_fill_value)
    clean = arr[valid]
    if clean.size == 0:
        raise ValueError("No valid data points")

    if method == 'percentile':
        # e.g. 95th percentile
        return np.percentile(clean, param)
    elif method == 'mean_sigma':
        # mean + param * std
        mu = clean.mean()
        sigma = clean.std()
        return mu + param * sigma
    else:
        raise ValueError("method must be 'percentile' or 'mean_sigma'")

# Example usage for your ASPEX-SWIS data:
# compute_empirical_threshold('L2_BLK.csv')
# import pandas as pd

# # Load L2_BLK.csv
    df = pd.read_csv(BLK_data)

    # 1. Alpha/proton ratio threshold at 90th percentile
    alpha_pr = df['alpha_density'] / df['proton_density']
    alpha_thr = compute_empirical_threshold(alpha_pr, method='percentile', param=90)
    print(f"Alpha/Proton ratio threshold (90th pct): {alpha_thr:.4f}")

    # 2. Proton speed threshold as mean + 2σ
    speed_thr = compute_empirical_threshold(df['proton_bulk_speed'], method='mean_sigma', param=2)
    print(f"Proton speed threshold (mean+2σ): {speed_thr:.1f} km/s")

    # 3. Temperature depression ratio threshold at 95th percentile
    # First compute temperature ratio array
    m_p = 1.673e-27
    k_B = 1.381e-23
    T_exp = 3.0 * (df['proton_bulk_speed'] / 100)**0.67 * 1e4
    T_obs = (df['proton_thermal'] * 1000)**2 * m_p / (2 * k_B)
    T_ratio = T_obs / T_exp
    temp_thr = compute_empirical_threshold(T_ratio, method='percentile', param=95)
    print(f"Temperature ratio threshold (95th pct): {temp_thr:.2f}")

