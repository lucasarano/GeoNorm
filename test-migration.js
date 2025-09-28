#!/usr/bin/env node

// Simple test script to verify Vercel functions are working
const testEndpoints = [
    { name: 'Health Check', url: 'http://localhost:3000/api/health', method: 'GET' },
    { name: 'Process Extract', url: 'http://localhost:3000/api/process/extract', method: 'POST', body: { csvData: 'Name,Address\nTest,123 Main St' } },
    { name: 'Analytics Stats', url: 'http://localhost:3000/api/analytics/stats?userId=test', method: 'GET' }
]

async function testEndpoint(endpoint) {
    try {
        console.log(`Testing ${endpoint.name}...`)

        const options = {
            method: endpoint.method,
            headers: { 'Content-Type': 'application/json' }
        }

        if (endpoint.body) {
            options.body = JSON.stringify(endpoint.body)
        }

        const response = await fetch(endpoint.url, options)
        const data = await response.json()

        if (response.ok) {
            console.log(`✅ ${endpoint.name}: OK`)
            return true
        } else {
            console.log(`❌ ${endpoint.name}: ${response.status} - ${data.error || 'Unknown error'}`)
            return false
        }
    } catch (error) {
        console.log(`❌ ${endpoint.name}: ${error.message}`)
        return false
    }
}

async function runTests() {
    console.log('🧪 Testing Vercel Functions Migration...\n')

    let passed = 0
    let total = testEndpoints.length

    for (const endpoint of testEndpoints) {
        const success = await testEndpoint(endpoint)
        if (success) passed++
        console.log('')
    }

    console.log(`📊 Test Results: ${passed}/${total} passed`)

    if (passed === total) {
        console.log('🎉 All tests passed! Migration successful.')
    } else {
        console.log('⚠️  Some tests failed. Check the Vercel dev server.')
    }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
    console.log('❌ This script requires Node.js 18+ or a fetch polyfill')
    process.exit(1)
}

runTests().catch(console.error)
