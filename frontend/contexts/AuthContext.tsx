import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from '../lib/firebase'

// Use the User type from the auth instance
type User = import('firebase/auth').User

const AUTH_COOKIE_NAME = 'geoAuthToken'
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds

const isBrowser = typeof window !== 'undefined'

const writeAuthCookie = (token: string) => {
  if (!isBrowser) return

  document.cookie = `${AUTH_COOKIE_NAME}=${token};Max-Age=${AUTH_COOKIE_MAX_AGE};Path=/;SameSite=Lax`
}

const clearAuthCookie = () => {
  if (!isBrowser) return

  document.cookie = `${AUTH_COOKIE_NAME}=;Max-Age=0;Path=/;SameSite=Lax`
}

const readAuthCookie = () => {
  if (!isBrowser) return null

  const cookies = document.cookie.split(';')
  const authCookie = cookies.find(cookie =>
    cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`)
  )

  if (authCookie) {
    return authCookie.split('=')[1]
  }

  return null
}

const storeAuthToken = async (user: User) => {
  try {
    const token = await user.getIdToken()
    writeAuthCookie(token)
  } catch (error) {
    console.error('Failed to store auth token', error)
  }
}

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  signup: (email: string, password: string, name: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const signup = async (email: string, password: string, name: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    // Update user profile with display name
    await updateProfile(user, {
      displayName: name
    })

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      createdAt: new Date().toISOString(),
      plan: 'free',
      usage: {
        addressesProcessed: 0,
        lastReset: new Date().toISOString()
      }
    })

    await storeAuthToken(user)
  }

  const login = async (email: string, password: string) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password)
    await storeAuthToken(user)
  }

  const loginWithGoogle = async () => {
    const { user } = await signInWithPopup(auth, googleProvider)

    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', user.uid))

    if (!userDoc.exists()) {
      // Create user document in Firestore for new Google users
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName || 'Usuario',
        email: user.email,
        createdAt: new Date().toISOString(),
        plan: 'free',
        usage: {
          addressesProcessed: 0,
          lastReset: new Date().toISOString()
        }
      })
    }

    await storeAuthToken(user)
  }

  const logout = async () => {
    clearAuthCookie()
    await signOut(auth)
  }

  useEffect(() => {
    const initializeAuth = async () => {
      // First, check if we have a stored token
      const storedToken = readAuthCookie()

      if (storedToken) {
        try {
          // Try to verify the token is still valid by getting a fresh token
          const user = auth.currentUser
          if (user) {
            const freshToken = await user.getIdToken(true) // Force refresh
            writeAuthCookie(freshToken)
            setCurrentUser(user)
          } else {
            // Token exists but no user, clear it
            clearAuthCookie()
          }
        } catch (error) {
          // Token is invalid, clear it
          console.log('Stored token is invalid, clearing...')
          clearAuthCookie()
        }
      }

      // Set up the auth state listener
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user)
        setLoading(false)

        if (!user) {
          clearAuthCookie()
        }
      })

      return unsubscribe
    }

    initializeAuth()
  }, [])

  const value = {
    currentUser,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
