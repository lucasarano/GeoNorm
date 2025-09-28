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
        const { addresses } = req.body

        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: 'Addresses array is required' })
        }

        // Prepare confirmations for SMS
        const confirmations = addresses
            .filter((addr: any) => addr.phone && addr.needsConfirmation)
            .map((addr: any) => ({
                phoneNumber: addr.phone,
                originalAddress: addr.originalAddress,
                cleanedAddress: addr.cleanedAddress,
                confirmationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/confirm/${addr.id}`
            }))

        if (confirmations.length === 0) {
            return res.json({ message: 'No addresses require SMS confirmation', sent: 0 })
        }

        const results = await smsService.sendBulkConfirmations(confirmations)

        res.json({
            message: `SMS confirmations processed`,
            sent: results.successful,
            failed: results.failed,
            errors: results.errors
        })

    } catch (error: any) {
        console.error('Error sending confirmations:', error)
        res.status(500).json({ error: 'Failed to send confirmation SMS' })
    }
}
