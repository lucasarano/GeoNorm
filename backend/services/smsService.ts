import twilio from 'twilio'

// SMS Service for sending confirmation requests
export class SMSService {
    private client: twilio.Twilio
    private fromNumber: string

    constructor() {
        // Initialize Twilio client
        this.client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        )
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER || ''
    }

    // Send SMS for address confirmation
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

    // Send bulk SMS notifications
    async sendBulkConfirmations(confirmations: Array<{
        phoneNumber: string
        originalAddress: string
        cleanedAddress: string
        confirmationUrl: string
    }>): Promise<{
        successful: number
        failed: number
        errors: string[]
    }> {
        const results = {
            successful: 0,
            failed: 0,
            errors: [] as string[]
        }

        // Process SMS in batches to avoid rate limiting
        const batchSize = 10
        for (let i = 0; i < confirmations.length; i += batchSize) {
            const batch = confirmations.slice(i, i + batchSize)

            const promises = batch.map(async (confirmation) => {
                try {
                    const success = await this.sendAddressConfirmation(
                        confirmation.phoneNumber,
                        confirmation.originalAddress,
                        confirmation.cleanedAddress,
                        confirmation.confirmationUrl
                    )

                    if (success) {
                        results.successful++
                    } else {
                        results.failed++
                        results.errors.push(`Failed to send to ${confirmation.phoneNumber}`)
                    }
                } catch (error) {
                    results.failed++
                    results.errors.push(`Error sending to ${confirmation.phoneNumber}: ${error}`)
                }
            })

            await Promise.all(promises)

            // Add delay between batches to respect rate limits
            if (i + batchSize < confirmations.length) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        return results
    }

    // Format phone number for international SMS
    private formatPhoneNumber(phoneNumber: string): string {
        // Remove all non-numeric characters
        let cleaned = phoneNumber.replace(/\D/g, '')

        // Add Paraguay country code if not present
        if (!cleaned.startsWith('595') && cleaned.length <= 9) {
            cleaned = '595' + cleaned
        }

        // Add + for international format
        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned
        }

        return cleaned
    }

    // Send simple notification SMS
    async sendNotification(phoneNumber: string, message: string): Promise<boolean> {
        try {
            await this.client.messages.create({
                body: `GeoNorm: ${message}`,
                from: this.fromNumber,
                to: this.formatPhoneNumber(phoneNumber)
            })

            return true
        } catch (error) {
            console.error('Error sending notification SMS:', error)
            return false
        }
    }

    // Send processing completion notification
    async sendProcessingComplete(
        phoneNumber: string,
        totalAddresses: number,
        pendingConfirmations: number
    ): Promise<boolean> {
        const message = `
✅ Procesamiento completado!

Total direcciones: ${totalAddresses}
Pendientes de confirmación: ${pendingConfirmations}

Revisa tu panel de control para ver los resultados.
    `.trim()

        return this.sendNotification(phoneNumber, message)
    }
}

// Export singleton instance
export const smsService = new SMSService()
