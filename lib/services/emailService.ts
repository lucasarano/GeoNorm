import nodemailer from 'nodemailer'

export class EmailService {
    private transporter: nodemailer.Transporter

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        })
    }

    async sendLocationRequest(
        email: string,
        customerName: string,
        locationUrl: string
    ): Promise<boolean> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'GeoNorm - Solicitud de Ubicación',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #f97316;">🏠 GeoNorm - Confirmación de Ubicación</h2>
                        
                        <p>Hola ${customerName},</p>
                        
                        <p>Para completar tu entrega, necesitamos confirmar tu ubicación exacta.</p>
                        
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; font-weight: bold;">Haz clic en el siguiente enlace para compartir tu ubicación:</p>
                            <a href="${locationUrl}" 
                               style="display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
                                📍 Compartir Ubicación
                            </a>
                        </div>
                        
                        <p><strong>¿Por qué necesitamos tu ubicación?</strong></p>
                        <ul>
                            <li>Garantizar una entrega precisa</li>
                            <li>Optimizar las rutas de entrega</li>
                            <li>Reducir tiempos de espera</li>
                        </ul>
                        
                        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                            Este enlace es seguro y expira en 7 días.<br>
                            Si no solicitaste este servicio, puedes ignorar este email.
                        </p>
                    </div>
                `
            }

            await this.transporter.sendMail(mailOptions)
            console.log(`Location request email sent to ${email}`)
            return true
        } catch (error) {
            console.error('Error sending email:', error)
            return false
        }
    }

    async sendTestEmail(email: string, name: string): Promise<boolean> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'GeoNorm - Email de Prueba',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #f97316;">✅ GeoNorm - Email de Prueba</h2>
                        <p>Hola ${name},</p>
                        <p>Este es un email de prueba para verificar la configuración del sistema.</p>
                        <p>Si recibes este mensaje, la configuración de email está funcionando correctamente.</p>
                    </div>
                `
            }

            await this.transporter.sendMail(mailOptions)
            return true
        } catch (error) {
            console.error('Error sending test email:', error)
            return false
        }
    }
}

export const emailService = new EmailService()
