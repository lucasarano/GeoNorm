import { Request, Response, NextFunction } from 'express'
import { userService } from '../services/firebaseUserService.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    name: string
    plan: string
    requestsCount: number
    maxRequests: number
  }
}

export const authenticateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '')
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        message: 'Please provide an API key in the X-API-Key header or Authorization header'
      })
    }

    const user = await userService.getUserByApiKey(apiKey)
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      })
    }

    // Check rate limits
    if (user.requestsCount >= user.maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have exceeded your monthly limit of ${user.maxRequests} requests`,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
      })
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
}

export const updateUsage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      await userService.updateUserUsage(req.user.id)
    }
    next()
  } catch (error) {
    console.error('Usage update error:', error)
    // Don't fail the request if usage update fails
    next()
  }
}
