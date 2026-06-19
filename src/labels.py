import pandas as pd
import numpy as np
import argparse
import os
import glob


def get_stau_points(row):
    q = row['q_kfz']
    v = row['v_kfz']

    # If no volume, or data is missing, it's not a stau
    if pd.isna(q) or q == 0 or pd.isna(v):
        return 0

    if v >= 80:
        return 0
    elif v >= 60:
        return 1
    elif v >= 40:
        return 2
    elif v >= 25:
        return 3
    else:
        return 4


def get_category(score):
    if pd.isna(score): return np.nan
    if score <= 30:
        return 1
    elif score <= 150:
        return 2
    elif score <= 400:
        return 3
    elif score <= 1000:
        return 4
    else:
        return 5


def process_file(input_path):
    print(f"Processing {input_path}...")
    df = pd.read_csv(input_path, sep=';', na_values=['null'])

    # Ensure numeric columns
    numeric_cols = ['q_kfz', 'v_kfz']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Calculate penalty points per minute
    df['stau_points'] = df.apply(get_stau_points, axis=1)

    # Identify valid measurements (sensor active)
    df['is_valid'] = ~df['q_kfz'].isna()

    # Format date properly (assuming format DD.MM.YYYY from raw)
    df['date'] = pd.to_datetime(df['datum'], format='%d.%m.%Y').dt.strftime('%Y-%m-%d')

    # Group by device and date
    grouped = df.groupby(['devices', 'date']).agg(
        stau_score=('stau_points', 'sum'),
        valid_mins=('is_valid', 'sum')
    ).reset_index()

    # Filter out days with less than 1000 valid minutes
    grouped.loc[grouped['valid_mins'] < 1000, 'stau_score'] = np.nan

    # Assign categories
    grouped['category'] = grouped['stau_score'].apply(get_category)

    # Drop intermediate valid_mins
    grouped.drop(columns=['valid_mins'], inplace=True)

    return grouped


def generate_daily_labels(input_dir, output_file):
    """
    Generate daily labels processing all CSVs in the input_dir and saving to output_file.
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
            all_labels.append(res)
        except Exception as e:
            print(f"Error processing {f}: {e}")

    if all_labels:
        final_df = pd.concat(all_labels, ignore_index=True)
        # Drop rows where stau_score is NaN due to insufficient data
        final_df.dropna(subset=['stau_score'], inplace=True)
        final_df['category'] = final_df['category'].astype(int)

        # Save
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        final_df.to_csv(output_file, index=False)
        print(f"\nSuccessfully saved labels to {output_file}")

        # Print summary
        print("\nLabel Distribution (Days per Category):")
        print(final_df['category'].value_counts().sort_index())
        return final_df
    return None


def main():
    parser = argparse.ArgumentParser(description="Calculate daily Stau-Score labels from 1-minute data.")
    parser.add_argument("--input_dir", type=str, default="data/rawdata/2023-2025_1min_2+0_v", help="Path to directory containing raw 1-min CSV files")
    parser.add_argument("--output_file", type=str, default="data/processed/daily_labels.csv", help="Path to output labels CSV file")
    
    args = parser.parse_args()
    generate_daily_labels(args.input_dir, args.output_file)


if __name__ == "__main__":
    main()
