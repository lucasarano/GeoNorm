// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Build config from VITE_* (local) or FIREBASE_WEBAPP_CONFIG (App Hosting)
const webAppConfigFromFirebase = (() => {
  try {
    const str = (import.meta as any).env?.FIREBASE_WEBAPP_CONFIG as string | undefined
    return str ? JSON.parse(str) : undefined
  } catch {
    return undefined
  }
})()

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (webAppConfigFromFirebase?.apiKey as string | undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (webAppConfigFromFirebase?.authDomain as string | undefined),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (webAppConfigFromFirebase?.projectId as string | undefined),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (webAppConfigFromFirebase?.storageBucket as string | undefined),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (webAppConfigFromFirebase?.messagingSenderId as string | undefined),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (webAppConfigFromFirebase?.appId as string | undefined),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || (webAppConfigFromFirebase?.measurementId as string | undefined)
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app)

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider()

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app)

export default app
