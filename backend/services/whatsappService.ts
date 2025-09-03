import dotenv from 'dotenv'
// Load environment variables for this module before reading process.env
dotenv.config()
import axios from 'axios'

interface WhatsAppMessage {
    to: string
    type: 'text'
    text: {
        body: string
    }
}

interface AddressCorrectionData {
    phone: string
    originalAddress: string
    cleanedAddress: string
    confidence: number
    rowIndex: number
}

class WhatsAppService {
    private accessToken: string
    private phoneNumberId: string
    private apiVersion: string
    private baseUrl: string

    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || ''
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
        this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0'
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`

        // Debug logging
        console.log('[WHATSAPP] Service initialized with:')
        console.log('[WHATSAPP] Access Token:', this.accessToken ? 'SET' : 'NOT SET')
        console.log('[WHATSAPP] Phone Number ID:', this.phoneNumberId ? 'SET' : 'NOT SET')
        console.log('[WHATSAPP] API Version:', this.apiVersion)
    }

    private formatPhoneNumber(phone: string): string {
        // Remove any non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '')

        // If it starts with +595, use as is
        if (cleaned.startsWith('+595')) {
            return cleaned
        }

        // If it starts with 595, add +
        if (cleaned.startsWith('595')) {
            return '+' + cleaned
        }

        // If it starts with 0, remove it and add +595
        if (cleaned.startsWith('0')) {
            return '+595' + cleaned.substring(1)
        }

        // If it's 9 digits, assume it's a Paraguay number without country code
        if (cleaned.length === 9) {
            return '+595' + cleaned
        }

        return cleaned
    }

    async sendAddressCorrectionMessage(data: AddressCorrectionData): Promise<boolean> {
        try {
            const formattedPhone = this.formatPhoneNumber(data.phone)

            const message: WhatsAppMessage & { messaging_product: 'whatsapp'; recipient_type?: 'individual' } = {
                // Required by WhatsApp Cloud API
                messaging_product: 'whatsapp',
                // Optional but recommended
                recipient_type: 'individual',
                to: formattedPhone,
                type: 'text',
                text: {
                    body: `🏠 Hola! Necesitamos corregir tu dirección.\n\n` +
                        `📍 Dirección registrada: "${data.originalAddress}"\n\n` +
                        `❓ La dirección tiene baja confianza (${Math.round(data.confidence * 100)}%).\n\n` +
                        `✍️ Por favor responde con tu dirección correcta para actualizar nuestros registros.\n\n` +
                        `Gracias por tu colaboración! 🙏`
                }
            }

            console.log(`[WHATSAPP] Sending address correction to ${formattedPhone}`)

            const response = await axios.post(
                `${this.baseUrl}/messages`,
                message,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            )

            if (response.status === 200) {
                console.log(`[WHATSAPP] Message sent successfully to ${formattedPhone}`)
                return true
            } else {
                console.error(`[WHATSAPP] Failed to send message: ${response.status}`)
                return false
            }

        } catch (error: any) {
            console.error(`[WHATSAPP] Error sending message:`, error.response?.data || error.message)
            return false
        }
    }

    async sendBulkAddressCorrections(addresses: AddressCorrectionData[]): Promise<{ sent: number, failed: number }> {
        let sent = 0
        let failed = 0

        for (const address of addresses) {
            // Only send to addresses with confidence <= 40%
            if (address.confidence <= 0.4) {
                const success = await this.sendAddressCorrectionMessage(address)
                if (success) {
                    sent++
                } else {
                    failed++
                }

                // Add delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        console.log(`[WHATSAPP] Bulk send completed: ${sent} sent, ${failed} failed`)
        return { sent, failed }
    }

    isConfigured(): boolean {
        const configured = !!(this.accessToken && this.phoneNumberId)
        console.log('[WHATSAPP] isConfigured check:', configured)
        console.log('[WHATSAPP] Access Token length:', this.accessToken.length)
        console.log('[WHATSAPP] Phone Number ID:', this.phoneNumberId)
        return configured
    }
}

export default new WhatsAppService()
