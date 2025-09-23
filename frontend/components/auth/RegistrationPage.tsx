import React, { useState } from 'react'
import { Button } from '../shared/ui/button'
import { Input } from '../shared/ui/input'
import { Label } from '../shared/ui/label'
import { Card } from '../shared/ui/card'
import { useAuth } from '../../contexts/AuthContext'

interface RegistrationPageProps {
  onRegistrationComplete: () => void
  onBackToHome: () => void
}

export default function RegistrationPage({ onRegistrationComplete, onBackToHome }: RegistrationPageProps) {
  const { signup, login, loginWithGoogle, logout, currentUser } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isSignIn, setIsSignIn] = useState(false)
  const [isLogoutProcessing, setIsLogoutProcessing] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})

  const handleLogout = async () => {
    setIsLogoutProcessing(true)
    try {
      await logout()
      setIsSignIn(false)
      setFormData({ email: '', password: '', confirmPassword: '', name: '' })
      onBackToHome()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLogoutProcessing(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    if (!formData.email) {
      newErrors.email = 'El correo electrónico es requerido'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Ingresa un correo electrónico válido'
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida'
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres'
    }

    if (!isSignIn) {
      if (!formData.name) {
        newErrors.name = 'El nombre es requerido'
      }
      
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Confirma tu contraseña'
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Las contraseñas no coinciden'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    try {
      await signup(formData.email, formData.password, formData.name)
      onRegistrationComplete()
    } catch (error: any) {
      console.error('Registration error:', error)
      let errorMessage = 'Error al crear la cuenta. Inténtalo de nuevo.'
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este correo electrónico ya está registrado.'
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña es demasiado débil.'
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El correo electrónico no es válido.'
      }
      
      setErrors({ general: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    try {
      await login(formData.email, formData.password)
      onRegistrationComplete()
    } catch (error: any) {
      console.error('Sign in error:', error)
      let errorMessage = 'Error al iniciar sesión. Verifica tus credenciales.'
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No se encontró una cuenta con este correo electrónico.'
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'La contraseña es incorrecta.'
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El correo electrónico no es válido.'
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos fallidos. Intenta más tarde.'
      }
      
      setErrors({ general: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await loginWithGoogle()
      onRegistrationComplete()
    } catch (error: any) {
      console.error('Google sign in error:', error)
      let errorMessage = 'Error al iniciar sesión con Google. Inténtalo de nuevo.'
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Ventana de Google cerrada. Intenta de nuevo.'
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup bloqueado. Permite popups para este sitio.'
      }
      
      setErrors({ general: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-gradient-to-br from-orange-200/30 to-amber-300/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-40 w-96 h-96 bg-gradient-to-tr from-orange-300/20 to-yellow-200/30 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-20 bg-white/95 backdrop-blur-xl border-b border-orange-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            {/* Logo & Brand - Left Side */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4 group cursor-pointer" onClick={onBackToHome}>
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

              {currentUser && (
                <Button
                  onClick={handleLogout}
                  disabled={isLogoutProcessing}
                  className="bg-white/90 border border-orange-200 text-orange-600 hover:text-orange-700 hover:bg-orange-50 transition-colors duration-200 text-sm font-semibold shadow-sm px-4 py-2 rounded-lg"
                >
                  {isLogoutProcessing ? 'Cerrando sesión...' : 'Cerrar sesión'}
                </Button>
              )}
            </div>

            {/* Back Button */}
            <Button
              onClick={onBackToHome}
              className="text-gray-600 hover:text-orange-600 transition-colors duration-200 text-sm font-medium bg-transparent border-0 shadow-none hover:bg-orange-50 px-4 py-2 rounded-lg"
            >
              ← Volver al Inicio
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="bg-white/90 backdrop-blur-sm border border-orange-100 shadow-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {isSignIn ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </h2>
              <p className="text-gray-600">
                {isSignIn 
                  ? 'Accede a tu cuenta para continuar' 
                  : 'Comienza a procesar direcciones con IA'
                }
              </p>
            </div>

            {errors.general && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Google Sign In Button */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full mb-6 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isLoading ? 'Procesando...' : `${isSignIn ? 'Iniciar sesión' : 'Registrarse'} con Google`}
              </div>
            </Button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">o continúa con email</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={isSignIn ? handleEmailSignIn : handleEmailSignUp} className="space-y-4">
              {!isSignIn && (
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Nombre completo
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    placeholder="Tu nombre completo"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>
              )}

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="tu@ejemplo.com"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              {!isSignIn && (
                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirmar contraseña
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    placeholder="Confirma tu contraseña"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:via-amber-600 hover:to-yellow-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-0 mt-6"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </span>
                ) : (
                  isSignIn ? 'Iniciar Sesión' : 'Crear Cuenta'
                )}
              </Button>
            </form>

            {/* Toggle Sign In/Sign Up */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                {isSignIn ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignIn(!isSignIn)
                    setErrors({})
                    setFormData({ email: '', password: '', confirmPassword: '', name: '' })
                  }}
                  className="ml-2 text-orange-600 hover:text-orange-700 font-semibold transition-colors duration-200"
                >
                  {isSignIn ? 'Crear cuenta' : 'Iniciar sesión'}
                </button>
              </p>
            </div>

            {/* Terms */}
            {!isSignIn && (
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                  Al crear una cuenta, aceptas nuestros{' '}
                  <a href="#" className="text-orange-600 hover:text-orange-700 underline">
                    Términos de Servicio
                  </a>{' '}
                  y{' '}
                  <a href="#" className="text-orange-600 hover:text-orange-700 underline">
                    Política de Privacidad
                  </a>
                </p>
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}
