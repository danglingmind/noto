'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ContactForm } from '@/components/contact-form'
import { MessageCircle } from 'lucide-react'

export function FloatingContactIcon() {
	const [isContactOpen, setIsContactOpen] = useState(false)
	const pathname = usePathname()

	// Don't show on viewer pages
	const isViewerPage = pathname?.includes('/file/') || pathname?.includes('/shared/')

	if (isViewerPage) {
		return null
	}

	return (
		<>
			<div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
				<Button
					onClick={() => setIsContactOpen(true)}
					className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white"
					size="icon"
					aria-label="Contact us"
				>
					<MessageCircle className="h-6 w-6" />
				</Button>
				<span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded shadow-sm">
					Contact
				</span>
			</div>

			<ContactForm
				open={isContactOpen}
				onOpenChange={setIsContactOpen}
			/>
		</>
	)
}
