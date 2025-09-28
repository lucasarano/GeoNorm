# Migration Guide: Express → Vercel Serverless

This guide documents the migration from Express.js backend to Vercel serverless functions.

## Migration Overview

### What Was Migrated

**25 Express endpoints** have been migrated to **Vercel serverless functions**:

#### Core Processing (4 endpoints)
- ✅ `POST /api/process-complete` → `api/process-complete.ts`
- ✅ `POST /api/extract-fields` → `api/process/extract.ts`
- ✅ `POST /api/clean-with-openai` → `api/process/clean.ts`
- ✅ `POST /api/geocode-both` → `api/process/geocode.ts`

#### Utility Endpoints (2 endpoints)
- ✅ `GET /health` → `api/health.ts`
- ✅ `GET /api/staticmap` → `api/staticmap.ts`

#### Notification Endpoints (3 endpoints)
- ✅ `POST /api/send-confirmations` → `api/notifications/sms.ts`
- ✅ `POST /api/test-location-email` → `api/notifications/email.ts`
- ✅ `POST /api/test-location-sms` → `api/notifications/test-sms.ts`

#### Location Management (3 endpoints)
- ✅ `POST /api/save-location` → `api/location/save.ts`
- ✅ `GET /api/location-history` → `api/location/history.ts`
- ✅ `POST /api/address-records/location-links` → `api/location/links.ts`

#### Address Management (2 endpoints)
- ✅ `GET /api/addresses/list` → `api/addresses/list.ts`
- ✅ `GET /api/addresses/get` → `api/addresses/get.ts`

#### Analytics (1 endpoint)
- ✅ `GET /api/analytics/stats` → `api/analytics/stats.ts`

### What Was NOT Migrated (Express Server)

**Real-time features** that require persistent connections remain on Express:
- `GET /api/address-updates/stream` (Server-Sent Events)
- `POST /api/notify-completion` (Real-time notifications)
- `GET /api/address-updates` (Real-time polling)

## New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MIGRATED ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────────┐ │
│  │   Frontend  │    │         Vercel Functions            │ │
│  │  (React)    │◄──►│  • /api/process/*                   │ │
│  │             │    │  • /api/addresses/*                 │ │
│  │             │    │  • /api/notifications/*             │ │
│  │             │    │  • /api/location/*                  │ │
│  │             │    │  • /api/analytics/*                 │ │
│  │             │    │  • /api/health                      │ │
│  │             │    │  • /api/staticmap                   │ │
│  └─────────────┘    └─────────────────────────────────────┘ │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Express Server (Real-time)                 │ │
│  │  • Server-Sent Events (SSE)                            │ │
│  │  • Real-time notifications                             │ │
│  │  • WebSocket connections                               │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## New File Structure

```
api/
├── health.ts                    # Health check
├── staticmap.ts                 # Static map generation
├── process-complete.ts          # Main processing pipeline
├── process/
│   ├── extract.ts              # Field extraction
│   ├── clean.ts                # Address cleaning
│   └── geocode.ts              # Geocoding
├── addresses/
│   ├── list.ts                 # List addresses
│   └── get.ts                  # Get single address
├── notifications/
│   ├── sms.ts                  # SMS notifications
│   ├── email.ts                # Email notifications
│   └── test-sms.ts             # Test SMS
├── location/
│   ├── save.ts                 # Save location
│   ├── history.ts              # Location history
│   └── links.ts                # Location links
└── analytics/
    └── stats.ts                # Statistics

lib/
├── firebase.ts                 # Firebase configuration
├── services/
│   ├── smsService.ts           # SMS service
│   ├── emailService.ts         # Email service
│   └── zipCodeService.ts       # Zip code service
└── utils/
    ├── csvParser.ts            # CSV parsing utilities
    └── geocoding.ts            # Geocoding utilities

frontend/lib/
└── api-config.ts               # API client configuration
```

## API Client Usage

### Before (Express)
```typescript
// Old way - direct fetch calls
const response = await fetch('/api/process-complete', {
  method: 'POST',
  headers: { 'Content-Type': 'text/csv' },
  body: csvData
})
const result = await response.json()
```

### After (Vercel + API Client)
```typescript
// New way - using API client
import { api } from '../lib/api-config'

const result = await api.processComplete(csvData, options)
```

## Environment Variables

### Required for Vercel Functions
```bash
# Core APIs
OPENAI_API_KEY=sk-...
VITE_GOOGLE_MAPS_API_KEY=AIza...
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...

# Notifications
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
EMAIL_USER=...
EMAIL_PASSWORD=...

# URLs
FRONTEND_URL=https://your-app.vercel.app
```

## Development Setup

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Run Vercel Functions Locally
```bash
# Start Vercel dev server (includes all functions)
vercel dev

# Functions available at:
# http://localhost:3000/api/process-complete
# http://localhost:3000/api/health
# etc.
```

### 3. Run Express Server (for real-time features)
```bash
# In another terminal
npm run server:dev

# Real-time features available at:
# http://localhost:3001/api/address-updates/stream
```

### 4. Run Frontend
```bash
# In another terminal
npm run dev

# Frontend available at:
# http://localhost:5173
```

## Deployment

### 1. Deploy to Vercel
```bash
# Deploy functions and frontend
vercel --prod
```

### 2. Deploy Express Server
Deploy to Railway, Render, or DigitalOcean for real-time features.

### 3. Update Environment Variables
Set all required environment variables in Vercel dashboard.

## Testing Migration

### 1. Test Core Functions
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test process-complete
curl -X POST http://localhost:3000/api/process-complete \
  -H "Content-Type: text/csv" \
  -d "Name,Address,City
Test,123 Main St,Asuncion"
```

### 2. Test Frontend Integration
- Upload a CSV file
- Verify processing works
- Check real-time updates

### 3. Test Real-time Features
- Verify SSE connections work
- Test notification system

## Benefits of Migration

### ✅ Advantages
- **Auto-scaling**: Handles traffic spikes automatically
- **Global CDN**: Fast response times worldwide
- **Zero maintenance**: No server management
- **Cost-effective**: Pay per request
- **Built-in monitoring**: Logs, metrics, alerts
- **Easy deployment**: Git push = deployment

### ⚠️ Considerations
- **Cold starts**: First request after idle period is slower
- **Execution limits**: 10s timeout on Hobby, 300s on Pro
- **No persistent state**: Each request is isolated
- **Vendor lock-in**: Tied to Vercel platform

## Rollback Plan

If issues arise, you can quickly rollback by:

1. **Revert frontend** to use Express endpoints
2. **Keep Express server** running
3. **Disable Vercel functions** if needed

## Support

For issues with the migration:
1. Check Vercel function logs
2. Verify environment variables
3. Test individual endpoints
4. Check Firebase configuration

## Next Steps

1. **Deploy to production** using Vercel
2. **Monitor performance** and usage
3. **Optimize functions** based on real usage
4. **Add API key management** for SaaS features
5. **Implement rate limiting** and usage tracking
