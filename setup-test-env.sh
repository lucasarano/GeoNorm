#!/bin/bash

# Setup script for testing GeoNorm API
echo "🔧 Setting up GeoNorm API test environment..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << EOF
# GeoNorm API Test Environment
NODE_ENV=development

# OpenAI API Key (required for processing)
OPENAI_API_KEY=your-openai-api-key-here

# Google Maps API Key (required for geocoding)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Firebase Configuration (required for database)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef

# Twilio Configuration (optional for SMS)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Email Configuration (optional for email)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:5173
EOF
    echo "✅ Created .env.local file"
    echo "⚠️  Please update the API keys in .env.local with your actual values"
else
    echo "✅ .env.local already exists"
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
else
    echo "✅ Vercel CLI already installed"
fi

# Check if required environment variables are set
echo "🔍 Checking environment variables..."

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your-openai-api-key-here" ]; then
    echo "⚠️  OPENAI_API_KEY not set or using placeholder"
    echo "   Please set your OpenAI API key in .env.local"
fi

if [ -z "$VITE_GOOGLE_MAPS_API_KEY" ] || [ "$VITE_GOOGLE_MAPS_API_KEY" = "your-google-maps-api-key-here" ]; then
    echo "⚠️  VITE_GOOGLE_MAPS_API_KEY not set or using placeholder"
    echo "   Please set your Google Maps API key in .env.local"
fi

if [ -z "$FIREBASE_PROJECT_ID" ] || [ "$FIREBASE_PROJECT_ID" = "your-project-id" ]; then
    echo "⚠️  Firebase configuration not set or using placeholders"
    echo "   Please set your Firebase configuration in .env.local"
fi

echo ""
echo "🚀 Setup complete! Next steps:"
echo "1. Update API keys in .env.local"
echo "2. Run: npm run vercel:dev"
echo "3. In another terminal, run: node test-api.js"
echo ""
echo "📚 For more information, see PRODUCTION_API.md"
