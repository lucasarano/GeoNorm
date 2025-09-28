import { VercelRequest, VercelResponse } from '@vercel/node'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
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
        const { userId, dateFrom, dateTo } = req.query as any

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        // Get all addresses for the user
        const q = query(
            collection(db, 'address_records'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        )

        const snapshot = await getDocs(q)
        const addresses = snapshot.docs.map(doc => doc.data())

        // Calculate statistics
        const stats = {
            total: addresses.length,
            byStatus: {
                high_confidence: addresses.filter(a => a.status === 'high_confidence').length,
                medium_confidence: addresses.filter(a => a.status === 'medium_confidence').length,
                low_confidence: addresses.filter(a => a.status === 'low_confidence').length,
                failed: addresses.filter(a => a.status === 'failed').length
            },
            byConfirmation: {
                confirmed: addresses.filter(a => a.confirmationStatus === 'confirmed').length,
                pending: addresses.filter(a => a.confirmationStatus === 'pending').length,
                rejected: addresses.filter(a => a.confirmationStatus === 'rejected').length
            },
            geocoding: {
                withCoordinates: addresses.filter(a => a.coordinates?.lat && a.coordinates?.lng).length,
                withoutCoordinates: addresses.filter(a => !a.coordinates?.lat || !a.coordinates?.lng).length
            },
            communication: {
                smsSent: addresses.filter(a => a.smsSent).length,
                emailSent: addresses.filter(a => a.emailSent).length,
                locationLinksSent: addresses.filter(a => a.locationLinkStatus === 'sent').length
            },
            averageConfidence: addresses.reduce((sum, a) => sum + (a.confidence || 0), 0) / addresses.length || 0,
            lastProcessed: addresses[0]?.createdAt?.toDate?.()?.toISOString() || null
        }

        res.json({
            success: true,
            stats,
            metadata: {
                userId,
                dateFrom,
                dateTo,
                timestamp: new Date().toISOString()
            }
        })

    } catch (error: any) {
        console.error('Stats error:', error)
        res.status(500).json({ error: 'Failed to get statistics', details: error.message })
    }
}
