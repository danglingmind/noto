import { Upload, MessageSquare, CheckCircle2 } from 'lucide-react'

const steps = [
	{
		icon: Upload,
		title: 'Upload',
		description: 'Upload your images, PDFs, or website links to get started'
	},
	{
		icon: MessageSquare,
		title: 'Annotate',
		description: 'Add pin or box annotations with comments directly on your designs'
	},
	{
		icon: CheckCircle2,
		title: 'Review',
		description: 'Collaborate with your team, track statuses, and get signoffs'
	}
]

export function HowItWorks() {
	return (
		<section id="how-it-works" className="py-20 md:py-32 px-4 bg-gray-50">
			<div className="container mx-auto max-w-6xl px-6">
				<div className="text-center mb-16">
					<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
						How it works
					</h2>
					<p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
						Get started in minutes with our simple workflow
					</p>
				</div>

				<div className="grid md:grid-cols-3 gap-8">
					{steps.map((step, index) => (
						<div key={index} className="text-center">
							<div className="w-16 h-16 rounded-full bg-black flex items-center justify-center mx-auto mb-6">
								<step.icon className="h-8 w-8 text-white" />
							</div>
							<h3 className="text-xl font-semibold mb-3 text-black">
								{step.title}
							</h3>
							<p className="text-base text-gray-600">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

