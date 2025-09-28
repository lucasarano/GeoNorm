import twilio from 'twilio'

export class SMSService {
    private client: twilio.Twilio
    private fromNumber: string

    constructor() {
        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        )
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER || ''
    }

    async sendAddressConfirmation(
        phoneNumber: string,
        originalAddress: string,
        cleanedAddress: string,
        confirmationUrl: string
    ): Promise<boolean> {
        try {
            const message = `
🏠 GeoNorm - Confirmación de Dirección

Dirección original: ${originalAddress}
Dirección procesada: ${cleanedAddress}

¿Es correcta la dirección procesada?

Confirmar: ${confirmationUrl}/confirm
Rechazar: ${confirmationUrl}/reject

Responde STOP para no recibir más mensajes.
      `.trim()

            await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: this.formatPhoneNumber(phoneNumber)
            })

            console.log(`SMS sent to ${phoneNumber} for address confirmation`)
            return true
        } catch (error) {
            console.error('Error sending SMS:', error)
            return false
        }
    }

    async sendBulkConfirmations(confirmations: Array<{
        phoneNumber: string
        originalAddress: string
        cleanedAddress: string
        confirmationUrl: string
    }>): Promise<{ successful: number, failed: number, errors: string[] }> {
        const results = await Promise.allSettled(
            confirmations.map(conf => this.sendAddressConfirmation(
                conf.phoneNumber,
                conf.originalAddress,
                conf.cleanedAddress,
                conf.confirmationUrl
            ))
        )

        const successful = results.filter(r => r.status === 'fulfilled' && r.value).length
        const failed = results.length - successful
        const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => (r as PromiseRejectedResult).reason?.message || 'Unknown error')

        return { successful, failed, errors }
    }

    async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
        try {
            await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: this.formatPhoneNumber(phoneNumber)
            })
            return true
        } catch (error) {
            console.error('Error sending SMS:', error)
            return false
        }
    }

    async sendTestMessage(
        phoneNumber: string,
        message: string
    ): Promise<{ success: boolean; message: string; sid?: string; error?: string }> {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber)
            const response = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: formattedPhone
            })

            return {
                success: true,
                message: 'Test message sent successfully',
                sid: response.sid
            }
        } catch (error) {
            console.error('Error sending test SMS:', error)
            const messageText = error instanceof Error ? error.message : 'Failed to send test SMS'
            return {
                success: false,
                message: 'Failed to send test SMS',
                error: messageText
            }
        }
    }

    async sendProcessingComplete(
        phoneNumber: string,
        totalAddresses: number,
        pendingConfirmations: number
    ): Promise<boolean> {
        const message = `
✅ GeoNorm - Procesamiento Completado

Se procesaron ${totalAddresses} direcciones.
Confirmaciones pendientes: ${pendingConfirmations}

Revisa los resultados en tu dashboard.
        `.trim()

        return this.sendSMS(phoneNumber, message)
    }

    private formatPhoneNumber(phone: string): string {
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '')

        // Add country code if not present
        if (cleaned.startsWith('595')) {
            return `+${cleaned}`
        } else if (cleaned.startsWith('0')) {
            return `+595${cleaned.substring(1)}`
        } else if (cleaned.length === 9) {
            return `+595${cleaned}`
        }

        return `+${cleaned}`
    }
}

export const smsService = new SMSService()
