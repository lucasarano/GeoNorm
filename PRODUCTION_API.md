# GeoNorm Production API

## Overview

The GeoNorm Production API provides a single endpoint for complete address processing and geocoding. It handles the entire pipeline automatically:

1. **Extract** - AI-powered field extraction from CSV
2. **Clean** - AI-powered address normalization  
3. **Geocode** - Google Maps geocoding with coordinates
4. **Save** - Automatic database storage
5. **Notify** - SMS/Email notifications (optional)

## Base URL

- **Production**: `https://your-app.vercel.app`
- **Development**: `http://localhost:3000`

## Authentication

All requests require an API key in the `X-API-Key` header.

## Endpoints

### 1. Process Addresses

**Endpoint**: `POST /api/process`

**Description**: Complete address processing pipeline

**Headers**:
```
Content-Type: application/json
X-API-Key: your-api-key
```

**Request Body**:
```json
{
  "csvData": "Name,Address,City\nJohn,123 Main St,Asuncion",
  "userId": "user-123",
  "options": {
    "sendNotifications": true,
    "includeZipCodes": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "totalProcessed": 1,
  "statistics": {
    "highConfidence": 1,
    "mediumConfidence": 0,
    "lowConfidence": 0,
    "totalRows": 1
  },
  "notifications": {
    "sms": { "sent": 0, "failed": 0 },
    "email": { "sent": 1, "failed": 0 }
  },
  "results": [
    {
      "rowIndex": 0,
      "original": {
        "address": "123 Main St",
        "city": "Asuncion",
        "state": "",
        "phone": ""
      },
      "cleaned": {
        "address": "123 Main St",
        "city": "Asunción",
        "state": "Asunción",
        "phone": "",
        "email": ""
      },
      "geocoding": {
        "latitude": -25.2637,
        "longitude": -57.5759,
        "formattedAddress": "123 Main St, Asunción, Paraguay",
        "confidence": 0.9,
        "confidenceDescription": "Most precise - exact address match",
        "locationType": "ROOFTOP",
        "googleMapsLink": "https://www.google.com/maps?q=-25.2637,-57.5759"
      },
      "zipCode": {
        "zipCode": "1000",
        "department": "Asunción",
        "district": "Asunción",
        "neighborhood": "Centro",
        "confidence": "high"
      },
      "status": "high_confidence"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Health Check

**Endpoint**: `GET /api/health`

**Description**: Check API health and status

**Response**:
```json
{
  "status": "OK",
  "message": "GeoNorm API Server is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": {
    "nodeEnv": "production",
    "allEnvVarsPresent": true
  }
}
```

### 3. Static Map

**Endpoint**: `GET /api/staticmap`

**Description**: Generate static map images

**Parameters**:
- `lat` (required): Latitude
- `lng` (required): Longitude  
- `zoom` (optional): Zoom level (default: 14)
- `size` (optional): Image size (default: 600x300)

**Example**: `/api/staticmap?lat=-25.2637&lng=-57.5759&zoom=14&size=600x300`

**Response**: PNG image or JSON error

## Usage Examples

### JavaScript/Node.js

```javascript
import { createGeoNormAPI } from './lib/production-api'

const api = createGeoNormAPI('your-api-key')

// Process addresses
const result = await api.processAddresses(csvData, userId, {
  sendNotifications: true,
  includeZipCodes: true
})

console.log(`Processed ${result.totalProcessed} addresses`)
console.log(`High confidence: ${result.statistics.highConfidence}`)
```

### cURL

```bash
curl -X POST https://your-app.vercel.app/api/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "csvData": "Name,Address,City\nJohn,123 Main St,Asuncion",
    "userId": "user-123"
  }'
```

### Python

```python
import requests

url = "https://your-app.vercel.app/api/process"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "your-api-key"
}
data = {
    "csvData": "Name,Address,City\nJohn,123 Main St,Asuncion",
    "userId": "user-123"
}

response = requests.post(url, json=data, headers=headers)
result = response.json()
```

## Error Handling

### Common Error Responses

**401 Unauthorized**:
```json
{
  "error": "API key required"
}
```

**400 Bad Request**:
```json
{
  "error": "CSV data is required"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Processing failed",
  "details": "OpenAI API key not configured"
}
```

## Rate Limits

- **Free Tier**: 100 requests/day
- **Pro Tier**: 10,000 requests/day
- **Enterprise**: 100,000 requests/day

## Processing Limits

- **Max CSV Size**: 10MB
- **Max Rows per Request**: 1,000
- **Processing Timeout**: 5 minutes
- **Concurrent Requests**: 10 per user

## Support

- **Documentation**: [API Docs](https://your-app.vercel.app/docs)
- **Status**: [Status Page](https://status.your-app.com)
- **Support**: support@your-app.com

## Changelog

### v1.0.0 (2024-01-15)
- Initial release
- Single endpoint processing pipeline
- AI-powered field extraction and cleaning
- Google Maps geocoding
- Automatic notifications
- Firebase integration
