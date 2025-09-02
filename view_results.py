#!/usr/bin/env python3
"""
Simple script to view the normalization results in a clean format
"""

import csv
import sys

def view_results(filename):
    with open(filename, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        print("=" * 100)
        print("ADDRESS NORMALIZATION RESULTS")
        print("=" * 100)
        
        for i, row in enumerate(reader, 1):
            print(f"\n📍 ROW {i}:")
            print(f"   Original:  {row.get('original_address', 'N/A')}")
            print(f"   Normalized: {row.get('normalized_address', 'N/A')}")
            print(f"   Quality: {row.get('address_quality', 'N/A')} | Confidence: {row.get('normalization_confidence', 'N/A')}")
            print(f"   Improvements: {row.get('improvements_made', 'N/A')}")
            print(f"   Missing: {row.get('missing_info', 'N/A')}")
            print("-" * 80)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        view_results(sys.argv[1])
    else:
        view_results("test_10_normalized.csv")
