import { VercelRequest, VercelResponse } from '@vercel/node'
import { smsService } from '../lib/services/smsService.js'
import { emailService } from '../lib/services/emailService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { action, ...data } = req.body || {}

        switch (action) {
            case 'send-sms':
                return await handleSendSMS(data, res)
            case 'send-email':
                return await handleSendEmail(data, res)
            case 'test-sms':
                return await handleTestSMS(data, res)
            case 'test-email':
                return await handleTestEmail(data, res)
            default:
                return res.status(400).json({ error: 'Invalid action. Use: send-sms, send-email, test-sms, test-email' })
        }

    } catch (error: unknown) {
        console.error('Notifications endpoint error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).json({ error: 'Failed to process notification', details: message })
    }
}

async function handleSendSMS(data: any, res: VercelResponse) {
    const { addresses } = data

    if (!addresses || !Array.isArray(addresses)) {
        return res.status(400).json({ error: 'addresses array is required' })
    }

    const result = await smsService.sendBulkConfirmations(addresses)
    return res.json({
        success: true,
        result,
        message: `SMS sent to ${result.successful} addresses, ${result.failed} failed`
    })
}

async function handleSendEmail(data: any, res: VercelResponse) {
    const { email, name, locationUrl } = data

    if (!email || !name) {
        return res.status(400).json({ error: 'email and name are required' })
    }

    const success = await emailService.sendLocationRequest(email, name, locationUrl || '#')
    return res.json({
        success,
        message: success ? 'Email sent successfully' : 'Failed to send email'
    })
}

async function handleTestSMS(data: any, res: VercelResponse) {
    const { phone } = data

    if (!phone) {
        return res.status(400).json({ error: 'phone is required' })
    }

    const result = await smsService.sendTestMessage(phone, 'Test message from GeoNorm API')
    return res.json({
        success: result.success,
        message: result.message,
        details: result
    })
}

async function handleTestEmail(data: any, res: VercelResponse) {
    const { email, name } = data

    if (!email || !name) {
        return res.status(400).json({ error: 'email and name are required' })
    }

    const success = await emailService.sendLocationRequest(email, name, 'https://example.com/test')
    return res.json({
        success,
        message: success ? 'Test email sent successfully' : 'Failed to send test email'
    })
}
