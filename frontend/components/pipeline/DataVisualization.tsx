import { useState } from 'react'
import { BarChart3, PieChart, Table, Download, Eye } from 'lucide-react'

interface DataStats {
    totalRows: number
    validRows: number
    invalidRows: number
    duplicatesRemoved: number
    addressesNormalized: number
    phonesNormalized: number
    emailsValidated: number
    citiesMatched: number
    statesMatched: number
}

interface DataVisualizationProps {
    title: string
    data?: any[]
    stats?: DataStats
    sampleData?: any[]
    showComparison?: boolean
    beforeData?: any[]
    afterData?: any[]
}

export default function DataVisualization({
    title,
    data = [],
    stats,
    sampleData = [],
    showComparison = false,
    beforeData = [],
    afterData = []
}: DataVisualizationProps) {
    const [viewMode, setViewMode] = useState<'stats' | 'sample' | 'comparison' | 'geocoding'>('stats')

    const renderStatsView = () => {
        if (!stats) return <div className="text-gray-500">No statistics available</div>

        const successRate = stats.totalRows > 0 ? (stats.validRows / stats.totalRows * 100).toFixed(1) : 0
        const normalizationRate = stats.totalRows > 0 ? (stats.addressesNormalized / stats.totalRows * 100).toFixed(1) : 0

        return (
            <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats.totalRows}</div>
                        <div className="text-sm text-gray-600">Total Rows</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.validRows}</div>
                        <div className="text-sm text-gray-600">Valid Rows</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">{stats.invalidRows}</div>
                        <div className="text-sm text-gray-600">Invalid Rows</div>
                    </div>
                    <div className="bg-white rounded-lg border p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">{stats.duplicatesRemoved}</div>
                        <div className="text-sm text-gray-600">Duplicates</div>
                    </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-3">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>Success Rate</span>
                            <span>{successRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${successRate}%` }}
                            ></div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>Address Normalization</span>
                            <span>{normalizationRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${normalizationRate}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Detailed Metrics */}
                <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Processing Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                            <span>Addresses Normalized:</span>
                            <span className="font-medium">{stats.addressesNormalized}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Phones Normalized:</span>
                            <span className="font-medium">{stats.phonesNormalized}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Emails Validated:</span>
                            <span className="font-medium">{stats.emailsValidated}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Cities Matched:</span>
                            <span className="font-medium">{stats.citiesMatched}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>States Matched:</span>
                            <span className="font-medium">{stats.statesMatched}</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderSampleView = () => {
        if (sampleData.length === 0) return <div className="text-gray-500">No sample data available</div>

        return (
            <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {Object.keys(sampleData[0] || {}).map((key) => (
                                    <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {key}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sampleData.slice(0, 10).map((row, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    {Object.values(row).map((value: any, cellIndex) => (
                                        <td key={cellIndex} className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value || '')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {sampleData.length > 10 && (
                    <div className="bg-gray-50 px-4 py-3 text-sm text-gray-600 text-center">
                        Showing 10 of {sampleData.length} rows
                    </div>
                )}
            </div>
        )
    }

    const renderComparisonView = () => {
        if (!showComparison || beforeData.length === 0 || afterData.length === 0) {
            return <div className="text-gray-500">No comparison data available</div>
        }

        // Create side-by-side comparison for first 5 rows
        const comparisonRows = Math.min(5, Math.min(beforeData.length, afterData.length))

        return (
            <div className="space-y-6">
                {/* Row-by-row Address Comparison */}
                <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                        <div className="w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
                        Address Transformation Comparison
                    </h4>

                    <div className="space-y-4">
                        {Array.from({ length: comparisonRows }, (_, i) => {
                            const beforeRow = beforeData[i]
                            const afterRow = afterData[i]

                            // Extract address components from before data
                            const beforeAddress = [
                                beforeRow['Buyer Address1'],
                                beforeRow['Buyer Address1 Number'],
                                beforeRow['Buyer Address2'],
                                beforeRow['Buyer Address3']
                            ].filter(part => part && part.trim() && part !== 'XXX').join(', ')

                            const beforeCity = beforeRow['Buyer City'] || ''
                            const beforeState = beforeRow['Buyer State'] || ''
                            const beforePhone = beforeRow['Buyer Phone'] || ''

                            // After data
                            const afterAddress = afterRow['Address'] || ''
                            const afterCity = afterRow['City'] || ''
                            const afterState = afterRow['State'] || ''
                            const afterPhone = afterRow['Phone'] || ''

                            // Simulate Google Maps components
                            const googleQuery = [afterAddress, afterCity, afterState, 'Paraguay'].filter(Boolean).join(', ')
                            const googleComponents = {
                                country: 'PY',
                                ...(afterCity && { locality: afterCity }),
                                ...(afterState && { administrative_area: afterState })
                            }

                            return (
                                <div key={i} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="text-sm font-medium text-gray-700 mb-3">Row {i + 1}</div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                                        {/* Before */}
                                        <div className="bg-red-50 border border-red-200 rounded p-3">
                                            <div className="text-xs font-medium text-red-800 mb-2">BEFORE (Raw Data)</div>
                                            <div className="space-y-1 text-xs">
                                                <div><strong>Address:</strong> {beforeAddress || <em className="text-gray-500">empty</em>}</div>
                                                <div><strong>City:</strong> {beforeCity || <em className="text-gray-500">empty</em>}</div>
                                                <div><strong>State:</strong> {beforeState || <em className="text-gray-500">empty</em>}</div>
                                                <div><strong>Phone:</strong> {beforePhone || <em className="text-gray-500">empty</em>}</div>
                                            </div>
                                        </div>

                                        {/* After */}
                                        <div className="bg-green-50 border border-green-200 rounded p-3">
                                            <div className="text-xs font-medium text-green-800 mb-2">AFTER (Cleaned)</div>
                                            <div className="space-y-1 text-xs">
                                                <div><strong>Address:</strong> {afterAddress || <em className="text-gray-500">empty</em>}</div>
                                                <div><strong>City:</strong> {afterCity || <em className="text-gray-500">empty</em>}</div>
                                                <div><strong>State:</strong> {afterState || <em className="text-gray-500">empty</em>}</div>
                                                <div><strong>Phone:</strong> {afterPhone || <em className="text-gray-500">empty</em>}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Google Maps Components */}
                                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                        <div className="text-xs font-medium text-blue-800 mb-2">🗺️ GOOGLE MAPS GEOCODING</div>
                                        <div className="space-y-1 text-xs">
                                            <div><strong>Query:</strong> <code className="bg-white px-1 rounded">{googleQuery}</code></div>
                                            <div><strong>Components:</strong> <code className="bg-white px-1 rounded">{JSON.stringify(googleComponents)}</code></div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Transformation Summary */}
                <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Transformation Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-red-50 rounded p-3">
                            <div className="text-2xl font-bold text-red-600">{beforeData.length}</div>
                            <div className="text-sm text-gray-600">Input Rows</div>
                        </div>
                        <div className="bg-green-50 rounded p-3">
                            <div className="text-2xl font-bold text-green-600">{afterData.length}</div>
                            <div className="text-sm text-gray-600">Output Rows</div>
                        </div>
                        <div className="bg-blue-50 rounded p-3">
                            <div className="text-2xl font-bold text-blue-600">
                                {Math.max(0, beforeData.length - afterData.length)}
                            </div>
                            <div className="text-sm text-gray-600">Filtered Out</div>
                        </div>
                    </div>

                    {/* Quality Indicators */}
                    <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="text-center">
                                <div className="font-medium text-gray-900">
                                    {afterData.filter(row => row.Address && row.Address.trim()).length}
                                </div>
                                <div className="text-gray-600">With Address</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium text-gray-900">
                                    {afterData.filter(row => row.City && row.City.trim()).length}
                                </div>
                                <div className="text-gray-600">With City</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium text-gray-900">
                                    {afterData.filter(row => row.State && row.State.trim()).length}
                                </div>
                                <div className="text-gray-600">With State</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium text-gray-900">
                                    {afterData.filter(row => row.Phone && row.Phone.startsWith('+595')).length}
                                </div>
                                <div className="text-gray-600">Valid Phones</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderGeocodingView = () => {
        if (!sampleData || sampleData.length === 0) {
            return <div className="text-gray-500">No geocoding data available</div>
        }

        return (
            <div className="space-y-4">
                <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                        <div className="w-3 h-3 bg-purple-400 rounded-full mr-2"></div>
                        Geocoding Components Validation
                    </h4>

                    <div className="space-y-4">
                        {sampleData.slice(0, 10).map((row, index) => {
                            // Generate Google Maps query and components
                            const address = row.Address || ''
                            const city = row.City || ''
                            const state = row.State || ''
                            const phone = row.Phone || ''
                            const email = row.Email || ''

                            const googleQuery = [address, city, state, 'Paraguay'].filter(Boolean).join(', ')
                            const googleComponents = {
                                country: 'PY',
                                ...(city && { locality: city }),
                                ...(state && { administrative_area: state })
                            }

                            // Quality indicators
                            const hasAddress = address && address.trim().length > 0
                            const hasCity = city && city.trim().length > 0
                            const hasState = state && state.trim().length > 0
                            const hasValidPhone = phone && phone.startsWith('+595')
                            const hasValidEmail = email && email.includes('@')

                            const qualityScore = [hasAddress, hasCity, hasState, hasValidPhone, hasValidEmail].filter(Boolean).length
                            const qualityColor = qualityScore >= 4 ? 'green' : qualityScore >= 3 ? 'yellow' : 'red'

                            return (
                                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-medium text-gray-700">Row {index + 1}</div>
                                        <div className={`px-2 py-1 rounded text-xs font-medium ${qualityColor === 'green' ? 'bg-green-100 text-green-800' :
                                                qualityColor === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                            }`}>
                                            Quality: {qualityScore}/5
                                        </div>
                                    </div>

                                    {/* Cleaned Data */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2">
                                            <div className="text-xs font-medium text-gray-600">EXTRACTED COMPONENTS</div>
                                            <div className="space-y-1 text-xs">
                                                <div className="flex items-center">
                                                    <span className={`w-2 h-2 rounded-full mr-2 ${hasAddress ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                    <strong>Address:</strong> <span className="ml-1">{address || <em className="text-gray-400">missing</em>}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={`w-2 h-2 rounded-full mr-2 ${hasCity ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                    <strong>City:</strong> <span className="ml-1">{city || <em className="text-gray-400">missing</em>}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={`w-2 h-2 rounded-full mr-2 ${hasState ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                    <strong>State:</strong> <span className="ml-1">{state || <em className="text-gray-400">missing</em>}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={`w-2 h-2 rounded-full mr-2 ${hasValidPhone ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                    <strong>Phone:</strong> <span className="ml-1">{phone || <em className="text-gray-400">missing</em>}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={`w-2 h-2 rounded-full mr-2 ${hasValidEmail ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                    <strong>Email:</strong> <span className="ml-1">{email || <em className="text-gray-400">missing</em>}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-xs font-medium text-gray-600">GEOCODING READINESS</div>
                                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                                <div className="text-xs">
                                                    <div><strong>Google Query:</strong></div>
                                                    <div className="bg-white p-1 rounded mt-1 font-mono text-xs break-all">
                                                        {googleQuery}
                                                    </div>
                                                </div>
                                                <div className="text-xs mt-2">
                                                    <div><strong>Components:</strong></div>
                                                    <div className="bg-white p-1 rounded mt-1 font-mono text-xs break-all">
                                                        {JSON.stringify(googleComponents, null, 1)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Geocoding Prediction */}
                                    <div className="bg-purple-50 border border-purple-200 rounded p-3">
                                        <div className="text-xs font-medium text-purple-800 mb-1">🎯 GEOCODING PREDICTION</div>
                                        <div className="text-xs text-purple-700">
                                            {hasAddress && hasCity && hasState ?
                                                '✅ High confidence - Address, city, and state provided' :
                                                hasAddress && (hasCity || hasState) ?
                                                    '🟡 Medium confidence - Address with partial location info' :
                                                    hasCity && hasState ?
                                                        '🟡 Medium confidence - City and state only' :
                                                        hasAddress ?
                                                            '🟠 Low confidence - Address only, no city/state context' :
                                                            '❌ Poor geocoding potential - Insufficient location data'
                                            }
                                        </div>
                                    </div>

                                    {/* Zip Code Information */}
                                    {row.zipCode && (
                                        <div className="bg-green-50 border border-green-200 rounded p-3 mt-3">
                                            <div className="text-xs font-medium text-green-800 mb-2">📮 ZIP CODE INFORMATION</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="font-medium">Zip Code:</span>
                                                    <span className="ml-1 font-mono">{row.zipCode.zipCode || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="font-medium">Department:</span>
                                                    <span className="ml-1">{row.zipCode.department || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="font-medium">District:</span>
                                                    <span className="ml-1">{row.zipCode.district || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="font-medium">Neighborhood:</span>
                                                    <span className="ml-1">{row.zipCode.neighborhood || 'N/A'}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="font-medium">Confidence:</span>
                                                    <span className={`ml-1 px-2 py-1 rounded text-xs ${
                                                        row.zipCode.confidence === 'high' ? 'bg-green-100 text-green-800' :
                                                        row.zipCode.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                        row.zipCode.confidence === 'low' ? 'bg-orange-100 text-orange-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {row.zipCode.confidence.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

                {/* View Mode Tabs */}
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('stats')}
                        className={`flex items-center space-x-1 px-3 py-1 rounded text-sm ${viewMode === 'stats' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        <span>Stats</span>
                    </button>
                    <button
                        onClick={() => setViewMode('sample')}
                        className={`flex items-center space-x-1 px-3 py-1 rounded text-sm ${viewMode === 'sample' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Table className="w-4 h-4" />
                        <span>Sample</span>
                    </button>
                    {showComparison && (
                        <button
                            onClick={() => setViewMode('comparison')}
                            className={`flex items-center space-x-1 px-3 py-1 rounded text-sm ${viewMode === 'comparison' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Eye className="w-4 h-4" />
                            <span>Compare</span>
                        </button>
                    )}
                    {(sampleData && sampleData.length > 0) && (
                        <button
                            onClick={() => setViewMode('geocoding')}
                            className={`flex items-center space-x-1 px-3 py-1 rounded text-sm ${viewMode === 'geocoding' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <PieChart className="w-4 h-4" />
                            <span>Geocoding</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div>
                {viewMode === 'stats' && renderStatsView()}
                {viewMode === 'sample' && renderSampleView()}
                {viewMode === 'comparison' && renderComparisonView()}
                {viewMode === 'geocoding' && renderGeocodingView()}
            </div>
        </div>
    )
}
