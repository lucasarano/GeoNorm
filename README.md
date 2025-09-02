# GeoNorm

A comprehensive geocoding solution with both Python backend scripts and a modern React frontend application.

## 🐍 Python Backend Scripts

### Features
- **Address Normalization**: Cleans and standardizes messy addresses using Gemini API
- **Address Parsing**: Separates addresses into STATE, CITY, STREET, COUNTRY components
- **CSV Processing**: Reads customer data from CSV files with flexible address field mapping
- **Gemini API Integration**: Uses Google's Gemini API for intelligent address processing
- **Google Maps Integration**: Ready for Google Maps API geocoding
- **Batch Processing**: Handles large datasets with rate limiting
- **Confidence Scoring**: Provides confidence scores (0.0-1.0) for each result
- **Duplicate Prevention**: Skips already processed addresses to avoid redundant API calls
- **Robust Error Handling**: Handles API failures and malformed responses gracefully
- **Command Line Interface**: Easy-to-use CLI with configurable options

### Installation

1. Install required dependencies:
```bash
pip install -r requirements.txt
```

2. Set up your API keys in the `.env` file:
```
GEMINI_API_KEY=your-gemini-api-key-here
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

### Usage

#### Step 1: Normalize Addresses
```bash
python address_normalizer.py --input "your_data.csv" --output "normalized_addresses.csv" --delay 3.0
```

#### Step 2: Parse Address Components
```bash
python address_parser.py --input "normalized_addresses.csv" --output "parsed_addresses.csv" --delay 2.0
```

#### Step 3: Geocode with Google Maps (Optional)
```bash
python google_maps_geocoder.py --input "parsed_addresses.csv" --output "final_results.csv" --delay 0.1
```

### Scripts Overview

- **`address_normalizer.py`**: Cleans and standardizes addresses
- **`address_parser.py`**: Separates addresses into components (STATE, CITY, STREET, COUNTRY)
- **`geocoding_script.py`**: Original geocoding using Gemini API
- **`google_maps_geocoder.py`**: Geocoding using Google Maps API
- **`batch_processor.py`**: Processes large CSV files in chunks
- **`view_results.py`**: Utility to view results in clean format

## ⚛️ React Frontend Application

### Features
- **Clean UI**: Built with React, Tailwind CSS, and shadcn/ui components
- **Dual API Integration**: Uses both Google Maps Geocoding API and Google Places API
- **Real-time Results**: Displays JSON responses from both APIs side by side
- **Modern Design**: Beautiful gradient backgrounds and responsive layout

### APIs Used

#### 1. Google Maps Geocoding API
- **Purpose**: Convert addresses → coordinates
- **Strength**: Handles messy/misspelled/multi-language input
- **Returns**: formatted_address, lat/lng, location_type
- **Best for**: Textual addresses (even vague ones)

#### 2. Google Places API (Find Place)
- **Purpose**: Find places by name, landmarks, or business names
- **Strength**: POIs, landmarks, businesses, informal place names
- **Returns**: place details, ratings, types
- **Best for**: "Hospital Central", business names, landmarks

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure API Key**:
   The `.env` file is already created with your Google Maps API key.

3. **Run the application**:
   
   **Option 1: Run both frontend and backend together**:
   ```bash
   npm run start:all
   ```
   
   **Option 2: Run separately**:
   ```bash
   # Terminal 1 - Backend server
   npm run server:dev
   
   # Terminal 2 - Frontend dev server
   npm run dev
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

### Usage

1. Enter any address, landmark, or place name in the input field
2. Click "Search Location" 
3. View the JSON responses from both Google APIs side by side
4. Compare the results to see the strengths of each API

### Example Inputs

- **Addresses**: "123 Main Street, New York, NY"
- **Landmarks**: "Hospital Nacional Itaugua Paraguay"
- **Businesses**: "Shopping Mariscal"
- **Informal locations**: "near Hospital Central"

## 🏗️ Project Structure

```
GeoNorm/
├── 🐍 Python Scripts
│   ├── address_normalizer.py      # Address normalization
│   ├── address_parser.py          # Address component parsing
│   ├── geocoding_script.py        # Gemini geocoding
│   ├── google_maps_geocoder.py    # Google Maps geocoding
│   ├── batch_processor.py         # Batch processing
│   ├── view_results.py            # Results viewer
│   ├── requirements.txt           # Python dependencies
│   └── env_template.txt           # Environment template
├── ⚛️ React Frontend
│   ├── src/                       # Frontend React app
│   │   ├── components/            # UI components
│   │   └── lib/                   # Utility functions
│   ├── server/                    # Backend Express server
│   ├── package.json               # Node.js dependencies
│   └── .env                       # Environment variables
└── 📊 Data Files
    ├── base para prueba maps.csv  # Sample data
    └── test_*.csv                 # Test results
```

## 🛠️ Technologies

### Python Backend
- **Python 3.7+**
- **Google Generative AI** (Gemini API)
- **Google Maps API**
- **pandas, csv, requests**

### React Frontend
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **APIs**: Google Maps Geocoding API, Google Places API

## 📋 Workflow

1. **Data Preparation**: Use Python scripts to normalize and parse addresses from CSV
2. **Geocoding**: Use either Gemini API or Google Maps API for coordinates
3. **Web Interface**: Use React app for interactive address lookup and testing
4. **Results**: Export clean, structured data with coordinates and confidence scores

## 🔑 API Keys Required

- **Gemini API Key**: For address normalization and parsing
- **Google Maps API Key**: For geocoding and the React frontend

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.