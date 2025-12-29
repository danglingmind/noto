import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function CTA() {
	return (
		<section className="py-20 md:py-32 px-4 bg-[#EEE9DD]">
			<div className="container mx-auto max-w-4xl px-6">
				<div className="text-center">
					<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
						Ready to streamline your review process?
					</h2>
					<p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8">
						Join thousands of teams who&apos;ve already transformed how they collaborate. Start your free trial today.
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
						<Button
							size="lg"
							className="bg-black text-white hover:bg-gray-900"
							asChild
						>
							<Link href="/sign-up">
								Get Started Free
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="border-black text-black hover:bg-gray-100"
							asChild
						>
							<Link href="#demo">Schedule a Demo</Link>
						</Button>
					</div>
				</div>
			</div>
		</section>
	)
}

