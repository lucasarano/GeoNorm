import { useState } from 'react'
import SimpleAddressForm from './components/SimpleAddressForm'
import CsvUploader from './components/CsvUploader'

function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'csv'>('single')

  console.log('🚀 App render - activeTab:', activeTab)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
            <span className="text-3xl">🗺️</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent mb-4">
            GeoNorm
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Transform addresses into precise coordinates using Google's powerful APIs
          </p>
        </div>

        {/* SUPER SIMPLE TABS - NO CSS CLASSES */}
        <div style={{ 
          maxWidth: '800px', 
          margin: '0 auto 32px auto',
          backgroundColor: '#1a1a1a',
          padding: '24px',
          borderRadius: '12px',
          border: '2px solid #333'
        }}>
          <h2 style={{ color: 'white', textAlign: 'center', marginBottom: '20px', fontSize: '24px' }}>
            Choose Processing Mode
          </h2>
          
          {/* Tab Buttons */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => {
                console.log('🔥 SINGLE BUTTON CLICKED!')
                setActiveTab('single')
              }}
              style={{
                flex: 1,
                padding: '20px',
                fontSize: '18px',
                fontWeight: 'bold',
                border: '3px solid #666',
                borderRadius: '8px',
                backgroundColor: activeTab === 'single' ? '#0066cc' : '#333',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                console.log('🔥 Mouse over SINGLE button')
                if (activeTab !== 'single') {
                  e.currentTarget.style.backgroundColor = '#555'
                }
              }}
              onMouseOut={(e) => {
                console.log('🔥 Mouse out SINGLE button')
                if (activeTab !== 'single') {
                  e.currentTarget.style.backgroundColor = '#333'
                }
              }}
            >
              🔍 Single Address
            </button>

            <button
              onClick={() => {
                console.log('🔥 CSV BUTTON CLICKED!')
                setActiveTab('csv')
              }}
              style={{
                flex: 1,
                padding: '20px',
                fontSize: '18px',
                fontWeight: 'bold',
                border: '3px solid #666',
                borderRadius: '8px',
                backgroundColor: activeTab === 'csv' ? '#cc0066' : '#333',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                console.log('🔥 Mouse over CSV button')
                if (activeTab !== 'csv') {
                  e.currentTarget.style.backgroundColor = '#555'
                }
              }}
              onMouseOut={(e) => {
                console.log('🔥 Mouse out CSV button')
                if (activeTab !== 'csv') {
                  e.currentTarget.style.backgroundColor = '#333'
                }
              }}
            >
              📊 CSV Batch Processing
            </button>
          </div>

          {/* Debug Info */}
          <div style={{ 
            marginTop: '20px', 
            padding: '16px', 
            backgroundColor: '#ffff00', 
            color: '#000', 
            borderRadius: '8px',
            textAlign: 'center',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            🐛 DEBUG: Current Mode = "{activeTab.toUpperCase()}"
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto">
          {activeTab === 'single' ? (
            <div>
              <div style={{ color: 'white', textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '28px', fontWeight: 'bold' }}>🔍 Single Address Mode Active</h3>
              </div>
              <SimpleAddressForm />
            </div>
          ) : (
            <div>
              <div style={{ color: 'white', textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '28px', fontWeight: 'bold' }}>📊 CSV Batch Processing Mode Active</h3>
              </div>
              <CsvUploader onUploadComplete={(result) => {
                console.log('CSV processing completed:', result)
              }} />
            </div>
          )}
        </div>

        {/* Simple Test Buttons */}
        <div style={{ 
          marginTop: '40px', 
          textAlign: 'center',
          backgroundColor: '#222',
          padding: '20px',
          borderRadius: '12px',
          maxWidth: '600px',
          margin: '40px auto 0'
        }}>
          <h4 style={{ color: 'white', marginBottom: '16px' }}>🧪 Test Buttons (Click these to verify clicking works)</h4>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => alert('Test button 1 works!')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#00aa00',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Test Button 1
            </button>
            <button
              onClick={() => alert('Test button 2 works!')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#aa0000',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Test Button 2
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App