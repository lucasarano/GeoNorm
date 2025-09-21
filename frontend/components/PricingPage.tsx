import React, { useState } from 'react'
import { Check, Star, Zap, Shield, Mail, ArrowRight, MapPin, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface PricingPageProps {
    onSelectPlan: (plan: 'free' | 'pro' | 'enterprise') => void
    onGetStarted: () => void
}

export default function PricingPage({ onSelectPlan, onGetStarted }: PricingPageProps) {
    const { currentUser, userUsage } = useAuth()
    const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro' | 'enterprise'>('free')

    const plans = [
        {
            id: 'free' as const,
            name: 'Free Trial',
            price: '$0',
            period: 'forever',
            description: 'Test our pipeline with 5 free runs',
            features: [
                '5 free pipeline runs',
                'CSV upload & processing',
                'AI address cleaning',
                'Google Maps geocoding',
                'CSV export',
                'Basic support'
            ],
            limitations: [
                '5 uses total',
                'No API access'
            ],
            icon: MapPin,
            gradient: 'from-blue-500 to-cyan-500',
            popular: false,
            cta: 'Start Free Trial'
        },
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
            limitations: [],
            icon: Zap,
            gradient: 'from-orange-500 to-pink-500',
            popular: true,
            cta: 'Upgrade to Pro'
        },
        {
            id: 'enterprise' as const,
            name: 'Enterprise',
            price: 'Custom',
            period: 'pricing',
            description: 'Custom integration & automation services',
            features: [
                'Everything in Pro',
                'Custom API integration',
                'White-label solution',
                'Dedicated support',
                'Custom deployment',
                'SLA agreements'
            ],
            limitations: [],
            icon: Shield,
            gradient: 'from-purple-500 to-indigo-500',
            popular: false,
            cta: 'Contact Sales'
        }
    ]

    const handlePlanSelect = (planId: 'free' | 'pro' | 'enterprise') => {
        setSelectedPlan(planId)
        if (planId === 'enterprise') {
            // Show contact form or redirect to contact
            window.location.href = 'mailto:sales@geonorm.com?subject=Enterprise%20Plan%20Inquiry'
        } else {
            onSelectPlan(planId)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
            {/* Header */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10" />
                <div className="relative max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                            Choose Your
                            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent"> Plan</span>
                        </h1>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                            Transform your address data with our AI-powered geocoding pipeline.
                            From free trials to enterprise solutions, we have the perfect plan for your needs.
                        </p>

                        {currentUser && userUsage && (
                            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 max-w-md mx-auto mb-8 border border-orange-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Current Plan: {userUsage.plan.charAt(0).toUpperCase() + userUsage.plan.slice(1)}</h3>
                                        {userUsage.plan === 'free' && (
                                            <p className="text-sm text-gray-600">
                                                {userUsage.freeTriesLimit - userUsage.freeTriesUsed} of {userUsage.freeTriesLimit} free tries remaining
                                            </p>
                                        )}
                                    </div>
                                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                                        <Check className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                <div className="grid md:grid-cols-3 gap-8">
                    {plans.map((plan) => {
                        const Icon = plan.icon
                        const isCurrentPlan = currentUser && userUsage && userUsage.plan === plan.id

                        return (
                            <div
                                key={plan.id}
                                className={`relative bg-white rounded-3xl shadow-xl border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${plan.popular
                                    ? 'border-orange-200 ring-2 ring-orange-500/20 scale-105'
                                    : 'border-gray-100'
                                    } ${isCurrentPlan ? 'ring-2 ring-green-500/50' : ''
                                    }`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                                            <Star className="w-4 h-4 mr-1" />
                                            Most Popular
                                        </div>
                                    </div>
                                )}

                                {isCurrentPlan && (
                                    <div className="absolute -top-4 right-4">
                                        <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                                            Current Plan
                                        </div>
                                    </div>
                                )}

                                <div className="p-8">
                                    {/* Plan Header */}
                                    <div className="text-center mb-8">
                                        <div className={`w-16 h-16 bg-gradient-to-r ${plan.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                                            <Icon className="w-8 h-8 text-white" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                                        <div className="mb-4">
                                            <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                                            {plan.price !== 'Custom' && <span className="text-gray-600 ml-2">/{plan.period}</span>}
                                        </div>
                                        <p className="text-gray-600">{plan.description}</p>
                                    </div>

                                    {/* Features */}
                                    <div className="space-y-4 mb-8">
                                        {plan.features.map((feature, index) => (
                                            <div key={index} className="flex items-start">
                                                <div className={`w-5 h-5 bg-gradient-to-r ${plan.gradient} rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0`}>
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                                <span className="text-gray-700">{feature}</span>
                                            </div>
                                        ))}

                                        {plan.limitations.length > 0 && (
                                            <>
                                                <div className="border-t pt-4 mt-6">
                                                    <p className="text-sm font-semibold text-gray-500 mb-3">Limitations:</p>
                                                    {plan.limitations.map((limitation, index) => (
                                                        <div key={index} className="flex items-start mb-2">
                                                            <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                                                                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                                            </div>
                                                            <span className="text-sm text-gray-500">{limitation}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* CTA Button */}
                                    <button
                                        onClick={() => handlePlanSelect(plan.id)}
                                        disabled={isCurrentPlan}
                                        className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-300 flex items-center justify-center ${isCurrentPlan
                                            ? 'bg-green-100 text-green-700 cursor-not-allowed'
                                            : plan.popular
                                                ? `bg-gradient-to-r ${plan.gradient} text-white hover:shadow-lg hover:shadow-orange-500/25 transform hover:scale-105`
                                                : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg transform hover:scale-105'
                                            }`}
                                    >
                                        {isCurrentPlan ? (
                                            <>
                                                <Check className="w-5 h-5 mr-2" />
                                                Current Plan
                                            </>
                                        ) : (
                                            <>
                                                {plan.cta}
                                                <ArrowRight className="w-5 h-5 ml-2" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* FAQ Section */}
            <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
                    <p className="text-gray-600">Everything you need to know about our pricing plans</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-white rounded-2xl p-6 shadow-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">What happens after my free trial?</h3>
                        <p className="text-gray-600">Upgrade to Pro for unlimited access. Your data remains accessible.</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">Can I change plans anytime?</h3>
                        <p className="text-gray-600">Yes! Upgrade or downgrade anytime. Changes take effect immediately.</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">What's included in Enterprise?</h3>
                        <p className="text-gray-600">Custom API integration, white-labeling, dedicated support, and custom deployment options.</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">Do you offer refunds?</h3>
                        <p className="text-gray-600">30-day money-back guarantee for Pro plans.</p>
                    </div>
                </div>
            </div>

            {/* Contact Section */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8 text-center">
                    <Users className="w-12 h-12 mx-auto mb-6 text-orange-400" />
                    <h2 className="text-3xl font-bold mb-4">Need a Custom Solution?</h2>
                    <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                        Enterprise plan with custom API integration, automation services, and dedicated support.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="mailto:sales@geonorm.com"
                            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-semibold transition-colors flex items-center justify-center"
                        >
                            <Mail className="w-5 h-5 mr-2" />
                            Contact Sales
                        </a>
                        <button
                            onClick={onGetStarted}
                            className="border border-gray-600 hover:border-gray-500 text-white px-8 py-3 rounded-2xl font-semibold transition-colors"
                        >
                            Start Free Trial
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
