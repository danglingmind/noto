import { PenTool, MessageSquare, Users, FileText, CheckCircle2, Zap } from 'lucide-react'

const features = [
	{
		icon: PenTool,
		title: 'Pin & Box Annotations',
		description: 'Use pin annotations for precise point feedback or box annotations to highlight entire areas. Click anywhere on a webpage or image to leave contextual comments.'
	},
	{
		icon: MessageSquare,
		title: 'Threaded Comments',
		description: 'Have focused conversations right where they matter. Reply, mention team members, and keep discussions organized.'
	},
	{
		icon: Users,
		title: 'Real-Time Collaboration',
		description: 'Work together seamlessly with instant updates. See feedback as it happens and respond in real-time.'
	},
	{
		icon: FileText,
		title: 'Status Tracking',
		description: 'Track progress with custom statuses. Mark items as in progress, approved, or needs revision.'
	},
	{
		icon: CheckCircle2,
		title: 'Revisions & Signoffs',
		description: 'Upload new versions without losing context. Compare revisions side-by-side and get signoffs on final designs.'
	},
	{
		icon: Zap,
		title: 'Lightning Fast',
		description: 'Get feedback in minutes, not days. Our streamlined workflow eliminates email threads and endless back-and-forth.'
	}
]

export function Features() {
	return (
		<section id="features" className="py-20 md:py-32 px-4 bg-white">
			<div className="container mx-auto max-w-7xl px-6">
				<div className="text-center mb-16">
					<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
						Everything you need to review faster
					</h2>
					<p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
						Stop wasting time on back-and-forth emails. vynl.in gives you all the tools to streamline your review process.
					</p>
				</div>

				<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
					{features.map((feature, index) => (
						<div
							key={index}
							className="rounded-none p-8 border border-gray-200 bg-white transition-shadow"
						>
								<feature.icon className="h-6 w-6 text-black mb-6 w-10 h-10" />
							<h3 className="text-xl font-semibold mb-3 text-black">
								{feature.title}
							</h3>
							<p className="text-base leading-relaxed text-gray-600">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

