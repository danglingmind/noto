'use client'

import Image from 'next/image'
import { MessageSquare, Video, PenTool, Users, RefreshCw, CheckCircle2 } from 'lucide-react'

interface Feature {
	title: string
	description: string
	image?: string
	icon?: React.ReactNode
}

interface FeatureCardsGridProps {
	features: Feature[]
	theme: {
		colors: {
			text: {
				primary: string
				secondary: string
			}
		}
		fonts: {
			heading: string
		}
	}
}

const iconMap: Record<string, React.ReactNode> = {
	'Visual Annotation': <PenTool className="w-6 h-6" />,
	'Built-In Revisions': <RefreshCw className="w-6 h-6" />,
	'Real-Time Collaboration': <Users className="w-6 h-6" />,
	'Feedback That Works': <MessageSquare className="w-6 h-6" />,
	'Comments in context': <MessageSquare className="w-6 h-6" />,
	'Record richer feedback': <Video className="w-6 h-6" />
}

export function FeatureCardsGrid({ features, theme }: FeatureCardsGridProps) {
	// Group features into pairs for 2-column layout
	const featurePairs: Feature[][] = []
	for (let i = 0; i < features.length; i += 2) {
		featurePairs.push(features.slice(i, i + 2))
	}

	return (
		<div className="w-full py-20 md:py-32 px-4" style={{ background: '#ffffff' }}>
			<div className="container mx-auto max-w-7xl px-6">
				{/* Section Title */}
				<div className="text-center mb-16 md:mb-20">
					<h2 
						className="text-4xl md:text-5xl lg:text-6xl font-semibold mb-4"
						style={{ 
							color: '#1a1a1a',
							fontFamily: theme.fonts.heading,
							fontWeight: 600,
							lineHeight: '1.2'
						}}
					>
						Collaboration tools{' '}
						<span 
							className="bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent"
							style={{
								backgroundImage: 'linear-gradient(90deg, #3b82f6 0%, #a855f7 33%, #ec4899 66%, #f97316 100%)'
							}}
						>
							for faster teamwork
						</span>
					</h2>
				</div>

				{/* Feature Cards Grid */}
				<div className="space-y-12 md:space-y-16">
					{featurePairs.map((pair, pairIndex) => (
						<div 
							key={pairIndex}
							className="grid md:grid-cols-2 gap-6 md:gap-8"
						>
							{pair.map((feature, featureIndex) => {
								const icon = feature.icon || iconMap[feature.title] || <CheckCircle2 className="w-6 h-6" />
								const isLeftCard = featureIndex === 0
								
								return (
									<div
										key={`${pairIndex}-${featureIndex}`}
										className="rounded-xl p-6 md:p-8"
										style={{
											backgroundColor: '#ffffff',
											border: '1px solid rgba(0, 0, 0, 0.08)',
											boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
										}}
									>
										{/* Icon */}
										<div 
											className="mb-5 inline-flex items-center justify-center w-11 h-11 rounded-lg"
											style={{
												backgroundColor: isLeftCard 
													? 'rgba(249, 115, 22, 0.1)' 
													: 'rgba(59, 130, 246, 0.1)',
												color: isLeftCard ? '#f97316' : '#3b82f6'
											}}
										>
											{icon}
										</div>

										{/* Title */}
										<h3 
											className="text-xl md:text-2xl font-semibold mb-3"
											style={{ 
												color: '#1a1a1a',
												fontFamily: theme.fonts.heading,
												fontWeight: 600
											}}
										>
											{feature.title}
										</h3>

										{/* Description */}
										<p 
											className="text-sm md:text-base mb-6 leading-relaxed"
											style={{ 
												color: '#6b7280',
												fontSize: '16px',
												lineHeight: '1.6'
											}}
										>
											{feature.description}
										</p>

										{/* Image/Visual Example */}
										{feature.image && (
											<div 
												className="relative w-full mt-4"
												style={{ 
													aspectRatio: '16/9',
													minHeight: '180px'
												}}
											>
												<Image
													src={feature.image}
													alt={feature.title}
													fill
													className="object-contain"
												/>
											</div>
										)}
									</div>
								)
							})}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

