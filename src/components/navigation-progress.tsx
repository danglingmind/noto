'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Navigation progress indicator
 * Shows a subtle progress bar at the top of the header during navigation
 * Provides visual feedback that page transition is happening
 */
export function NavigationProgress() {
	const pathname = usePathname()
	const [isNavigating, setIsNavigating] = useState(false)
	const [progress, setProgress] = useState(0)
	const previousPathname = useRef(pathname)

	useEffect(() => {
		// Only show progress if pathname actually changed
		if (previousPathname.current !== pathname) {
			previousPathname.current = pathname
			setIsNavigating(true)
			setProgress(0)

			// Start progress animation
			let currentProgress = 0
			const interval = setInterval(() => {
				currentProgress += Math.random() * 15
				if (currentProgress > 90) {
					currentProgress = 90
				}
				setProgress(currentProgress)
			}, 100)

			// Complete progress after a short delay (navigation should be done)
			const timeout = setTimeout(() => {
				clearInterval(interval)
				setProgress(100)
				// Hide after completion animation
				setTimeout(() => {
					setIsNavigating(false)
					setProgress(0)
				}, 300)
			}, 500)

			return () => {
				clearInterval(interval)
				clearTimeout(timeout)
			}
		}
	}, [pathname])

	if (!isNavigating) {
		return null
	}

	return (
		<div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-200 overflow-hidden z-50">
			<div
				className="h-full bg-blue-600 shadow-sm"
				style={{
					width: `${progress}%`,
					transition: progress === 100 
						? 'width 0.3s ease-out' 
						: 'width 0.1s linear',
					boxShadow: progress > 0 ? '0 0 8px rgba(37, 99, 235, 0.5)' : 'none'
				}}
			/>
		</div>
	)
}

