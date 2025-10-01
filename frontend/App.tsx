import React, { useEffect, useMemo, useState } from 'react'
import LandingPage from './components/LandingPage'
import RegistrationPage from './components/auth/RegistrationPage'
import UnifiedProcessor from './components/UnifiedProcessor'
import DataDashboard from './components/DataDashboard'
import DataHistory from './components/DataHistory'
import LocationCollection from './components/LocationCollection'
import Documentation from './components/Documentation'
import ApiKeyDashboard from './components/ApiKeyDashboard'
import AppHeader from './components/layout/AppHeader'
import type { AppView } from './types/app-view'
import { useAuth } from './contexts/AuthContext'

interface ProcessingResult {
    success: boolean
    totalProcessed: number
    statistics: {
        highConfidence: number
        mediumConfidence: number
        lowConfidence: number
        totalRows: number
    }
    results: any[]
    debug?: {
        batchProcessing?: any
        geocodingInteractions?: any
    }
}

const viewBackgrounds: Record<AppView, string> = {
    landing: 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50',
    registration: 'bg-gray-50',
    pipeline: 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50',
    dashboard: 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50',
    'data-history': 'bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50',
    'location-collection': 'bg-gray-50',
    documentation: 'bg-gray-50',
    'api-keys': 'bg-gray-50'
}

const mainClassMap: Partial<Record<AppView, string>> = {
    landing: 'flex-1',
    pipeline: 'flex-1',
    documentation: 'flex-1',
    registration: 'flex-1',
    dashboard: 'flex-1',
    'data-history': 'flex-1',
    'location-collection': 'flex-1',
    'api-keys': 'flex-1'
}

