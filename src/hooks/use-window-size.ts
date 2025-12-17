'use client'

import { useState, useEffect } from 'react'

interface WindowSize {
	width: number
	height: number
}

/**
 * Custom hook to track window size
 * @param threshold - Minimum width threshold (default: 1024px)
 * @returns Object with window size and whether it's below threshold
 */
export function useWindowSize (threshold = 1024): {
	size: WindowSize
	isBelowThreshold: boolean
} {
	const [windowSize, setWindowSize] = useState<WindowSize>({
		width: typeof window !== 'undefined' ? window.innerWidth : 0,
		height: typeof window !== 'undefined' ? window.innerHeight : 0
	})

	useEffect(() => {
		// Handler to call on window resize
		function handleResize () {
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight
			})
		}

		// Set initial size
		handleResize()

		// Add event listener
		window.addEventListener('resize', handleResize)

		// Cleanup
		return () => window.removeEventListener('resize', handleResize)
	}, [])

	const isBelowThreshold = windowSize.width < threshold

	return {
		size: windowSize,
		isBelowThreshold
	}
}

