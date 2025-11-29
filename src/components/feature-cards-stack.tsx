'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'

interface Feature {
	title: string
	description: string
	image?: string
}

interface FeatureCardsStackProps {
	features: Feature[]
	theme: {
		colors: {
			background: {
				card: string
			}
			text: {
				primary: string
				tertiary: string
			}
		}
		fonts: {
			heading: string
		}
	}
}

export function FeatureCardsStack({ features, theme }: FeatureCardsStackProps) {
	// Alternating colors - white and beige
	const cardColors = ['#ffffff', '#f9f7f2']
	// Light blue color for all headings
	const headlineColor = '#60a5fa'
	const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set())
	const cardRefs = useRef<(HTMLDivElement | null)[]>([])

	useEffect(() => {
		const observers: IntersectionObserver[] = []

		cardRefs.current.forEach((cardRef, index) => {
			if (!cardRef) return

			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							setVisibleCards((prev) => new Set(prev).add(index))
							observer.unobserve(entry.target)
						}
					})
				},
				{
					threshold: 0.1,
					rootMargin: '0px 0px -100px 0px'
				}
			)

			observer.observe(cardRef)
			observers.push(observer)
		})

		return () => {
			observers.forEach((observer) => observer.disconnect())
		}
	}, [features.length])

	return (
		<div className="w-full">
			<style dangerouslySetInnerHTML={{ __html: `
				@keyframes fadeInUp {
					from {
						opacity: 0;
						transform: translateY(40px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				@keyframes fadeInLeft {
					from {
						opacity: 0;
						transform: translateX(-40px);
					}
					to {
						opacity: 1;
						transform: translateX(0);
					}
				}
				@keyframes fadeInRight {
					from {
						opacity: 0;
						transform: translateX(40px);
					}
					to {
						opacity: 1;
						transform: translateX(0);
					}
				}
				.feature-card-animate {
					animation: fadeInUp 0.8s ease-out forwards;
				}
				.feature-image-animate-left {
					animation: fadeInLeft 0.8s ease-out forwards;
				}
				.feature-image-animate-right {
					animation: fadeInRight 0.8s ease-out forwards;
				}
				.feature-text-animate-left {
					animation: fadeInRight 0.8s ease-out 0.2s forwards;
					opacity: 0;
				}
				.feature-text-animate-right {
					animation: fadeInLeft 0.8s ease-out 0.2s forwards;
					opacity: 0;
				}
			`}} />
			{features.map((feature, i) => {
				const backgroundColor = cardColors[i % cardColors.length]
				const isImageLeft = i % 2 === 0 // Alternate: even index = image left, odd = image right
				const isVisible = visibleCards.has(i)
				
				return (
					<div
						key={i}
						ref={(el) => {
							cardRefs.current[i] = el
						}}
						className={`w-full ${isVisible ? 'feature-card-animate' : 'opacity-0'}`}
					>
					<div
						className="w-full flex flex-col md:flex-row min-h-[600px] md:min-h-[700px]"
						style={{
							backgroundColor
						}}
					>
						{feature.image && (
							<div className={`flex-shrink-0 w-full md:w-1/2 relative min-h-[400px] md:min-h-[700px] flex items-center ${isImageLeft ? 'justify-end pr-0 md:pr-4 order-1' : 'justify-start pl-0 md:pl-4 order-1 md:order-3'} ${isVisible ? (isImageLeft ? 'feature-image-animate-left' : 'feature-image-animate-right') : 'opacity-0'}`}>
								{/* Minimal Modern Laptop Mockup */}
								<div className="relative w-full max-w-[800px]">
										<div 
											className="relative rounded-lg overflow-hidden"
											style={{
												backgroundColor: '#f5f5f5',
												paddingTop: '62.5%', // 16:10 aspect ratio
												borderRadius: '12px',
												border: '1px solid rgba(0, 0, 0, 0.08)',
												boxShadow: `
													0 4px 20px rgba(0, 0, 0, 0.08),
													0 0 40px rgba(96, 165, 250, 0.15),
													0 0 80px rgba(96, 165, 250, 0.1)
												`,
												position: 'relative'
											}}
										>
											{/* Gradient Glow Overlay */}
											<div 
												className="absolute inset-0 pointer-events-none rounded-lg"
												style={{
													background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.05) 50%, transparent 100%)',
													zIndex: 1
												}}
											/>
											{/* Screen Content */}
											<div className="absolute inset-0 p-1" style={{ zIndex: 2 }}>
												<div className="relative w-full h-full rounded-lg overflow-hidden">
													<Image
														src={feature.image}
														alt={feature.title}
														fill
														className="object-cover"
													/>
												</div>
											</div>
										</div>
									</div>
								</div>
							)}
							<div 
								className={`flex-1 p-8 md:p-16 lg:p-20 flex flex-col justify-center items-center relative ${isImageLeft ? 'md:pl-0 order-2' : 'md:pr-0 order-2 md:order-2'} ${isVisible ? (isImageLeft ? 'feature-text-animate-left' : 'feature-text-animate-right') : ''}`}
							>
								<div style={{ maxWidth: '600px', width: '100%' }}>
									<h3
										className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-4 md:mb-6"
										style={{
											color: headlineColor,
											fontFamily: 'Inter, system-ui, sans-serif',
											fontWeight: 600
										}}
									>
										{feature.title}
									</h3>
									<p
										className="text-base md:text-lg lg:text-xl leading-relaxed mb-6"
										style={{ color: theme.colors.text.tertiary }}
									>
										{feature.description}
									</p>
									<button
										className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
										style={{ 
											color: headlineColor,
											fontFamily: 'Inter, system-ui, sans-serif'
										}}
									>
										<ArrowUpRight size={16} />
										Explore Now
									</button>
								</div>
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}

