import { VercelRequest, VercelResponse } from '@vercel/node'
import { smsService } from '../../lib/services/smsService'

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
        const { phone } = req.body

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' })
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
        const locationUrl = `${baseUrl}/location?orderID=TEST-${Date.now()}`
        const message = `Hola! Este es un SMS de prueba. Para compartir tu ubicación, haz clic aquí: ${locationUrl}`

        const success = await smsService.sendSMS(phone, message)

        res.json({
            success: success,
            messageId: success ? 'sent' : undefined,
            locationUrl,
            error: success ? undefined : 'SMS sending failed'
        })

    } catch (error: any) {
        console.error('Error sending test SMS:', error)
        res.status(500).json({ error: 'Failed to send test SMS' })
    }
}
