'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface HeaderActionsContextType {
	headerActions: ReactNode | null
	setHeaderActions: (actions: ReactNode | null) => void
}

export const HeaderActionsContext = createContext<HeaderActionsContextType | undefined>(undefined)

interface HeaderActionsProviderProps {
	children: ReactNode
}

/**
 * Context provider for header actions
 * Allows child components to set header actions that will be rendered in the layout
 */
export function HeaderActionsProvider({ children }: HeaderActionsProviderProps) {
	const [headerActions, setHeaderActions] = useState<ReactNode | null>(null)

	return (
		<HeaderActionsContext.Provider value={{ headerActions, setHeaderActions }}>
			{children}
		</HeaderActionsContext.Provider>
	)
}

/**
 * Hook to access header actions context
 */
export function useHeaderActions() {
	const context = useContext(HeaderActionsContext)
	if (context === undefined) {
		throw new Error('useHeaderActions must be used within a HeaderActionsProvider')
	}
	return context
}

