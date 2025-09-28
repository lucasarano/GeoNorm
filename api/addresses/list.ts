import { VercelRequest, VercelResponse } from '@vercel/node'
import { collection, query, where, getDocs, orderBy, limit, startAfter } from 'firebase/firestore'
import { db } from '../../lib/firebase'

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
        const {
            userId,
            status,
            limit: limitParam = '50',
            offset = '0',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query as any

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        const limitNum = parseInt(limitParam, 10)
        const offsetNum = parseInt(offset, 10)

        let q = query(
            collection(db, 'address_records'),
            where('userId', '==', userId),
            orderBy(sortBy, sortOrder),
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

    } catch (error: any) {
        console.error('List addresses error:', error)
        res.status(500).json({ error: 'Failed to list addresses', details: error.message })
    }
}
