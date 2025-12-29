import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Play } from 'lucide-react'

export function Hero() {
	return (
		<section className="py-20 md:py-32 px-4 bg-[#EEE9DD]">
			<div className="container mx-auto max-w-4xl px-6">
				{/* Beta Banner */}
				<div className="flex justify-center mb-8">
					<div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-gray-100">
						<div className="w-2 h-2 bg-black rounded-full"></div>
						<span className="text-sm text-black">Now in public beta</span>
					</div>
				</div>

				{/* Hero Content */}
				<div className="text-center">
					<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-6">
						Visual feedback for websites & images
					</h1>
					<p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
						Collaborate in real-time with pinpoint annotations. Leave comments directly on any webpage or image. Track progress with statuses, revisions, and signoffs.
					</p>

					{/* CTA Buttons */}
					<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
						<Button
							size="lg"
							className="bg-black text-white hover:bg-gray-900 rounded-none"
							asChild
						>
							<Link href="/sign-up">
								Start Free Trial
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="border-black text-black hover:bg-gray-100 rounded-none"
							asChild
						>
							<Link href="#demo">
								Watch Demo
								<Play className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					</div>

					{/* Additional Info */}
					<p className="text-sm text-gray-500">
						No credit card required • Free for up to 3 projects
					</p>
				</div>
			</div>
		</section>
	)
}

