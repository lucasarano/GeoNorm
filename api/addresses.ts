import { VercelRequest, VercelResponse } from '@vercel/node'
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { action, userId, id, status, limit: limitParam = '50', offset = '0', sortBy = 'createdAt', sortOrder = 'desc' } = req.query as Record<string, string>

        if (action === 'get' && id) {
            // Get specific address
            const docRef = doc(db, 'address_records', id)
            const docSnap = await getDoc(docRef)

            if (!docSnap.exists()) {
                return res.status(404).json({ error: 'Address not found' })
            }

            return res.json({
                success: true,
                address: {
                    id: docSnap.id,
                    ...docSnap.data()
                }
            })
        }

        // List addresses (default action)
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        const limitNum = parseInt(limitParam, 10)
        const offsetNum = parseInt(offset, 10)

        let q = query(
            collection(db, 'address_records'),
            where('userId', '==', userId),
            orderBy(sortBy, sortOrder as 'asc' | 'desc'),
            limit(limitNum)
        )

        if (status) {
            q = query(q, where('status', '==', status))
        }

        const snapshot = await getDocs(q)
        const addresses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        res.json({
            success: true,
            addresses,
            pagination: {
                limit: limitNum,
                offset: offsetNum,
                total: addresses.length,
                hasMore: addresses.length === limitNum
            },
            metadata: {
                timestamp: new Date().toISOString(),
                userId,
                filters: { status }
            }
        })

    } catch (error: unknown) {
        console.error('Addresses endpoint error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).json({ error: 'Failed to process request', details: message })
    }
}
