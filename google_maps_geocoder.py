#!/usr/bin/env python3
"""
Google Maps Geocoding Script
Uses normalized addresses to get accurate coordinates via Google Maps API
"""

import csv
import json
import os
import sys
import argparse
import time
import requests
from typing import Dict, List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class GoogleMapsGeocoder:
    def __init__(self, api_key: str):
        """Initialize the Google Maps geocoder."""
        self.api_key = api_key
        self.base_url = "https://maps.googleapis.com/maps/api/geocode/json"
        
    def geocode_address(self, address: str) -> Optional[Dict]:
        """Geocode an address using Google Maps API."""
        try:
            params = {
                'address': address,
                'key': self.api_key
            }
            
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            if data['status'] == 'OK' and data['results']:
                result = data['results'][0]  # Get the first (most relevant) result
                
                # Extract coordinates
                location = result['geometry']['location']
                lat = location['lat']
                lng = location['lng']
                
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
                    'latitude': lat,
                    'longitude': lng,
                    'formatted_address': result['formatted_address'],
                    'country': country,
                    'postal_code': postal_code,
                    'city': city,
                    'state': state,
                    'location_type': location_type,
                    'confidence_score': confidence,
                    'google_maps_link': f"https://www.google.com/maps?q={lat},{lng}"
                }
            else:
                print(f"Geocoding failed: {data.get('status', 'Unknown error')}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"Request error: {e}")
            return None
        except Exception as e:
            print(f"Error geocoding address: {e}")
            return None
    
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
            print(f"Geocoded results written to '{filename}'")
        except Exception as e:
            print(f"Error writing CSV file: {e}")
            sys.exit(1)
    
    def geocode_addresses(self, input_file: str, output_file: str, delay: float = 0.1):
        """Main processing function to geocode addresses from CSV."""
        print(f"Reading input file: {input_file}")
        rows = self.read_csv(input_file)
        
        if not rows:
            print("No data found in input file.")
            return
        
        print(f"Found {len(rows)} rows to process.")
        
        # Process each row
        processed_data = []
        
        for i, row in enumerate(rows, 1):
            # Use normalized address if available, otherwise use original
            address = row.get('normalized_address') or row.get('original_address', '')
            
            if not address:
                print(f"Row {i}: No address information found, skipping.")
                continue
            
            print(f"Row {i}/{len(rows)}: Geocoding address: {address}")
            
            result = self.geocode_address(address)
            
            if result:
                # Add geocoding results to the row
                row['google_latitude'] = result['latitude']
                row['google_longitude'] = result['longitude']
                row['google_formatted_address'] = result['formatted_address']
                row['google_country'] = result['country']
                row['google_postal_code'] = result['postal_code']
                row['google_city'] = result['city']
                row['google_state'] = result['state']
                row['google_location_type'] = result['location_type']
                row['google_confidence'] = result['confidence_score']
                row['google_maps_link'] = result['google_maps_link']
                
                processed_data.append(row)
                print(f"  -> Success: lat={result['latitude']}, lng={result['longitude']}, confidence={result['confidence_score']}")
            else:
                print(f"  -> Failed to geocode address")
                # Add empty geocoding fields for failed attempts
                row['google_latitude'] = None
                row['google_longitude'] = None
                row['google_formatted_address'] = None
                row['google_country'] = None
                row['google_postal_code'] = None
                row['google_city'] = None
                row['google_state'] = None
                row['google_location_type'] = None
                row['google_confidence'] = None
                row['google_maps_link'] = None
                processed_data.append(row)
            
            # Add delay between API calls to avoid rate limiting
            if i < len(rows):
                time.sleep(delay)
        
        # Write results
        if processed_data:
            self.write_csv(processed_data, output_file)
            print(f"\nGeocoding complete!")
            print(f"Total rows processed: {len(rows)}")
            print(f"Successfully geocoded: {len([r for r in processed_data if r.get('google_latitude')])}")
        else:
            print("No data to write.")


def main():
    """Main function to handle command line arguments and run the geocoding process."""
    parser = argparse.ArgumentParser(description='Geocode addresses using Google Maps API')
    parser.add_argument('--input', '-i', default='normalized_addresses.csv',
                       help='Input CSV file with normalized addresses (default: normalized_addresses.csv)')
    parser.add_argument('--output', '-o', default='final_geocoded_results.csv',
                       help='Output CSV file (default: final_geocoded_results.csv)')
    parser.add_argument('--delay', '-d', type=float, default=0.1,
                       help='Delay between API calls in seconds (default: 0.1)')
    parser.add_argument('--api-key', '-k',
                       help='Google Maps API key (overrides environment variable)')
    
    args = parser.parse_args()
    
    # Get API key from argument or environment variable
    api_key = args.api_key or os.getenv('GOOGLE_MAPS_API_KEY')
    
    if not api_key:
        print("Error: Google Maps API key not provided.")
        print("Please set GOOGLE_MAPS_API_KEY environment variable or use --api-key argument.")
        print("Get your API key from: https://console.cloud.google.com/google/maps-apis")
        sys.exit(1)
    
    # Initialize geocoder and run
    geocoder = GoogleMapsGeocoder(api_key)
    geocoder.geocode_addresses(args.input, args.output, args.delay)


if __name__ == "__main__":
    main()
