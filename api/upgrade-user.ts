import { VercelRequest, VercelResponse } from '@vercel/node'
import { userService } from '../backend/services/firebaseUserService'

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
        const { userId, plan, subscriptionId } = req.body

        if (!userId || !plan) {
            return res.status(400).json({ error: 'User ID and plan are required' })
        }

        if (!['pro', 'enterprise'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan. Must be pro or enterprise' })
        }

        await userService.upgradeUser(userId, plan, subscriptionId)

        res.status(200).json({
            success: true,
            message: `Successfully upgraded to ${plan} plan`
        })
    } catch (error) {
        console.error('Error upgrading user:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}
