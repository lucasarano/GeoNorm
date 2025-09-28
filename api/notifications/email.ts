import { VercelRequest, VercelResponse } from '@vercel/node'
import { emailService } from '../../lib/services/emailService'

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
        const { email, name } = req.body

        if (!email) {
            return res.status(400).json({ error: 'Email address is required' })
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
        const locationUrl = `${baseUrl}/location?orderID=TEST-${Date.now()}`
        const customerName = name || 'Cliente'

        const success = await emailService.sendLocationRequest(email, customerName, locationUrl)

        res.json({
            success: success,
            messageId: success ? 'sent' : undefined,
            locationUrl,
            error: success ? undefined : 'Email sending failed'
        })

    } catch (error: any) {
        console.error('Error sending test email:', error)
        res.status(500).json({ error: 'Failed to send test email' })
    }
}
