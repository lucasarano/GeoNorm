import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { FirebaseAdminInitError, verifyFirebaseIdToken } from './firebaseAdmin.js'

export async function requireAuth(
    req: VercelRequest,
    res: VercelResponse
): Promise<DecodedIdToken | null> {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid Authorization header'
        })
        return null
    }

    const token = authHeader.slice('Bearer '.length).trim()

    if (!token) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Authorization header is empty'
        })
        return null
    }

    try {
        const decoded = await verifyFirebaseIdToken(token)
        return decoded
    } catch (error: unknown) {
        if (error instanceof FirebaseAdminInitError) {
            console.error('[AUTH] Firebase Admin initialization error:', error.message)
            res.status(500).json({
                error: 'Server configuration error',
                message: error.message
            })
            return null
        }

        console.error('[AUTH] Failed to verify ID token:', error)
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired authentication token'
        })
        return null
    }
}
