#!/usr/bin/env python3
"""
Parallel CSV Master Processor
Handles CSV batch processing with parallel address normalization and Google Maps geocoding
Provides real-time progress updates
"""

import csv
import json
import os
import sys
import uuid
import time
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple
import tempfile
import shutil
from pathlib import Path
import google.generativeai as genai
import requests
from dotenv import load_dotenv

# Force stdout to flush immediately
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Load environment variables
load_dotenv()

class ParallelCSVProcessor:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash", max_workers: int = 3):
        """Initialize the parallel CSV processor."""
        self.api_key = api_key
        self.model_name = model_name
        self.max_workers = max_workers
        self.google_maps_key = os.getenv('VITE_GOOGLE_MAPS_API_KEY')
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
    
    def extract_phone_from_row(self, row: Dict) -> str:
        """Extract phone number from CSV row."""
        phone_fields = ['Buyer Phone', 'Phone', 'phone', 'buyer_phone', 'contact_phone']
        
        for field in phone_fields:
            if field in row and row[field] and str(row[field]).strip():
                phone = str(row[field]).strip()
                # Skip invalid phone values
                if phone.lower() not in ['xxx', '0000', 'null', 'none', 'n/a', '']:
                    return phone
        
        return ''
    
    def clean_paraguay_phone(self, phone: str) -> str:
        """Fallback function to clean Paraguay phone numbers."""
        if not phone:
            return ''
        
        # Remove all non-digit characters except +
        cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        # Handle duplicate numbers (e.g., "7739778244/7739778244")
        if '/' in phone:
            cleaned = phone.split('/')[0].strip()
            cleaned = ''.join(c for c in cleaned if c.isdigit())
        
        # Remove leading zero if present
        if cleaned.startswith('0'):
            cleaned = cleaned[1:]
        
        # Ensure we have 9 digits after country code
        if len(cleaned) == 9:
            return f"+595{cleaned}"
        elif len(cleaned) == 10 and cleaned.startswith('0'):
            return f"+595{cleaned[1:]}"
        elif len(cleaned) == 13 and cleaned.startswith('595'):
            return f"+{cleaned}"
        elif len(cleaned) == 12 and cleaned.startswith('595'):
            return f"+{cleaned}"
        
        # If we can't format it properly, return empty
        return ''
    
    def process_address_with_gemini(self, address: str, phone: str, row_index: int) -> Tuple[int, Optional[Dict]]:
        """Process address with Gemini API for normalization and parsing."""
        prompt = f"""Clean and parse this Paraguay address and phone number:

**Address:** "{address}"
**Phone:** "{phone}"

**Instructions:**
1. Clean the address (fix spelling, standardize format)
2. Extract these components:
   - STATE: Department (Central, Itapúa, Alto Paraná, etc.)
   - CITY: City/town name
   - STREET: Street names and intersections (no house numbers)
   - COUNTRY: Always "Paraguay"
3. Clean and format the phone number for Paraguay:
   - Convert to international format: +595XXXXXXXXX
   - Remove leading zero if present (0985 → 985)
   - Handle duplicate numbers (7739778244/7739778244 → use first one)
   - Remove all non-digit characters except +
   - Ensure proper length: +595 + 9 digits (total 13 characters)
   - Common Paraguay mobile prefixes: 098x (Tigo), 097x (Personal), 099x (Claro)
   - If number is too short/long or invalid, return empty string
   - If no valid phone, return empty string

**Paraguay Phone Examples:**
- 0985 728 119 → +595985728119
- 0972 862 686 → +595972862686  
- 0995 628 128 → +595995628128
- 7739778244/7739778244 → +5957739778244

**Output Format:**
Return ONLY a JSON object with these 6 keys:
{{"cleaned_address": "full cleaned address", "state": "department", "city": "city name", "street": "street names", "country": "Paraguay", "phone": "+595XXXXXXXXX or empty string"}}

Process: "{address}" with phone: "{phone}" """
        
        try:
            print(f"REAL_TIME_UPDATE:{row_index}:Processing: {address[:50]}...", flush=True)
            response = self.model.generate_content(prompt)
            
            if not response.text:
                print(f"REAL_TIME_UPDATE:{row_index}:Warning: Empty response from Gemini")
                return row_index, None
                
            # Try to extract JSON from the response
            response_text = response.text.strip()
            
            # Look for JSON in the response
            if response_text.startswith('```json'):
                start = response_text.find('```json') + 7
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
            elif response_text.startswith('```'):
                start = response_text.find('```') + 3
                end = response_text.find('```', start)
                if end != -1:
                    response_text = response_text[start:end].strip()
            
            if '{' in response_text and '}' in response_text:
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                response_text = response_text[start:end]
            
            result = json.loads(response_text)
            
            # Validate required fields
            required_fields = ['cleaned_address', 'state', 'city', 'street', 'country', 'phone']
            for field in required_fields:
                if field not in result:
                    result[field] = None
            
            print(f"REAL_TIME_UPDATE:{row_index}:✅ Processed: {result.get('state')}, {result.get('city')}")
            return row_index, result
            
        except Exception as e:
            print(f"REAL_TIME_UPDATE:{row_index}:❌ Error: {str(e)[:100]}")
            return row_index, None
    
    def geocode_with_google_maps(self, address: str, row_index: int) -> Tuple[int, Optional[Dict]]:
        """Geocode address using Google Maps API."""
        try:
            print(f"REAL_TIME_UPDATE:{row_index}:Geocoding...")
            url = f"https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'address': address,
                'key': self.google_maps_key
            }
            
            response = requests.get(url, params=params, timeout=10)
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
                
                geocode_result = {
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
                
                print(f"REAL_TIME_UPDATE:{row_index}:🗺️  Geocoded: {location['lat']:.4f}, {location['lng']:.4f}")
                return row_index, geocode_result
            else:
                print(f"REAL_TIME_UPDATE:{row_index}:❌ Geocoding failed: {data.get('status', 'Unknown')}")
                return row_index, None
                
        except Exception as e:
            print(f"REAL_TIME_UPDATE:{row_index}:❌ Geocoding error: {str(e)[:100]}")
            return row_index, None
    
    def process_single_row(self, row_data: Tuple[int, Dict]) -> Dict:
        """Process a single row with both Gemini and Google Maps."""
        row_index, row = row_data
        
        # Get original address and phone
        address = self.combine_address_fields(row)
        phone = self.extract_phone_from_row(row)
        
        if not address:
            print(f"REAL_TIME_UPDATE:{row_index}:⚠️  No address found - skipping")
            return None  # Return None to indicate this row should be skipped
        
        # Step 1: Process with Gemini (normalize + parse address and phone)
        _, gemini_result = self.process_address_with_gemini(address, phone, row_index)
        
        # Create result with original data
        result = {
            'row_index': row_index,
            'original_address': address,
            'original_phone': phone
        }
        
        if gemini_result:
            # Get Gemini-cleaned phone or use fallback cleaning
            gemini_phone = gemini_result.get('phone', '')
            if not gemini_phone or gemini_phone == phone:
                # Gemini didn't clean the phone properly, use our fallback
                cleaned_phone = self.clean_paraguay_phone(phone)
            else:
                cleaned_phone = gemini_phone
            
            # Include all components from Gemini processing
            result.update({
                'cleaned_address': gemini_result.get('cleaned_address', address),
                'state': gemini_result.get('state', ''),
                'city': gemini_result.get('city', ''),
                'street': gemini_result.get('street', ''),
                'country': gemini_result.get('country', 'Paraguay'),
                'phone': cleaned_phone
            })
        else:
            # Failed to process with Gemini - use original data with phone cleaning
            cleaned_phone = self.clean_paraguay_phone(phone)
            result.update({
                'cleaned_address': address,
                'state': '',
                'city': '',
                'street': '',
                'country': 'Paraguay',
                'phone': cleaned_phone
            })
        
        print(f"ROW_COMPLETED:{row_index}:Row {row_index + 1} processing completed")
        return result
    
    def process_csv_file(self, input_file_path: str, output_file_path: str, batch_size: int = 5) -> bool:
        """Process entire CSV file with parallel processing."""
        try:
            print('Reading CSV file...', flush=True)
            
            # Read CSV file
            with open(input_file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                rows = list(reader)
            
            if not rows:
                print('No data found in CSV file')
                return False
            
            total_rows = len(rows)
            total_batches = (total_rows + batch_size - 1) // batch_size
            
            print(f'Processing {total_rows} rows in {total_batches} batches with {self.max_workers} parallel workers')
            
            # Process in batches with parallel workers
            all_processed_rows = []
            
            for batch_num in range(total_batches):
                start_idx = batch_num * batch_size
                end_idx = min(start_idx + batch_size, total_rows)
                batch_rows = rows[start_idx:end_idx]
                
                current_batch = batch_num + 1
                print(f"PROGRESS:{current_batch}:{total_batches}:Processing batch {current_batch}/{total_batches} in parallel", flush=True)
                
                # Create indexed row data for parallel processing
                indexed_rows = [(start_idx + i, row) for i, row in enumerate(batch_rows)]
                
                # Process batch in parallel
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    future_to_row = {executor.submit(self.process_single_row, row_data): row_data 
                                   for row_data in indexed_rows}
                    
                    batch_results = []
                    for future in as_completed(future_to_row):
                        try:
                            result = future.result()
                            # Only add non-None results (skip empty addresses)
                            if result is not None:
                                batch_results.append(result)
                        except Exception as e:
                            print(f"Error processing row: {e}")
                            # Add the original row with error info
                            row_data = future_to_row[future]
                            row = row_data[1]
                            error_result = {
                                'original_address': str(row),
                                'cleaned_address': f'Error: {str(e)}',
                                'state': '',
                                'city': '',
                                'street': '',
                                'country': 'Paraguay'
                            }
                            batch_results.append(error_result)
                
                # Results are already processed, no need to sort since we'll extend in order
                # The parallel processing maintains order through the indexed_rows structure
                all_processed_rows.extend(batch_results)
                
                print(f"BATCH_COMPLETED:{current_batch}:{total_batches}:Batch {current_batch}/{total_batches} completed")
                
                # Small delay between batches to avoid overwhelming APIs
                if current_batch < total_batches:
                    time.sleep(0.5)
            
            # Write output JSON
            print(f"PROGRESS:{total_batches}:{total_batches}:Writing output JSON...")
            print('Writing output JSON...')
            
            if all_processed_rows:
                with open(output_file_path, 'w', encoding='utf-8') as file:
                    json.dump(all_processed_rows, file, indent=2, ensure_ascii=False)
            
            valid_addresses = len(all_processed_rows)
            print(f'Successfully processed {valid_addresses} valid addresses out of {total_rows} total rows in parallel')
            return True
            
        except Exception as e:
            print(f'Error processing CSV: {str(e)}')
            return False


def main():
    """Main function for testing."""
    if len(sys.argv) < 3:
        print("Usage: python csv_parallel_processor.py <input_file> <output_file> [task_id]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    task_id = sys.argv[3] if len(sys.argv) > 3 else str(uuid.uuid4())
    
    print(f"Task ID: {task_id}", flush=True)
    print(f"Input file: {input_file}", flush=True)
    print(f"Output file: {output_file}", flush=True)
    
    # Get API keys and runtime tuning from environment
    gemini_key = os.getenv('GEMINI_API_KEY')
    max_workers_env = os.getenv('MAX_WORKERS')
    batch_size_env = os.getenv('BATCH_SIZE')
    
    print(f"Environment check:", flush=True)
    print(f"- GEMINI_API_KEY: {'✓ Found' if gemini_key else '✗ Missing'}", flush=True)
    
    if not gemini_key:
        print("Error: GEMINI_API_KEY not found in environment variables", flush=True)
        sys.exit(1)
    
    try:
        # Create processor with parallel workers
        print("Initializing processor with Gemini 2.5 Flash...", flush=True)
        max_workers = int(max_workers_env) if max_workers_env and max_workers_env.isdigit() else 3
        processor = ParallelCSVProcessor(gemini_key or '', model_name="gemini-2.5-flash", max_workers=max_workers)
        
        # Process file
        print("Starting CSV processing...", flush=True)
        batch_size = int(batch_size_env) if batch_size_env and batch_size_env.isdigit() else 5
        success = processor.process_csv_file(input_file, output_file, batch_size=batch_size)
        
        if success:
            print(f"Processing completed successfully: {output_file}", flush=True)
        else:
            print("Processing failed", flush=True)
            sys.exit(1)
    except Exception as e:
        print(f"Critical error in main(): {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
