# WhatsApp Business API Setup Guide

## 🎯 Overview

This integration sends WhatsApp messages to users with low confidence addresses (< 0.6) asking them to confirm or correct their address information.

## 📋 Prerequisites

1. **WhatsApp Business Account**: You need a verified WhatsApp Business account
2. **Facebook Developer Account**: Required to access the Cloud API
3. **Phone Number**: A business phone number registered with WhatsApp Business

## 🚀 Setup Steps

### 1. Create WhatsApp Business App

1. Go to [Facebook for Developers](https://developers.facebook.com/)
2. Create a new app and select "Business" as the app type
3. Add "WhatsApp" product to your app
4. Complete the business verification process

### 2. Get API Credentials

From your WhatsApp Business dashboard, collect:

- **Access Token**: Long-lived access token for your app
- **Phone Number ID**: The ID of your WhatsApp Business phone number
- **Webhook Verify Token**: A custom string you create for webhook verification

### 3. Configure Environment Variables

Add these to your `.env` file:

```env
# WhatsApp Business API Configuration
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_API_VERSION=v20.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_custom_verify_token_here
```

### 4. Setup Webhook

1. In your WhatsApp app dashboard, go to Configuration
2. Set webhook URL to: `https://yourdomain.com/api/whatsapp/webhook`
3. Set verify token to match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Subscribe to `messages` field

## 🧪 Testing

### Test with Sample Data

```bash
# Install dependencies if needed
npm install axios

# Run the test script
node test-whatsapp.js

# Test single number
node test-whatsapp.js single +595981234567
```

### Manual API Testing

```bash
# Test configuration
curl "http://localhost:3001/api/whatsapp/test?number=+595981234567"

# Send low confidence messages
curl -X POST http://localhost:3001/api/whatsapp/send-low-confidence \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": [
      {
        "phoneNumber": "+595981234567",
        "originalAddress": "Casa cerca del mercado",
        "cleanedAddress": "Mercado Central, Asunción, Paraguay",
        "confidence": 0.3
      }
    ]
  }'

# Check records status
curl http://localhost:3001/api/whatsapp/records
```

## 📱 Message Flow

### 1. Low Confidence Detection
When an address has confidence < 0.6, the system automatically:
- Stores the address record
- Sends a WhatsApp message with 3 options

### 2. User Message (Spanish)
```
Hola, te escribimos de AEX porque parece que tu dirección no ha sido ingresada correctamente.

*Dirección original:* Casa cerca del mercado
*Dirección sugerida:* Mercado Central, Asunción, Paraguay

¿Cuál prefieres usar?

[Usar sugerida] [Compartir ubicación] [Escribir nueva]
```

### 3. User Response Options

- **"Usar sugerida"**: Confirms the cleaned address
- **"Compartir ubicación"**: User sends GPS location
- **"Escribir nueva"**: User types a new address

### 4. Follow-up Processing
The webhook receives the response and:
- Updates the address record status
- Processes location data or new address text
- Sends confirmation message

## 🔧 API Endpoints

### Send Low Confidence Messages
```
POST /api/whatsapp/send-low-confidence
{
  "addresses": [
    {
      "phoneNumber": "+595981234567",
      "originalAddress": "string",
      "cleanedAddress": "string",
      "confidence": 0.3
    }
  ]
}
```

### Webhook Endpoints
```
GET  /api/whatsapp/webhook  # Webhook verification
POST /api/whatsapp/webhook  # Receive messages
```

### Status and Testing
```
GET /api/whatsapp/records   # View address records
GET /api/whatsapp/test?number=+595... # Test single number
```

## 📊 Response Tracking

The system tracks:
- Message delivery status
- User response type (button, location, text)
- Address confirmation status
- Processing timestamps

## 🛡️ Security Notes

1. **Webhook Verification**: Always verify webhook signatures in production
2. **Rate Limits**: Respect WhatsApp's messaging limits
3. **24-Hour Window**: Use templates for messages outside the customer service window
4. **Phone Number Validation**: Ensure proper E.164 format (+country_code + number)

## 🐛 Troubleshooting

### Common Issues

1. **"WhatsApp configuration incomplete"**
   - Check all environment variables are set
   - Verify access token is valid

2. **"Message not delivered"**
   - Verify phone number format (+595981234567)
   - Check if number is registered with WhatsApp
   - Ensure you're within messaging limits

3. **"Webhook not receiving messages"**
   - Verify webhook URL is publicly accessible
   - Check verify token matches
   - Ensure webhook is subscribed to 'messages' field

### Debug Logs

The server logs all WhatsApp operations:
```
[WHATSAPP] Sending message to +595981234567
[WHATSAPP] Message sent successfully
[WHATSAPP] Received interactive message from +595981234567
[WHATSAPP] +595981234567 confirmed cleaned address
```

## 📈 Production Considerations

1. **Database Storage**: Replace in-memory maps with proper database
2. **Queue System**: Use Redis/Bull for message queuing
3. **Monitoring**: Add metrics and alerting
4. **Scaling**: Consider webhook processing delays
5. **Backup**: Store conversation history for compliance

## 🔄 Integration with Existing Pipeline

This WhatsApp integration plugs into your existing address processing:

1. **CSV Processing** → Geocoding → **Confidence Check** → WhatsApp (if < 0.6)
2. **User Response** → Update Record → **Continue Processing**
3. **Final Export** includes WhatsApp-confirmed addresses

The system maintains the same data structure and can resume processing after user interaction.
