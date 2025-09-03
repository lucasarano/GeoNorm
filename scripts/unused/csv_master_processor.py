#!/usr/bin/env python3
"""
CSV Master Processor
Handles CSV batch processing with address normalization and Google Maps geocoding
"""

import csv
import json
import os
import sys
import uuid
import time
from typing import Dict, List, Optional, Tuple
import tempfile
import shutil
from pathlib import Path
import google.generativeai as genai
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class CSVMasterProcessor:
    def __init__(self, api_key: str, google_maps_key: str, model_name: str = "gemini-2.5-pro"):
        """Initialize the CSV master processor."""
        self.api_key = api_key
        self.google_maps_key = google_maps_key
        self.model_name = model_name
        self.configure_gemini()
        
    def configure_gemini(self):
        """Configure the Gemini API client."""
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)
    
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
    
    def process_address_with_gemini(self, address: str) -> Optional[Dict]:
        """Process address with Gemini API for normalization and parsing."""
        prompt = f"""**Objective:** Normalize and parse the following address into structured components.

**Raw Address:**
"{address}"

**Task:**
1. First, normalize and improve the address (correct spelling, add missing info, standardize format)
2. Then, parse the normalized address into these components:
   - STATE (Department/State/Province)
   - CITY (City/Town/Municipality) 
   - STREET (Street name(s), including intersections, building names)
   - COUNTRY (Always "Paraguay" for these addresses)

**Rules:**
- COUNTRY is always "Paraguay"
- STATE should be the department (e.g., "Central", "Itapúa", "Alto Paraná")
- CITY should be the main city/town name
- STREET should include street names, intersections, building names, but NOT house numbers
- Remove house numbers, apartment numbers, postal codes from STREET
- Keep building names and landmarks in STREET
- Provide confidence score for the overall processing

**Output Format:**
Return ONLY a single, minified JSON object with these keys: 
"normalized_address", "state", "city", "street", "country", "confidence_score", "improvements_made", "address_quality".

Please process this address: "{address}" """
        
        try:
            print("[LLM] ------------------------------------------------------------")
            print(f"[LLM] Address: {address}")
            print("[LLM] Prompt (first 600 chars):\n" + (prompt[:600] + ("..." if len(prompt) > 600 else "")))
            response = self.model.generate_content(prompt)
            
            if not response.text:
                print("[LLM] Warning: Empty response.text from Gemini")
                return None
                
            # Try to extract JSON from the response
            response_text = response.text.strip()
            print("[LLM] Raw response (first 600 chars):\n" + (response_text[:600] + ("..." if len(response_text) > 600 else "")))
            
            # Look for JSON in the response
            if response_text.startswith('```json'):
                start = response_text.find('```json') + 7
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
                    print("[LLM] Extracted JSON from ```json block")
            elif response_text.startswith('```'):
                start = response_text.find('```') + 3
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
                    print("[LLM] Extracted JSON from ``` block")
            
            if '{' in response_text and '}' in response_text:
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                response_text = response_text[start:end]
                print("[LLM] Trimmed to outermost JSON braces")
            
            result = json.loads(response_text)
            print("[LLM] Parsed JSON successfully")
            
            # Validate required fields
            required_fields = ['normalized_address', 'state', 'city', 'street', 'country', 'confidence_score', 'improvements_made', 'address_quality']
            for field in required_fields:
                if field not in result:
                    print(f"[LLM] Warning: Missing field '{field}' in response; setting to None")
                    result[field] = None
            
            return result
            
        except Exception as e:
            print(f"[LLM] Error processing address with Gemini: {e}")
            return None
    
    def geocode_with_google_maps(self, address: str) -> Optional[Dict]:
        """Geocode address using Google Maps API."""
        try:
            url = f"https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'address': address,
                'key': self.google_maps_key
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            if data['status'] == 'OK' and data['results']:
                result = data['results'][0]
                location = result['geometry']['location']
                
                # Extract address components
                components = result['address_components']
                country = None
                postal_code = None
                city = None
                state = None
                
                for component in components:
                    types = component['types']
                    if 'country' in types:
                        country = component['long_name']
                    elif 'postal_code' in types:
                        postal_code = component['long_name']
                    elif 'locality' in types or 'administrative_area_level_2' in types:
                        city = component['long_name']
                    elif 'administrative_area_level_1' in types:
                        state = component['long_name']
                
                # Calculate confidence based on result type
                location_type = result['geometry']['location_type']
                confidence_map = {
                    'ROOFTOP': 1.0,
                    'RANGE_INTERPOLATED': 0.8,
                    'GEOMETRIC_CENTER': 0.6,
                    'APPROXIMATE': 0.4
                }
                confidence = confidence_map.get(location_type, 0.5)
                
                return {
                    'latitude': location['lat'],
                    'longitude': location['lng'],
                    'formatted_address': result['formatted_address'],
                    'country': country,
                    'postal_code': postal_code,
                    'city': city,
                    'state': state,
                    'location_type': location_type,
                    'confidence_score': confidence,
                    'google_maps_link': f"https://www.google.com/maps?q={location['lat']},{location['lng']}"
                }
            else:
                print(f"Geocoding failed: {data.get('status', 'Unknown error')}")
                return None
                
        except Exception as e:
            print(f"Error geocoding with Google Maps: {e}")
            return None
    
    def process_csv_batch(self, rows: List[Dict], batch_num: int, total_batches: int) -> List[Dict]:
        """Process a batch of CSV rows."""
        processed_rows = []
        
        for i, row in enumerate(rows):
            # Progress info
            print(f"[BATCH] Processing batch {batch_num}/{total_batches}, row {i+1}/{len(rows)}")
            
            # Get original address
            address = self.combine_address_fields(row)
            
            if not address:
                print(f"[BATCH] No address found for row {i+1}")
                row.update({
                    'original_address': '',
                    'normalized_address': '',
                    'processed_state': '',
                    'processed_city': '',
                    'processed_street': '',
                    'processed_country': '',
                    'processing_confidence': 0.0,
                    'improvements_made': 'No address found',
                    'address_quality': 'None',
                    'google_latitude': '',
                    'google_longitude': '',
                    'google_formatted_address': '',
                    'google_confidence': 0.0,
                    'google_maps_link': ''
                })
                processed_rows.append(row)
                continue
            
            print(f"[BATCH] Processing: {address}")
            
            # Step 1: Process with Gemini (normalize + parse)
            gemini_result = self.process_address_with_gemini(address)
            
            if gemini_result:
                print("[BATCH] LLM result: state=", gemini_result.get('state'), 
                      " city=", gemini_result.get('city'), 
                      " street=", gemini_result.get('street'))
                row.update({
                    'original_address': address,
                    'normalized_address': gemini_result.get('normalized_address', ''),
                    'processed_state': gemini_result.get('state', ''),
                    'processed_city': gemini_result.get('city', ''),
                    'processed_street': gemini_result.get('street', ''),
                    'processed_country': gemini_result.get('country', ''),
                    'processing_confidence': gemini_result.get('confidence_score', 0.0),
                    'improvements_made': gemini_result.get('improvements_made', ''),
                    'address_quality': gemini_result.get('address_quality', '')
                })
                
                # Step 2: Geocode with Google Maps using normalized address
                geocoding_result = self.geocode_with_google_maps(gemini_result.get('normalized_address', address))
                
                if geocoding_result:
                    row.update({
                        'google_latitude': geocoding_result.get('latitude', ''),
                        'google_longitude': geocoding_result.get('longitude', ''),
                        'google_formatted_address': geocoding_result.get('formatted_address', ''),
                        'google_confidence': geocoding_result.get('confidence_score', 0.0),
                        'google_maps_link': geocoding_result.get('google_maps_link', '')
                    })
                    print(f"[BATCH] Geocoded: {geocoding_result.get('latitude')}, {geocoding_result.get('longitude')}")
                else:
                    row.update({
                        'google_latitude': '',
                        'google_longitude': '',
                        'google_formatted_address': '',
                        'google_confidence': 0.0,
                        'google_maps_link': ''
                    })
                    print(f"[BATCH] Geocoding failed")
            else:
                # Failed to process with Gemini
                row.update({
                    'original_address': address,
                    'normalized_address': address,
                    'processed_state': '',
                    'processed_city': '',
                    'processed_street': '',
                    'processed_country': '',
                    'processing_confidence': 0.0,
                    'improvements_made': 'Failed to process',
                    'address_quality': 'Unknown',
                    'google_latitude': '',
                    'google_longitude': '',
                    'google_formatted_address': '',
                    'google_confidence': 0.0,
                    'google_maps_link': ''
                })
                print(f"[BATCH] Gemini processing failed")
            
            processed_rows.append(row)
            
            # Add delay to avoid rate limits
            time.sleep(1.0)
        
        return processed_rows
    
    def process_csv_file(self, input_file_path: str, output_file_path: str, batch_size: int = 10) -> bool:
        """Process entire CSV file in batches."""
        try:
            print('Reading CSV file...')
            
            # Read CSV file
            with open(input_file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                rows = list(reader)
            
            if not rows:
                print('No data found in CSV file')
                return False
            
            total_rows = len(rows)
            total_batches = (total_rows + batch_size - 1) // batch_size
            
            print(f'Processing {total_rows} rows in {total_batches} batches')
            
            # Process in batches
            all_processed_rows = []
            
            for batch_num in range(total_batches):
                start_idx = batch_num * batch_size
                end_idx = min(start_idx + batch_size, total_rows)
                batch_rows = rows[start_idx:end_idx]
                
                current_batch = batch_num + 1
                print(f"PROGRESS:{current_batch}:{total_batches}:Processing batch {current_batch}/{total_batches}")
                print(f"\n--- Starting Batch {current_batch}/{total_batches} ---")
                
                processed_batch = self.process_csv_batch(
                    batch_rows, 
                    current_batch, 
                    total_batches
                )
                
                all_processed_rows.extend(processed_batch)
                print(f"--- Completed Batch {current_batch}/{total_batches} ---\n")
            
            # Write output CSV
            print(f"PROGRESS:{total_batches}:{total_batches}:Writing output CSV...")
            print('Writing output CSV...')
            
            if all_processed_rows:
                with open(output_file_path, 'w', newline='', encoding='utf-8') as file:
                    fieldnames = all_processed_rows[0].keys()
                    writer = csv.DictWriter(file, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(all_processed_rows)
            
            print(f'Successfully processed {total_rows} addresses')
            return True
            
        except Exception as e:
            print(f'Error processing CSV: {str(e)}')
            return False


def main():
    """Main function for testing."""
    if len(sys.argv) < 3:
        print("Usage: python csv_master_processor.py <input_file> <output_file> [task_id]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    task_id = sys.argv[3] if len(sys.argv) > 3 else str(uuid.uuid4())
    
    print(f"Task ID: {task_id}")
    print(f"Input file: {input_file}")
    print(f"Output file: {output_file}")
    
    # Get API keys
    gemini_key = os.getenv('GEMINI_API_KEY')
    google_maps_key = os.getenv('GOOGLE_MAPS_API_KEY') or os.getenv('VITE_GOOGLE_MAPS_API_KEY')
    
    if not gemini_key:
        print("Error: GEMINI_API_KEY not found in environment variables")
        sys.exit(1)
        
    if not google_maps_key:
        print("Error: GOOGLE_MAPS_API_KEY not found in environment variables")
        sys.exit(1)
    
    # Create processor
    processor = CSVMasterProcessor(gemini_key, google_maps_key)
    
    # Process file
    success = processor.process_csv_file(input_file, output_file)
    
    if success:
        print(f"Processing completed successfully: {output_file}")
    else:
        print("Processing failed")
        sys.exit(1)


if __name__ == "__main__":
    main()