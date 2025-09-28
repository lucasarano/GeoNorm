import { VercelRequest, VercelResponse } from '@vercel/node'
import { doc, getDoc } from 'firebase/firestore'
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
        const { id } = req.query as { id: string }

        if (!id) {
            return res.status(400).json({ error: 'Address ID is required' })
        }

        const addressRef = doc(db, 'address_records', id)
        const addressSnap = await getDoc(addressRef)

        if (!addressSnap.exists()) {
            return res.status(404).json({ error: 'Address not found' })
        }

        const addressData = addressSnap.data()

        res.json({
            success: true,
            address: {
                id: addressSnap.id,
                ...addressData
            },
            metadata: {
                timestamp: new Date().toISOString()
            }
        })

    } catch (error: any) {
        console.error('Get address error:', error)
        res.status(500).json({ error: 'Failed to get address', details: error.message })
    }
}
