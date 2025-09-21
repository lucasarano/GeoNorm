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
        const { userId } = req.body

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' })
        }

        const result = await userService.useFreeTrial(userId)
        res.status(200).json(result)
    } catch (error) {
        console.error('Error using free trial:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}
