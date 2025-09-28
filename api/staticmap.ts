import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
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
        const { lat, lng, zoom = '14', size = '600x300' } = req.query
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY

        if (!apiKey) {
            console.error('[STATIC_MAP] No API key found')
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }

        if (!lat || !lng) {
            console.error('[STATIC_MAP] Missing lat/lng:', { lat, lng })
            return res.status(400).json({ error: 'lat and lng are required' })
        }

        const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=color:red%7C${lat},${lng}&key=${apiKey}`
        console.log('[STATIC_MAP] Requesting:', url.replace(apiKey, '[API_KEY]'))

        const response = await fetch(url)
        console.log('[STATIC_MAP] Google response status:', response.status)

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[STATIC_MAP] Google API error:', response.status, errorText)
            return res.status(500).json({ error: `Google API error: ${response.status} - ${errorText}` })
        }

        const contentType = response.headers.get('content-type')
        console.log('[STATIC_MAP] Content-Type from Google:', contentType)

        if (contentType && contentType.includes('image')) {
            res.setHeader('Content-Type', 'image/png')
            res.setHeader('Cache-Control', 'public, max-age=3600')

            // Use arrayBuffer for better compatibility
            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            res.send(buffer)
        } else {
            const text = await response.text()
            console.error('[STATIC_MAP] Unexpected response:', text)
            res.status(500).json({ error: 'Unexpected response from Google Maps API' })
        }

    } catch (error: any) {
        console.error('[STATIC_MAP] Error:', error)
        res.status(500).json({ error: 'Failed to fetch static map', details: error.message })
    }
}
