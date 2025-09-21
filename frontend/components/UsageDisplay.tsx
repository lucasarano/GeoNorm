import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Zap, Shield, AlertTriangle, Crown, Sparkles } from 'lucide-react'

interface UsageDisplayProps {
    className?: string
    showUpgradeButton?: boolean
    onUpgrade?: () => void
}

export default function UsageDisplay({ className = '', showUpgradeButton = true, onUpgrade }: UsageDisplayProps) {
    const { userUsage, currentUser } = useAuth()

    if (!currentUser || !userUsage) {
        return null
    }

    const isFreeTrial = userUsage.plan === 'free'
    const isPro = userUsage.plan === 'pro'
    const isEnterprise = userUsage.plan === 'enterprise'
    const remainingTries = userUsage.freeTriesLimit - userUsage.freeTriesUsed
    const isNearLimit = remainingTries <= 2 && isFreeTrial
    const isOutOfTries = remainingTries <= 0 && isFreeTrial

    const getPlanIcon = () => {
        if (isEnterprise) return Shield
        if (isPro) return Zap
        return Sparkles
    }

    const getPlanColor = () => {
        if (isEnterprise) return 'from-purple-500 to-indigo-500'
        if (isPro) return 'from-orange-500 to-pink-500'
        return 'from-blue-500 to-cyan-500'
    }

    const getPlanBadgeColor = () => {
        if (isEnterprise) return 'bg-purple-100 text-purple-800 border-purple-200'
        if (isPro) return 'bg-orange-100 text-orange-800 border-orange-200'
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }

    const Icon = getPlanIcon()

    return (
        <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 border shadow-lg ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${getPlanColor()} rounded-xl flex items-center justify-center shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                    </div>

                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {userUsage.plan.charAt(0).toUpperCase() + userUsage.plan.slice(1)} Plan
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPlanBadgeColor()}`}>
                                {isFreeTrial ? 'Free Trial' : isPro ? 'Pro' : 'Enterprise'}
                            </span>
                        </div>

                        <div className="text-sm text-gray-600">
                            {isFreeTrial ? (
                                <div className="flex items-center space-x-2">
                                    <span>{remainingTries} of {userUsage.freeTriesLimit} free tries remaining</span>
                                    {isNearLimit && (
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <span>Unlimited pipeline access</span>
                                    <Crown className="w-4 h-4 text-yellow-500" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    {isFreeTrial && (
                        <div className="flex items-center space-x-3 mb-3">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all duration-300 ${isOutOfTries ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-green-500'
                                        }`}
                                    style={{ width: `${Math.max(0, (remainingTries / userUsage.freeTriesLimit) * 100)}%` }}
                                />
                            </div>
                            <span className={`text-sm font-medium ${isOutOfTries ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-gray-600'
                                }`}>
                                {remainingTries}
                            </span>
                        </div>
                    )}

                    {isFreeTrial && showUpgradeButton && (
                        <button
                            onClick={onUpgrade}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${isOutOfTries
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg'
                                    : isNearLimit
                                        ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg'
                                        : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg hover:shadow-orange-500/25'
                                }`}
                        >
                            {isOutOfTries ? 'Upgrade Now' : 'Upgrade to Pro'}
                        </button>
                    )}

                    {(isPro || isEnterprise) && (
                        <div className="text-sm text-green-600 font-medium">
                            ✓ Unlimited Access
                        </div>
                    )}
                </div>
            </div>

            {/* Warning Messages */}
            {isFreeTrial && isOutOfTries && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="text-sm font-semibold text-red-800">Free trial exhausted</h4>
                            <p className="text-sm text-red-700 mt-1">
                                You've used all your free tries. Upgrade to Pro for unlimited access to the pipeline.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {isFreeTrial && isNearLimit && !isOutOfTries && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="text-sm font-semibold text-amber-800">Almost out of free tries</h4>
                            <p className="text-sm text-amber-700 mt-1">
                                Only {remainingTries} tries left. Consider upgrading to Pro for unlimited access.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
