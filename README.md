# Geocoding Script with Gemini API

A Python script that reads addresses from a CSV file, geocodes them using Google's Gemini API, and outputs the results with confidence scores to a new CSV file.

## Features

- **CSV Processing**: Reads customer data from CSV files with flexible address field mapping
- **Gemini API Integration**: Uses Google's Gemini API for intelligent geocoding
- **Confidence Scoring**: Provides confidence scores (0.0-1.0) for each geocoding result
- **Duplicate Prevention**: Skips already processed addresses to avoid redundant API calls
- **Robust Error Handling**: Handles API failures and malformed responses gracefully
- **Command Line Interface**: Easy-to-use CLI with configurable options

## Installation

1. Install required dependencies:
```bash
pip install -r requirements.txt
```

2. Set up your Gemini API key in the `.env` file:
```
GEMINI_API_KEY=your-api-key-here
```

## Usage

### Basic Usage
```bash
python geocoding_script.py
```

This will:
- Read from `input_addresses.csv`
- Write results to `output_geocoded.csv`
- Use a 1-second delay between API calls

### Advanced Usage
```bash
python geocoding_script.py --input my_addresses.csv --output results.csv --delay 2.0 --model gemini-pro
```

### Command Line Options
- `--input, -i`: Input CSV file (default: input_addresses.csv)
- `--output, -o`: Output CSV file (default: output_geocoded.csv)
- `--delay, -d`: Delay between API calls in seconds (default: 1.0)
- `--api-key, -k`: Gemini API key (overrides environment variable)
- `--model, -m`: Gemini model name (default: gemini-pro)

## Input Format

The script expects a CSV file with address information spread across multiple columns. Common field names include:

- `Buyer Address`, `Address`, `Street Address`, `Street`
- `Buyer City`, `City`
- `Buyer State`, `State`, `Province`
- `Buyer ZIP`, `ZIP`, `Postal Code`, `ZIP Code`

Example input row:
```csv
Name,Buyer Address,Buyer City,Buyer State,Buyer ZIP
"Juan Carlos Gimenez","Avda. Lopez Godoy, Ruta 1, km. 20","Capiata","Other","2560"
```

## Output Format

The output CSV contains all original columns plus new geocoding columns:

- `gemini_latitude`: Latitude coordinate
- `gemini_longitude`: Longitude coordinate
- `gemini_zip_code`: Corrected or determined ZIP code
- `gemini_confidence`: Confidence score (0.0-1.0)
- `gemini_explanation`: Brief explanation of the result
- `google_maps_link`: Google Maps link to the coordinates

Example output row:
```csv
Name,Buyer Address,Buyer City,Buyer State,Buyer ZIP,gemini_latitude,gemini_longitude,gemini_zip_code,gemini_confidence,gemini_explanation,google_maps_link
"Juan Carlos Gimenez","Avda. Lopez Godoy, Ruta 1, km. 20","Capiata","Other","2560",-25.2637,-57.5759,"1804",0.60,"Address is incomplete. Based on 'Capiata' and 'Ruta 1', this is likely a location in Capiatá, Paraguay...","https://www.google.com/maps?q=-25.2637,-57.5759"
```

## How It Works

1. **Address Combination**: The script combines address fields from multiple columns into a single address string
2. **Prompt Construction**: Creates detailed prompts for the Gemini API with specific instructions for geocoding
3. **API Interaction**: Sends prompts to Gemini API and parses JSON responses
4. **Duplicate Check**: Tracks processed addresses to avoid redundant API calls
5. **Result Processing**: Validates and processes API responses with error handling
6. **CSV Output**: Writes results to output CSV with all original data plus geocoding results

## Error Handling

The script includes robust error handling for:
- Missing or invalid API keys
- Network connectivity issues
- Malformed API responses
- JSON parsing errors
- File I/O errors
- Missing address information

## Rate Limiting

The script includes a configurable delay between API calls to respect rate limits. Default is 1 second, but you can adjust this with the `--delay` parameter.

## Sample Data

The repository includes `input_addresses.csv` with sample data including:
- Complete addresses
- Incomplete addresses
- Vague addresses
- International addresses
- Well-known addresses (for testing)

## Requirements

- Python 3.7+
- Google Generative AI library
- python-dotenv for environment variable management
- Valid Gemini API key

## License

This project is licensed under the MIT License - see the LICENSE file for details.
