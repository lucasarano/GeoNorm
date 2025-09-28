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
        // Check environment variables
        const envCheck = {
            OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
            GOOGLE_MAPS_API_KEY: !!process.env.VITE_GOOGLE_MAPS_API_KEY,
            FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
            TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
            EMAIL_USER: !!process.env.EMAIL_USER
        }

        const allEnvVarsPresent = Object.values(envCheck).every(Boolean)

        res.json({
            status: 'OK',
            message: 'GeoNorm API Server is running',
            timestamp: new Date().toISOString(),
            environment: {
                nodeEnv: process.env.NODE_ENV || 'development',
                allEnvVarsPresent,
                envCheck
            },
            version: '2.0.0'
        })

    } catch (error: any) {
        console.error('Health check error:', error)
        res.status(500).json({
            status: 'ERROR',
            message: 'Health check failed',
            error: error.message
        })
    }
}