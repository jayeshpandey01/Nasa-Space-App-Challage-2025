import cdflib
import spacepy.pycdf as pycdf
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta

def load_cdf(file_path):
    try:
        with cdflib.CDF(file_path) as cdf:
            variables = cdf.var_names()
            data = {}
            for var in variables:
                data[var] = cdf.varget(var)
                fillval = cdf.varattsget(var).get('FILLVAL', -1.0e31)
                if np.isscalar(data[var]):
                    continue
                data[var][data[var] == fillval] = np.nan
                if data[var].ndim > 1 and var not in ['sun_angle_tha1', 'sun_angle_tha2', 'angle_tha1', 'angle_tha2']:
                    data[var] = np.nanmean(data[var], axis=tuple(range(1, data[var].ndim)))
            return data
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return None

def prepare_data(image_path):
        image_data = pycdf.CDF(image_path)
        if 'L1_AUX' in image_path:
            df = pd.DataFrame({
                'epoch_for_cdf': image_data['epoch_for_cdf'][:, 0],
                'trig_counts': image_data['trig_counts'][:, 0, 0, 0],
                'coin_trig_counts': image_data['coin_trig_counts'][:, 0, 0],
                'coinc_trig_count_total': image_data['coinc_trig_count_total'][:, 0],
                'angle_tha1': image_data['angle_tha1'][:, 0, 0],
                'angle_tha2': image_data['angle_tha2'][:, 0, 0],
                'angle_xgse': image_data['angle_xgse'][:],
                'angle_ygse': image_data['angle_ygse'][:],
                'angle_zgse': image_data['angle_zgse'][:],
                'peak_det_counts': image_data['peak_det_counts'][:, 0, 0],
                'rej_counts': image_data['rej_counts'][:, 0, 0],
                'obs_time': image_data['obs_time'][:, 0],
                'spacecraft_xpos': image_data['spacecraft_xpos'][:],
                'spacecraft_xvel': image_data['spacecraft_xvel'][:],
                'spacecraft_ypos': image_data['spacecraft_ypos'][:],
                'spacecraft_yvel': image_data['spacecraft_yvel'][:],
                'spacecraft_zpos': image_data['spacecraft_zpos'][:],
                'spacecraft_zvel': image_data['spacecraft_zvel'][:]
            })
            return df

        elif 'L1_TH1' in image_path:
            df = pd.DataFrame({
                'epoch_for_cdf': image_data['epoch_for_cdf'][:, 0],
                'obs_time': image_data['obs_time'][:, 0],
                'THA-1_spec': image_data['THA-1_spec'],
                'fpga_ticks': image_data['fpga_ticks'],
                'frame_num': image_data['frame_num']
            })
            return df

        elif 'L2_BLK' in image_path:
            df = pd.DataFrame({
                'time': pd.to_datetime(image_data['epoch_for_cdf_mod'][:]),
                'proton_bulk_speed': image_data['proton_bulk_speed'][:],
                'alpha_bulk_speed': image_data['alpha_bulk_speed'][:],
                'alpha_density': image_data['alpha_density'][:],
                'alpha_thermal': image_data['alpha_thermal'][:],
                'proton_density': image_data['proton_density'][:],
                'proton_thermal': image_data['proton_thermal'][:],
                'proton_xvelocity': image_data['proton_xvelocity'][:],
                'proton_yvelocity': image_data['proton_yvelocity'][:],
                'proton_zvelocity': image_data['proton_zvelocity'][:],
                'spacecraft_xpos': image_data['spacecraft_xpos'][:],
                'spacecraft_ypos': image_data['spacecraft_ypos'][:],
                'spacecraft_zpos': image_data['spacecraft_zpos'][:]
            })
            return df

        elif 'L1_TH2' in image_path:
            df = pd.DataFrame({
                'epoch': image_data['epoch_for_cdf'][:, 0],
                'obs_time': image_data['obs_time'][:, 0],
                'fpga_ticks': image_data['fpga_ticks'][:],
                'frame_num': image_data['frame_num'][:],
                'tha2_spec': image_data['THA-2_spec'][:],
            })
            return df

        elif 'L2_TH1' in image_path:
            df = pd.DataFrame({
                'epoch': pd.to_datetime(image_data['epoch_for_cdf_mod'][:], unit='ms'),
                'spacecraft_xpos': image_data['spacecraft_xpos'][:],
                'spacecraft_ypos': image_data['spacecraft_ypos'][:],
                'spacecraft_zpos': image_data['spacecraft_zpos'][:]
            })

            # Energy bins
            energy_bins = image_data['energy_center_mod'][:]
            for i in range(energy_bins.shape[1]):
                df[f'flux_mod_E{i}'] = image_data['integrated_flux_mod'][:, i]
                df[f'flux_s9_E{i}'] = image_data['integrated_flux_s9_mod'][:, i]
                df[f'flux_s10_E{i}'] = image_data['integrated_flux_s10_mod'][:, i]
                df[f'flux_s11_E{i}'] = image_data['integrated_flux_s11_mod'][:, i]

            # Optional: flatten sun_angle_tha1 (16 sectors × 3 components)
            sun_angle = image_data['sun_angle_tha1'][:]  # shape: [N, 16, 3]
            for sector in range(sun_angle.shape[1]):
                for comp in range(3):
                    df[f'sun_angle_s{sector}_c{comp}'] = sun_angle[:, sector, comp]

            return df
        elif 'L2_TH2' in image_path:
            df = pd.DataFrame({
                'epoch': pd.to_datetime(image_data['epoch_for_cdf_mod'][:], unit='ms'),
                'spacecraft_xpos': image_data['spacecraft_xpos'][:],
                'spacecraft_ypos': image_data['spacecraft_ypos'][:],
                'spacecraft_zpos': image_data['spacecraft_zpos'][:]
            })

            # Energy bins
            energy_bins = image_data['energy_center_mod'][:]
            for i in range(energy_bins.shape[1]):
                df[f'flux_mod_E{i}'] = image_data['integrated_flux_mod'][:, i]
                df[f'flux_s15_E{i}'] = image_data['integrated_flux_s15_mod'][:, i]
                df[f'flux_s16_E{i}'] = image_data['integrated_flux_s16_mod'][:, i]
                df[f'flux_s17_E{i}'] = image_data['integrated_flux_s17_mod'][:, i]
                df[f'flux_s18_E{i}'] = image_data['integrated_flux_s18_mod'][:, i]
                df[f'flux_s19_E{i}'] = image_data['integrated_flux_s19_mod'][:, i]

            # Flatten sun_angle_tha2: [time, 32 sectors, 3 components]
            sun_angle = image_data['sun_angle_tha2'][:]
            for sector in range(sun_angle.shape[1]):
                for comp in range(3):
                    df[f'sun_angle_s{sector}_c{comp}'] = sun_angle[:, sector, comp]

            return df

        else:
            return None