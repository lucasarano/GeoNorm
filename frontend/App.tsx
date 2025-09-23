import React, { useEffect, useState } from 'react'
import LandingPage from './components/LandingPage'
import RegistrationPage from './components/auth/RegistrationPage'
import UnifiedProcessor from './components/UnifiedProcessor'
import DataDashboard from './components/DataDashboard'
import DataHistory from './components/DataHistory'
import LocationCollection from './components/LocationCollection'
import SMSTest from './components/SMSTest'
import EmailTest from './components/EmailTest'
import type { ProcessingResult } from './types/processing'
import { useAuth } from './contexts/AuthContext'

type AppState = 'landing' | 'registration' | 'pipeline' | 'dashboard' | 'data-history' | 'location-collection' | 'sms-test' | 'email-test'

function App() {
  const [currentView, setCurrentView] = useState<AppState>(() => {
    // Check if this is a location collection URL
    const path = window.location.pathname
    const params = new URLSearchParams(window.location.search)

    if (path === '/location' || params.has('orderID') || params.has('token')) {
      return 'location-collection'
    }

    return 'landing'
  })
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null)
  const [isLiveProcessing, setIsLiveProcessing] = useState(false)
  const { currentUser, loading, logout } = useAuth()

  useEffect(() => {
    if (loading) {
      return
    }

    // Only redirect to pipeline if user is actually authenticated
    if (currentUser && currentUser.uid) {
      if (currentView === 'landing') {
        setCurrentView('pipeline')
      }
    } else if (['pipeline', 'dashboard', 'data-history'].includes(currentView)) {
      // User is not authenticated, redirect to landing
      setCurrentView('landing')
    }
  }, [currentUser, currentView, loading])

  if (currentView === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setCurrentView('registration')}
        onSMSTest={() => setCurrentView('sms-test')}
        onEmailTest={() => setCurrentView('email-test')}
      />
    )
  }

  if (currentView === 'registration') {
    return (
      <RegistrationPage
        onRegistrationComplete={() => setCurrentView('pipeline')}
        onBackToHome={() => setCurrentView('landing')}
      />
    )
  }

  if (currentView === 'location-collection') {
    const params = new URLSearchParams(window.location.search)
    const orderID = params.get('orderID') || undefined
    const token = params.get('token') || undefined
    return <LocationCollection orderID={orderID} token={token} />
  }

  if (currentView === 'sms-test') {
    return <SMSTest onBack={() => setCurrentView('landing')} />
  }

  if (currentView === 'email-test') {
    return <EmailTest onBack={() => setCurrentView('landing')} />
  }

  if (currentView === 'data-history') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-orange-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">GeoNorm</h1>
                  <p className="text-sm text-gray-600">Historial de Datos</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('pipeline')}
                  className="text-gray-600 hover:text-orange-600 transition-colors duration-200 text-sm font-medium"
                >
                  ← Volver al Pipeline
                </button>
                <button
                  onClick={logout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DataHistory
            onSelectDataset={(dataset, addresses) => {
              // Convert Firebase data to the format expected by DataDashboard
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
                failed: 0,
                totalRows: dataset.processedRows
              }

              setProcessingResult({
                success: true,
                isComplete: true,
                totalProcessed: dataset.processedRows,
                totalExpected: dataset.totalRows,
                skipped: Math.max(0, dataset.totalRows - dataset.processedRows),
                statistics,
                results: convertedResults,
                csvId: dataset.id,
                progressPercent: 100,
                statusMessage: 'Dataset histórico cargado'
              })
              setIsLiveProcessing(false)
              setCurrentView('dashboard')
            }}
            onBack={() => setCurrentView('pipeline')}
          />
        </main>
      </div>
    )
  }


  if (currentView === 'dashboard' && processingResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-orange-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">GeoNorm</h1>
                  <p className="text-sm text-gray-600">Dashboard de Resultados</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('pipeline')}
                  className="text-gray-600 hover:text-orange-600 transition-colors duration-200 text-sm font-medium"
                >
                  ← Volver al Pipeline
                </button>
                <button
                  onClick={logout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DataDashboard
            data={processingResult.results}
            statistics={processingResult.statistics}
            totalExpected={processingResult.totalExpected}
            skipped={processingResult.skipped}
            isProcessing={isLiveProcessing}
            progressPercent={processingResult.progressPercent}
            statusMessage={processingResult.statusMessage}
            batchLatenciesMs={processingResult.batchLatenciesMs}
            batchDurationsMs={processingResult.batchDurationsMs}
            totalRuntimeMs={processingResult.totalRuntimeMs}
            onBack={() => setCurrentView('pipeline')}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-orange-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">GeoNorm</h1>
                <p className="text-sm text-gray-600">Inteligencia de Direcciones con IA</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentView('data-history')}
                className="text-gray-600 hover:text-orange-600 transition-colors duration-200 text-sm font-medium"
              >
                📊 Ver Datos Anteriores
              </button>
              <button
                onClick={() => setCurrentView('landing')}
                className="text-gray-600 hover:text-orange-600 transition-colors duration-200 text-sm font-medium"
              >
                ← Volver al Inicio
              </button>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6">
            Transforma Direcciones En
            <span className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent"> Coordenadas Precisas</span>
          </h2>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
            Potenciado por OpenAI y Google Maps para geocodificación precisa y normalización inteligente de direcciones
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-2xl border border-orange-100">
          <div className="p-8">
            <div>
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Pipeline de Procesamiento de Direcciones</h3>
                  <p className="text-gray-600">Extraer desde CSV → Limpiar con IA → Geocodificar con Precisión</p>
                </div>
              </div>
              <UnifiedProcessor
                onProcessingStart={(state) => {
                  setProcessingResult(state)
                  setIsLiveProcessing(true)
                }}
                onProcessingProgress={(state) => {
                  setProcessingResult(state)
                }}
                onProcessingComplete={(state) => {
                  setProcessingResult(state)
                  setIsLiveProcessing(false)
                  setCurrentView('dashboard')
                }}
                onProcessingError={() => {
                  setIsLiveProcessing(false)
                }}
              />
            </div>
          </div>
        </div>

        {processingResult && (
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-xl border border-orange-100">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Dashboard en vivo</h3>
                  <p className="text-sm text-gray-600">Observa cómo cada fila se agrega al tablero en tiempo real</p>
                </div>
                <button
                  onClick={() => {
                    if (!isLiveProcessing) {
                      setCurrentView('dashboard')
                    }
                  }}
                  disabled={isLiveProcessing}
                  className={`text-sm font-medium ${isLiveProcessing ? 'text-gray-400 cursor-not-allowed' : 'text-orange-600 hover:text-orange-700'}`}
                >
                  {isLiveProcessing ? 'Procesando…' : 'Abrir en pantalla completa →'}
                </button>
              </div>
              <DataDashboard
                data={processingResult.results}
                statistics={processingResult.statistics}
                totalExpected={processingResult.totalExpected}
                skipped={processingResult.skipped}
                isProcessing={isLiveProcessing}
                progressPercent={processingResult.progressPercent}
                statusMessage={processingResult.statusMessage}
                batchLatenciesMs={processingResult.batchLatenciesMs}
                batchDurationsMs={processingResult.batchDurationsMs}
                totalRuntimeMs={processingResult.totalRuntimeMs}
                onBack={() => setCurrentView('pipeline')}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/60 backdrop-blur-sm border-t border-orange-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                <span className="text-xs font-bold text-white">GN</span>
              </div>
              <span className="text-gray-600">Powered by OpenAI & Google Maps</span>
            </div>
            <div className="text-sm text-gray-500">
              Construido para el futuro de la inteligencia de direcciones
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
