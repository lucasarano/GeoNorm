import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Input } from './shared/ui/input'
import { Label } from './shared/ui/label'
import { Copy, Check, Key, Code, Globe, Zap, Shield, BookOpen } from 'lucide-react'

interface CodeBlockProps {
    children: string
    language?: string
    title?: string
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, language = 'javascript', title }) => {
    const [copied, setCopied] = useState(false)

    const copyToClipboard = () => {
        navigator.clipboard.writeText(children)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="relative">
            {title && (
                <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium rounded-t-lg">
                    {title}
                </div>
            )}
            <div className="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto relative">
                <pre className="text-sm">
                    <code className={`language-${language}`}>{children}</code>
                </pre>
                <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0 text-gray-400 hover:text-white"
                    onClick={copyToClipboard}
                >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    )
}

interface EndpointDocProps {
    method: string
    path: string
    description: string
    parameters?: any
    response?: any
    example?: string
}

const EndpointDoc: React.FC<EndpointDocProps> = ({
    method,
    path,
    description,
    parameters,
    response,
    example
}) => {
    const methodColors = {
        GET: 'bg-green-100 text-green-800',
        POST: 'bg-blue-100 text-blue-800',
        PUT: 'bg-yellow-100 text-yellow-800',
        DELETE: 'bg-red-100 text-red-800'
    }

    return (
        <Card className="mb-6">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${methodColors[method as keyof typeof methodColors]}`}>
                        {method}
                    </span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">{path}</code>
                </div>
                <CardDescription className="mt-2">{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {parameters && (
                    <div>
                        <h4 className="font-semibold mb-2">Parameters</h4>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <pre className="text-sm text-gray-700">{JSON.stringify(parameters, null, 2)}</pre>
                        </div>
                    </div>
                )}

                {response && (
                    <div>
                        <h4 className="font-semibold mb-2">Response</h4>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <pre className="text-sm text-gray-700">{JSON.stringify(response, null, 2)}</pre>
                        </div>
                    </div>
                )}

                {example && (
                    <div>
                        <h4 className="font-semibold mb-2">Example</h4>
                        <CodeBlock language="javascript">{example}</CodeBlock>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

const Documentation: React.FC = () => {
    const [activeTab, setActiveTab] = useState('overview')

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BookOpen },
        { id: 'authentication', label: 'Authentication', icon: Shield },
        { id: 'endpoints', label: 'API Endpoints', icon: Globe },
        { id: 'examples', label: 'Code Examples', icon: Code },
        { id: 'sdks', label: 'SDKs & Tools', icon: Zap }
    ]

    const curlExample = `curl -X POST https://geonorm-app.vercel.app/api/process \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key-here" \\
  -d '{
    "address": "Av. España 123, Asunción"
  }'`

    const javascriptExample = `const response = await fetch('https://geonorm-app.vercel.app/api/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here'
  },
  body: JSON.stringify({
    address: 'Av. España 123, Asunción'
  })
});

const result = await response.json();
console.log(result.cleanedAddress);
console.log(result.coordinates.latitude, result.coordinates.longitude);`

    const pythonExample = `import requests

url = "https://geonorm-app.vercel.app/api/process"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "your-api-key-here"
}
data = {"address": "Av. España 123, Asunción"}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result["cleanedAddress"], result["coordinates"]["latitude"], result["coordinates"]["longitude"])`

    const responseExample = {
        "success": true,
        "userId": "user-123",
        "originalAddress": "Av. España 123, Asunción",
        "cleanedAddress": "Av. España 123, Asunción, Paraguay",
        "coordinates": {
            "latitude": -25.282362,
            "longitude": -57.635981
        },
        "zipCode": "1000",
        "zipCodeDetails": {
            "zipCode": "1000",
            "department": "Capital",
            "district": "Asunción",
            "neighborhood": "San Roque",
            "confidence": "high"
        },
        "confidence": 0.95,
        "confidenceDescription": "Most precise - exact address match",
        "locationType": "ROOFTOP",
        "timestamp": "2024-04-10T15:23:45.123Z"
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-600 rounded-lg">
                                <BookOpen className="h-6 w-6 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900">GeoNorm API Documentation</h1>
                        </div>
                        <p className="text-lg text-gray-600 max-w-3xl">
                            Send a single address string and instantly receive a cleaned address, coordinates, and zip code details for Paraguay.
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex gap-8">
                    {/* Sidebar Navigation */}
                    <div className="w-64 flex-shrink-0">
                        <nav className="space-y-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1">
                        {activeTab === 'overview' && (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>What is GeoNorm API?</CardTitle>
                                        <CardDescription>
                                            A simple address normalization API that cleans, geocodes, and enriches any Paraguayan address string.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-blue-50 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Zap className="h-5 w-5 text-blue-600" />
                                                    <h3 className="font-semibold text-blue-900">Automatic Normalization</h3>
                                                </div>
                                                <p className="text-sm text-blue-700">
                                                    Returns the Google-formatted address for any raw string you send
                                                </p>
                                            </div>
                                            <div className="p-4 bg-green-50 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Globe className="h-5 w-5 text-green-600" />
                                                    <h3 className="font-semibold text-green-900">Precise Geocoding</h3>
                                                </div>
                                                <p className="text-sm text-green-700">
                                                    Google Maps integration for accurate latitude/longitude coordinates
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            <h3 className="font-semibold mb-2">Key Features</h3>
                                            <ul className="space-y-2 text-sm text-gray-600">
                                                <li className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    Single call returns cleaned address, coordinates, and zip code metadata
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    Confidence scoring and location type direct from Google Maps
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    Postal code enrichment with district and neighborhood details
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    Lightweight JSON response ready for dashboards or automations
                                                </li>
                                            </ul>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Getting Started</CardTitle>
                                        <CardDescription>
                                            Follow these steps to start using the GeoNorm API
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                                                <div>
                                                    <h4 className="font-semibold">Get your API key</h4>
                                                    <p className="text-sm text-gray-600">Sign up and generate your API key from the dashboard</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                                                <div>
                                                    <h4 className="font-semibold">Grab an address</h4>
                                                    <p className="text-sm text-gray-600">Use the raw address string exactly as your users provide it</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                                                <div>
                                                    <h4 className="font-semibold">Make your first request</h4>
                                                    <p className="text-sm text-gray-600">Send a POST request to /api/process with the address string and your API key</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === 'authentication' && (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>API Key Authentication</CardTitle>
                                        <CardDescription>
                                            All API requests require authentication using an API key
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Shield className="h-5 w-5 text-yellow-600" />
                                                <h3 className="font-semibold text-yellow-800">Security Notice</h3>
                                            </div>
                                            <p className="text-sm text-yellow-700">
                                                Keep your API key secure and never expose it in client-side code.
                                                Use environment variables or secure storage.
                                            </p>
                                        </div>

                                        <div>
                                            <h3 className="font-semibold mb-2">How to authenticate</h3>
                                            <p className="text-sm text-gray-600 mb-3">
                                                Include your API key in the request headers:
                                            </p>
                                            <CodeBlock title="Authentication Header">
                                                X-API-Key: your-api-key-here</CodeBlock>
                                        </div>

                                        <div>
                                            <h3 className="font-semibold mb-2">Get Your API Key</h3>
                                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                <p className="text-sm text-blue-800 mb-3">
                                                    API keys are managed through your dashboard. You can create, monitor, and manage
                                                    multiple API keys with different usage tiers.
                                                </p>
                                                <Button className="w-full" onClick={() => window.location.href = '/dashboard'}>
                                                    <Key className="h-4 w-4 mr-2" />
                                                    Go to API Key Dashboard
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Rate Limits</CardTitle>
                                        <CardDescription>
                                            API usage limits and best practices
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <h4 className="font-semibold mb-1">Free Tier</h4>
                                                    <p className="text-sm text-gray-600">100 requests per day</p>
                                                </div>
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <h4 className="font-semibold mb-1">Pro Tier</h4>
                                                    <p className="text-sm text-gray-600">10,000 requests per day</p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                Need more? Enterprise plans support 100,000+ daily requests. Contact support for custom limits.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === 'endpoints' && (
                            <div className="space-y-6">
                                <EndpointDoc
                                    method="POST"
                                    path="/api/process"
                                    description="Send one address string and receive the cleaned address, coordinates, and zip code"
                                    parameters={{
                                        headers: {
                                            "X-API-Key": "string (required) - Your API key",
                                            "Content-Type": "application/json"
                                        },
                                        body: {
                                            address: "string (required) - Address to normalize and geocode"
                                        }
                                    }}
                                    response={responseExample}
                                    example={curlExample}
                                />

                                <EndpointDoc
                                    method="GET"
                                    path="/api/health"
                                    description="Check API health status"
                                    response={{
                                        status: "healthy",
                                        timestamp: "2024-01-01T00:00:00.000Z",
                                        version: "1.0.0"
                                    }}
                                    example={`curl -X GET https://geonorm-app.vercel.app/api/health`}
                                />

                                <EndpointDoc
                                    method="GET"
                                    path="/api/staticmap"
                                    description="Generate static map images for geocoded locations"
                                    parameters={{
                                        query: {
                                            lat: "number (required) - Latitude",
                                            lng: "number (required) - Longitude",
                                            zoom: "number (optional) - Zoom level (default: 14)",
                                            size: "string (optional) - Image size (default: '600x300')"
                                        }
                                    }}
                                    example={`curl -X GET "https://geonorm-app.vercel.app/api/staticmap?lat=-25.2637&lng=-57.5759&zoom=15&size=800x400"`}
                                />
                            </div>
                        )}

                        {activeTab === 'examples' && (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>cURL Example</CardTitle>
                                        <CardDescription>
                                            Basic request using cURL command line tool
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <CodeBlock language="bash">{curlExample}</CodeBlock>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>JavaScript/Node.js</CardTitle>
                                        <CardDescription>
                                            Using fetch API or axios in JavaScript applications
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <CodeBlock language="javascript">{javascriptExample}</CodeBlock>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Python</CardTitle>
                                        <CardDescription>
                                            Using requests library in Python
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <CodeBlock language="python">{pythonExample}</CodeBlock>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Response Format</CardTitle>
                                        <CardDescription>
                                            Expected response structure from the API
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <CodeBlock language="json">{JSON.stringify(responseExample, null, 2)}</CodeBlock>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === 'sdks' && (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Official SDKs</CardTitle>
                                        <CardDescription>
                                            Pre-built libraries for popular programming languages
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="p-4 border rounded-lg">
                                                <h3 className="font-semibold mb-2">JavaScript/TypeScript</h3>
                                                <p className="text-sm text-gray-600 mb-3">
                                                    NPM package with full TypeScript support
                                                </p>
                                                <CodeBlock language="bash">npm install @geonorm/sdk</CodeBlock>
                                            </div>
                                            <div className="p-4 border rounded-lg">
                                                <h3 className="font-semibold mb-2">Python</h3>
                                                <p className="text-sm text-gray-600 mb-3">
                                                    PyPI package for Python applications
                                                </p>
                                                <CodeBlock language="bash">pip install geonorm</CodeBlock>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Postman Collection</CardTitle>
                                        <CardDescription>
                                            Ready-to-use Postman collection for testing
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Button variant="outline" className="w-full">
                                            <Code className="h-4 w-4 mr-2" />
                                            Download Postman Collection
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>OpenAPI Specification</CardTitle>
                                        <CardDescription>
                                            Machine-readable API specification
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <Button variant="outline" className="w-full">
                                                <Globe className="h-4 w-4 mr-2" />
                                                View OpenAPI Spec
                                            </Button>
                                            <Button variant="outline" className="w-full">
                                                <Code className="h-4 w-4 mr-2" />
                                                Download swagger.json
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Documentation
