import { VercelRequest, VercelResponse } from '@vercel/node'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
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
        const { userId, dateFrom, dateTo, limit: limitParam = '100' } = req.query as Record<string, string>

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        const limitNum = parseInt(limitParam, 10)

        // Build query
        let q = query(
            collection(db, 'address_records'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(limitNum)
        )

        // Add date filtering if provided
        if (dateFrom) {
            const fromDate = new Date(dateFrom)
            q = query(q, where('createdAt', '>=', fromDate))
        }

        if (dateTo) {
            const toDate = new Date(dateTo)
            q = query(q, where('createdAt', '<=', toDate))
        }

        const snapshot = await getDocs(q)
        const records = snapshot.docs.map(doc => doc.data())

        // Calculate statistics
        const stats = {
            totalProcessed: records.length,
            highConfidence: records.filter(r => r.status === 'high_confidence').length,
            mediumConfidence: records.filter(r => r.status === 'medium_confidence').length,
            lowConfidence: records.filter(r => r.status === 'low_confidence').length,
            failed: records.filter(r => r.status === 'failed').length,
            withZipCodes: records.filter(r => r.zipCode && r.zipCode.zipCode).length,
            withUserLocations: records.filter(r => r.userProvidedLocation).length,
            averageConfidence: records.length > 0
                ? records.reduce((sum, r) => sum + (r.geocoding?.confidence || 0), 0) / records.length
                : 0
        }

        // Group by date for trends
        const dailyStats = new Map()
        records.forEach(record => {
            const date = record.createdAt?.toDate?.()?.toISOString().split('T')[0] || 'unknown'
            if (!dailyStats.has(date)) {
                dailyStats.set(date, { date, count: 0, highConf: 0, medConf: 0, lowConf: 0 })
            }
            const dayStats = dailyStats.get(date)
            dayStats.count++
            if (record.status === 'high_confidence') dayStats.highConf++
            else if (record.status === 'medium_confidence') dayStats.medConf++
            else if (record.status === 'low_confidence') dayStats.lowConf++
        })

        const trends = Array.from(dailyStats.values()).sort((a, b) => a.date.localeCompare(b.date))

        return res.json({
            success: true,
            stats,
            trends,
            dateRange: {
                from: dateFrom || null,
                to: dateTo || null
            },
            metadata: {
                timestamp: new Date().toISOString(),
                userId,
                recordCount: records.length
            }
        })

    } catch (error: unknown) {
        console.error('Analytics endpoint error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).json({ error: 'Failed to get analytics', details: message })
    }
}
