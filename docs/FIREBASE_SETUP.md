# 🔥 Firebase Setup Guide for GeoNorm

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Enter project name: `geonorm` (or your preferred name)
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to your users)
5. Click "Done"

## Step 3: Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" → Web app (</>) icon
4. Enter app nickname: `GeoNorm Web`
5. Click "Register app"
6. Copy the Firebase configuration object

## Step 4: Update Environment Variables

Add these to your `.env` file:

```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id_here
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
FIREBASE_APP_ID=your_app_id_here
```

## Step 5: Set Up Firestore Security Rules

In Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Addresses are user-specific
    match /addresses/{addressId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // For development - allow all reads/writes
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Step 6: Test the Integration

1. Start your backend server:
   ```bash
   npm run server
   ```

2. Start your frontend:
   ```bash
   npm run dev
   ```

3. Go to the "Get API Key" tab
4. Register a new user
5. Test the API with your new API key

## API Usage Examples

### Register a User
```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User", "plan": "free"}'
```

### Use API Key
```bash
curl -X POST http://localhost:3001/api/geocode-both \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{"cleanedAddress": "Av. Mariscal López 1234, Asunción"}'
```

### Check Profile
```bash
curl -X GET http://localhost:3001/api/profile \
  -H "X-API-Key: your_api_key_here"
```

## Troubleshooting

### Common Issues

1. **Firebase connection error**: Check your environment variables
2. **Permission denied**: Update Firestore security rules
3. **API key not working**: Make sure you're using the correct header format

### Development vs Production

- **Development**: Use test mode security rules
- **Production**: Implement proper authentication and security rules
- **Environment**: Set `NODE_ENV=production` for production builds

## Next Steps

1. Set up proper authentication (optional)
2. Implement rate limiting per user
3. Add user management dashboard
4. Set up monitoring and analytics
5. Deploy to production

## Support

If you encounter issues:
1. Check the Firebase Console for errors
2. Check your backend logs
3. Verify environment variables
4. Test with a simple API call first
