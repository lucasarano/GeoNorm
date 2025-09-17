import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import dotenv from 'dotenv'

// Load environment variables immediately
dotenv.config()
dotenv.config({ path: '.env.local' })

let app: any, db: any, auth: any

function initializeFirebase() {
  if (app) return { app, db, auth } // Already initialized

  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID
  }

  console.log('🔍 Firebase config check:', {
    apiKey: firebaseConfig.apiKey ? '✅ Set' : '❌ Missing',
    authDomain: firebaseConfig.authDomain ? '✅ Set' : '❌ Missing',
    projectId: firebaseConfig.projectId ? '✅ Set' : '❌ Missing',
    storageBucket: firebaseConfig.storageBucket ? '✅ Set' : '❌ Missing',
    messagingSenderId: firebaseConfig.messagingSenderId ? '✅ Set' : '❌ Missing',
    appId: firebaseConfig.appId ? '✅ Set' : '❌ Missing'
  })

  const hasValidConfig = firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId

  if (hasValidConfig) {
    // Initialize Firebase
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    db = getFirestore(app)
    auth = getAuth(app)
    console.log('🔥 Firebase initialized successfully')
  } else {
    console.log('⚠️  Firebase config not found - running without Firebase')
    // Create mock objects to prevent crashes
    db = null
    auth = null
    app = null
  }

  return { app, db, auth }
}

// Initialize Firebase immediately
const firebase = initializeFirebase()
app = firebase.app
db = firebase.db
auth = firebase.auth

export { db, auth }

// Connect to emulators only if explicitly enabled
if (process.env.USE_FIREBASE_EMULATORS === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectAuthEmulator(auth, 'http://localhost:9099')
    console.log('🔥 Connected to Firebase emulators')
  } catch (error) {
    // Emulators already connected
  }
} else {
  console.log('🔥 Connected to Firebase production')
}

export default app
