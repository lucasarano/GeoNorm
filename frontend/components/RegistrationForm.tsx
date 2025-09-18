import React, { useState } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Input } from './shared/ui/input'
import { Label } from './shared/ui/label'

interface RegistrationFormProps {
    onRegistrationComplete?: (user: any) => void
}

export default function RegistrationForm({ onRegistrationComplete }: RegistrationFormProps) {
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        plan: 'free'
    })
    const [isLoading, setIsLoading] = useState(false)
    const [registered, setRegistered] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Registration failed')
            }

            const result = await response.json()
            setUser(result.user)
            setRegistered(true)
            onRegistrationComplete?.(result.user)
        } catch (error: any) {
            setError(error.message || 'Registration failed. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    if (registered && user) {
        return (
            <Card className="p-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-green-600 mb-2">Registration Successful!</h3>
                    <p className="text-gray-600">Welcome to GeoNorm API, {user.name}!</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-medium text-gray-700">Your API Key</Label>
                        <div className="flex items-center space-x-2 mt-1">
                            <Input
                                value={user.apiKey}
                                readOnly
                                className="font-mono text-sm bg-gray-50"
                            />
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText(user.apiKey)
                                    // You could add a toast notification here
                                }}
                                size="sm"
                                variant="outline"
                            >
                                Copy
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Save this API key! You'll need it to access the GeoNorm API.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="font-medium text-blue-900">Plan</p>
                            <p className="text-blue-700 capitalize">{user.plan}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                            <p className="font-medium text-green-900">Monthly Limit</p>
                            <p className="text-green-700">{user.maxRequests.toLocaleString()} requests</p>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                        <div className="flex items-start">
                            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-yellow-800">Important Security Note</p>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Keep your API key secure and never share it publicly. Use it in the <code className="bg-yellow-100 px-1 rounded">X-API-Key</code> header for all API requests.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <h4 className="font-medium text-gray-900 mb-2">Next Steps</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Use your API key to authenticate requests</li>
                            <li>• Start with the single address endpoint</li>
                            <li>• Check your usage in the profile endpoint</li>
                            <li>• Upgrade your plan as you scale</li>
                        </ul>
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <Card className="p-6">
            <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Register for GeoNorm API</h3>
                <p className="text-gray-600">Get your API key and start processing addresses with AI</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                    <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="mt-1"
                        placeholder="your@email.com"
                    />
                </div>

                <div>
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
                    <Input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="mt-1"
                        placeholder="John Doe"
                    />
                </div>

                <div>
                    <Label htmlFor="plan" className="text-sm font-medium text-gray-700">Choose Plan</Label>
                    <select
                        id="plan"
                        value={formData.plan}
                        onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="free">Free - 100 requests/month</option>
                        <option value="pro">Pro - 1,000 requests/month</option>
                        <option value="enterprise">Enterprise - 10,000 requests/month</option>
                    </select>
                </div>

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating Account...
                        </div>
                    ) : (
                        'Create Account & Get API Key'
                    )}
                </Button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                    By registering, you agree to our terms of service and privacy policy.
                </p>
            </div>
        </Card>
    )
}
