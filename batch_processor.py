#!/usr/bin/env python3
"""
Batch processor for large CSV files to avoid rate limits
"""

import csv
import os
import sys
import subprocess
import time
from typing import List

def split_csv(input_file: str, chunk_size: int = 10):
    """Split CSV into smaller chunks"""
    chunks = []
    
    with open(input_file, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader)  # Get header
        
        chunk = [header]
        chunk_count = 1
        
        for row in reader:
            chunk.append(row)
            
            if len(chunk) > chunk_size:
                # Write current chunk
                chunk_file = f"chunk_{chunk_count}.csv"
                with open(chunk_file, 'w', newline='', encoding='utf-8') as chunk_f:
                    writer = csv.writer(chunk_f)
                    writer.writerows(chunk)
                
                chunks.append(chunk_file)
                chunk = [header]  # Start new chunk with header
                chunk_count += 1
        
        # Write final chunk if it has data
        if len(chunk) > 1:
            chunk_file = f"chunk_{chunk_count}.csv"
            with open(chunk_file, 'w', newline='', encoding='utf-8') as chunk_f:
                writer = csv.writer(chunk_f)
                writer.writerows(chunk)
            chunks.append(chunk_file)
    
    return chunks

def process_chunks(chunks: List[str], delay: float = 5.0):
    """Process each chunk with the geocoding script"""
    all_results = []
    
    for i, chunk_file in enumerate(chunks, 1):
        print(f"\n🔄 Processing chunk {i}/{len(chunks)}: {chunk_file}")
        
        output_file = f"result_{i}.csv"
        
        # Run geocoding script on chunk
        cmd = [
            "python", "geocoding_script.py",
            "--input", chunk_file,
            "--output", output_file,
            "--delay", str(delay)
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ Chunk {i} processed successfully")
                all_results.append(output_file)
            else:
                print(f"❌ Error processing chunk {i}: {result.stderr}")
        except Exception as e:
            print(f"❌ Exception processing chunk {i}: {e}")
        
        # Clean up chunk file
        os.remove(chunk_file)
        
        # Wait between chunks
        if i < len(chunks):
            print(f"⏳ Waiting {delay} seconds before next chunk...")
            time.sleep(delay)
    
    return all_results

def combine_results(result_files: List[str], final_output: str):
    """Combine all result files into one"""
    if not result_files:
        print("No result files to combine")
        return
    
    all_data = []
    
    for result_file in result_files:
        if os.path.exists(result_file):
            with open(result_file, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                all_data.extend(list(reader))
            os.remove(result_file)  # Clean up
    
    if all_data:
        with open(final_output, 'w', newline='', encoding='utf-8') as file:
            fieldnames = all_data[0].keys()
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_data)
        
        print(f"🎉 Combined {len(all_data)} records into {final_output}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python batch_processor.py <input_csv> [chunk_size] [delay]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    chunk_size = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    delay = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
    
    print(f"📊 Splitting {input_file} into chunks of {chunk_size} rows...")
    chunks = split_csv(input_file, chunk_size)
    print(f"📦 Created {len(chunks)} chunks")
    
    print(f"🚀 Processing chunks with {delay}s delay...")
    result_files = process_chunks(chunks, delay)
    
    print(f"🔗 Combining {len(result_files)} result files...")
    combine_results(result_files, "final_geocoded_results.csv")
    
    print("✨ Batch processing complete!")

if __name__ == "__main__":
    main()
