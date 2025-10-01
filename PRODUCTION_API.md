# GeoNorm Production API

## Overview

The GeoNorm Production API lets you send a single address string and receive the cleaned address, GPS coordinates, and Paraguayan zip code metadata. The endpoint performs Google Maps geocoding and zip code lookup so you only need to provide the raw address text.

## Base URL

- **Production**: `https://your-app.vercel.app`
- **Development**: `http://localhost:3000`

## Authentication

Include your API key in the `X-API-Key` header for every request.

```
X-API-Key: your-api-key
Content-Type: application/json
```

## Endpoint

### `POST /api/process`

Submit a raw address string and receive the normalized result.

#### Request Body

```json
{
  "address": "Av. España 123, Asunción"
}
```

You may also send the address as a plain string payload; the API will interpret either format.

#### Response

```json
{
  "success": true,
  "userId": "user-123",
  "originalAddress": "Av. España 123, Asunción",
  "cleanedAddress": "Av. España 123, Asunción, Paraguay",
  "coordinates": {
    "latitude": -25.282362,
    "longitude": -57.635981
  },
  "zipCode": "1000",
  "zipCodeDetails": {
    "zipCode": "1000",
    "department": "Capital",
    "district": "Asunción",
    "neighborhood": "San Roque",
    "confidence": "high"
  },
  "confidence": 0.95,
  "confidenceDescription": "Most precise - exact address match",
  "locationType": "ROOFTOP",
  "timestamp": "2024-04-10T15:23:45.123Z"
}
```

When no precise result can be found the API returns an error with HTTP status `404` and `error: "Unable to find a matching location"`.

## Additional Endpoints

### `GET /api/health`

Returns API status, environment, and timestamp for monitoring.

### `GET /api/staticmap`

Generate a static PNG map for any coordinate pair.

- `lat` (required): Latitude
- `lng` (required): Longitude
- `zoom` (optional): 14 by default
- `size` (optional): 600x300 by default

Example: `/api/staticmap?lat=-25.2637&lng=-57.5759&zoom=14&size=600x300`

## Usage Examples

### JavaScript / Node.js

```javascript
import { createGeoNormAPI } from './lib/production-api'

const api = createGeoNormAPI('your-api-key')

const result = await api.processAddress('Av. España 123, Asunción')

console.log(result.cleanedAddress)
console.log(result.coordinates)
console.log(result.zipCode)
```

### cURL

```bash
curl -X POST https://your-app.vercel.app/api/process \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "address": "Av. España 123, Asunción"
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

payload = {"address": "Av. España 123, Asunción"}

response = requests.post(url, json=payload, headers=headers)
result = response.json()

print(result["cleanedAddress"], result["coordinates"]) 
```

## Error Handling

- **401 Unauthorized** – missing or invalid API key.
- **400 Bad Request** – the address value is missing or empty.
- **404 Not Found** – Google Maps could not find a matching location for the provided address.
- **500 Internal Server Error** – unexpected failure while contacting Google Maps or loading zip code data.

## Rate Limits

- **Free Tier**: 100 requests/day
- **Pro Tier**: 10,000 requests/day
- **Enterprise**: 100,000 requests/day

## Support

- **Documentation**: [API Docs](https://your-app.vercel.app/docs)
- **Status**: [Status Page](https://status.your-app.com)
- **Support**: support@your-app.com

