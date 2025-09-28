import { VercelRequest, VercelResponse } from '@vercel/node'

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
        const { extractedData } = req.body

        if (!extractedData || !Array.isArray(extractedData)) {
            return res.status(400).json({ error: 'Extracted data is required' })
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' })
        }

        // Convert extracted data to CSV format for OpenAI
        const csvData = [
            'Address,City,State,Phone',
            ...extractedData.map((row: any) =>
                `"${row.address}","${row.city}","${row.state}","${row.phone}"`
            )
        ].join('\n')

        console.log('Sending data to OpenAI for cleaning...')

        // Dynamically import cleaning function (JS module) and call it
        // @ts-ignore - JS module without TypeScript types
        const cleanerModule: any = await import('../../backend/cleanParaguayAddresses.js')
        const cleanedCsv: string = await cleanerModule.cleanParaguayAddresses(apiKey, csvData)

        console.log('Received cleaned CSV from OpenAI')

        // Parse the cleaned CSV using our robust parser
        const { parseCSVLine } = await import('../../lib/utils/csvParser')
        const lines = cleanedCsv.trim().split('\n')
        const dataLines = lines.slice(1) // Skip header

        const cleaned = dataLines.map((line: string, index: number) => {
            const values = parseCSVLine(line)
            console.log(`Parsed cleaned row ${index + 1}:`, values)

            return {
                address: values[0] || '',
                city: values[1] || '',
                state: values[2] || '',
                phone: values[3] || '',
                email: values[4] || ''
            }
        })

        res.json({
            success: true,
            data: cleaned,
            metadata: {
                timestamp: new Date().toISOString(),
                totalRows: cleaned.length
            }
        })

    } catch (error: any) {
        console.error('OpenAI cleaning error:', error)
        res.status(500).json({ error: 'Failed to clean data with OpenAI', details: error.message })
    }
}
