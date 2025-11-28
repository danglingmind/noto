'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

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
	const containerRef = useRef<HTMLDivElement>(null)
	const cardsRef = useRef<HTMLDivElement[]>([])

	useEffect(() => {
		if (!containerRef.current) return

		let masterTrigger: ScrollTrigger | null = null

		// Wait for next frame to ensure DOM is ready
		const timeoutId = setTimeout(() => {
			const cards = cardsRef.current.filter(Boolean)
			if (cards.length === 0) return

			// Set initial states for all cards with proper z-index
			cards.forEach((card, index) => {
				gsap.set(card, {
					opacity: index === 0 ? 1 : 0.3,
					scale: index === 0 ? 1 : 0.9,
					zIndex: cards.length - index
				})
			})

			// Create a master ScrollTrigger that controls all cards
			masterTrigger = ScrollTrigger.create({
				trigger: containerRef.current,
				start: 'top top',
				end: 'bottom bottom',
				scrub: 1,
				onUpdate: (self) => {
					const progress = self.progress
					const totalCards = cards.length
					const scrollPosition = progress * (totalCards - 1)

					cards.forEach((card, index) => {
						const distance = scrollPosition - index
						
						if (distance < -0.5) {
							// Card is far past - completely hide it
							gsap.to(card, {
								opacity: 0,
								scale: 0.85,
								duration: 0.1,
								ease: 'none'
							})
						} else if (distance < 0) {
							// Card is just past - fade out
							const fadeProgress = Math.abs(distance) * 2
							gsap.to(card, {
								opacity: Math.max(0, 1 - fadeProgress),
								scale: 0.85 + 0.05 * (1 - fadeProgress),
								duration: 0.1,
								ease: 'none'
							})
						} else if (distance <= 1) {
							// Card is in the active range
							const cardProgress = 1 - distance
							const opacity = 0.3 + 0.7 * cardProgress
							const scale = 0.9 + 0.1 * cardProgress
							
							gsap.to(card, {
								opacity: Math.max(0.3, Math.min(1, opacity)),
								scale: Math.max(0.9, Math.min(1, scale)),
								duration: 0.1,
								ease: 'none'
							})
						} else {
							// Card is upcoming
							gsap.to(card, {
								opacity: 0.3,
								scale: 0.9,
								duration: 0.1,
								ease: 'none'
							})
						}
					})
				}
			})

			// Refresh ScrollTrigger after setup
			ScrollTrigger.refresh()
		}, 100)

		return () => {
			clearTimeout(timeoutId)
			if (masterTrigger) {
				masterTrigger.kill()
			}
			ScrollTrigger.getAll().forEach(trigger => {
				if (trigger.vars.trigger === containerRef.current) {
					trigger.kill()
				}
			})
		}
	}, [features.length])

	// Alternating colors
	const cardColors = ['#dae9fa', '#eed1df', '#f9f7f2', '#c0b8d1']

	return (
		<div 
			ref={containerRef}
			className="relative"
			style={{ 
				minHeight: `${features.length * 80}vh`
			}}
		>
			{features.map((feature, i) => {
				const backgroundColor = cardColors[i % cardColors.length]
				
				return (
					<div
						key={i}
						className="card-section relative"
						style={{
							height: '80vh',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							paddingTop: '10vh',
							paddingBottom: '10vh'
						}}
					>
					<div
						ref={(el) => {
							if (el) cardsRef.current[i] = el
						}}
						className="w-full max-w-[98%] md:max-w-[96%] mx-auto px-2 md:px-4"
						style={{
							position: 'sticky',
							top: '50%',
							transform: 'translateY(-50%)',
							zIndex: features.length - i
						}}
					>
							<div
								className="p-12 md:p-16 rounded-2xl shadow-lg w-full flex flex-col md:flex-row gap-8 md:gap-12 items-center min-h-[500px]"
								style={{
									backgroundColor
								}}
							>
							<div className="flex-1">
								<h3
									className="text-3xl md:text-4xl font-bold mb-4"
									style={{
										color: theme.colors.text.primary,
										fontFamily: theme.fonts.heading
									}}
								>
									{feature.title}
								</h3>
								<p
									className="text-base md:text-lg leading-relaxed"
									style={{ color: theme.colors.text.tertiary }}
								>
									{feature.description}
								</p>
							</div>
							{feature.image && (
								<div className="flex-shrink-0 w-full md:w-1/2 max-w-lg">
									<div className="relative aspect-video rounded-lg overflow-hidden">
										<Image
											src={feature.image}
											alt={feature.title}
											fill
											className="object-cover"
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
				)
			})}
		</div>
	)
}