function App() {
    const [currentView, setCurrentView] = useState<AppView>(() => {
        const path = window.location.pathname
        const params = new URLSearchParams(window.location.search)

        if (path === '/location' || params.has('orderID') || params.has('token')) {
            return 'location-collection'
        }
        if (path === '/documentation' || path === '/docs') {
            return 'documentation'
        }
        if (path === '/api-keys' || path === '/dashboard') {
            return 'api-keys'
        }

        return 'landing'
    })

    const { currentUser, loading } = useAuth()

    const [userId] = useState(() => {
        let id = localStorage.getItem('geonorm-user-id')
        if (!id) {
            id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            localStorage.setItem('geonorm-user-id', id)
        }
        return id
    })

    const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null)

    const publicViews = useMemo<AppView[]>(() => ['landing', 'registration', 'location-collection'], [])

    useEffect(() => {
        if (loading) return

        const isPublic = publicViews.includes(currentView)

        if (!currentUser && !isPublic) {
            setCurrentView('landing')
            return
        }

        if (currentUser && currentView === 'registration') {
            setCurrentView('pipeline')
        }
    }, [currentUser, currentView, loading, publicViews])

    const handleNavigate = (view: AppView) => {
        const isPublic = publicViews.includes(view)

        if (view === 'registration' && currentUser) {
            setCurrentView('pipeline')
            return
        }

        if (!currentUser && !isPublic) {
            setCurrentView('landing')
            return
        }

        if (view === 'dashboard' && !processingResult) {
            setCurrentView(currentUser ? 'pipeline' : 'landing')
            return
        }

        setCurrentView(view)
    }

    const handleGetStarted = () => {
        if (currentUser) {
            setCurrentView('pipeline')
        } else {
            setCurrentView('registration')
        }
    }

    const resolvedView: AppView = useMemo(() => {
        if (!loading && !currentUser && !publicViews.includes(currentView)) {
            return 'landing'
        }

        if (currentUser && currentView === 'registration') {
            return 'pipeline'
        }

        if (currentView === 'dashboard' && !processingResult && !currentUser) {
            return 'landing'
        }

        if (currentView === 'dashboard' && !processingResult && currentUser) {
            return 'pipeline'
        }

        return currentView
    }, [currentView, currentUser, loading, processingResult, publicViews])

    const renderContent = () => {
        switch (resolvedView) {
            case 'landing':
                return (
                    <LandingPage
                        onGetStarted={handleGetStarted}
                    />
                )

            case 'registration':
                return (
                    <RegistrationPage
                        onRegistrationComplete={() => setCurrentView('pipeline')}
                        onBackToHome={() => setCurrentView('landing')}
                    />
                )

            case 'location-collection': {
                const params = new URLSearchParams(window.location.search)
                const orderID = params.get('orderID') || undefined
                const token = params.get('token') || undefined
                return <LocationCollection orderID={orderID} token={token} />
            }

            case 'documentation':
                return <Documentation />

            case 'api-keys':
                return (
                    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                        <ApiKeyDashboard userId={userId} />
                    </div>
                )

            case 'data-history':
                return (
                    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                        <DataHistory
                            onSelectDataset={(dataset, addresses) => {
                                const convertedResults = addresses.map(addr => ({
                                    recordId: addr.id,
                                    locationLinkToken: addr.locationLinkToken || undefined,
                                    locationLinkStatus: addr.locationLinkStatus || undefined,
                                    locationLinkExpiresAt: addr.locationLinkExpiresAt?.toDate?.()?.toISOString(),
                                    lastLocationUpdate: addr.lastLocationUpdate?.toDate?.()?.toISOString(),
                                    rowIndex: addr.rowIndex,
                                    original: {
                                        address: addr.originalAddress,
                                        city: addr.originalCity || '',
                                        state: addr.originalState || '',
                                        phone: addr.originalPhone || ''
                                    },
                                    cleaned: {
                                        address: addr.cleanedAddress,
                                        city: addr.cleanedCity,
                                        state: addr.cleanedState,
                                        phone: addr.cleanedPhone || '',
                                        email: addr.cleanedEmail || ''
                                    },
                                    geocoding: {
                                        latitude: addr.coordinates?.lat || null,
                                        longitude: addr.coordinates?.lng || null,
                                        formattedAddress: addr.formattedAddress || '',
                                        confidence: addr.geocodingConfidence === 'high' ? 0.9 :
                                            addr.geocodingConfidence === 'medium' ? 0.7 : 0.4,
                                        confidenceDescription: `Confidence: ${addr.geocodingConfidence}`,
                                        locationType: addr.locationType || 'N/A',
                                        staticMapUrl: null
                                    },
                                    status: addr.geocodingConfidence === 'high' ? 'high_confidence' :
                                        addr.geocodingConfidence === 'medium' ? 'medium_confidence' : 'low_confidence'
                                }))

                                const statistics = {
                                    highConfidence: dataset.highConfidenceAddresses,
                                    mediumConfidence: dataset.mediumConfidenceAddresses,
                                    lowConfidence: dataset.lowConfidenceAddresses,
                                    totalRows: dataset.processedRows
                                }

                                setProcessingResult({
                                    success: true,
                                    totalProcessed: dataset.processedRows,
                                    statistics,
                                    results: convertedResults
                                })
                                setCurrentView('dashboard')
                            }}
                            onBack={() => setCurrentView('pipeline')}
                        />
                    </div>
                )

            case 'dashboard':
                if (!processingResult) {
                    return (
                        <div className="flex h-full items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
                            <div className="max-w-md rounded-3xl bg-white/80 p-8 text-center shadow-xl backdrop-blur">
                                <p className="text-lg font-semibold text-gray-700">
                                    Genera un procesamiento para ver el dashboard.
                                </p>
                                <button
                                    onClick={() => setCurrentView(currentUser ? 'pipeline' : 'landing')}
                                    className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition-transform duration-200 hover:scale-105"
                                >
                                    Ir al pipeline
                                </button>
                            </div>
                        </div>
                    )
                }

                return (
                    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                        <DataDashboard
                            data={processingResult.results}
                            statistics={processingResult.statistics}
                            debug={processingResult.debug}
                            onBack={() => setCurrentView('pipeline')}
                        />
                    </div>
                )

            case 'pipeline':
            default:
                return (
                    <>
                        <section className="px-4 py-12 sm:px-6 lg:px-8">
                            <div className="mx-auto max-w-4xl text-center">
                                <h2 className="text-4xl font-black text-gray-900 md:text-5xl">
                                    Transforma Direcciones En
                                    <span className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent"> Coordenadas Precisas</span>
                                </h2>
                                <p className="mt-6 text-lg text-gray-700 md:text-xl">
                                    Potenciado por OpenAI y Google Maps para geocodificación precisa y normalización inteligente de direcciones.
                                </p>
                            </div>
                        </section>

                        <section className="px-4 pb-16 sm:px-6 lg:px-8">
                            <div className="mx-auto max-w-6xl rounded-3xl border border-orange-100 bg-white/70 p-8 shadow-2xl backdrop-blur-sm">
                                <div className="mb-8 flex items-center">
                                    <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg">
                                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900">Pipeline de Procesamiento de Direcciones</h3>
                                        <p className="text-gray-600">Extraer desde CSV → Limpiar con IA → Geocodificar con Precisión</p>
                                    </div>
                                </div>

                                <UnifiedProcessor
                                    onProcessingComplete={(result) => {
                                        setProcessingResult(result)
                                        setCurrentView('dashboard')
                                    }}
                                />
                            </div>
                        </section>

                        <footer className="border-t border-orange-100 bg-white/60">
                            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-8 sm:px-6 lg:px-8">
                                <div className="flex items-center space-x-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-bold text-white">
                                        GN
                                    </div>
                                    <span className="text-sm text-gray-600">Powered by OpenAI & Google Maps</span>
                                </div>
                                <p className="text-sm text-gray-500">
                                    Construido para el futuro de la inteligencia de direcciones
                                </p>
                            </div>
                        </footer>
                    </>
                )
        }
    }

    const backgroundClass = viewBackgrounds[resolvedView] ?? 'bg-gray-50'
    const mainClass = mainClassMap[resolvedView] ?? 'flex-1'

    return (
        <div className={`min-h-screen w-full ${backgroundClass}`}>
            <div className="flex min-h-screen flex-col">
                <AppHeader activeView={resolvedView} onNavigate={handleNavigate} onGetStarted={handleGetStarted} />
                <main className={mainClass}>
                    {renderContent()}
                </main>
            </div>
        </div>
    )
}

export default App
