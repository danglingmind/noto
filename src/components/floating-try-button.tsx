'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function FloatingTryButton() {
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		const handleScroll = () => {
			const element = document.getElementById('try-it-yourself')
			if (element) {
				const rect = element.getBoundingClientRect()
				// Show button when section is scrolled past (bottom of section is above viewport)
				const scrolledPast = rect.bottom < 0
				setIsVisible(scrolledPast)
			}
		}

		// Check on mount and on scroll
		handleScroll()
		window.addEventListener('scroll', handleScroll, { passive: true })

		return () => {
			window.removeEventListener('scroll', handleScroll)
		}
	}, [])

	const handleClick = () => {
		const element = document.getElementById('try-it-yourself')
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}

	return (
		<div
			className="fixed bottom-6 right-6 z-50"
			style={{
				opacity: isVisible ? 1 : 0,
				transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
				pointerEvents: isVisible ? 'auto' : 'none',
				transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out',
				animation: isVisible ? 'float 3s ease-in-out infinite' : 'none'
			}}
		>
			<style dangerouslySetInnerHTML={{ __html: `
				@keyframes float {
					0%, 100% {
						transform: translateY(0);
					}
					50% {
						transform: translateY(-10px);
					}
				}
			`}} />
			<Button
				onClick={handleClick}
				size="lg"
				className="rounded-full transition-all hover:scale-105"
				style={{
					background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
					color: '#ffffff',
					padding: '14px 28px',
					fontWeight: 600,
					fontSize: '16px',
					boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)',
					border: 'none'
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.5), 0 6px 16px rgba(0, 0, 0, 0.2)'
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15)'
				}}
			>
				Try it
			</Button>
		</div>
	)
}

