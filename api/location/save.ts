import { VercelRequest, VercelResponse } from '@vercel/node'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
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
        const { latitude, longitude, accuracy, orderID, userAgent } = req.body

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' })
        }

        const locationData = {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            accuracy: accuracy ? parseFloat(accuracy) : null,
            orderID: orderID || null,
            phoneNumber: orderID, // Using orderID as phone number for now
            userAgent: userAgent || null,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        }

        // Save to Firebase
        const docRef = await addDoc(collection(db, 'locations'), locationData)

        console.log(`[LOCATION] Saved location: ${latitude}, ${longitude} (Order: ${orderID})`)

        res.json({
            success: true,
            location: { id: docRef.id, ...locationData }
        })

    } catch (error: any) {
        console.error('Error saving location:', error)
        res.status(500).json({ error: 'Failed to save location' })
    }
}
