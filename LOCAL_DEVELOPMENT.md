# Local Development Setup Guide

This guide will help you set up and test your GeoNorm project locally using environment variables from Vercel.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Access to your Vercel project environment variables

## Step 1: Get Environment Variables from Vercel

### Option A: Using Vercel CLI
```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# Login to Vercel
vercel login

# Pull environment variables from your project
vercel env pull .env.local
```

### Option B: Manual Setup
1. Go to your Vercel dashboard
2. Navigate to your project
3. Go to Settings → Environment Variables
4. Copy each variable and add it to your `.env` file

## Step 2: Configure Environment Variables

The project uses two types of environment variables:

### Backend Variables (in `.env`)
These are loaded by the backend server using `dotenv`:

```env
# Firebase Configuration
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id

# Google Maps API
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL_NAME=gemini-1.5-flash
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_API_VERSION=v1beta

# Twilio SMS Service
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Email Service
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Server Port
PORT=3001
```

### Frontend Variables (prefixed with VITE_)
These are loaded by Vite and available in the browser:

```env
# Frontend Firebase Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# Frontend Google Maps API
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

## Step 3: Install Dependencies

```bash
# Install all dependencies
npm install
```

## Step 4: Start Development Servers

### Option A: Start Both Servers (Recommended)
```bash
# This starts both backend and frontend concurrently
npm run start:all
```

### Option B: Start Servers Separately
```bash
# Terminal 1: Start backend server
npm run server:dev

# Terminal 2: Start frontend development server
npm run dev
```

## Step 5: Access Your Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Environment Variable Mapping

| Vercel Variable | Local Backend | Local Frontend | Purpose |
|----------------|---------------|----------------|---------|
| `FIREBASE_API_KEY` | `FIREBASE_API_KEY` | `VITE_FIREBASE_API_KEY` | Firebase authentication |
| `FIREBASE_AUTH_DOMAIN` | `FIREBASE_AUTH_DOMAIN` | `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `FIREBASE_PROJECT_ID` | `FIREBASE_PROJECT_ID` | `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `GOOGLE_MAPS_API_KEY` | `GOOGLE_MAPS_API_KEY` | `VITE_GOOGLE_MAPS_API_KEY` | Google Maps geocoding |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` | - | OpenAI address cleaning |
| `GEMINI_API_KEY` | `GEMINI_API_KEY` | - | Google Gemini AI |
| `TWILIO_ACCOUNT_SID` | `TWILIO_ACCOUNT_SID` | - | SMS service |
| `TWILIO_AUTH_TOKEN` | `TWILIO_AUTH_TOKEN` | - | SMS service |
| `TWILIO_PHONE_NUMBER` | `TWILIO_PHONE_NUMBER` | - | SMS service |

## Troubleshooting

### Common Issues

1. **"Firebase config not found"**
   - Ensure all Firebase environment variables are set
   - Check that `VITE_` prefix is used for frontend variables

2. **"Google Maps API key not configured"**
   - Verify `GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` are set
   - Check API key permissions in Google Cloud Console

3. **"OpenAI API key not configured"**
   - Ensure `OPENAI_API_KEY` is set in your `.env` file

4. **CORS errors**
   - The backend is configured to allow localhost:5173, 5174, 5175, and 3000
   - If using a different port, update the CORS configuration in `backend/index.ts`

5. **Port conflicts**
   - Backend runs on port 3001 by default
   - Frontend runs on port 5173 by default
   - Change `PORT` in `.env` to use a different backend port

### Debugging Environment Variables

```bash
# Check if environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env.FIREBASE_API_KEY ? 'Firebase key loaded' : 'Firebase key missing')"

# Check frontend environment variables
npm run dev
# Then open browser console and check: console.log(import.meta.env.VITE_FIREBASE_API_KEY)
```

## Firebase Emulators (Optional)

For local testing without hitting production Firebase:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Set `USE_FIREBASE_EMULATORS=true` in your `.env` file
3. Start emulators: `firebase emulators:start`
4. The app will automatically connect to local emulators

## Production vs Local Differences

- **Database**: Local uses same Firebase project as production (unless using emulators)
- **API Keys**: Same keys as production (be careful with rate limits)
- **CORS**: Configured for localhost development
- **File Uploads**: Uses local file system instead of cloud storage

## Next Steps

1. Copy your Vercel environment variables to the `.env` file
2. Run `npm run start:all`
3. Open http://localhost:5173
4. Test the address processing pipeline
5. Check the browser console and server logs for any errors

## Security Notes

- Never commit `.env` files to version control
- Use different API keys for development if possible
- Consider using Firebase emulators for safer local testing
- Monitor API usage to avoid hitting production limits
