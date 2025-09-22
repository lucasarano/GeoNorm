import { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { doc, getDoc, updateDoc, setDoc, collection, where, query, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore'
import { db } from '../backend/config/firebase.js'
import { emailService } from '../backend/services/emailService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { addressIds, userId } = (req.body as any) || {}

        if (!Array.isArray(addressIds) || addressIds.length === 0) {
            return res.status(400).json({ error: 'addressIds array is required' })
        }
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' })
        }

        const results: Array<{ addressId: string, success: boolean, email?: string, error?: string }> = []

        for (const addressId of addressIds) {
            try {
                const addressRef = doc(db, 'address_records', addressId)
                const addressSnap = await getDoc(addressRef)
                if (!addressSnap.exists()) {
                    results.push({ addressId, success: false, error: 'Address not found' })
                    continue
                }

                const addressData: any = addressSnap.data()
                if (addressData.userId !== userId) {
                    results.push({ addressId, success: false, error: 'Access denied' })
                    continue
                }

                if (!addressData.cleanedEmail) {
                    results.push({ addressId, success: false, error: 'No email address' })
                    continue
                }

                // Generate or reuse location link token
                let token = addressData.locationLinkToken as string | undefined
                if (!token) {
                    token = randomUUID()
                    const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    const locationLinksCollection = collection(db, 'location_links')
                    const linkRef = doc(locationLinksCollection, token)
                    await setDoc(linkRef, {
                        token,
                        addressId,
                        userId,
                        createdAt: serverTimestamp(),
                        expiresAt: Timestamp.fromDate(expiration),
                        status: 'sent'
                    })
                    await updateDoc(addressRef, {
                        locationLinkToken: token,
                        locationLinkStatus: 'sent',
                        locationLinkCreatedAt: serverTimestamp(),
                        locationLinkExpiresAt: Timestamp.fromDate(expiration),
                        updatedAt: serverTimestamp()
                    })
                }

                // Determine base URL for link
                const frontendEnv = process.env.FRONTEND_URL
                const headerOrigin = (req.headers['origin'] as string) || ''
                const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
                const baseUrl = frontendEnv || headerOrigin || vercelUrl || 'http://localhost:5173'
                const locationUrl = `${baseUrl}/location?token=${token}`
                const customerName = 'Cliente'

                const success = await emailService.sendLocationRequest(
                    addressData.cleanedEmail,
                    customerName,
                    locationUrl
                )

                if (success) {
                    await updateDoc(addressRef, {
                        locationLinkStatus: 'sent',
                        updatedAt: serverTimestamp()
                    })
                }

                results.push({
                    addressId,
                    success,
                    email: addressData.cleanedEmail,
                    error: success ? undefined : 'Email sending failed'
                })
            } catch (innerError: any) {
                results.push({ addressId, success: false, error: 'Processing error' })
            }
        }

        const successCount = results.filter(r => r.success).length
        const failureCount = results.filter(r => !r.success).length
        return res.json({
            totalProcessed: addressIds.length,
            successCount,
            failureCount,
            results
        })
    } catch (error: any) {
        console.error('Error sending location links via email:', error)
        return res.status(500).json({ error: 'Failed to send location links via email' })
    }
}


