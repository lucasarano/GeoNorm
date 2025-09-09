import React, { useState, useEffect } from 'react'
import { Button } from './shared/ui/button'

interface LandingPageProps {
    onGetStarted: () => void
    onSMSTest?: () => void
    onEmailTest?: () => void
}

export default function LandingPage({ onGetStarted, onSMSTest, onEmailTest }: LandingPageProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        setIsVisible(true)
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-32 w-80 h-80 bg-gradient-to-br from-orange-200/30 to-amber-300/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-32 -left-40 w-96 h-96 bg-gradient-to-tr from-orange-300/20 to-yellow-200/30 rounded-full blur-3xl"></div>
            </div>

            {/* Modern Header */}
            <header className="relative z-20 bg-white/95 backdrop-blur-xl border-b border-orange-100/50 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
                    <div className="flex items-center justify-between">
                        {/* Logo & Brand - Left Side */}
                        <div className="flex items-center space-x-4 group cursor-pointer">
                            <div className="relative">
                                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-xl group-hover:shadow-orange-200/50 transition-all duration-300 group-hover:scale-105">
                                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full border-2 border-white animate-pulse"></div>
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent group-hover:from-orange-600 group-hover:via-amber-600 group-hover:to-yellow-600 transition-all duration-300">
                                    GeoNorm
                                </h1>
                                <p className="text-sm text-gray-600 font-medium tracking-wide">Inteligencia de Direcciones con IA</p>
                            </div>
                        </div>

                        {/* Navigation & Actions - Right Side */}
                        <div className="flex items-center space-x-6">
                            {/* Navigation Links */}
                            <nav className="hidden md:flex items-center space-x-8">
                                <a href="#como-funciona" className="text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium text-sm">
                                    ¿Cómo funciona?
                                </a>
                                <a href="#integraciones" className="text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium text-sm">
                                    Integraciones
                                </a>
                                <a href="#contacto" className="text-gray-600 hover:text-orange-600 transition-colors duration-200 font-medium text-sm">
                                    Contacto
                                </a>
                            </nav>

                            {/* CTA Button */}
                            <Button
                                onClick={onGetStarted}
                                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-0"
                            >
                                <span className="flex items-center text-sm">
                                    Probar Gratis
                                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </span>
                            </Button>

                            {/* Mobile Menu Button */}
                            <div className="md:hidden">
                                <button className="p-2 text-gray-600 hover:text-orange-600 transition-colors duration-200">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Title */}
                    <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
                            <span className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
                                Convierte
                            </span>
                            <br />
                            <span className="text-gray-800">Direcciones Vagas</span>
                            <br />
                            <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-500 bg-clip-text text-transparent">
                                A Puntos Exactos
                            </span>
                        </h2>
                    </div>

                    {/* Address Transformation Demo */}
                    <div className={`transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-orange-100 p-8 md:p-12">

                            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                                {/* Before - Messy Address */}
                                <div className="flex-1 max-w-md">
                                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 relative">
                                        <div className="absolute -top-3 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                            ANTES
                                        </div>
                                        <div className="mt-2">
                                            <div className="bg-white rounded-lg p-4 border border-red-200">
                                                <div className="text-red-800 font-mono text-base leading-relaxed">
                                                    a 3 km de don ramon<br />
                                                    cerca del supermercado<br />
                                                    por la ruta vieja asuncion
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Big Orange Arrow */}
                                <div className="flex justify-center">
                                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-full p-6 shadow-2xl">
                                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </div>
                                </div>

                                {/* After - Clean Address */}
                                <div className="flex-1 max-w-md">
                                    <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 relative">
                                        <div className="absolute -top-3 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                                            DESPUÉS
                                        </div>
                                        <div className="mt-2">
                                            <div className="bg-white rounded-lg p-4 border border-green-200">
                                                <div className="text-green-800 font-semibold text-base leading-relaxed">
                                                    Ruta Transchaco Km 15<br />
                                                    Mariano Roque Alonso<br />
                                                    Central, Paraguay
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className={`text-center mt-16 transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="flex flex-col items-center justify-center gap-4 mb-6">
                            <Button
                                onClick={onGetStarted}
                                className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 text-white font-bold py-6 px-16 rounded-2xl text-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 border-0"
                            >
                                <span className="flex items-center">
                                    Probar Ahora
                                    <svg className="w-7 h-7 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </span>
                            </Button>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                {onSMSTest && (
                                    <Button
                                        onClick={onSMSTest}
                                        variant="outline"
                                        className="bg-white/80 backdrop-blur-sm border-2 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 font-semibold py-3 px-6 rounded-xl text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                                    >
                                        <span className="flex items-center">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            Test SMS
                                        </span>
                                    </Button>
                                )}

                                {onEmailTest && (
                                    <Button
                                        onClick={onEmailTest}
                                        variant="outline"
                                        className="bg-white/80 backdrop-blur-sm border-2 border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 font-semibold py-3 px-6 rounded-xl text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                                    >
                                        <span className="flex items-center">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            Test Email
                                        </span>
                                    </Button>
                                )}
                            </div>
                        </div>
                        <p className="text-gray-500 text-base">Sin registro • Procesa hasta 100 direcciones gratis • Incluye confirmación por SMS y Email</p>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="como-funciona" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 bg-white/30 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                            ¿Cómo <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Funciona</span>?
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            Nuestro sistema de inteligencia artificial procesa tus direcciones en tres pasos simples
                        </p>
                    </div>

                    {/* Steps */}
                    <div className="grid md:grid-cols-3 gap-8 mb-16">
                        {/* Step 1 */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-orange-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl mb-6 mx-auto">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">1. Carga tus Datos</h3>
                            <p className="text-gray-600 text-center">
                                Sube tu archivo CSV o conecta tu base de datos. Nuestro sistema extrae automáticamente las direcciones de cualquier formato.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-orange-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl mb-6 mx-auto">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">2. IA Procesa</h3>
                            <p className="text-gray-600 text-center">
                                Nuestra inteligencia artificial limpia, estandariza y estructura cada dirección usando modelos avanzados de OpenAI.
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-orange-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl mb-6 mx-auto">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">3. Geocodifica</h3>
                            <p className="text-gray-600 text-center">
                                Convertimos cada dirección en coordenadas exactas usando Google Maps, con indicadores de precisión y confianza.
                            </p>
                        </div>
                    </div>

                    {/* Database Integration Section */}
                    <div id="integraciones" className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-8 md:p-12 border border-blue-100">
                        <div className="text-center mb-8">
                            <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl mb-6 mx-auto">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-4">Conecta tu Base de Datos</h3>
                            <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-8">
                                <strong>Te ayudamos a integrar tu sistema existente</strong> con nuestra plataforma.
                                Conectamos directamente con tu base de datos para procesar direcciones de forma automática y continua.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-blue-100">
                                <h4 className="text-lg font-semibold text-gray-900 mb-3">Integraciones Soportadas</h4>
                                <ul className="space-y-2 text-gray-600">
                                    <li className="flex items-center">
                                        <svg className="w-4 h-4 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        PostgreSQL, MySQL, SQL Server
                                    </li>
                                    <li className="flex items-center">
                                        <svg className="w-4 h-4 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        MongoDB, Firebase, DynamoDB
                                    </li>
                                    <li className="flex items-center">
                                        <svg className="w-4 h-4 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        APIs REST y GraphQL
                                    </li>
                                    <li className="flex items-center">
                                        <svg className="w-4 h-4 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Archivos CSV, Excel, JSON
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-blue-100">
                                <h4 className="text-lg font-semibold text-gray-900 mb-3">Servicios de Integración</h4>
                                <ul className="space-y-2 text-gray-600">
                                    <li className="flex items-center">
                                        <svg className="w-4 h-4 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Configuración técnica completa
                                    </li>
                                    <li className="flex items-center">
                                        <svg className="w-4 h-4 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Migración de datos existentes
                                    </li>
                                    <li className="flex items-center">
                                        <svg className="w-4 h-4 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Procesamiento automático
                                    </li>
                                    <li className="flex items-center">
                                        <svg className="w-4 h-4 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Soporte técnico continuo
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="text-center mt-8">
                            <p className="text-gray-700 mb-6">
                                <strong>¿Necesitas ayuda con la integración?</strong> Nuestro equipo técnico te acompaña en todo el proceso.
                            </p>
                            <Button
                                id="contacto"
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border-0"
                            >
                                Contactar Equipo Técnico
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 bg-white/60 backdrop-blur-sm border-t border-orange-100 mt-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-center">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <span className="text-gray-600">Powered by OpenAI & Google Maps</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}