import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

export interface WhatsAppConfig {
    phoneNumberId: string
    accessToken: string
    apiVersion: string
}

export interface WhatsAppMessage {
    to: string
    type: 'template' | 'text' | 'interactive'
    template?: {
        name: string
        language: { code: string }
        components: any[]
    }
    text?: {
        body: string
    }
    interactive?: {
        type: 'button' | 'list'
        body: { text: string }
        action: any
    }
}

export class WhatsAppService {
    private config: WhatsAppConfig

    constructor() {
        this.config = {
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
            apiVersion: process.env.WHATSAPP_API_VERSION || 'v22.0'
        }
    }

    private validateConfig(): boolean {
        return !!(this.config.phoneNumberId && this.config.accessToken)
    }

    async sendMessage(message: WhatsAppMessage): Promise<any> {
        if (!this.validateConfig()) {
            throw new Error('WhatsApp configuration is incomplete. Please set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN')
        }

        const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`

        const payload = {
            messaging_product: 'whatsapp',
            ...message
        }

        try {
            console.log(`[WHATSAPP] Sending message to ${message.to}`)
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.config.accessToken}`,
                    'Content-Type': 'application/json'
                }
            })

            console.log(`[WHATSAPP] Message sent successfully:`, response.data)
            return response.data
        } catch (error: any) {
            console.error(`[WHATSAPP] Error sending message:`, error.response?.data || error.message)
            throw error
        }
    }

    async sendLowConfidenceAddressMessage(phoneNumber: string, cleanedAddress: string, originalAddress: string): Promise<any> {
        // Clean phone number to E.164 format
        const cleanPhoneNumber = this.formatPhoneNumber(phoneNumber)

        const message: WhatsAppMessage = {
            to: cleanPhoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text: `Hola, te escribimos de AEX porque parece que tu dirección no ha sido ingresada correctamente.\n\n*Dirección original:* ${originalAddress}\n*Dirección sugerida:* ${cleanedAddress}\n\n¿Cuál prefieres usar?`
                },
                action: {
                    buttons: [
                        {
                            type: 'reply',
                            reply: {
                                id: 'USE_CLEANED',
                                title: 'Usar sugerida'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'SHARE_LOCATION',
                                title: 'Compartir ubicación'
                            }
                        },
                        {
                            type: 'reply',
                            reply: {
                                id: 'EDIT_ADDRESS',
                                title: 'Escribir nueva'
                            }
                        }
                    ]
                }
            }
        }

        return await this.sendMessage(message)
    }

    async sendFollowUpMessage(phoneNumber: string): Promise<any> {
        const cleanPhoneNumber = this.formatPhoneNumber(phoneNumber)

        const message: WhatsAppMessage = {
            to: cleanPhoneNumber,
            type: 'text',
            text: {
                body: 'Por favor, ingresa tu dirección correcta para continuar con el proceso.'
            }
        }

        return await this.sendMessage(message)
    }

    private formatPhoneNumber(phoneNumber: string): string {
        // Remove all non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '')

        // Add country code if missing (assuming Paraguay +595)
        if (!cleaned.startsWith('595') && cleaned.length <= 10) {
            cleaned = '595' + cleaned
        }

        // Ensure it starts with country code for E.164 format
        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned
        }

        return cleaned
    }

    // Validate webhook signature (for security)
    validateWebhookSignature(payload: string, signature: string): boolean {
        // This would typically use HMAC-SHA256 with your app secret
        // Implementation depends on your specific setup
        return true // Simplified for now
    }
}

export default WhatsAppService
