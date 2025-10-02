import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'

export class FirebaseAdminInitError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'FirebaseAdminInitError'
    }
}

let cachedAuth: Auth | null = null

function normalizePrivateKey(key: string): string {
    return key.replace(/\\n/g, '\n')
}

function loadServiceAccountFromEnv(): ServiceAccount | null {
    const candidateKeys = [
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
        process.env.FIREBASE_SERVICE_ACCOUNT,
        process.env.FIREBASE_ADMIN_CREDENTIALS
    ] as const

    for (const raw of candidateKeys) {
        if (!raw) continue
        try {
            const parsed = JSON.parse(raw) as Partial<ServiceAccount>
            if (parsed.projectId && parsed.clientEmail && parsed.privateKey) {
                return {
                    projectId: parsed.projectId,
                    clientEmail: parsed.clientEmail,
                    privateKey: normalizePrivateKey(parsed.privateKey)
                }
            }
        } catch (error) {
            console.error('[FIREBASE_ADMIN] Failed to parse service account JSON from environment variable', error)
        }
    }

    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (projectId && clientEmail && privateKey) {
        return {
            projectId,
            clientEmail,
            privateKey: normalizePrivateKey(privateKey)
        }
    }

    return null
}

function initializeFirebaseAdmin(): Auth {
    if (cachedAuth) {
        return cachedAuth
    }

    if (getApps().length === 0) {
        const serviceAccount = loadServiceAccountFromEnv()

        if (serviceAccount) {
            initializeApp({
                credential: cert(serviceAccount)
            })
        } else {
            try {
                initializeApp({
                    credential: applicationDefault()
                })
            } catch (_error) {
                throw new FirebaseAdminInitError(
                    'Firebase Admin SDK is not configured. Provide service account credentials via FIREBASE_SERVICE_ACCOUNT_KEY or set GOOGLE_APPLICATION_CREDENTIALS.'
                )
            }
        }
    }

    cachedAuth = getAuth()
    return cachedAuth
}

export function getFirebaseAuth(): Auth {
    return initializeFirebaseAdmin()
}

export async function verifyFirebaseIdToken(idToken: string) {
    const auth = getFirebaseAuth()
    return auth.verifyIdToken(idToken)
}
