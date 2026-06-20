import pandas as pd
import numpy as np
import argparse
import os
import glob

def get_category(v):
    """Map 4-hour average speed to Category 1-5"""
    if pd.isna(v):
        return np.nan
    if v >= 80:
        return 1
    elif v >= 60:
        return 2
    elif v >= 40:
        return 3
    elif v >= 25:
        return 4
    else:
        return 5

def process_file(input_path):
    print(f"Processing {input_path}...")
    df = pd.read_csv(input_path)

    # We expect clean data to already have 'devices', 'date', 'time_slot', and 'v_kfz'
    if 'v_kfz' not in df.columns:
        # If dataset lacks speed, we skip or handle differently (like DAUZ or LT_FBT)
        # For DAUZ, we might not have v_kfz. Just returning None if it's missing.
        print(f"Skipping {input_path}: no 'v_kfz' column found.")
        return None

    # Calculate category from the 4-hour average speed
    df['category'] = df['v_kfz'].apply(get_category)
    
    # Select only the relevant label columns
    if 'devices' in df.columns:
        result = df[['devices', 'date', 'time_slot', 'v_kfz', 'category']].copy()
    else:
        # For LT/FBT data without devices column
        result = df[['date', 'time_slot', 'v_kfz', 'category']].copy()
        
    return result

def generate_daily_labels(input_dir, output_file):
    """
    Generate labels processing all CSVs in the input_dir and saving to output_file.
    Can be called directly from other Python scripts.
    """
    csv_files = glob.glob(os.path.join(input_dir, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {input_dir}")
        return None

    all_labels = []
    for f in csv_files:
        try:
            res = process_file(f)
            if res is not None:
                all_labels.append(res)
        except Exception as e:
            print(f"Error processing {f}: {e}")

    if all_labels:
        final_df = pd.concat(all_labels, ignore_index=True)
        # Drop rows where category is NaN
        final_df.dropna(subset=['category'], inplace=True)
        final_df['category'] = final_df['category'].astype(int)

        # Save
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        final_df.to_csv(output_file, index=False)
        print(f"\nSuccessfully saved labels to {output_file}")

        # Print summary
        print("\nLabel Distribution (4-hour blocks per Category):")
        print(final_df['category'].value_counts().sort_index())
        return final_df
    return None

def main():
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_input = os.path.join(BASE_DIR, "data", "clean", "2023-2025_1min_2+0_v")
    default_output = os.path.join(BASE_DIR, "data", "processed", "daily_labels.csv")

    parser = argparse.ArgumentParser(description="Calculate Stau Categories from clean 30 minutes data.")
    parser.add_argument("--input_dir", type=str, default=default_input, help="Path to directory containing clean 4-hour CSV files")
    parser.add_argument("--output_file", type=str, default=default_output, help="Path to output labels CSV file")
    
    args = parser.parse_args()
    generate_daily_labels(args.input_dir, args.output_file)

if __name__ == "__main__":
    main()
