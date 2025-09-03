#!/usr/bin/env python3
"""
Address Normalization Script using Gemini API
Reads addresses from CSV, normalizes and improves them using Gemini API, and outputs cleaned addresses.
"""

import csv
import json
import os
import sys
import argparse
import time
from typing import Dict, List, Optional, Tuple
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class AddressNormalizer:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-pro"):
        """Initialize the address normalizer with Gemini API configuration."""
        self.api_key = api_key
        self.model_name = model_name
        self.configure_gemini()
        
    def configure_gemini(self):
        """Configure the Gemini API client."""
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)
        
    def construct_normalization_prompt(self, address: str) -> str:
        """Construct a detailed prompt for the Gemini API to normalize an address."""
        prompt = f""" You are an expert Paraguayan address normalization API. Your task is to convert a raw Paraguayan address string into a structured JSON object.

Rules:

Context: All addresses are in Paraguay. Use knowledge of Paraguayan geography (cities, departments) to enrich the data.

Abbreviations:

c/, casi -> "y casi" (near intersection).

esq., esquina -> "y" (corner intersection).

Enrichment:

Infer missing departments from the city.

Standardize common names (e.g., "Mcal." to "Mariscal").

Clean extraneous text.

Output Format: You MUST return only a valid JSON object with these exact keys: street_name_and_number, city, department, original_address, Maps_query.

Maps_query: This should be a clean, single-line string optimized for the Google Maps API, ending with ", Paraguay".

Example:

Input: "Av. Mcal. Lopez c/ Gral. Santos, Asunción"

Output:

{
  "street_name_and_number": "Avenida Mariscal Lopez y casi General Santos",
  "city": "Asunción",
  "department": "Distrito Capital",
  "original_address": "Av. Mcal. Lopez c/ Gral. Santos, Asunción",
  "google_maps_query": "Avenida Mariscal Lopez y casi General Santos, Asunción, Paraguay"
}
 """
        
        return prompt
    
    def call_gemini_api(self, prompt: str) -> Optional[Dict]:
        """Call the Gemini API with the given prompt and return parsed JSON response."""
        try:
            print(f"Calling Gemini API for normalization...")
            response = self.model.generate_content(prompt)
            
            if not response.text:
                print("Warning: Empty response from Gemini API")
                return None
                
            # Try to extract JSON from the response
            response_text = response.text.strip()
            
            # Look for JSON in the response (it might be wrapped in markdown or other text)
            if response_text.startswith('```json'):
                # Extract JSON from markdown code block
                start = response_text.find('```json') + 7
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
            elif response_text.startswith('```'):
                # Extract JSON from generic code block
                start = response_text.find('```') + 3
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
            
            # Try to find JSON object in the text
            if '{' in response_text and '}' in response_text:
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                response_text = response_text[start:end]
            
            # Parse the JSON
            result = json.loads(response_text)
            
            # Validate required fields
            required_fields = ['normalized_address', 'confidence_score', 'improvements_made', 'missing_info', 'address_quality']
            for field in required_fields:
                if field not in result:
                    print(f"Warning: Missing field '{field}' in API response")
                    result[field] = None
            
            return result
            
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON response: {e}")
            print(f"Raw response: {response.text if 'response' in locals() else 'No response'}")
            return None
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            return None
    
    def combine_address_fields(self, row: Dict) -> str:
        """Combine address fields from CSV row into a single address string."""
        address_parts = []
        
        # Common address field names to look for
        address_fields = [
            'Buyer Address1', 'Buyer Address1 Number', 'Buyer Address2', 'Buyer Address3',
            'Buyer City', 'Buyer State', 'Buyer ZIP'
        ]
        
        for field in address_fields:
            if field in row and row[field] and str(row[field]).strip():
                value = str(row[field]).strip()
                # Skip obviously invalid values
                if value.lower() not in ['xxx', '0000', 'null', 'none', '']:
                    address_parts.append(value)
        
        # Join with commas and clean up
        combined = ', '.join(address_parts)
        return combined.strip()
    
    def read_csv(self, filename: str) -> List[Dict]:
        """Read CSV file and return list of dictionaries."""
        try:
            with open(filename, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                return list(reader)
        except FileNotFoundError:
            print(f"Error: Input file '{filename}' not found.")
            sys.exit(1)
        except Exception as e:
            print(f"Error reading CSV file: {e}")
            sys.exit(1)
    
    def write_csv(self, data: List[Dict], filename: str):
        """Write data to CSV file."""
        if not data:
            print("No data to write.")
            return
            
        try:
            with open(filename, 'w', newline='', encoding='utf-8') as file:
                fieldnames = data[0].keys()
                writer = csv.DictWriter(file, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(data)
            print(f"Normalized addresses written to '{filename}'")
        except Exception as e:
            print(f"Error writing CSV file: {e}")
            sys.exit(1)
    
    def get_processed_addresses(self, output_file: str) -> set:
        """Get set of already processed addresses from output file."""
        processed = set()
        
        if not os.path.exists(output_file):
            return processed
            
        try:
            with open(output_file, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    # Create a key from the original address fields
                    address_key = self.combine_address_fields(row)
                    if address_key:
                        processed.add(address_key)
        except Exception as e:
            print(f"Warning: Could not read existing output file: {e}")
            
        return processed
    
    def normalize_addresses(self, input_file: str, output_file: str, delay: float = 1.0):
        """Main processing function to normalize addresses from CSV."""
        print(f"Reading input file: {input_file}")
        rows = self.read_csv(input_file)
        
        if not rows:
            print("No data found in input file.")
            return
        
        print(f"Found {len(rows)} rows to process.")
        
        # Get already processed addresses
        processed_addresses = self.get_processed_addresses(output_file)
        print(f"Found {len(processed_addresses)} already processed addresses.")
        
        # Read existing output data if file exists
        existing_data = []
        if os.path.exists(output_file):
            existing_data = self.read_csv(output_file)
        
        # Process each row
        new_data = []
        skipped_count = 0
        
        for i, row in enumerate(rows, 1):
            address = self.combine_address_fields(row)
            
            if not address:
                print(f"Row {i}: No address information found, skipping.")
                continue
                
            if address in processed_addresses:
                print(f"Row {i}: Address already processed, skipping.")
                skipped_count += 1
                continue
            
            print(f"Row {i}/{len(rows)}: Normalizing address: {address}")
            
            # Construct prompt and call API
            prompt = self.construct_normalization_prompt(address)
            result = self.call_gemini_api(prompt)
            
            if result:
                # Add normalization results to the row
                row['original_address'] = address
                row['normalized_address'] = result.get('normalized_address')
                row['normalization_confidence'] = result.get('confidence_score')
                row['improvements_made'] = result.get('improvements_made')
                row['missing_info'] = result.get('missing_info')
                row['address_quality'] = result.get('address_quality')
                
                new_data.append(row)
                print(f"  -> Success: {result.get('normalized_address')}")
                print(f"  -> Quality: {result.get('address_quality')}, Confidence: {result.get('confidence_score')}")
            else:
                print(f"  -> Failed to normalize address")
                # Add empty normalization fields for failed attempts
                row['original_address'] = address
                row['normalized_address'] = address  # Keep original if normalization fails
                row['normalization_confidence'] = 0.0
                row['improvements_made'] = "Failed to normalize"
                row['missing_info'] = "Unknown"
                row['address_quality'] = "Unknown"
                new_data.append(row)
            
            # Add delay between API calls to avoid rate limiting
            if i < len(rows):
                time.sleep(delay)
        
        # Combine existing and new data
        all_data = existing_data + new_data
        
        # Write results
        if all_data:
            self.write_csv(all_data, output_file)
            print(f"\nNormalization complete!")
            print(f"Total rows processed: {len(rows)}")
            print(f"Skipped (already processed): {skipped_count}")
            print(f"Newly processed: {len(new_data)}")
            print(f"Total in output file: {len(all_data)}")
        else:
            print("No new data to write.")


def main():
    """Main function to handle command line arguments and run the normalization process."""
    parser = argparse.ArgumentParser(description='Normalize addresses using Gemini API')
    parser.add_argument('--input', '-i', default='input_addresses.csv',
                       help='Input CSV file (default: input_addresses.csv)')
    parser.add_argument('--output', '-o', default='normalized_addresses.csv',
                       help='Output CSV file (default: normalized_addresses.csv)')
    parser.add_argument('--delay', '-d', type=float, default=1.0,
                       help='Delay between API calls in seconds (default: 1.0)')
    parser.add_argument('--api-key', '-k',
                       help='Gemini API key (overrides environment variable)')
    parser.add_argument('--model', '-m', default='gemini-1.5-flash',
                       help='Gemini model name (default: gemini-1.5-flash)')
    
    args = parser.parse_args()
    
    # Get API key from argument or environment variable
    api_key = args.api_key or os.getenv('GEMINI_API_KEY')
    
    if not api_key:
        print("Error: Gemini API key not provided.")
        print("Please set GEMINI_API_KEY environment variable or use --api-key argument.")
        sys.exit(1)
    
    # Initialize normalizer and run
    normalizer = AddressNormalizer(api_key, args.model)
    normalizer.normalize_addresses(args.input, args.output, args.delay)


if __name__ == "__main__":
    main()
