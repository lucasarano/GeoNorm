// Test script for WhatsApp integration
// Run with: node test-whatsapp.js

import axios from 'axios';

const SERVER_URL = 'http://localhost:3001';

// Sample test data with low confidence addresses
const testAddresses = [
    {
        phoneNumber: '+13465275200', // Working test number
        originalAddress: 'Casa cerca del mercado',
        cleanedAddress: 'Mercado Central, Asunción, Paraguay',
        confidence: 0.3
    },
    {
        phoneNumber: '+13465275200', // Same number, different address
        originalAddress: 'Por la iglesia',
        cleanedAddress: 'Iglesia San Roque, Fernando de la Mora, Paraguay',
        confidence: 0.4
    },
    {
        phoneNumber: '+13465275200', // High confidence - should be skipped
        originalAddress: 'Av. España 1234, Asunción',
        cleanedAddress: 'Avenida España 1234, Asunción, Paraguay',
        confidence: 0.9
    }
];

async function testWhatsAppIntegration() {
    try {
        console.log('🧪 Testing WhatsApp Integration...\n');

        // Test 1: Send low confidence messages
        console.log('📤 Sending low confidence messages...');
        const response = await axios.post(`${SERVER_URL}/api/whatsapp/send-low-confidence`, {
            addresses: testAddresses
        });

        console.log('✅ Response:', JSON.stringify(response.data, null, 2));

        // Test 2: Check records status
        console.log('\n📊 Checking address records status...');
        const recordsResponse = await axios.get(`${SERVER_URL}/api/whatsapp/records`);
        console.log('✅ Records:', JSON.stringify(recordsResponse.data, null, 2));

        console.log('\n🎉 WhatsApp integration test completed!');
        console.log('\n📱 Check your WhatsApp to see if messages were received.');
        console.log('💡 Reply to the messages to test the webhook functionality.');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);

        if (error.response?.status === 500 && error.response?.data?.error?.includes('WhatsApp configuration')) {
            console.log('\n💡 Make sure to set your WhatsApp API credentials in .env file:');
            console.log('   WHATSAPP_ACCESS_TOKEN=your_token_here');
            console.log('   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here');
            console.log('   WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token_here');
        }
    }
}

// Test individual phone number
async function testSingleNumber(phoneNumber) {
    try {
        console.log(`📞 Testing single number: ${phoneNumber}`);

        const response = await axios.get(`${SERVER_URL}/api/whatsapp/test`, {
            params: { number: phoneNumber }
        });

        console.log('✅ Test message sent:', response.data);

    } catch (error) {
        console.error('❌ Single number test failed:', error.response?.data || error.message);
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    if (args.length > 0 && args[0] === 'single') {
        const phoneNumber = args[1] || '+595981234567';
        await testSingleNumber(phoneNumber);
    } else {
        await testWhatsAppIntegration();
    }
}

main();
