# GeoNorm

A clean and modern React application that uses Google Maps APIs to convert addresses into precise coordinates and location data.

## Features

- **Clean UI**: Built with React, Tailwind CSS, and shadcn/ui components
- **Dual API Integration**: Uses both Google Maps Geocoding API and Google Places API
- **Real-time Results**: Displays JSON responses from both APIs side by side
- **Modern Design**: Beautiful gradient backgrounds and responsive layout

## APIs Used

### 1. Google Maps Geocoding API
- **Purpose**: Convert addresses → coordinates
- **Strength**: Handles messy/misspelled/multi-language input
- **Returns**: formatted_address, lat/lng, location_type
- **Best for**: Textual addresses (even vague ones)

### 2. Google Places API (Find Place)
- **Purpose**: Find places by name, landmarks, or business names
- **Strength**: POIs, landmarks, businesses, informal place names
- **Returns**: place details, ratings, types
- **Best for**: "Hospital Central", business names, landmarks

## Setup

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

## Usage

1. Enter any address, landmark, or place name in the input field
2. Click "Search Location" 
3. View the JSON responses from both Google APIs side by side
4. Compare the results to see the strengths of each API

## Example Inputs

- **Addresses**: "123 Main Street, New York, NY"
- **Landmarks**: "Hospital Nacional Itaugua Paraguay"
- **Businesses**: "Shopping Mariscal"
- **Informal locations**: "near Hospital Central"

## Project Structure

```
GeoNorm/
├── src/                    # Frontend React app
│   ├── components/         # UI components
│   └── lib/               # Utility functions
├── server/                # Backend Express server
├── .env                   # Environment variables (API key)
└── README.md             # This file
```

## Technologies

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **APIs**: Google Maps Geocoding API, Google Places API