import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Input } from './shared/ui/input'
import { Label } from './shared/ui/label'
import {
    Key,
    Copy,
    Check,
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Activity,
    AlertCircle,
    TrendingUp,
} from 'lucide-react'

interface ApiKey {
    id: string
    name: string
    keyPreview: string
    tier: 'free' | 'pro' | 'enterprise'
    usageCount: number
    usageLimit: number
    isActive: boolean
    createdAt: Date
    lastUsedAt: Date | null
}

interface UsageStats {
    totalRequests: number
    successfulRequests: number
    errorRequests: number
    averageProcessingTime: number
    usageByDay: Array<{ date: string; count: number }>
}

const ApiKeyDashboard: React.FC<{ userId: string }> = ({ userId }) => {
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [newKeyName, setNewKeyName] = useState('')
    const [newKeyTier, setNewKeyTier] = useState<'free' | 'pro' | 'enterprise'>('free')
    const [newApiKey, setNewApiKey] = useState<string | null>(null)
    const [showNewKey, setShowNewKey] = useState(false)
    const [selectedKeyStats, setSelectedKeyStats] = useState<{ [key: string]: UsageStats }>({})
    const [copied, setCopied] = useState<{ [key: string]: boolean }>({})

    const loadApiKeys = useCallback(async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/apikeys?userId=${userId}`)
            const data = await response.json()
            if (response.ok) {
                setApiKeys(data.apiKeys)
            }
        } catch (error) {
            console.error('Failed to load API keys:', error)
        } finally {
            setLoading(false)
        }
    }, [userId])

    useEffect(() => {
        loadApiKeys()
    }, [loadApiKeys])

    const createApiKey = async () => {
        if (!newKeyName.trim()) return

        setCreating(true)
        try {
            const response = await fetch('/api/apikeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    name: newKeyName,
                    tier: newKeyTier
                })
            })

            const data = await response.json()
            if (response.ok) {
                setNewApiKey(data.rawKey)
                setNewKeyName('')
                loadApiKeys()
            } else {
                alert(`Failed to create API key: ${data.error}`)
            }
        } catch (error) {
            console.error('Failed to create API key:', error)
            alert('Failed to create API key')
        } finally {
            setCreating(false)
        }
    }

    const deleteApiKey = async (apiKeyId: string) => {
        if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
            return
        }

        try {
            const response = await fetch(`/api/apikeys?apiKeyId=${apiKeyId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                loadApiKeys()
            } else {
                const data = await response.json()
                alert(`Failed to delete API key: ${data.error}`)
            }
        } catch (error) {
            console.error('Failed to delete API key:', error)
            alert('Failed to delete API key')
        }
    }

    const loadUsageStats = async (apiKeyId: string) => {
        try {
            const response = await fetch(`/api/apikeys?userId=${userId}&apiKeyId=${apiKeyId}&stats=true`)
            const stats = await response.json()
            if (response.ok) {
                setSelectedKeyStats(prev => ({
                    ...prev,
                    [apiKeyId]: stats
                }))
            }
        } catch (error) {
            console.error('Failed to load usage stats:', error)
        }
    }

    const copyToClipboard = (text: string, keyId: string) => {
        navigator.clipboard.writeText(text)
        setCopied(prev => ({ ...prev, [keyId]: true }))
        setTimeout(() => {
            setCopied(prev => ({ ...prev, [keyId]: false }))
        }, 2000)
    }

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'free': return 'bg-gray-100 text-gray-800'
            case 'pro': return 'bg-blue-100 text-blue-800'
            case 'enterprise': return 'bg-purple-100 text-purple-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getUsagePercentage = (used: number, limit: number) => {
        return Math.min((used / limit) * 100, 100)
    }

    const getUsageColor = (percentage: number) => {
        if (percentage >= 90) return 'bg-red-500'
        if (percentage >= 70) return 'bg-yellow-500'
        return 'bg-green-500'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">API Keys</h2>
                    <p className="text-gray-600">Manage your API keys and monitor usage</p>
                </div>
                <Button onClick={() => setNewApiKey(null)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create New Key
                </Button>
            </div>

            {/* New API Key Modal */}
            {(newApiKey || !newApiKey) && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            {newApiKey ? 'API Key Created' : 'Create New API Key'}
                        </CardTitle>
                        <CardDescription>
                            {newApiKey
                                ? 'Save this API key securely - it will not be shown again!'
                                : 'Generate a new API key for your applications'
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {newApiKey ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium text-green-800 mb-1">Your new API key:</p>
                                            <div className="flex items-center gap-2">
                                                <code className="bg-white px-3 py-2 rounded border text-sm flex-1">
                                                    {showNewKey ? newApiKey : '•'.repeat(newApiKey.length)}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setShowNewKey(!showNewKey)}
                                                >
                                                    {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(newApiKey, 'new')}
                                                >
                                                    {copied.new ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setNewApiKey(null)}
                                    className="w-full"
                                >
                                    Got it, close
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="key-name">API Key Name</Label>
                                    <Input
                                        id="key-name"
                                        placeholder="e.g., Production App, Development"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="key-tier">Tier</Label>
                                    <select
                                        id="key-tier"
                                        value={newKeyTier}
                                        onChange={(e) => setNewKeyTier(e.target.value as 'free' | 'pro' | 'enterprise')}
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="free">Free (100 requests/month)</option>
                                        <option value="pro">Pro (10,000 requests/month)</option>
                                        <option value="enterprise">Enterprise (100,000 requests/month)</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={createApiKey}
                                        disabled={creating || !newKeyName.trim()}
                                        className="flex-1"
                                    >
                                        {creating ? 'Creating...' : 'Create API Key'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setNewApiKey(null)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* API Keys List */}
            <div className="space-y-4">
                {loading ? (
                    <Card>
                        <CardContent className="py-8">
                            <div className="text-center text-gray-500">Loading API keys...</div>
                        </CardContent>
                    </Card>
                ) : apiKeys.length === 0 ? (
                    <Card>
                        <CardContent className="py-8">
                            <div className="text-center">
                                <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No API keys yet</h3>
                                <p className="text-gray-500 mb-4">Create your first API key to start using the GeoNorm API</p>
                                <Button onClick={() => setNewApiKey(null)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create API Key
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    apiKeys.map((apiKey) => {
                        const usagePercentage = getUsagePercentage(apiKey.usageCount, apiKey.usageLimit)
                        const stats = selectedKeyStats[apiKey.id]

                        return (
                            <Card key={apiKey.id} className={!apiKey.isActive ? 'opacity-60' : ''}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 rounded-lg">
                                                <Key className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                                                <CardDescription className="flex items-center gap-2 mt-1">
                                                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                                        {apiKey.keyPreview}
                                                    </code>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTierColor(apiKey.tier)}`}>
                                                        {apiKey.tier.toUpperCase()}
                                                    </span>
                                                    {!apiKey.isActive && (
                                                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                                                            INACTIVE
                                                        </span>
                                                    )}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => loadUsageStats(apiKey.id)}
                                            >
                                                <Activity className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteApiKey(apiKey.id)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Usage Progress */}
                                    <div>
                                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                                            <span>Usage this month</span>
                                            <span>{apiKey.usageCount} / {apiKey.usageLimit}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${getUsageColor(usagePercentage)}`}
                                                style={{ width: `${usagePercentage}%` }}
                                            />
                                        </div>
                                        {usagePercentage >= 90 && (
                                            <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                                                <AlertCircle className="h-4 w-4" />
                                                <span>Usage limit nearly reached</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Key Details */}
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">Created</span>
                                            <p className="font-medium">
                                                {new Date(apiKey.createdAt?.toDate?.() || apiKey.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Last Used</span>
                                            <p className="font-medium">
                                                {apiKey.lastUsedAt
                                                    ? new Date(apiKey.lastUsedAt?.toDate?.() || apiKey.lastUsedAt).toLocaleDateString()
                                                    : 'Never'
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {/* Usage Stats */}
                                    {stats && (
                                        <div className="border-t pt-4">
                                            <h4 className="font-medium mb-3 flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4" />
                                                Usage Statistics (Last 30 days)
                                            </h4>
                                            <div className="grid grid-cols-4 gap-4 text-sm">
                                                <div className="text-center">
                                                    <div className="font-semibold text-lg">{stats.totalRequests}</div>
                                                    <div className="text-gray-500">Total</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="font-semibold text-lg text-green-600">{stats.successfulRequests}</div>
                                                    <div className="text-gray-500">Success</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="font-semibold text-lg text-red-600">{stats.errorRequests}</div>
                                                    <div className="text-gray-500">Errors</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="font-semibold text-lg">{Math.round(stats.averageProcessingTime)}ms</div>
                                                    <div className="text-gray-500">Avg Time</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    )
}

export default ApiKeyDashboard
