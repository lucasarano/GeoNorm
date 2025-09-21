import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { UsageService } from '../services/usageService'
import { X, Check, Zap, Shield, Star, Crown, Mail } from 'lucide-react'

interface UpgradeModalProps {
    isOpen: boolean
    onClose: () => void
    onUpgradeComplete?: () => void
}

export default function UpgradeModal({ isOpen, onClose, onUpgradeComplete }: UpgradeModalProps) {
    const { currentUser, refreshUserUsage } = useAuth()
    const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>('pro')
    const [isUpgrading, setIsUpgrading] = useState(false)

    if (!isOpen) return null

    const handleUpgrade = async () => {
        if (!currentUser) return

        if (selectedPlan === 'enterprise') {
            // For enterprise, open email client
            window.location.href = 'mailto:sales@geonorm.com?subject=Enterprise%20Plan%20Inquiry&body=Hi%2C%0A%0AI%27m%20interested%20in%20the%20Enterprise%20plan%20for%20GeoNorm.%20Please%20contact%20me%20to%20discuss%20custom%20pricing%20and%20integration%20options.%0A%0AThank%20you%21'
            onClose()
            return
        }

        setIsUpgrading(true)
        try {
            const result = await UsageService.upgradeUser(currentUser.uid, selectedPlan)
            if (result.success) {
                await refreshUserUsage()
                onUpgradeComplete?.()
                onClose()
                // Show success message
                alert('Successfully upgraded to Pro plan! You now have unlimited access.')
            } else {
                alert(result.message)
            }
        } catch (error) {
            console.error('Upgrade error:', error)
            alert('Error upgrading account. Please try again.')
        } finally {
            setIsUpgrading(false)
        }
    }

    const plans = [
        {
            id: 'pro' as const,
            name: 'Pro Plan',
            price: '$49',
            period: 'per month',
            description: 'Unlimited processing for businesses',
            features: [
                'Unlimited pipeline runs',
                'Priority processing',
                'API access',
                'Batch processing',
                'Priority support',
                'Usage analytics'
            ],
            icon: Zap,
            gradient: 'from-orange-500 to-pink-500',
            popular: true
        },
        {
            id: 'enterprise' as const,
            name: 'Enterprise',
            price: 'Custom',
            period: 'pricing',
            description: 'Custom integration & automation',
            features: [
                'Everything in Pro',
                'Custom API integration',
                'White-label solution',
                'Dedicated support',
                'Custom deployment',
                'SLA agreements'
            ],
            icon: Shield,
            gradient: 'from-purple-500 to-indigo-500',
            popular: false
        }
    ]

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-3xl">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">Upgrade Your Plan</h2>
                            <p className="text-gray-600 mt-2">Unlock unlimited access to our address processing pipeline</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Plans */}
                <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                        {plans.map((plan) => {
                            const Icon = plan.icon
                            const isSelected = selectedPlan === plan.id

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative border rounded-2xl p-6 cursor-pointer transition-all duration-300 ${isSelected
                                        ? 'border-orange-500 bg-orange-50 shadow-lg ring-2 ring-orange-500/20'
                                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                                        } ${plan.popular ? 'ring-2 ring-orange-500/20' : ''
                                        }`}
                                    onClick={() => setSelectedPlan(plan.id)}
                                >
                                    {plan.popular && (
                                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                            <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                                                <Star className="w-4 h-4 mr-1" />
                                                Most Popular
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`w-12 h-12 bg-gradient-to-r ${plan.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                                            <Icon className="w-6 h-6 text-white" />
                                        </div>
                                        <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                                            }`}>
                                            {isSelected && <Check className="w-4 h-4 text-white" />}
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                                        <div className="mb-2">
                                            <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                                            {plan.price !== 'Custom' && <span className="text-gray-600 ml-2">/{plan.period}</span>}
                                        </div>
                                        <p className="text-gray-600 text-sm">{plan.description}</p>
                                    </div>

                                    <div className="space-y-3">
                                        {plan.features.slice(0, 6).map((feature, index) => (
                                            <div key={index} className="flex items-center">
                                                <div className={`w-5 h-5 bg-gradient-to-r ${plan.gradient} rounded-full flex items-center justify-center mr-3 flex-shrink-0`}>
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                                <span className="text-sm text-gray-700">{feature}</span>
                                            </div>
                                        ))}
                                        {plan.features.length > 6 && (
                                            <div className="text-sm text-gray-500 pl-8">
                                                +{plan.features.length - 6} more features
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Enterprise Contact Info */}
                    {selectedPlan === 'enterprise' && (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6 mb-6">
                            <div className="flex items-start space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                                    <Mail className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 mb-2">Enterprise Solutions</h4>
                                    <p className="text-gray-700 mb-4">
                                        Custom API integration, automation services, and dedicated support for large organizations.
                                    </p>
                                    <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                                        <div>
                                            <strong>Services:</strong>
                                            <ul className="list-disc list-inside mt-1 space-y-1">
                                                <li>Custom API development</li>
                                                <li>System integration</li>
                                                <li>Automated workflows</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <strong>Support:</strong>
                                            <ul className="list-disc list-inside mt-1 space-y-1">
                                                <li>Dedicated account manager</li>
                                                <li>24/7 priority support</li>
                                                <li>Custom deployment</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                            disabled={isUpgrading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpgrade}
                            disabled={isUpgrading}
                            className={`px-8 py-3 rounded-2xl font-semibold transition-all duration-300 flex items-center ${selectedPlan === 'pro'
                                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:shadow-lg hover:shadow-orange-500/25 transform hover:scale-105'
                                : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-purple-500/25 transform hover:scale-105'
                                } disabled:opacity-50 disabled:transform-none disabled:shadow-none`}
                        >
                            {isUpgrading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Processing...
                                </>
                            ) : selectedPlan === 'enterprise' ? (
                                <>
                                    <Mail className="w-5 h-5 mr-2" />
                                    Contact Sales
                                </>
                            ) : (
                                <>
                                    <Crown className="w-5 h-5 mr-2" />
                                    Upgrade to Pro - $49/month
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
