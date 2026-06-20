import pandas as pd
import numpy as np
import argparse
import os
import glob

def assign_time_slot(dt):
    hour_str = f"{dt.hour:02d}"
    if dt.minute < 30:
        return f"{hour_str}:00-{hour_str}:30"
    else:
        next_hour_str = f"{(dt.hour + 1) % 24:02d}"
        if dt.hour == 23:
            return "23:30-00:00"
        return f"{hour_str}:30-{next_hour_str}:00"

def process_data(input_path, output_path, dataset_type="1min_traffic"):
    print(f"Loading data from {input_path} as type '{dataset_type}'...")
    df = pd.read_csv(input_path, sep=';', na_values=['null'])
    
    if dataset_type == "1min_traffic":
        df['datetime'] = pd.to_datetime(df['datum'] + ' ' + df['t_start'], format='%d.%m.%Y %H:%M:%S')
        df.sort_values(by=['devices', 'datetime'], inplace=True)
        numeric_cols = ['q_kfz', 'q_lkw', 'q_pkw', 'v_kfz']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        vol_cols = ['q_kfz', 'q_lkw', 'q_pkw']
        df[vol_cols] = df.groupby('devices')[vol_cols].transform(lambda x: x.interpolate(method='linear', limit=15))
        df[vol_cols] = df[vol_cols].fillna(0)
        df['date'] = df['datetime'].dt.strftime('%Y-%m-%d')
        df['time_slot'] = df['datetime'].apply(assign_time_slot)
        agg_funcs = {'q_kfz': 'sum', 'q_lkw': 'sum', 'q_pkw': 'sum', 'v_kfz': 'mean'}
        aggregated = df.groupby(['devices', 'date', 'time_slot']).agg(agg_funcs).reset_index()
        aggregated['v_kfz'] = aggregated['v_kfz'].round(2)
        
    elif dataset_type == "dauz_1h":
        df['datetime'] = pd.to_datetime(df['datum'] + ' ' + df['t_start'], format='%d.%m.%Y %H:%M:%S')
        df.sort_values(by=['devices', 'datetime'], inplace=True)
        numeric_cols = ['kfz_h', 'sv_h']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        # Interpolate only 1 hour (limit=1) before zeroing out
        df[numeric_cols] = df.groupby('devices')[numeric_cols].transform(lambda x: x.interpolate(method='linear', limit=1))
        df[numeric_cols] = df[numeric_cols].fillna(0)
        df['kfz_h'] = df['kfz_h'] / 2.0
        df['sv_h'] = df['sv_h'] / 2.0
        df_second_half = df.copy()
        df_second_half['datetime'] = df_second_half['datetime'] + pd.Timedelta(minutes=30)
        df_expanded = pd.concat([df, df_second_half], ignore_index=True)
        df_expanded['date'] = df_expanded['datetime'].dt.strftime('%Y-%m-%d')
        df_expanded['time_slot'] = df_expanded['datetime'].apply(assign_time_slot)
        agg_funcs = {'kfz_h': 'sum', 'sv_h': 'sum'}
        aggregated = df_expanded.groupby(['devices', 'date', 'time_slot']).agg(agg_funcs).reset_index()
        
    elif dataset_type == "lt_fbt":
        # Check if t_start is full datetime
        if 't_start' in df.columns:
            df['datetime'] = pd.to_datetime(df['t_start'], format='%Y-%m-%d %H:%M:%S', errors='coerce')
        else:
            raise ValueError(f"Missing 't_start' in {input_path}")
            
        df.sort_values(by=['datetime'], inplace=True)
        
        # metric col is either 'lt' or 'fbt'. We find it dynamically.
        metric_col = 'lt' if 'lt' in df.columns else 'fbt' if 'fbt' in df.columns else None
        if not metric_col:
            raise ValueError(f"Neither 'lt' nor 'fbt' column found in {input_path}")
            
        df[metric_col] = pd.to_numeric(df[metric_col], errors='coerce')
        # Interpolate up to 15 min
        df[metric_col] = df[metric_col].interpolate(method='linear', limit=15)
        # Drop remaining NaNs
        df = df.dropna(subset=[metric_col])
        
        df['date'] = df['datetime'].dt.strftime('%Y-%m-%d')
        df['time_slot'] = df['datetime'].apply(assign_time_slot)
        df['devices'] = os.path.basename(input_path).replace(".csv", "")
        
        agg_funcs = {metric_col: 'mean'}
        aggregated = df.groupby(['devices', 'date', 'time_slot']).agg(agg_funcs).reset_index()
        aggregated[metric_col] = aggregated[metric_col].round(2)
        
    else:
        raise ValueError(f"Unknown dataset_type: {dataset_type}")
        
    print(f"Saving ML-ready dataset to {output_path}...")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    aggregated.to_csv(output_path, index=False)

def process_directory(input_dir, output_dir, dataset_type="1min_traffic"):
    csv_files = glob.glob(os.path.join(input_dir, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {input_dir}")
        return
        
    os.makedirs(output_dir, exist_ok=True)
    
    for i, input_path in enumerate(csv_files):
        print(f"\n--- Processing file {i+1}/{len(csv_files)} ---")
        filename = os.path.basename(input_path)
        output_path = os.path.join(output_dir, filename.replace(".csv", "_ML_Ready.csv"))
        try:
            process_data(input_path, output_path, dataset_type)
        except Exception as e:
            print(f"Error processing {input_path}: {e}")

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_input_dir = os.path.join(BASE_DIR, "data", "raw", "2023-2025_1min_2+0_v")
    default_output_dir = os.path.join(BASE_DIR, "data", "clean", "2023-2025_1min_2+0_v")

    parser = argparse.ArgumentParser(description="Process minute-by-minute highway sensor data into 4-hour aggregated blocks.")
    parser.add_argument("--input", type=str, help="Path to a single input raw CSV file")
    parser.add_argument("--output", type=str, help="Path to save the processed ML-ready CSV file")
    parser.add_argument("--input_dir", type=str, default=default_input_dir, help="Path to a directory of raw CSV files")
    parser.add_argument("--output_dir", type=str, default=default_output_dir, help="Path to a directory to save processed CSV files")
    parser.add_argument("--dataset_type", type=str, default="1min_traffic", choices=["1min_traffic", "dauz_1h", "lt_fbt"], help="Type of dataset to process")
    
    args = parser.parse_args()
    
    if args.input_dir and args.output_dir:
        process_directory(args.input_dir, args.output_dir, args.dataset_type)
    elif args.input and args.output:
        process_data(args.input, args.output, args.dataset_type)
    else:
        print("Please provide either (--input and --output) OR (--input_dir and --output_dir)")
