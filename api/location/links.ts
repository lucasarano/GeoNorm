import { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { doc, getDoc, updateDoc, setDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        const { addressIds, userId } = req.body || {}

        if (!Array.isArray(addressIds) || addressIds.length === 0) {
            return res.status(400).json({ error: 'addressIds array is required' })
        }

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
        const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        const locationLinksCollection = collection(db, 'location_links')
        const results: Array<{ addressId: string, token: string, url: string, status: string, expiresAt?: string }> = []

        for (const addressId of addressIds) {
            try {
                const addressRef = doc(db, 'address_records', addressId)
                const addressSnap = await getDoc(addressRef)

                if (!addressSnap.exists()) {
                    console.warn(`[LOCATION_LINK] Address record not found: ${addressId}`)
                    continue
                }

                const addressData: any = addressSnap.data()
                if (addressData.userId !== userId) {
                    console.warn(`[LOCATION_LINK] User mismatch for address ${addressId}`)
                    continue
                }

                const token = randomUUID()
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

                results.push({
                    addressId,
                    token,
                    url: `${baseUrl}/location?token=${token}`,
                    status: 'sent',
                    expiresAt: expiration.toISOString()
                })
            } catch (innerError) {
                console.error('Error generating link for address', addressId, innerError)
            }
        }

        res.json({ links: results })

    } catch (error: any) {
        console.error('Error creating location links:', error)
        res.status(500).json({ error: 'Failed to create location links' })
    }
}
