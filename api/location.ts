import { VercelRequest, VercelResponse } from '@vercel/node'
import { collection, query, where, getDocs, orderBy, limit, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { randomUUID } from 'crypto'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    try {
        switch (req.method) {
            case 'GET':
                return await handleGetLocation(req, res)
            case 'POST':
                return await handleSaveLocation(req, res)
            case 'PUT':
                return await handleCreateLinks(req, res)
            default:
                return res.status(405).json({ error: 'Method not allowed' })
        }

    } catch (error: unknown) {
        console.error('Location endpoint error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).json({ error: 'Failed to process location request', details: message })
    }
}

async function handleGetLocation(req: VercelRequest, res: VercelResponse) {
    const { action, userId, limit: limitParam = '50' } = req.query as Record<string, string>

    if (action === 'history') {
        // Get location history
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        const limitNum = parseInt(limitParam, 10)
        const q = query(
            collection(db, 'location_updates'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(limitNum)
        )

        const snapshot = await getDocs(q)
        const history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        return res.json({
            success: true,
            history,
            total: history.length
        })
    }

    return res.status(400).json({ error: 'Invalid action. Use: history' })
}

async function handleSaveLocation(req: VercelRequest, res: VercelResponse) {
    const { userId, addressId, coordinates, accuracy, timestamp, method } = req.body || {}

    if (!userId || !addressId || !coordinates) {
        return res.status(400).json({
            error: 'userId, addressId, and coordinates are required'
        })
    }

    const locationId = randomUUID()
    const locationData = {
        id: locationId,
        userId,
        addressId,
        coordinates: {
            lat: coordinates.lat,
            lng: coordinates.lng
        },
        accuracy: accuracy || null,
        method: method || 'manual',
        timestamp: timestamp || new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }

    await setDoc(doc(collection(db, 'location_updates'), locationId), locationData)

    // Update the address record with location info
    if (addressId) {
        const addressRef = doc(db, 'address_records', addressId)
        await updateDoc(addressRef, {
            userProvidedLocation: coordinates,
            locationAccuracy: accuracy,
            locationMethod: method,
            lastLocationUpdate: serverTimestamp(),
            locationLinkStatus: 'completed'
        })
    }

    return res.json({
        success: true,
        locationId,
        message: 'Location saved successfully'
    })
}

async function handleCreateLinks(req: VercelRequest, res: VercelResponse) {
    const { addressIds, userId } = req.body || {}

    if (!addressIds || !Array.isArray(addressIds) || !userId) {
        return res.status(400).json({
            error: 'addressIds array and userId are required'
        })
    }

    const links = []
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    for (const addressId of addressIds) {
        const token = randomUUID()
        const linkData = {
            token,
            addressId,
            userId,
            expiresAt,
            createdAt: serverTimestamp(),
            status: 'pending'
        }

        await setDoc(doc(collection(db, 'location_links'), token), linkData)

        // Update address record
        const addressRef = doc(db, 'address_records', addressId)
        await updateDoc(addressRef, {
            locationLinkToken: token,
            locationLinkStatus: 'pending',
            locationLinkExpiresAt: expiresAt
        })

        links.push({
            addressId,
            token,
            url: `${process.env.FRONTEND_URL || 'https://geonorm-app.vercel.app'}/location?token=${token}`,
            expiresAt: expiresAt.toISOString()
        })
    }

    return res.json({
        success: true,
        links,
        message: `Created ${links.length} location collection links`
    })
}
