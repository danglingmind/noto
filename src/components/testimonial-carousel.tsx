'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface Testimonial {
	quote: string
	name: string
	role: string
	company: string
	avatar?: string
}

interface TestimonialCarouselProps {
	testimonials: Testimonial[]
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

export function TestimonialCarousel({ testimonials, theme }: TestimonialCarouselProps) {
	const [activeIndex, setActiveIndex] = useState(0)

	// Auto-rotate testimonials
	useEffect(() => {
		const interval = setInterval(() => {
			setActiveIndex((prev) => (prev + 1) % testimonials.length)
		}, 5000) // Change every 5 seconds

		return () => clearInterval(interval)
	}, [testimonials.length])

	const goToSlide = (index: number) => {
		setActiveIndex(index)
	}

	const currentTestimonial = testimonials[activeIndex]

	return (
		<div className="relative w-full">
			{/* Testimonial Card */}
			<div
				className="rounded-md shadow-lg p-8 md:p-16 w-full max-w-6xl mx-auto border transition-all duration-500"
				style={{
					backgroundImage: 'linear-gradient(130deg, rgb(6, 6, 6) 0%, rgb(33, 11, 31) 22%, rgb(14, 35, 45) 60%, rgb(18, 14, 46) 100%)',
					borderColor: 'rgba(255, 255, 255, 0.2)',
					borderWidth: '1px',
					minHeight: '500px',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
				}}
			>
				{/* Profile Picture */}
				<div className="flex justify-center mb-8">
					<div className="relative w-24 h-24 rounded-full overflow-hidden border border-white/20">
						{currentTestimonial.avatar ? (
							<Image
								src={currentTestimonial.avatar}
								alt={currentTestimonial.name}
								fill
								className="object-cover"
							/>
						) : (
							<Image
								src={`https://i.pravatar.cc/150?img=${activeIndex + 1}`}
								alt={currentTestimonial.name}
								fill
								className="object-cover"
							/>
						)}
					</div>
				</div>

				{/* Quote */}
				<div className="flex justify-center mb-8">
					<p
						className="text-lg md:text-xl font-bold text-center leading-relaxed max-w-2xl mx-auto"
						style={{
							color: '#ffffff',
							fontFamily: theme.fonts.heading
						}}
					>
						&quot;{currentTestimonial.quote}&quot;
					</p>
				</div>

				{/* Name - Stylized */}
				<p
					className="text-lg md:text-xl mb-2 text-center"
					style={{
						color: '#ffffff',
						fontFamily: theme.fonts.heading,
						fontStyle: 'italic',
						fontWeight: 500
					}}
				>
					{currentTestimonial.name}
				</p>

				{/* Attribution */}
				<p
					className="text-sm md:text-base text-center"
					style={{ color: '#e5e5e5' }}
				>
					{currentTestimonial.role}, {currentTestimonial.company}
				</p>
			</div>

			{/* Pagination Dots */}
			<div className="flex justify-center items-center gap-2 mt-8">
				{testimonials.map((_, index) => (
					<button
						key={index}
						onClick={() => goToSlide(index)}
						className="transition-all duration-300 focus:outline-none flex items-center"
						aria-label={`Go to testimonial ${index + 1}`}
					>
						<div className="flex items-center">
							<div
								className="rounded-full transition-all duration-300"
								style={{
									width: index === activeIndex ? '10px' : '6px',
									height: index === activeIndex ? '10px' : '6px',
									backgroundColor: '#4f292f',
									opacity: index === activeIndex ? 1 : 0.4
								}}
							/>
							{index === activeIndex && (
								<div
									className="h-0.5 ml-1 transition-all duration-300"
									style={{
										width: '16px',
										backgroundColor: '#4f292f',
										opacity: 0.3
									}}
								/>
							)}
						</div>
					</button>
				))}
			</div>
		</div>
	)
}
