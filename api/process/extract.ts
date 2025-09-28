import { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPrompt } from '../../backend/buildPrompt.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
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
        const { csvData, options = {} } = req.body

        if (!csvData) {
            return res.status(400).json({ error: 'CSV data is required' })
        }

        // Use your existing buildPrompt function
        const prompt = buildPrompt(csvData)

        // Call OpenAI for field extraction
        const openaiApiKey = process.env.OPENAI_API_KEY
        if (!openaiApiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' })
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 4000
            })
        })

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()
        const extractedCsv = data.choices[0]?.message?.content || ''

        res.json({
            success: true,
            extractedCsv,
            metadata: {
                model: 'gpt-4o',
                timestamp: new Date().toISOString(),
                options
            }
        })

    } catch (error: any) {
        console.error('Extract error:', error)
        res.status(500).json({ error: 'Failed to extract fields', details: error.message })
    }
}
