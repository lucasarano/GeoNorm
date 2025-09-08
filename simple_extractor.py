#!/usr/bin/env python3
"""
Simple CSV Field Extractor
Extracts Address, City, State, Phone from the standard CSV format
"""

import pandas as pd
import argparse
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def load_csv(input_file: str) -> pd.DataFrame:
    """Load CSV file and show column mapping"""
    try:
        df = pd.read_csv(input_file, encoding='utf-8')
        logger.info(f"✅ Loaded {len(df)} rows from {input_file}")
        
        # Show column mapping
        logger.info("\n📋 COLUMN MAPPING:")
        for i, col in enumerate(df.columns):
            logger.info(f"  {i:2d}: {col}")
        
        return df
    except Exception as e:
        logger.error(f"❌ Error loading file: {e}")
        raise

def extract_fields(df: pd.DataFrame) -> pd.DataFrame:
    """Extract the 4 required fields"""
    logger.info("\n🔍 EXTRACTING FIELDS:")
    
    # Show what we're extracting from each column
    logger.info("  Address  ← Buyer Address1")
    logger.info("  City     ← Buyer City") 
    logger.info("  State    ← Buyer State")
    logger.info("  Phone    ← Buyer Phone")
    
    # Extract the fields
    result = pd.DataFrame()
    result['Address'] = df['Buyer Address1'].fillna('')
    result['City'] = df['Buyer City'].fillna('')
    result['State'] = df['Buyer State'].fillna('')
    result['Phone'] = df['Buyer Phone'].fillna('')
    
    return result

def show_comparison(df: pd.DataFrame, extracted: pd.DataFrame, max_rows: int = 5):
    """Show side-by-side comparison"""
    logger.info(f"\n📊 COMPARISON (First {max_rows} rows):")
    logger.info("=" * 120)
    
    for i in range(min(max_rows, len(df))):
        logger.info(f"\nRow {i+1}:")
        logger.info(f"  Original Address1: '{df.iloc[i]['Buyer Address1']}'")
        logger.info(f"  Extracted Address: '{extracted.iloc[i]['Address']}'")
        logger.info(f"  Original City:     '{df.iloc[i]['Buyer City']}'")
        logger.info(f"  Extracted City:    '{extracted.iloc[i]['City']}'")
        logger.info(f"  Original State:    '{df.iloc[i]['Buyer State']}'")
        logger.info(f"  Extracted State:   '{extracted.iloc[i]['State']}'")
        logger.info(f"  Original Phone:    '{df.iloc[i]['Buyer Phone']}'")
        logger.info(f"  Extracted Phone:   '{extracted.iloc[i]['Phone']}'")
        logger.info("-" * 80)

def save_output(extracted: pd.DataFrame, output_file: str):
    """Save extracted data to CSV"""
    try:
        extracted.to_csv(output_file, index=False, encoding='utf-8')
        logger.info(f"\n💾 Saved {len(extracted)} rows to {output_file}")
    except Exception as e:
        logger.error(f"❌ Error saving file: {e}")
        raise

def main():
    parser = argparse.ArgumentParser(description='Extract Address, City, State, Phone from CSV')
    parser.add_argument('--in', dest='input_file', required=True, help='Input CSV file')
    parser.add_argument('--out', dest='output_file', required=True, help='Output CSV file')
    parser.add_argument('--rows', type=int, default=5, help='Number of rows to show in comparison (default: 5)')
    
    args = parser.parse_args()
    
    # Load CSV
    df = load_csv(args.input_file)
    
    # Extract fields
    extracted = extract_fields(df)
    
    # Show comparison
    show_comparison(df, extracted, args.rows)
    
    # Save output
    save_output(extracted, args.output_file)
    
    logger.info(f"\n✅ Extraction complete! Check {args.output_file}")

if __name__ == "__main__":
    main()
