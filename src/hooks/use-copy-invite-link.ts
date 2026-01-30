'use client'

import { useState, useCallback } from 'react'

/**
 * Hook for copying invite links to clipboard
 * Follows Single Responsibility Principle - handles only clipboard operations
 */
export function useCopyInviteLink() {
	const [copiedToken, setCopiedToken] = useState<string | null>(null)

	const copyInviteLink = useCallback(async (token: string) => {
		try {
			const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/invite/${token}`
			await navigator.clipboard.writeText(inviteUrl)
			setCopiedToken(token)
			setTimeout(() => {
				setCopiedToken(null)
			}, 2000)
			return true
		} catch (error) {
			console.error('Failed to copy invite link:', error)
			return false
		}
	}, [])

	const isCopied = useCallback((token: string) => {
		return copiedToken === token
	}, [copiedToken])

	return {
		copyInviteLink,
		isCopied,
	}
}

/**
 * Utility function to generate invite link URL from token
 * Follows Single Responsibility Principle - handles only URL generation
 */
export function generateInviteLink(token: string): string {
	return `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/invite/${token}`
}
