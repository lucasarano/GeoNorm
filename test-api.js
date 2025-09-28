#!/usr/bin/env node

// Test script for GeoNorm Production API
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000'
const API_KEY = process.env.API_KEY || 'test-api-key-123'

// Test datadata
const testCSV = `Name,Address,City,Phone
John Doe,123 Main Street,Asuncion,+595981234567
Jane Smith,456 Oak Avenue,Encarnacion,+595981234568
Bob Johnson,789 Pine Road,Ciudad del Este,+595981234569`

const testUserId = 'test-user-' + Date.now()

// Test functions
async function testHealthCheck() {
    console.log('🔍 Testing Health Check...')

    try {
        const response = await fetch(`${API_BASE_URL}/api/health`)
        const data = await response.json()

        if (response.ok) {
            console.log('✅ Health Check: OK')
            console.log(`   Status: ${data.status}`)
            console.log(`   Environment: ${data.environment?.nodeEnv || 'unknown'}`)
            return true
        } else {
            console.log('❌ Health Check: Failed')
            console.log(`   Error: ${data.error || 'Unknown error'}`)
            return false
        }
    } catch (error) {
        console.log('❌ Health Check: Error')
        console.log(`   Error: ${error.message}`)
        return false
    }
}

async function testProcessAPI() {
    console.log('🔍 Testing Process API...')

    try {
        const response = await fetch(`${API_BASE_URL}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                csvData: testCSV,
                userId: testUserId,
                options: {
                    sendNotifications: false, // Disable for testing
                    includeZipCodes: true
                }
            })
        })

        const data = await response.json()

        if (response.ok && data.success) {
            console.log('✅ Process API: Success')
            console.log(`   Total Processed: ${data.totalProcessed}`)
            console.log(`   High Confidence: ${data.statistics.highConfidence}`)
            console.log(`   Medium Confidence: ${data.statistics.mediumConfidence}`)
            console.log(`   Low Confidence: ${data.statistics.lowConfidence}`)
            console.log(`   Results: ${data.results.length} addresses`)

            // Show first result
            if (data.results.length > 0) {
                const first = data.results[0]
                console.log('   First Result:')
                console.log(`     Original: ${first.original.address}, ${first.original.city}`)
                console.log(`     Cleaned: ${first.cleaned.address}, ${first.cleaned.city}`)
                console.log(`     Geocoded: ${first.geocoding.latitude}, ${first.geocoding.longitude}`)
                console.log(`     Confidence: ${first.geocoding.confidence}`)
            }

            return true
        } else {
            console.log('❌ Process API: Failed')
            console.log(`   Error: ${data.error || 'Unknown error'}`)
            console.log(`   Details: ${data.details || 'No details'}`)
            return false
        }
    } catch (error) {
        console.log('❌ Process API: Error')
        console.log(`   Error: ${error.message}`)
        return false
    }
}

async function testStaticMap() {
    console.log('🔍 Testing Static Map...')

    try {
        const response = await fetch(`${API_BASE_URL}/api/staticmap?lat=-25.2637&lng=-57.5759&zoom=14&size=400x300`)

        if (response.ok) {
            const contentType = response.headers.get('content-type')
            if (contentType && contentType.includes('image')) {
                console.log('✅ Static Map: Success')
                console.log(`   Content-Type: ${contentType}`)
                console.log(`   Content-Length: ${response.headers.get('content-length')} bytes`)
                return true
            } else {
                console.log('❌ Static Map: Wrong content type')
                console.log(`   Expected: image/png, Got: ${contentType}`)
                return false
            }
        } else {
            const data = await response.json()
            console.log('❌ Static Map: Failed')
            console.log(`   Error: ${data.error || 'Unknown error'}`)
            return false
        }
    } catch (error) {
        console.log('❌ Static Map: Error')
        console.log(`   Error: ${error.message}`)
        return false
    }
}

async function testErrorHandling() {
    console.log('🔍 Testing Error Handling...')

    // Test missing API key
    try {
        const response = await fetch(`${API_BASE_URL}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Missing X-API-Key header
            },
            body: JSON.stringify({
                csvData: testCSV,
                userId: testUserId
            })
        })

        const data = await response.json()

        if (response.status === 401 && data.error === 'API key required') {
            console.log('✅ Error Handling: Missing API key correctly rejected')
        } else {
            console.log('❌ Error Handling: Missing API key not handled correctly')
            return false
        }
    } catch (error) {
        console.log('❌ Error Handling: Error testing missing API key')
        console.log(`   Error: ${error.message}`)
        return false
    }

    // Test missing CSV data
    try {
        const response = await fetch(`${API_BASE_URL}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                userId: testUserId
                // Missing csvData
            })
        })

        const data = await response.json()

        if (response.status === 400 && data.error === 'CSV data is required') {
            console.log('✅ Error Handling: Missing CSV data correctly rejected')
        } else {
            console.log('❌ Error Handling: Missing CSV data not handled correctly')
            return false
        }
    } catch (error) {
        console.log('❌ Error Handling: Error testing missing CSV data')
        console.log(`   Error: ${error.message}`)
        return false
    }

    return true
}

// Main test runner
async function runTests() {
    console.log('🧪 Starting GeoNorm API Tests...\n')
    console.log(`API Base URL: ${API_BASE_URL}`)
    console.log(`API Key: ${API_KEY}\n`)

    const tests = [
        { name: 'Health Check', fn: testHealthCheck },
        { name: 'Process API', fn: testProcessAPI },
        { name: 'Static Map', fn: testStaticMap },
        { name: 'Error Handling', fn: testErrorHandling }
    ]

    let passed = 0
    let total = tests.length

    for (const test of tests) {
        try {
            const success = await test.fn()
            if (success) passed++
        } catch (error) {
            console.log(`❌ ${test.name}: Unexpected error`)
            console.log(`   Error: ${error.message}`)
        }
        console.log('')
    }

    console.log('📊 Test Results:')
    console.log(`   Passed: ${passed}/${total}`)
    console.log(`   Success Rate: ${Math.round((passed / total) * 100)}%`)

    if (passed === total) {
        console.log('🎉 All tests passed! API is working correctly.')
        process.exit(0)
    } else {
        console.log('⚠️  Some tests failed. Check the API server and configuration.')
        process.exit(1)
    }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
    console.log('❌ This script requires Node.js 18+ or a fetch polyfill')
    console.log('   Install: npm install node-fetch')
    process.exit(1)
}

runTests().catch(console.error)
