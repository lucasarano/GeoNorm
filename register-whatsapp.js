// WhatsApp Phone Number Registration Script
// Run with: node register-whatsapp.js

import axios from 'axios';

// Your WhatsApp credentials (from the Facebook Developer Console)
const ACCESS_TOKEN = 'EAAK3Ug7FiAoBPX6QjmDwAZB6JoQZCZC5d6wtrCT0f0YetPQRMNJZA7m3ggLXxZCgi3Ly5tZBeZBgHqexMNH6patw0CXhBy0t7V8x3cZCrTb937RZBBBv6JIHlgIZA4HsAfWccRKS0wDeKpY3pTOfdXI8cHawEOcBx9GSiW5RGjcaBbZCB9NSMXzXhQChh4hKrVFOzN4c8DBVChiPj6LSFBDuotSZBaJILZAJwP4yYAZCF0X3laygZDZD';
const PHONE_NUMBER_ID = '772680082595949';
const API_VERSION = 'v22.0';

const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}`;

async function requestVerificationCode() {
    try {
        console.log('📱 Requesting verification code...');

        const response = await axios.post(`${BASE_URL}/request_code`, {
            code_method: 'SMS',
            language: 'en'
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Verification code sent! Check your phone for SMS.');
        console.log('Response:', response.data);

        return true;
    } catch (error) {
        console.error('❌ Failed to request verification code:', error.response?.data || error.message);
        return false;
    }
}

async function verifyCode(code) {
    try {
        console.log(`🔐 Verifying code: ${code}`);

        const response = await axios.post(`${BASE_URL}/verify_code`, {
            code: code
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Code verified successfully!');
        console.log('Response:', response.data);

        return true;
    } catch (error) {
        console.error('❌ Failed to verify code:', error.response?.data || error.message);
        return false;
    }
}

async function registerPhoneNumber(pin) {
    try {
        console.log(`📝 Registering phone number with PIN: ${pin}`);

        const response = await axios.post(`${BASE_URL}/register`, {
            messaging_product: 'whatsapp',
            pin: pin
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('🎉 Phone number registered successfully!');
        console.log('Response:', response.data);

        return true;
    } catch (error) {
        console.error('❌ Failed to register phone number:', error.response?.data || error.message);
        return false;
    }
}

async function testMessage() {
    try {
        console.log('📤 Testing message sending...');

        const response = await axios.post(`${BASE_URL}/messages`, {
            messaging_product: 'whatsapp',
            to: '13465275200', // Your test recipient
            type: 'template',
            template: {
                name: 'hello_world',
                language: { code: 'en_US' }
            }
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Test message sent successfully!');
        console.log('Response:', response.data);

        return true;
    } catch (error) {
        console.error('❌ Failed to send test message:', error.response?.data || error.message);
        return false;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('🚀 WhatsApp Phone Number Registration Tool\n');

    switch (command) {
        case 'request':
            await requestVerificationCode();
            break;

        case 'verify':
            const code = args[1];
            if (!code) {
                console.error('❌ Please provide verification code: node register-whatsapp.js verify 123456');
                return;
            }
            await verifyCode(code);
            break;

        case 'register':
            const pin = args[1];
            if (!pin) {
                console.error('❌ Please provide 6-digit PIN: node register-whatsapp.js register 123456');
                return;
            }
            await registerPhoneNumber(pin);
            break;

        case 'test':
            await testMessage();
            break;

        case 'full':
            console.log('🔄 Running full registration process...\n');

            // Step 1: Request verification code
            const codeRequested = await requestVerificationCode();
            if (!codeRequested) return;

            console.log('\n⏳ Please check your phone for the verification code, then run:');
            console.log(`node register-whatsapp.js verify <CODE>`);
            console.log(`node register-whatsapp.js register <6-DIGIT-PIN>`);
            break;

        default:
            console.log('📋 Available commands:');
            console.log('  node register-whatsapp.js request          - Request verification code');
            console.log('  node register-whatsapp.js verify <code>    - Verify code');
            console.log('  node register-whatsapp.js register <pin>   - Register with PIN');
            console.log('  node register-whatsapp.js test             - Send test message');
            console.log('  node register-whatsapp.js full             - Start full process');
            console.log('\n💡 Example:');
            console.log('  node register-whatsapp.js full');
            console.log('  node register-whatsapp.js verify 123456');
            console.log('  node register-whatsapp.js register 654321');
            console.log('  node register-whatsapp.js test');
    }
}

main();
