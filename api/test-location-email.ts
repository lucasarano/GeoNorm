import { VercelRequest, VercelResponse } from '@vercel/node'
// Reuse existing email service implementation
import { emailService } from '../backend/services/emailService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
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
        const { email, name } = (req.body as any) || {}

        if (!email || typeof email !== 'string' || email.trim() === '') {
            return res.status(400).json({ error: 'Email address is required' })
        }

        // Prefer explicit FRONTEND_URL; gracefully fallback to request origin or Vercel URL
        const frontendEnv = process.env.FRONTEND_URL
        const headerOrigin = (req.headers['origin'] as string) || ''
        const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
        const baseUrl = frontendEnv || headerOrigin || vercelUrl || 'http://localhost:5173'
        const locationUrl = `${baseUrl}/location?orderID=TEST-${Date.now()}`
        const customerName = (typeof name === 'string' && name.trim()) ? name.trim() : 'Cliente'

        const success = await emailService.sendLocationRequest(email.trim(), customerName, locationUrl)

        return res.json({
            success,
            messageId: success ? 'sent' : undefined,
            locationUrl,
            error: success ? undefined : 'Email sending failed'
        })
    } catch (error: any) {
        console.error('Error sending test email:', error)
        return res.status(500).json({ error: 'Failed to send test email' })
    }
}


