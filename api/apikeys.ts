import { VercelRequest, VercelResponse } from '@vercel/node'
import { apiKeyService } from '../lib/services/apiKeyService.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    try {
        switch (req.method) {
            case 'GET':
                return await handleGetApiKeys(req, res)
            case 'POST':
                return await handleCreateApiKey(req, res)
            case 'PUT':
                return await handleUpdateApiKey(req, res)
            case 'DELETE':
                return await handleDeleteApiKey(req, res)
            default:
                return res.status(405).json({ error: 'Method not allowed' })
        }
    } catch (error: unknown) {
        console.error('API Keys endpoint error:', error)
        const message = error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
        return res.status(500).json({
            error: 'Internal server error',
            details: message
        })
    }
}

async function handleGetApiKeys(req: VercelRequest, res: VercelResponse) {
    const { userId, apiKeyId, stats } = req.query

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
    }

    if (apiKeyId && stats) {
        // Get usage statistics for specific API key
        const days = parseInt(req.query.days as string) || 30
        const usageStats = await apiKeyService.getUsageStats(apiKeyId as string, days)
        return res.json(usageStats)
    }

    if (apiKeyId) {
        // Get specific API key (not implemented for security)
        return res.status(400).json({ error: 'Getting specific API key not supported' })
    }

    // Get all API keys for user
    const apiKeys = await apiKeyService.getUserApiKeys(userId as string)
    return res.json({ apiKeys })
}

async function handleCreateApiKey(req: VercelRequest, res: VercelResponse) {
    const { userId, name, tier = 'free' } = req.body

    if (!userId || !name) {
        return res.status(400).json({ error: 'userId and name are required' })
    }

    if (!['free', 'pro', 'enterprise'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier. Must be free, pro, or enterprise' })
    }

    try {
        const result = await apiKeyService.createApiKey(userId, name, tier)

        // Return API key data with the raw key (only time it's shown)
        return res.status(201).json({
            apiKey: result.apiKey,
            rawKey: result.rawKey,
            message: 'API key created successfully. Save the raw key securely - it will not be shown again.'
        })
    } catch (error: unknown) {
        console.error('Error creating API key:', error)
        return res.status(500).json({ error: 'Failed to create API key' })
    }
}

async function handleUpdateApiKey(req: VercelRequest, res: VercelResponse) {
    const { apiKeyId, tier, action } = req.body

    if (!apiKeyId) {
        return res.status(400).json({ error: 'apiKeyId is required' })
    }

    try {
        if (action === 'deactivate') {
            await apiKeyService.deactivateApiKey(apiKeyId)
            return res.json({ message: 'API key deactivated successfully' })
        }

        if (tier && ['free', 'pro', 'enterprise'].includes(tier)) {
            await apiKeyService.updateApiKeyTier(apiKeyId, tier)
            return res.json({ message: 'API key tier updated successfully' })
        }

        return res.status(400).json({ error: 'Invalid update parameters' })
    } catch (error: unknown) {
        console.error('Error updating API key:', error)
        return res.status(500).json({ error: 'Failed to update API key' })
    }
}

async function handleDeleteApiKey(req: VercelRequest, res: VercelResponse) {
    const { apiKeyId } = req.query

    if (!apiKeyId) {
        return res.status(400).json({ error: 'apiKeyId is required' })
    }

    try {
        await apiKeyService.deleteApiKey(apiKeyId as string)
        return res.json({ message: 'API key deleted successfully' })
    } catch (error: unknown) {
        console.error('Error deleting API key:', error)
        return res.status(500).json({ error: 'Failed to delete API key' })
    }
}
