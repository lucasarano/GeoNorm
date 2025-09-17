import dotenv from 'dotenv'
dotenv.config()
import nodemailer from 'nodemailer'

// Email Service for sending confirmation requests
export class EmailService {
    private transporter: nodemailer.Transporter

    constructor() {
        // Initialize nodemailer transporter with debugging
        console.log('🔍 Email service config check:', {
            EMAIL_USER: process.env.EMAIL_USER ? '✅ Set' : '❌ Missing',
            EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing'
        })

        this.transporter = nodemailer.createTransport({
            service: 'gmail', // Options: 'gmail', 'outlook', 'yahoo', 'hotmail'
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD // App password for Gmail
            },
            debug: true, // Enable debug logging
            logger: true // Enable logger
        })

        // Verify transporter configuration
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Email transporter verification failed:', error)
            } else {
                console.log('✅ Email transporter verified successfully')
            }
        })
    }

    // Send email for address confirmation
    async sendAddressConfirmation(
        email: string,
        originalAddress: string,
        cleanedAddress: string,
        confirmationUrl: string
    ): Promise<boolean> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: '🏠 GeoNorm - Confirmación de Dirección',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #f97316 0%, #f59e0b 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">🏠 GeoNorm</h1>
                            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Confirmación de Dirección</p>
                        </div>
                        
                        <div style="background: #f9fafb; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                            <h2 style="color: #374151; margin-top: 0;">Dirección Procesada</h2>
                            <div style="margin-bottom: 15px;">
                                <strong style="color: #dc2626;">Dirección original:</strong><br>
                                <span style="background: #fee2e2; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${originalAddress}</span>
                            </div>
                            <div>
                                <strong style="color: #059669;">Dirección procesada:</strong><br>
                                <span style="background: #d1fae5; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">${cleanedAddress}</span>
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin-bottom: 25px;">
                            <p style="font-size: 18px; color: #374151; margin-bottom: 20px;"><strong>¿Es correcta la dirección procesada?</strong></p>
                            
                            <div style="margin-bottom: 15px;">
                                <a href="${confirmationUrl}/confirm" 
                                   style="background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-right: 10px;">
                                    ✅ Confirmar
                                </a>
                                <a href="${confirmationUrl}/reject" 
                                   style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                    ❌ Rechazar
                                </a>
                            </div>
                        </div>
                        
                        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                                Este email fue enviado por GeoNorm para confirmar el procesamiento de tu dirección.<br>
                                Si no solicitaste este servicio, puedes ignorar este mensaje.
                            </p>
                        </div>
                    </div>
                `,
                text: `
GeoNorm - Confirmación de Dirección

Dirección original: ${originalAddress}
Dirección procesada: ${cleanedAddress}

¿Es correcta la dirección procesada?

Confirmar: ${confirmationUrl}/confirm
Rechazar: ${confirmationUrl}/reject

Si no solicitaste este servicio, puedes ignorar este mensaje.
                `.trim()
            }

            console.log(`📧 Attempting to send email to: ${email}`)
            const result = await this.transporter.sendMail(mailOptions)
            console.log(`✅ Email sent successfully to ${email}:`, result.messageId)
            return true
        } catch (error) {
            console.error(`❌ Error sending email to ${email}:`, error)
            return false
        }
    }

    // Send bulk email confirmations
    async sendBulkConfirmations(confirmations: Array<{
        email: string
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

        // Process emails in batches to avoid rate limiting
        const batchSize = 5 // Smaller batch size for email
        for (let i = 0; i < confirmations.length; i += batchSize) {
            const batch = confirmations.slice(i, i + batchSize)

            const promises = batch.map(async (confirmation) => {
                try {
                    const success = await this.sendAddressConfirmation(
                        confirmation.email,
                        confirmation.originalAddress,
                        confirmation.cleanedAddress,
                        confirmation.confirmationUrl
                    )

                    if (success) {
                        results.successful++
                    } else {
                        results.failed++
                        results.errors.push(`Failed to send to ${confirmation.email}`)
                    }
                } catch (error) {
                    results.failed++
                    results.errors.push(`Error sending to ${confirmation.email}: ${error}`)
                }
            })

            await Promise.all(promises)

            // Add delay between batches to respect rate limits
            if (i + batchSize < confirmations.length) {
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }

        return results
    }

    // Send generic email message
    async sendEmail(email: string, subject: string, message: string): Promise<boolean> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: subject,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">📧 GeoNorm</h1>
                            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Notificación</p>
                        </div>
                        
                        <div style="background: #f9fafb; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                            <div style="color: #374151; line-height: 1.6; white-space: pre-line;">${message}</div>
                        </div>
                        
                        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                                Este email fue enviado por GeoNorm.
                            </p>
                        </div>
                    </div>
                `,
                text: message
            }

            await this.transporter.sendMail(mailOptions)
            return true
        } catch (error) {
            console.error('Error sending email:', error)
            return false
        }
    }

    // Send location collection email
    async sendLocationRequest(email: string, customerName: string, locationUrl: string): Promise<boolean> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: '📍 Solicitud de Ubicación - GeoNorm',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">📍 GeoNorm</h1>
                            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Solicitud de Ubicación</p>
                        </div>
                        
                        <div style="background: #f9fafb; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                            <h2 style="color: #374151; margin-top: 0;">¡Hola ${customerName}!</h2>
                            <p style="color: #374151; line-height: 1.6;">
                                Para completar tu entrega, necesitamos tu ubicación exacta. 
                                Por favor haz clic en el botón de abajo para compartir tu ubicación:
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin-bottom: 25px;">
                            <a href="${locationUrl}" 
                               style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                                📍 Compartir Mi Ubicación
                            </a>
                        </div>
                        
                        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                            <p style="color: #92400e; margin: 0; font-size: 14px;">
                                <strong>Nota:</strong> Este enlace es seguro y solo se usará para mejorar la precisión de tu entrega.
                            </p>
                        </div>
                        
                        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                                Si no esperabas este mensaje, puedes ignorarlo de forma segura.
                            </p>
                        </div>
                    </div>
                `,
                text: `
Hola ${customerName}!

Para completar tu entrega, necesitamos tu ubicación exacta. 
Por favor haz clic en este enlace para compartir tu ubicación:

${locationUrl}

Si no esperabas este mensaje, puedes ignorarlo de forma segura.
                `.trim()
            }

            console.log(`📧 Attempting to send location request email to: ${email}`)
            const result = await this.transporter.sendMail(mailOptions)
            console.log(`✅ Location request email sent successfully to ${email}:`, result.messageId)
            return true
        } catch (error) {
            console.error(`❌ Error sending location request email to ${email}:`, error)
            return false
        }
    }

    // Send processing completion notification
    async sendProcessingComplete(
        email: string,
        totalAddresses: number,
        pendingConfirmations: number
    ): Promise<boolean> {
        const subject = '✅ Procesamiento Completado - GeoNorm'
        const message = `¡Procesamiento completado exitosamente!

Total direcciones procesadas: ${totalAddresses}
Pendientes de confirmación: ${pendingConfirmations}

Puedes revisar tu panel de control para ver todos los resultados detallados.`

        return this.sendEmail(email, subject, message)
    }
}

// Export singleton instance
export const emailService = new EmailService()
