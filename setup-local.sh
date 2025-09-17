#!/bin/bash

# GeoNorm Local Development Setup Script
echo "🚀 Setting up GeoNorm for local development..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please copy your Vercel environment variables to .env file first."
    echo "   See LOCAL_DEVELOPMENT.md for detailed instructions."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check for required environment variables
echo "🔍 Checking environment variables..."

# Check backend variables
if [ -z "$FIREBASE_API_KEY" ]; then
    echo "⚠️  FIREBASE_API_KEY not found in .env"
fi

if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo "⚠️  GOOGLE_MAPS_API_KEY not found in .env"
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY not found in .env"
fi

# Check frontend variables
if [ -z "$VITE_FIREBASE_API_KEY" ]; then
    echo "⚠️  VITE_FIREBASE_API_KEY not found in .env"
fi

if [ -z "$VITE_GOOGLE_MAPS_API_KEY" ]; then
    echo "⚠️  VITE_GOOGLE_MAPS_API_KEY not found in .env"
fi

echo ""
echo "🎯 Starting development servers..."
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both servers
npm run start:all
