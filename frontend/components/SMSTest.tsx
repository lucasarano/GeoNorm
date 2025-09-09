import React, { useState, useEffect, useRef } from 'react'
import { Button } from './shared/ui/button'
import { Input } from './shared/ui/input'
import { Label } from './shared/ui/label'
import { Card } from './shared/ui/card'

interface SMSTestProps {
    onBack?: () => void
}

interface CountryCode {
    code: string
    name: string
    flag: string
    dialCode: string
    format: string
}

const countryCodes: CountryCode[] = [
    { code: 'PY', name: 'Paraguay', flag: '🇵🇾', dialCode: '+595', format: '0XX-XXX-XXX' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷', dialCode: '+54', format: '9-XXXX-XXXX' },
    { code: 'BR', name: 'Brasil', flag: '🇧🇷', dialCode: '+55', format: '(XX) XXXXX-XXXX' },
    { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dialCode: '+598', format: 'XXXX-XXXX' },
    { code: 'BO', name: 'Bolivia', flag: '🇧🇴', dialCode: '+591', format: 'XXXX-XXXX' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱', dialCode: '+56', format: 'X-XXXX-XXXX' },
    { code: 'PE', name: 'Perú', flag: '🇵🇪', dialCode: '+51', format: 'XXX-XXX-XXX' },
    { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', dialCode: '+1', format: '(XXX) XXX-XXXX' },
    { code: 'ES', name: 'España', flag: '🇪🇸', dialCode: '+34', format: 'XXX XX XX XX' },
]

const SMSTest: React.FC<SMSTestProps> = ({ onBack }) => {
    const [selectedCountry, setSelectedCountry] = useState<CountryCode>(countryCodes[0]) // Default to Paraguay
    const [phone, setPhone] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showCountryDropdown, setShowCountryDropdown] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        locationUrl?: string
        error?: string
    } | null>(null)

    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowCountryDropdown(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const formatPhoneNumber = (value: string, country: CountryCode) => {
        // Remove all non-numeric characters
        const cleaned = value.replace(/\D/g, '')

        // Format based on country
        switch (country.code) {
            case 'PY': // Paraguay: 0981-123-456
                if (cleaned.length <= 3) return cleaned
                if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
                return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7, 10)}`

            case 'AR': // Argentina: 9-1234-5678
                if (cleaned.length <= 1) return cleaned
                if (cleaned.length <= 5) return `${cleaned.slice(0, 1)}-${cleaned.slice(1)}`
                return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 5)}-${cleaned.slice(5, 9)}`

            case 'BR': // Brazil: (11) 99999-9999
                if (cleaned.length <= 2) return cleaned
                if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`
                return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`

            case 'US': // US: (555) 123-4567
                if (cleaned.length <= 3) return cleaned
                if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
                return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`

            default: // Generic formatting
                if (cleaned.length <= 3) return cleaned
                if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`
        }
    }

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setPhone(formatPhoneNumber(value, selectedCountry))
    }

    const getFullPhoneNumber = () => {
        const cleaned = phone.replace(/\D/g, '')
        return `${selectedCountry.dialCode}${cleaned}`
    }

    const sendTestSMS = async () => {
        if (!phone.trim()) {
            setResult({
                success: false,
                message: 'Por favor ingresa un número de teléfono',
                error: 'Phone number required'
            })
            return
        }

        setIsLoading(true)
        setResult(null)

        try {
            const response = await fetch('http://localhost:3001/api/test-location-sms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: getFullPhoneNumber() // Send full international number
                })
            })

            const data = await response.json()

            if (response.ok && data.success) {
                setResult({
                    success: true,
                    message: '¡SMS enviado exitosamente!',
                    locationUrl: data.locationUrl
                })
            } else {
                setResult({
                    success: false,
                    message: 'Error al enviar SMS',
                    error: data.error || 'Unknown error'
                })
            }
        } catch (error) {
            console.error('Error sending SMS:', error)
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
            sendTestSMS()
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    SMS Test
                                </h1>
                                <p className="text-sm text-gray-600">Prueba de envío de SMS con Twilio</p>
                            </div>
                        </div>
                        {onBack && (
                            <Button
                                variant="outline"
                                onClick={onBack}
                                className="text-gray-600 hover:text-blue-600"
                            >
                                ← Volver
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Card className="p-8 bg-white/80 backdrop-blur-sm shadow-2xl border-blue-100">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21l4-7 4 7M3 5l6 6m0 0l6-6m-6 6V3" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Test SMS Location</h2>
                        <p className="text-gray-600">
                            Envía un SMS de prueba con enlace de ubicación a cualquier número de teléfono
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                                Número de Teléfono
                            </Label>

                            {/* Country Code Selector and Phone Input */}
                            <div className="flex space-x-2">
                                {/* Country Selector */}
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                        className="flex items-center space-x-2 px-3 py-3 bg-white border border-gray-300 rounded-lg hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        disabled={isLoading}
                                    >
                                        <span className="text-lg">{selectedCountry.flag}</span>
                                        <span className="text-sm font-medium text-gray-700">{selectedCountry.dialCode}</span>
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Dropdown */}
                                    {showCountryDropdown && (
                                        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                            {countryCodes.map((country) => (
                                                <button
                                                    key={country.code}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCountry(country)
                                                        setShowCountryDropdown(false)
                                                        setPhone('') // Reset phone when changing country
                                                    }}
                                                    className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                                                >
                                                    <span className="text-lg">{country.flag}</span>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900">{country.name}</div>
                                                        <div className="text-sm text-gray-500">{country.dialCode} • {country.format}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Phone Number Input */}
                                <div className="flex-1">
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder={`Ej: ${selectedCountry.format.replace(/X/g, '9')}`}
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        onKeyPress={handleKeyPress}
                                        className="text-lg py-3"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Formato: {selectedCountry.format}</span>
                                <span className="font-medium">
                                    Número completo: {phone ? getFullPhoneNumber() : selectedCountry.dialCode + '...'}
                                </span>
                            </div>
                        </div>

                        <Button
                            onClick={sendTestSMS}
                            disabled={isLoading || !phone.trim()}
                            className="w-full py-3 text-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Enviando SMS...</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    <span>Enviar SMS de Prueba</span>
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
                                            {result.success ? 'SMS Enviado' : 'Error al Enviar'}
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

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                ¿Qué hace este test?
                            </h3>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>• Envía un SMS usando tu configuración de Twilio</li>
                                <li>• Incluye un enlace único para recopilar ubicación</li>
                                <li>• Verifica que la integración SMS funciona correctamente</li>
                                <li>• El mensaje incluye "Este es un SMS de prueba"</li>
                            </ul>
                        </div>
                    </div>
                </Card>
            </main>
        </div>
    )
}

export default SMSTest
