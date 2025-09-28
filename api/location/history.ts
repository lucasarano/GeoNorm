import { VercelRequest, VercelResponse } from '@vercel/node'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { limit: limitParam = '50' } = req.query
        const limitNum = parseInt(limitParam as string, 10)

        // Query locations from Firebase
        const locationsRef = collection(db, 'locations')
        const q = query(
            locationsRef,
            orderBy('timestamp', 'desc'),
            limit(limitNum)
        )

        const snapshot = await getDocs(q)
        const locations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        res.json({
            success: true,
            locations,
            total: locations.length,
            metadata: {
                timestamp: new Date().toISOString(),
                limit: limitNum
            }
        })

    } catch (error: any) {
        console.error('Error fetching location history:', error)
        res.status(500).json({ error: 'Failed to fetch location history' })
    }
}
