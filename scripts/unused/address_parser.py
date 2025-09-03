#!/usr/bin/env python3
"""
Address Parser Script
Parses normalized addresses into separate columns: STATE, CITY, STREET, COUNTRY
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

class AddressParser:
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-pro"):
        """Initialize the address parser with Gemini API configuration."""
        self.api_key = api_key
        self.model_name = model_name
        self.configure_gemini()
        
    def configure_gemini(self):
        """Configure the Gemini API client."""
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)
        
    def construct_parsing_prompt(self, address: str) -> str:
        """Construct a detailed prompt for the Gemini API to parse an address into components."""
        prompt = f"""**Objective:** Parse the following normalized address into separate components.

**Normalized Address:**
"{address}"

**Task:**
Extract and separate the address into these specific components:
1. STATE (Department/State/Province)
2. CITY (City/Town/Municipality)
3. STREET (Street name(s), including intersections)
4. COUNTRY (Always "Paraguay" for these addresses)

**Rules:**
- COUNTRY is always "Paraguay"
- STATE should be the department (e.g., "Central", "Itapúa", "Alto Paraná")
- CITY should be the main city/town name
- STREET should include street names, intersections, building names, but NOT house numbers
- If there are multiple streets (intersection), include both names
- Remove house numbers, apartment numbers, postal codes from STREET
- Keep building names and landmarks in STREET

**Output Format:**
Return ONLY a single, minified JSON object with these keys: "state", "city", "street", "country".

**Examples:**

Example 1:
- Input: "Avda. López Godoy, Ruta 1, Km 20, Capiatá, Central Department, Paraguay"
- Expected JSON: {{"state": "Central", "city": "Capiatá", "street": "Avda. López Godoy, Ruta 1", "country": "Paraguay"}}

Example 2:
- Input: "Calle Virgen del Rosario y Paraná, General Artigas, Itapúa Department, Paraguay"
- Expected JSON: {{"state": "Itapúa", "city": "General Artigas", "street": "Calle Virgen del Rosario y Paraná", "country": "Paraguay"}}

Example 3:
- Input: "Estrella 692, Piso 3, Oficina 37, Asunción, Central Department, Paraguay"
- Expected JSON: {{"state": "Central", "city": "Asunción", "street": "Estrella", "country": "Paraguay"}}

Example 4:
- Input: "Benjamin Constant c/ Colón, Edificio Colón 1, Departamento 12B, Asunción, Central Department, Paraguay"
- Expected JSON: {{"state": "Central", "city": "Asunción", "street": "Benjamin Constant c/ Colón, Edificio Colón 1", "country": "Paraguay"}}

Please parse this address: "{address}" """
        
        return prompt
    
    def call_gemini_api(self, prompt: str) -> Optional[Dict]:
        """Call the Gemini API with the given prompt and return parsed JSON response."""
        try:
            print(f"Calling Gemini API for parsing...")
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
            required_fields = ['state', 'city', 'street', 'country']
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
            print(f"Parsed addresses written to '{filename}'")
        except Exception as e:
            print(f"Error writing CSV file: {e}")
            sys.exit(1)
    
    def parse_addresses(self, input_file: str, output_file: str, delay: float = 1.0):
        """Main processing function to parse addresses from CSV."""
        print(f"Reading input file: {input_file}")
        rows = self.read_csv(input_file)
        
        if not rows:
            print("No data found in input file.")
            return
        
        print(f"Found {len(rows)} rows to process.")
        
        # Process each row
        processed_data = []
        
        for i, row in enumerate(rows, 1):
            # Use normalized address if available
            address = row.get('normalized_address', '')
            
            if not address:
                print(f"Row {i}: No normalized address found, skipping.")
                continue
            
            print(f"Row {i}/{len(rows)}: Parsing address: {address}")
            
            # Construct prompt and call API
            prompt = self.construct_parsing_prompt(address)
            result = self.call_gemini_api(prompt)
            
            if result:
                # Add parsed components to the row
                row['parsed_state'] = result.get('state')
                row['parsed_city'] = result.get('city')
                row['parsed_street'] = result.get('street')
                row['parsed_country'] = result.get('country')
                
                processed_data.append(row)
                print(f"  -> Success: State={result.get('state')}, City={result.get('city')}, Street={result.get('street')}")
            else:
                print(f"  -> Failed to parse address")
                # Add empty parsing fields for failed attempts
                row['parsed_state'] = None
                row['parsed_city'] = None
                row['parsed_street'] = None
                row['parsed_country'] = None
                processed_data.append(row)
            
            # Add delay between API calls to avoid rate limiting
            if i < len(rows):
                time.sleep(delay)
        
        # Write results
        if processed_data:
            self.write_csv(processed_data, output_file)
            print(f"\nParsing complete!")
            print(f"Total rows processed: {len(rows)}")
            print(f"Successfully parsed: {len([r for r in processed_data if r.get('parsed_state')])}")
        else:
            print("No data to write.")


def main():
    """Main function to handle command line arguments and run the parsing process."""
    parser = argparse.ArgumentParser(description='Parse normalized addresses into components using Gemini API')
    parser.add_argument('--input', '-i', default='test_10_normalized.csv',
                       help='Input CSV file with normalized addresses (default: test_10_normalized.csv)')
    parser.add_argument('--output', '-o', default='parsed_addresses.csv',
                       help='Output CSV file (default: parsed_addresses.csv)')
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
    
    # Initialize parser and run
    parser = AddressParser(api_key, args.model)
    parser.parse_addresses(args.input, args.output, args.delay)


if __name__ == "__main__":
    main()
