import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Copy, Check, Webhook, Code, AlertTriangle, CheckCircle, XCircle, Shield, Globe, Zap, Info } from 'lucide-react'

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
                <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium rounded-t-lg flex items-center justify-between">
                    <span>{title}</span>
                    <span className="text-xs text-gray-400">{language}</span>
                </div>
            )}
            <div className="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto relative">
                <pre className="text-sm">
                    <code className={`language-${language}`}>{children}</code>
                </pre>
                <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
                    onClick={copyToClipboard}
                >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    )
}

interface ResponseCardProps {
    title: string
    description: string
    statusCode: string
    statusColor: string
    example: any
    icon: React.ReactNode
}

const ResponseCard: React.FC<ResponseCardProps> = ({ title, description, statusCode, statusColor, example, icon }) => {
    return (
        <Card className="border-l-4" style={{ borderLeftColor: statusColor }}>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        {icon}
                        <div>
                            <CardTitle className="text-lg">{title}</CardTitle>
                            <CardDescription className="mt-1">{description}</CardDescription>
                        </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: statusColor + '20', color: statusColor }}>
                        {statusCode}
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                <CodeBlock language="json">{JSON.stringify(example, null, 2)}</CodeBlock>
            </CardContent>
        </Card>
    )
}

const GeonormWebhookDocs: React.FC = () => {
    const [activeTab, setActiveTab] = useState('overview')

    const curlExample = `curl -X POST "https://lucasarano.app.n8n.cloud/webhook/cd75c4b4-61de-4275-9bc2-9a795305d58a" \\
  -H "Content-Type: application/json" \\
  -H "TESTUSER: <YOUR_API_KEY>" \\
  -d '{
        "address":"Mariscal Jose Felix Estigarribia, Concepción, Paraguay",
        "useLLM": false,
        "components": "locality:Concepcion|country:PY"
      }'`

    const pythonExample = `import json, urllib.request

url = "https://lucasarano.app.n8n.cloud/webhook/cd75c4b4-61de-4275-9bc2-9a795305d58a"
headers = {"Content-Type": "application/json", "TESTUSER": "<YOUR_API_KEY>"}
payload = {
    "address": "Mariscal Jose Felix Estigarribia, Concepción, Paraguay",
    "useLLM": False,  # or True
    "components": "locality:Concepcion|country:PY"
}
req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    print(resp.status, resp.read().decode())`

    const successResponse = {
        "status": "OK",
        "address": "Mariscal Jose Felix Estigarribia, Concepción, Paraguay",
        "location": { "lat": -23.4086232, "lng": -57.4448971 },
        "location_type": "GEOMETRIC_CENTER",
        "radius_m": 396.88,
        "useLLM": true
    }

    const error400Response = {
        "error": "Invalid request body",
        "status": "INVALID_REQUEST",
        "code": 400,
        "details": ["address must be a non-empty string"],
        "useLLM": false
    }

    const error404Response = {
        "error": "Geocoding failed",
        "status": "ZERO_RESULTS",
        "code": 404,
        "hint": "Try removing postal code/components or adding a clearer locality.",
        "useLLM": true
    }

    const error403Response = {
        "error": "Geocoding failed",
        "status": "REQUEST_DENIED",
        "code": 403,
        "hint": "Check API key, domain restrictions, and that Geocoding API is enabled.",
        "useLLM": true
    }

    const error429Response = {
        "error": "Geocoding failed",
        "status": "OVER_QUERY_LIMIT",
        "code": 429,
        "hint": "Throttle requests, add caching, and ensure billing/quotas are configured.",
        "useLLM": false
    }

    const error502Response = {
        "error": "Geocoding failed",
        "status": "UNKNOWN_ERROR",
        "code": 502,
        "hint": "Temporary upstream issue. Retry with exponential backoff.",
        "useLLM": true
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Webhook className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold">Geonorm Webhook API</h1>
                            <p className="text-blue-100 mt-2">Production-ready geocoding with LLM normalization</p>
                        </div>
                    </div>
                    
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                        <div className="flex items-center gap-2 mb-3">
                            <Globe className="h-5 w-5 text-blue-200" />
                            <span className="text-sm font-semibold text-blue-100">Base URL (Production)</span>
                        </div>
                        <code className="text-lg font-mono bg-black/30 px-4 py-3 rounded-lg block">
                            POST https://lucasarano.app.n8n.cloud/webhook/cd75c4b4-61de-4275-9bc2-9a795305d58a
                        </code>
                        <p className="text-sm text-blue-200 mt-3 flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Use /webhook-test/… only while executing the workflow in the n8n editor.
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Navigation Tabs */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                    {[
                        { id: 'overview', label: 'Overview', icon: Info },
                        { id: 'authentication', label: 'Authentication', icon: Shield },
                        { id: 'request', label: 'Request', icon: Code },
                        { id: 'responses', label: 'Responses', icon: CheckCircle },
                        { id: 'examples', label: 'Examples', icon: Zap },
                    ].map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'bg-white shadow-lg text-indigo-600 border-2 border-indigo-200'
                                        : 'bg-white/60 text-gray-600 hover:bg-white hover:shadow-md'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* Content Sections */}
                <div className="space-y-6">
                    {activeTab === 'overview' && (
                        <>
                            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-2xl flex items-center gap-3">
                                        <Zap className="h-6 w-6 text-indigo-600" />
                                        Key Features
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-blue-600 rounded-lg">
                                                    <Zap className="h-5 w-5 text-white" />
                                                </div>
                                                <h3 className="font-bold text-lg text-blue-900">LLM Normalization</h3>
                                            </div>
                                            <p className="text-sm text-blue-800">
                                                Optional AI-powered address cleaning before geocoding for improved accuracy and standardization
                                            </p>
                                        </div>
                                        
                                        <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-purple-600 rounded-lg">
                                                    <Globe className="h-5 w-5 text-white" />
                                                </div>
                                                <h3 className="font-bold text-lg text-purple-900">Precise Geocoding</h3>
                                            </div>
                                            <p className="text-sm text-purple-800">
                                                Google Maps integration with detailed location data, confidence scores, and accuracy metrics
                                            </p>
                                        </div>
                                        
                                        <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-green-600 rounded-lg">
                                                    <CheckCircle className="h-5 w-5 text-white" />
                                                </div>
                                                <h3 className="font-bold text-lg text-green-900">Smart Components</h3>
                                            </div>
                                            <p className="text-sm text-green-800">
                                                Automatic handling of geocoding components, plus codes, and postal codes for optimal results
                                            </p>
                                        </div>
                                        
                                        <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-amber-600 rounded-lg">
                                                    <Shield className="h-5 w-5 text-white" />
                                                </div>
                                                <h3 className="font-bold text-lg text-amber-900">Production Ready</h3>
                                            </div>
                                            <p className="text-sm text-amber-800">
                                                Comprehensive error handling, detailed hints, and robust status codes for easy debugging
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-2xl">Behavior Notes</CardTitle>
                                    <CardDescription>Important details about how the API works</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-blue-900 mb-1">Plus Codes & ZIP Codes</h4>
                                            <p className="text-sm text-blue-800">
                                                The workflow automatically omits components when needed (e.g., plus codes) to avoid ZERO_RESULTS
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                                        <Zap className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-green-900 mb-1">LLM Off (useLLM=false)</h4>
                                            <p className="text-sm text-green-800">
                                                Fast path - address sent directly to geocoding. You may still provide components filter
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                                        <Zap className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-purple-900 mb-1">LLM On (useLLM=true)</h4>
                                            <p className="text-sm text-purple-800">
                                                Address is normalized and—depending on content—components may be generated or dropped automatically
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                        <Shield className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-amber-900 mb-1">Security</h4>
                                            <p className="text-sm text-amber-800">
                                                Keep your API key in a secure header and rotate regularly. Never expose it in client-side code
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {activeTab === 'authentication' && (
                        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                            <CardHeader>
                                <CardTitle className="text-2xl flex items-center gap-3">
                                    <Shield className="h-6 w-6 text-indigo-600" />
                                    Authentication
                                </CardTitle>
                                <CardDescription>Send your API key in a header</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
                                    <div className="flex items-center gap-3 mb-3">
                                        <AlertTriangle className="h-6 w-6 text-amber-600" />
                                        <h3 className="font-bold text-lg text-amber-900">Authentication Header</h3>
                                    </div>
                                    <CodeBlock title="Required Header">TESTUSER: &lt;YOUR_API_KEY&gt;</CodeBlock>
                                    <p className="text-sm text-amber-800 mt-4 flex items-start gap-2">
                                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>
                                            <strong>Tip:</strong> For production, consider switching to a more standard header such as <code className="bg-amber-200 px-2 py-0.5 rounded">x-api-key</code>
                                        </span>
                                    </p>
                                </div>

                                <div className="p-6 bg-red-50 border-2 border-red-200 rounded-xl">
                                    <div className="flex items-center gap-3 mb-3">
                                        <XCircle className="h-6 w-6 text-red-600" />
                                        <h3 className="font-bold text-lg text-red-900">Security Best Practices</h3>
                                    </div>
                                    <ul className="space-y-2 text-sm text-red-800">
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-600 mt-1">•</span>
                                            <span>Never expose API keys in client-side code or public repositories</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-600 mt-1">•</span>
                                            <span>Use environment variables to store API keys</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-600 mt-1">•</span>
                                            <span>Rotate API keys regularly as part of security maintenance</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-red-600 mt-1">•</span>
                                            <span>Always use HTTPS when making API requests</span>
                                        </li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'request' && (
                        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                            <CardHeader>
                                <CardTitle className="text-2xl flex items-center gap-3">
                                    <Code className="h-6 w-6 text-indigo-600" />
                                    Request Format
                                </CardTitle>
                                <CardDescription>Content-Type: application/json</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <h3 className="font-bold text-lg mb-4">Body Schema</h3>
                                    <CodeBlock language="json">{`{
  "address": "string (required)",
  "useLLM": true,
  "components": "string (optional)"
}`}</CodeBlock>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg">
                                        <h4 className="font-semibold text-blue-900 mb-2">address <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">required</span></h4>
                                        <p className="text-sm text-blue-800">
                                            Raw address text (e.g., "Mariscal Jose Felix Estigarribia, Concepción, Paraguay")
                                        </p>
                                    </div>

                                    <div className="p-4 border-l-4 border-purple-500 bg-purple-50 rounded-r-lg">
                                        <h4 className="font-semibold text-purple-900 mb-2">useLLM <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded">required</span> <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded">boolean</span></h4>
                                        <ul className="text-sm text-purple-800 space-y-1 mt-2">
                                            <li><code className="bg-purple-200 px-2 py-0.5 rounded">true</code> → normalize/clean with LLM before geocoding</li>
                                            <li><code className="bg-purple-200 px-2 py-0.5 rounded">false</code> → send address directly to geocoding (faster/cheaper)</li>
                                        </ul>
                                    </div>

                                    <div className="p-4 border-l-4 border-green-500 bg-green-50 rounded-r-lg">
                                        <h4 className="font-semibold text-green-900 mb-2">components <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded">optional</span></h4>
                                        <p className="text-sm text-green-800">
                                            Geocoding component filter (e.g., "locality:Concepcion|country:PY"). Ignored/removed automatically when it shouldn't be sent (e.g., plus codes)
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'responses' && (
                        <div className="space-y-6">
                            <ResponseCard
                                title="200 OK — Success"
                                description="Request processed successfully and geocoding returned results"
                                statusCode="200"
                                statusColor="#10b981"
                                icon={<CheckCircle className="h-8 w-8 text-green-600" />}
                                example={successResponse}
                            />

                            <div className="grid md:grid-cols-2 gap-6">
                                <ResponseCard
                                    title="400 Bad Request"
                                    description="Invalid input or malformed request body"
                                    statusCode="400"
                                    statusColor="#f59e0b"
                                    icon={<AlertTriangle className="h-6 w-6 text-amber-600" />}
                                    example={error400Response}
                                />

                                <ResponseCard
                                    title="404 Not Found"
                                    description="No geocoding match found for the address"
                                    statusCode="404"
                                    statusColor="#ef4444"
                                    icon={<XCircle className="h-6 w-6 text-red-600" />}
                                    example={error404Response}
                                />

                                <ResponseCard
                                    title="403 Request Denied"
                                    description="API key or configuration issue"
                                    statusCode="403"
                                    statusColor="#dc2626"
                                    icon={<Shield className="h-6 w-6 text-red-700" />}
                                    example={error403Response}
                                />

                                <ResponseCard
                                    title="429 Over Query Limit"
                                    description="Rate limit exceeded or quota exhausted"
                                    statusCode="429"
                                    statusColor="#f97316"
                                    icon={<AlertTriangle className="h-6 w-6 text-orange-600" />}
                                    example={error429Response}
                                />
                            </div>

                            <ResponseCard
                                title="502 Upstream/Temporary Error"
                                description="Temporary upstream issue or unknown error"
                                statusCode="502"
                                statusColor="#6b7280"
                                icon={<AlertTriangle className="h-6 w-6 text-gray-600" />}
                                example={error502Response}
                            />

                            <Card className="shadow-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
                                <CardHeader>
                                    <CardTitle>Success Response Fields</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-start gap-3">
                                            <code className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-semibold">status</code>
                                            <span className="text-gray-700">Geocoding status (OK)</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <code className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-semibold">address</code>
                                            <span className="text-gray-700">Final standardized address returned</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <code className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-semibold">location</code>
                                            <span className="text-gray-700">Latitude/longitude coordinates</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <code className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-semibold">location_type</code>
                                            <span className="text-gray-700">Precision indicator (ROOFTOP, GEOMETRIC_CENTER, APPROXIMATE, ...)</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <code className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-semibold">radius_m</code>
                                            <span className="text-gray-700">Approximate radius derived from bounds/viewport (meters)</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <code className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-semibold">useLLM</code>
                                            <span className="text-gray-700">Echoes the flag used for this run</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'examples' && (
                        <div className="space-y-6">
                            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-2xl flex items-center gap-3">
                                        <Code className="h-6 w-6 text-indigo-600" />
                                        cURL Example
                                    </CardTitle>
                                    <CardDescription>Command-line request using cURL</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <CodeBlock language="bash" title="cURL">
                                        {curlExample}
                                    </CodeBlock>
                                </CardContent>
                            </Card>

                            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-2xl flex items-center gap-3">
                                        <Code className="h-6 w-6 text-yellow-600" />
                                        Python (urllib)
                                    </CardTitle>
                                    <CardDescription>Python example using built-in urllib library</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <CodeBlock language="python" title="Python">
                                        {pythonExample}
                                    </CodeBlock>
                                </CardContent>
                            </Card>

                            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                                <CardHeader>
                                    <CardTitle className="text-2xl flex items-center gap-3">
                                        <Code className="h-6 w-6 text-blue-600" />
                                        JavaScript/Node.js
                                    </CardTitle>
                                    <CardDescription>JavaScript example using fetch API</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <CodeBlock language="javascript" title="JavaScript">
{`const response = await fetch('https://lucasarano.app.n8n.cloud/webhook/cd75c4b4-61de-4275-9bc2-9a795305d58a', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'TESTUSER': '<YOUR_API_KEY>'
  },
  body: JSON.stringify({
    address: 'Mariscal Jose Felix Estigarribia, Concepción, Paraguay',
    useLLM: false,
    components: 'locality:Concepcion|country:PY'
  })
});

const data = await response.json();
console.log(data);`}
                                    </CodeBlock>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-gray-200 mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                                <Webhook className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">Geonorm Webhook API</p>
                                <p className="text-sm text-gray-500">Production-ready geocoding solution</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-500">
                            Powered by n8n & Google Maps
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GeonormWebhookDocs

