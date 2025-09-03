# 🗺️ GeoNorm

Transform addresses into precise coordinates using Google's powerful APIs with AI-powered address cleaning.

## 🏗️ Project Structure

```
GeoNorm/
├── 📁 backend/              # Express.js API server
│   ├── index.ts            # Main server file
│   ├── types.ts            # TypeScript interfaces
│   └── tsconfig.json       # Backend TypeScript config
├── 📁 frontend/            # React frontend application
│   ├── components/
│   │   ├── forms/          # Form components
│   │   │   ├── SimpleAddressForm.tsx
│   │   │   └── CsvUploader.tsx
│   │   ├── shared/         # Shared UI components
│   │   │   └── ui/         # shadcn/ui components
│   │   └── AddressForm.tsx # Legacy form (unused)
│   ├── lib/               # Utility functions
│   ├── assets/            # Static assets
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # App entry point
│   └── index.css          # Global styles
├── 📁 scripts/             # Processing scripts
│   ├── csv_parallel_processor.py  # Main CSV processor
│   └── unused/            # Legacy/unused scripts
├── 📁 data/               # Data storage
│   ├── uploads/           # Uploaded CSV files
│   ├── outputs/           # Processed results
│   └── samples/           # Sample data files
├── 📁 docs/               # Documentation
├── 📁 venv/               # Python virtual environment
└── 📁 public/             # Static public files
```

## 🚀 Features

- **🤖 AI-Powered Address Cleaning**: Uses Google Gemini AI to normalize and clean addresses
- **🗺️ Precise Geocoding**: Google Maps API for accurate coordinate conversion
- **📊 Batch Processing**: Upload CSV files for bulk address processing
- **🎯 Confidence Scoring**: Visual confidence indicators for geocoding results
- **📍 Interactive Maps**: Static maps showing exact locations
- **⚡ Real-time Progress**: Live updates during processing

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 20.19+ or 22.12+
- Python 3.13+
- Google Maps API Key
- Google Gemini AI API Key

### Installation

1. **Clone and install dependencies**:
```bash
git clone <repository>
cd GeoNorm
npm install
```

2. **Set up Python environment**:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install google-generativeai requests python-dotenv aiohttp
```

3. **Configure environment variables**:
```bash
cp docs/env_template.txt .env
# Edit .env with your API keys
```

4. **Start the application**:
```bash
npm run start:all
```

## 🎯 Usage

### Single Address Processing
1. Navigate to http://localhost:5173
2. Select "Single Address" mode
3. Enter address and optional components
4. View geocoding results with confidence scores

### CSV Batch Processing
1. Select "CSV Batch Processing" mode
2. Upload a CSV file with address columns:
   - `Buyer Address1` - Main address
   - `Buyer City` - City name
   - `Buyer State` - State/Department
   - `Buyer ZIP` - Postal code
3. Monitor real-time processing progress
4. Download processed results

## 📊 API Endpoints

- `GET /health` - Health check
- `GET /api/geocoding` - Single address geocoding
- `GET /api/places` - Places API search
- `POST /api/geocode-both` - Geocode with confidence scoring
- `POST /api/process-csv` - Upload and process CSV
- `GET /api/progress/:taskId` - Check processing progress
- `GET /api/results/:taskId` - Get processed results

## 🔧 Configuration

### Environment Variables
```env
# Google Maps API
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL_NAME=gemini-2.5-flash
```

### CSV Format
Your CSV should contain address columns:
- `Buyer Address1` - Street address
- `Buyer City` - City name  
- `Buyer State` - State/Department
- `Buyer ZIP` - Postal code

## 🎨 Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express.js, TypeScript
- **AI Processing**: Google Gemini AI, Python
- **APIs**: Google Maps Geocoding & Places APIs
- **Storage**: File-based (CSV/JSON)

## 📈 Confidence Levels

- 🟢 **80%+ (Green)**: High confidence - Exact address match
- 🟡 **60-79% (Yellow)**: Medium confidence - Approximate location
- 🔴 **<60% (Red)**: Low confidence - General area only

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

[Your License Here]
