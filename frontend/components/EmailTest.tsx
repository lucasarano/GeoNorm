import React, { useState } from 'react'
import { Button } from './shared/ui/button'
import { Input } from './shared/ui/input'
import { Label } from './shared/ui/label'
import { Card } from './shared/ui/card'

interface EmailTestProps {
    onBack?: () => void
}

const EmailTest: React.FC<EmailTestProps> = ({ onBack }) => {
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        locationUrl?: string
        error?: string
    } | null>(null)

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    const sendTestEmail = async () => {
        if (!email.trim()) {
            setResult({
                success: false,
                message: 'Por favor ingresa una dirección de email',
                error: 'Email address required'
            })
            return
        }

        if (!validateEmail(email)) {
            setResult({
                success: false,
                message: 'Por favor ingresa un email válido',
                error: 'Invalid email format'
            })
            return
        }

        setIsLoading(true)
        setResult(null)

        try {
            const response = await fetch('http://localhost:3001/api/test-location-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email.trim(),
                    name: name.trim() || 'Cliente'
                })
            })

            const data = await response.json()

            if (response.ok && data.success) {
                setResult({
                    success: true,
                    message: '¡Email enviado exitosamente!',
                    locationUrl: data.locationUrl
                })
            } else {
                setResult({
                    success: false,
                    message: 'Error al enviar email',
                    error: data.error || 'Unknown error'
                })
            }
        } catch (error) {
            console.error('Error sending email:', error)
            setResult({
                success: false,
                message: 'Error de conexión al servidor',
                error: error instanceof Error ? error.message : 'Network error'
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading) {
            sendTestEmail()
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-md border-b border-purple-100 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                    Email Test
                                </h1>
                                <p className="text-sm text-gray-600">Prueba de envío de emails con ubicación</p>
                            </div>
                        </div>
                        {onBack && (
                            <Button
                                variant="outline"
                                onClick={onBack}
                                className="text-gray-600 hover:text-purple-600"
                            >
                                ← Volver
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Card className="p-8 bg-white/80 backdrop-blur-sm shadow-2xl border-purple-100">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Test Email Location</h2>
                        <p className="text-gray-600">
                            Envía un email de prueba con enlace de ubicación a cualquier dirección de correo
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                Dirección de Email *
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="ejemplo@correo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="text-lg py-3"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                                Nombre del Cliente (Opcional)
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Juan Pérez"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="text-lg py-3"
                                disabled={isLoading}
                            />
                            <p className="text-xs text-gray-500">
                                Se usará "Cliente" si no se especifica un nombre
                            </p>
                        </div>

                        <Button
                            onClick={sendTestEmail}
                            disabled={isLoading || !email.trim()}
                            className="w-full py-3 text-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Enviando Email...</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    <span>Enviar Email de Prueba</span>
                                </div>
                            )}
                        </Button>

                        {result && (
                            <div className={`p-4 rounded-xl border ${result.success
                                    ? 'bg-green-50 border-green-200 text-green-800'
                                    : 'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0">
                                        {result.success ? (
                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1">
                                            {result.success ? 'Email Enviado' : 'Error al Enviar'}
                                        </h3>
                                        <p className="text-sm">{result.message}</p>
                                        {result.locationUrl && (
                                            <div className="mt-2">
                                                <p className="text-xs font-medium mb-1">URL de ubicación generada:</p>
                                                <code className="text-xs bg-white/50 px-2 py-1 rounded border break-all">
                                                    {result.locationUrl}
                                                </code>
                                            </div>
                                        )}
                                        {result.error && (
                                            <p className="text-xs mt-1 opacity-75">
                                                Detalles técnicos: {result.error}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                            <h3 className="font-semibold text-purple-900 mb-2 flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                ¿Qué hace este test?
                            </h3>
                            <ul className="text-sm text-purple-800 space-y-1">
                                <li>• Envía un email usando tu configuración de correo</li>
                                <li>• Incluye un enlace único para recopilar ubicación</li>
                                <li>• Verifica que la integración de email funciona correctamente</li>
                                <li>• El email tiene un diseño profesional con HTML</li>
                                <li>• Personaliza el saludo con el nombre del cliente</li>
                            </ul>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <h3 className="font-semibold text-amber-900 mb-2 flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                Configuración Requerida
                            </h3>
                            <p className="text-sm text-amber-800">
                                Para que funcione, necesitas configurar estas variables en tu .env:
                            </p>
                            <ul className="text-xs text-amber-700 mt-2 space-y-1 font-mono">
                                <li>• EMAIL_USER=tu-email@gmail.com</li>
                                <li>• EMAIL_PASSWORD=tu-app-password</li>
                            </ul>
                        </div>
                    </div>
                </Card>
            </main>
        </div>
    )
}

export default EmailTest
