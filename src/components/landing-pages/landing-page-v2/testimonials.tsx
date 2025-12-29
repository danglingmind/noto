import { Star } from 'lucide-react'
import Image from 'next/image'

const testimonials = [
	{
		quote: 'vynl.in cut our review cycles in half. Our clients love how easy it is to leave feedback directly on designs.',
		author: 'Sarah Chen',
		role: 'Design Director',
		company: 'Creative Studio',
		avatar: null
	},
	{
		quote: 'Finally, a tool that makes async design reviews actually work. No more confusion about which element needs changes.',
		author: 'Michael Rodriguez',
		role: 'Product Manager',
		company: 'Tech Startup',
		avatar: null
	},
	{
		quote: 'We switched from screenshots and email threads to vynl.in. The difference in clarity and speed is incredible.',
		author: 'Emily Johnson',
		role: 'Marketing Lead',
		company: 'Agency',
		avatar: null
	}
]

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
	const initials = name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2)

	if (avatar) {
		return (
			<Image
				src={avatar}
				alt={name}
				width={48}
				height={48}
				className="rounded-full object-cover"
			/>
		)
	}

	return (
		<div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
			<span className="text-white font-semibold text-sm">{initials}</span>
		</div>
	)
}

export function Testimonials() {
	return (
		<section id="testimonials" className="py-20 md:py-32 px-4 bg-white">
			<div className="container mx-auto max-w-7xl px-6">
				<div className="text-center mb-16">
					<h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
						Loved by creative teams
					</h2>
					<p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
						Join thousands of designers, developers, and marketers who trust vynl.in for their review workflow.
					</p>
				</div>

				<div className="grid md:grid-cols-3 gap-8">
					{testimonials.map((testimonial, index) => (
						<div
							key={index}
							className="rounded-none p-8 border border-gray-200 bg-white"
						>
							<div className="flex mb-4">
								{[...Array(5)].map((_, i) => (
									<Star
										key={i}
										className="h-5 w-5 text-black fill-black"
									/>
								))}
							</div>
							<p className="text-base text-gray-700 mb-6 leading-relaxed">
								&quot;{testimonial.quote}&quot;
							</p>
							<div className="flex items-center gap-3">
								<Avatar name={testimonial.author} avatar={testimonial.avatar} />
								<div>
									<p className="font-semibold text-black">
										{testimonial.author}
									</p>
									<p className="text-sm text-gray-600">
										{testimonial.role}, {testimonial.company}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

