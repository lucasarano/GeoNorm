import React, { useState } from 'react'
import { Button } from '../shared/ui/button'
import {
    BookOpen,
    Clock,
    KeyRound,
    Menu,
    Sparkles,
    Workflow,
    X
} from 'lucide-react'
import type { AppView } from '../../types/app-view'

interface AppHeaderProps {
    activeView: AppView
    onNavigate: (view: AppView) => void
    onGetStarted: () => void
}

const navItems: Array<{
    label: string
    view: AppView
    icon: React.ComponentType<{ className?: string }>
}> = [
    { label: 'Inicio', view: 'landing', icon: Sparkles },
    { label: 'Documentación', view: 'documentation', icon: BookOpen },
    { label: 'API Keys', view: 'api-keys', icon: KeyRound },
    { label: 'Pipeline', view: 'pipeline', icon: Workflow },
    { label: 'Historial', view: 'data-history', icon: Clock }
]

export function AppHeader({ activeView, onNavigate, onGetStarted }: AppHeaderProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const desktopNavBase = 'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200'
    const desktopNavActive = 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white shadow-lg shadow-orange-200/60'
    const desktopNavInactive = 'text-gray-600 hover:bg-gray-100/80'

    const mobileNavBase = 'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all'
    const mobileNavActive = 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white shadow-lg'
    const mobileNavInactive = 'bg-white/80 text-gray-700 hover:bg-gray-100/90'

    const handleNavigate = (view: AppView) => {
        setIsMobileMenuOpen(false)
        onNavigate(view)
    }

    return (
        <header className="sticky top-0 z-50 border-b border-white/20 bg-white/80 backdrop-blur-xl">
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <button
                    onClick={() => handleNavigate('landing')}
                    className="group flex items-center space-x-3 rounded-full border border-white/40 bg-white/60 px-3 py-1.5 shadow-sm backdrop-blur hover:border-orange-200 hover:bg-white"
                >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                        <span className="block text-xs font-semibold uppercase tracking-widest text-gray-500">GeoNorm</span>
                        <span className="block bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-base font-bold text-transparent">
                            Inteligencia de Direcciones
                        </span>
                    </div>
                </button>

                <nav className="hidden items-center gap-1 md:flex">
                    {navItems.map(({ view, label, icon: Icon }) => {
                        const isActive = activeView === view
                        const navClass = `${desktopNavBase} ${isActive ? desktopNavActive : desktopNavInactive}`

                        return (
                            <button
                                key={view}
                                onClick={() => handleNavigate(view)}
                                className={navClass}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        )
                    })}
                </nav>

                <div className="hidden items-center gap-3 md:flex">
                    <Button
                        onClick={() => handleNavigate('documentation')}
                        variant="ghost"
                        className="text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                        Docs
                    </Button>
                    <Button
                        onClick={onGetStarted}
                        className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-base font-semibold shadow-lg shadow-orange-200/70 transition-all duration-200 hover:shadow-orange-300/80"
                    >
                        Comenzar
                    </Button>
                </div>

                <button
                    className="flex items-center justify-center rounded-full border border-gray-200 bg-white p-2 text-gray-700 shadow-sm transition-colors duration-200 md:hidden"
                    onClick={() => setIsMobileMenuOpen((value) => !value)}
                    aria-label="Toggle navigation"
                >
                    {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="border-t border-white/40 bg-white/90 backdrop-blur md:hidden">
                    <div className="space-y-2 px-4 py-4">
                        {navItems.map(({ view, label, icon: Icon }) => {
                            const isActive = activeView === view
                            const navClass = `${mobileNavBase} ${isActive ? mobileNavActive : mobileNavInactive}`
                            return (
                                <button
                                    key={view}
                                    onClick={() => handleNavigate(view)}
                                    className={navClass}
                                >
                                    <Icon className="h-5 w-5" />
                                    {label}
                                </button>
                            )
                        })}
                        <Button
                            onClick={() => {
                                setIsMobileMenuOpen(false)
                                onGetStarted()
                            }}
                            className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-base font-semibold"
                        >
                            Comenzar
                        </Button>
                    </div>
                </div>
            )}
        </header>
    )
}

export default AppHeader
