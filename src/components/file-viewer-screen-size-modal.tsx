'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Monitor } from 'lucide-react'

interface FileViewerScreenSizeModalProps {
	isOpen: boolean
	currentWidth: number
	requiredWidth?: number
}

/**
 * Modal component that displays when the browser window is too small for the file viewer
 * Prevents interaction with the app until the screen is resized to an acceptable size
 */
export function FileViewerScreenSizeModal ({
	isOpen,
	currentWidth,
	requiredWidth = 1024
}: FileViewerScreenSizeModalProps) {
	return (
		<Dialog open={isOpen} modal={true}>
			<DialogContent 
				className="sm:max-w-md z-[9999] p-0 overflow-hidden shadow-2xl" 
				showCloseButton={false}
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				{/* Light Gradient Background */}
				<div className="relative bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 px-8 pt-12 pb-12">
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.08),transparent_50%)]" />
					
					<DialogHeader className="relative">
						<div className="flex items-center justify-center mb-6">
							<div className="relative">
								<div className="absolute inset-0 bg-indigo-100 blur-2xl rounded-full opacity-60" />
								<div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 shadow-lg ring-4 ring-indigo-100">
									<Monitor className="h-8 w-8 text-white" />
								</div>
							</div>
						</div>
						<DialogTitle className="text-center text-3xl font-bold text-slate-900 mb-4 tracking-tight">
							Use a Bigger Screen
						</DialogTitle>
						<DialogDescription className="text-center text-slate-600 text-base leading-relaxed max-w-sm mx-auto">
							For the best experience, please use a larger screen or resize your browser window.
						</DialogDescription>
					</DialogHeader>
				</div>
			</DialogContent>
		</Dialog>
	)
}

