import { useState } from 'react'
import SimpleAddressForm from './components/forms/SimpleAddressForm'
import CsvUploader from './components/forms/CsvUploader'
import FieldExtractor from './components/FieldExtractor'

function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'csv' | 'extract'>('single')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-base font-semibold text-white">GN</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">GeoNorm</h1>
                <p className="text-sm md:text-base text-gray-600">AI-Powered Address Intelligence</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-6 text-sm text-gray-600">
              <span className="flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>API Connected</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Transform Addresses Into
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"> Precise Coordinates</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Powered by Google Maps API and Gemini AI for accurate geocoding and intelligent address normalization
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Processing Mode</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('single')}
                className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${activeTab === 'single'
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
              >
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-3">🔍</span>
                  <h4 className="font-semibold text-gray-900">Single Address</h4>
                </div>
                <p className="text-gray-600 text-sm">
                  Process individual addresses with detailed geocoding results
                </p>
              </button>

              <button
                onClick={() => setActiveTab('csv')}
                className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${activeTab === 'csv'
                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
              >
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-3">📊</span>
                  <h4 className="font-semibold text-gray-900">Pipeline Testing</h4>
                </div>
                <p className="text-gray-600 text-sm">
                  Upload CSV files for bulk address processing with AI normalization
                </p>
              </button>

              <button
                onClick={() => setActiveTab('extract')}
                className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${activeTab === 'extract'
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
              >
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-3">🔧</span>
                  <h4 className="font-semibold text-gray-900">Field Extractor</h4>
                </div>
                <p className="text-gray-600 text-sm">
                  Simple extraction of Address, City, State, and Phone fields
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="p-8">
            {activeTab === 'single' ? (
              <div>
                <div className="flex items-center mb-6">
                  <span className="text-3xl mr-3">🔍</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Single Address Geocoding</h3>
                    <p className="text-gray-600">Enter an address to get precise coordinates and location data</p>
                  </div>
                </div>
                <SimpleAddressForm />
              </div>
            ) : activeTab === 'csv' ? (
              <div>
                <div className="flex items-center mb-6">
                  <span className="text-3xl mr-3">📊</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Pipeline Testing</h3>
                    <p className="text-gray-600">Upload CSV files to process multiple addresses with AI-powered normalization</p>
                  </div>
                </div>
                <CsvUploader onUploadComplete={(result) => {
                  console.log('CSV processing completed:', result)
                }} />
              </div>
            ) : (
              <div>
                <div className="flex items-center mb-6">
                  <span className="text-3xl mr-3">🔧</span>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Field Extractor</h3>
                    <p className="text-gray-600">Extract Address, City, State, and Phone fields from CSV files</p>
                  </div>
                </div>
                <FieldExtractor onExtractComplete={(data) => {
                  console.log('Field extraction completed:', data)
                }} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-xs font-semibold text-white">GN</span>
              </div>
              <span className="text-gray-600">Powered by Google Maps API & Gemini AI</span>
            </div>
            <div className="text-sm text-gray-500">
              Built for precise address intelligence
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App