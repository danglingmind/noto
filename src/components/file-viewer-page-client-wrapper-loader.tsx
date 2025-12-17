'use client'

import dynamic from 'next/dynamic'

// Dynamically import client wrapper to prevent SSR issues with context
// This component is a client component, so it can use ssr: false
const DynamicFileViewerPageClientWrapper = dynamic(
	() => import('./file-viewer-page-client-wrapper').then(mod => ({ default: mod.FileViewerPageClientWrapper })),
	{ ssr: false }
)

interface FileViewerPageClientWrapperLoaderProps {
	workspaceId: string
	children: React.ReactNode
}

export function FileViewerPageClientWrapperLoader({ workspaceId, children }: FileViewerPageClientWrapperLoaderProps) {
	return (
		<DynamicFileViewerPageClientWrapper workspaceId={workspaceId}>
			{children}
		</DynamicFileViewerPageClientWrapper>
	)
}

