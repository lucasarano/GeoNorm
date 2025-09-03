#!/usr/bin/env python3
"""
Geocoding Script using Gemini API
Reads addresses from CSV, geocodes them using Gemini API, and outputs results to a new CSV.
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

class GeocodingProcessor:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-pro"):
        """Initialize the geocoding processor with Gemini API configuration."""
        self.api_key = api_key
        self.model_name = model_name
        self.configure_gemini()
        
    def configure_gemini(self):
        """Configure the Gemini API client."""
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)
        
    def construct_prompt(self, address: str) -> str:
        """Construct a detailed prompt for the Gemini API to geocode an address."""
        prompt = f"""**Objective:** Geocode the following address and assess the confidence of the result.

**Address Information:**
- Full Address: "{address}"

**Task:**
1. Analyze the provided address. It may be incomplete or vague.
2. Determine the geographic coordinates (latitude and longitude).
3. Determine the correct ZIP code.
4. Provide a confidence score between 0.0 (no confidence) and 1.0 (certainty).
5. Provide a brief explanation for your confidence score.
6. If coordinates are found, generate a Google Maps link for them.

**Output Format:**
Return ONLY a single, minified JSON object with these keys: "latitude", "longitude", "zip_code", "confidence_score", "explanation", and "google_maps_link".

**Example 1 (Good Address):**
- Input: "1600 Amphitheatre Parkway, Mountain View, CA, 94043"
- Expected JSON: {{"latitude": 37.422, "longitude": -122.084, "zip_code": "94043", "confidence_score": 1.0, "explanation": "Address is complete and well-known.", "google_maps_link": "https://www.google.com/maps?q=37.422,-122.084"}}

**Example 2 (Bad Address):**
- Input: "the big house near the park, Bogota"
- Expected JSON: {{"latitude": 4.60971, "longitude": -74.08175, "zip_code": null, "confidence_score": 0.2, "explanation": "Information is too vague. Coordinates are for the center of Bogota.", "google_maps_link": "https://www.google.com/maps?q=4.60971,-74.08175"}}

Please geocode this address: "{address}" """
        
        return prompt
    
    def call_gemini_api(self, prompt: str) -> Optional[Dict]:
        """Call the Gemini API with the given prompt and return parsed JSON response."""
        try:
            print(f"Calling Gemini API...")
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
            required_fields = ['latitude', 'longitude', 'zip_code', 'confidence_score', 'explanation', 'google_maps_link']
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
            'Buyer Address', 'Address', 'Street Address', 'Street',
            'Buyer City', 'City', 
            'Buyer State', 'State', 'Province',
            'Buyer ZIP', 'ZIP', 'Postal Code', 'ZIP Code'
        ]
        
        for field in address_fields:
            if field in row and row[field] and str(row[field]).strip():
                address_parts.append(str(row[field]).strip())
        
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
            print(f"Results written to '{filename}'")
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
                    # Create a key from the address fields
                    address_key = self.combine_address_fields(row)
                    if address_key:
                        processed.add(address_key)
        except Exception as e:
            print(f"Warning: Could not read existing output file: {e}")
            
        return processed
    
    def process_addresses(self, input_file: str, output_file: str, delay: float = 1.0):
        """Main processing function to geocode addresses from CSV."""
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
            
            print(f"Row {i}/{len(rows)}: Processing address: {address}")
            
            # Construct prompt and call API
            prompt = self.construct_prompt(address)
            result = self.call_gemini_api(prompt)
            
            if result:
                # Add geocoding results to the row
                row['gemini_latitude'] = result.get('latitude')
                row['gemini_longitude'] = result.get('longitude')
                row['gemini_zip_code'] = result.get('zip_code')
                row['gemini_confidence'] = result.get('confidence_score')
                row['gemini_explanation'] = result.get('explanation')
                row['google_maps_link'] = result.get('google_maps_link')
                
                new_data.append(row)
                print(f"  -> Success: lat={result.get('latitude')}, lng={result.get('longitude')}, confidence={result.get('confidence_score')}")
            else:
                print(f"  -> Failed to geocode address")
                # Add empty geocoding fields for failed attempts
                row['gemini_latitude'] = None
                row['gemini_longitude'] = None
                row['gemini_zip_code'] = None
                row['gemini_confidence'] = None
                row['gemini_explanation'] = "Failed to geocode"
                row['google_maps_link'] = None
                new_data.append(row)
            
            # Add delay between API calls to avoid rate limiting
            if i < len(rows):
                time.sleep(delay)
        
        # Combine existing and new data
        all_data = existing_data + new_data
        
        # Write results
        if all_data:
            self.write_csv(all_data, output_file)
            print(f"\nProcessing complete!")
            print(f"Total rows processed: {len(rows)}")
            print(f"Skipped (already processed): {skipped_count}")
            print(f"Newly processed: {len(new_data)}")
            print(f"Total in output file: {len(all_data)}")
        else:
            print("No new data to write.")


def main():
    """Main function to handle command line arguments and run the geocoding process."""
    parser = argparse.ArgumentParser(description='Geocode addresses using Gemini API')
    parser.add_argument('--input', '-i', default='input_addresses.csv',
                       help='Input CSV file (default: input_addresses.csv)')
    parser.add_argument('--output', '-o', default='output_geocoded.csv',
                       help='Output CSV file (default: output_geocoded.csv)')
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
    
    # Initialize processor and run
    processor = GeocodingProcessor(api_key, args.model)
    processor.process_addresses(args.input, args.output, args.delay)


if __name__ == "__main__":
    main()
