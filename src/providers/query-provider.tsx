'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000, // 1 minute - data is fresh for 1 minute
						gcTime: 5 * 60 * 1000, // 5 minutes - cache persists for 5 minutes (formerly cacheTime)
						refetchOnWindowFocus: false, // Don't refetch on window focus
						retry: 1, // Retry failed requests once
					},
				},
			})
	)

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

