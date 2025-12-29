'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { X, CheckCircle2, ArrowRight } from 'lucide-react'

interface ProblemSolutionSectionProps {
	theme: {
		fonts: {
			heading: string
		}
	}
}

export function ProblemSolutionSection({ theme }: ProblemSolutionSectionProps) {
	return (
		<section 
			className="py-20 md:py-32 px-4 relative"
			style={{ 
				background: '#000000',
				backgroundImage: `
					radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
				`,
				backgroundSize: '50px 50px'
			}}
		>
			<div className="container mx-auto max-w-6xl px-6">
				<div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
					{/* The Pain - Problem */}
					<div 
						className="space-y-6 p-8 md:p-10 rounded-xl"
						style={{
							backgroundColor: 'rgba(239, 68, 68, 0.15)',
							border: '2px solid rgba(239, 68, 68, 0.4)',
							boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)'
						}}
					>
						<div className="mb-6">
							<h2 
								className="text-xl md:text-2xl font-semibold mb-2"
								style={{ 
									color: '#ffffff',
									fontFamily: theme.fonts.heading,
									fontWeight: 600
								}}
							>
								You&apos;ve lived this chaos before 🎨
							</h2>
						</div>
						
						<div className="space-y-5">
							<div className="flex items-start gap-3">
								<X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#e5e5e5',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									That one hero section that somehow needs <strong>27 Slack messages</strong> to align.
								</p>
							</div>
							<div className="flex items-start gap-3">
								<X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#e5e5e5',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									Slack threads <strong>longer than your Figma file</strong>
								</p>
							</div>
							<div className="flex items-start gap-3">
								<X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#e5e5e5',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									<strong>Toddlers</strong>-<strong>doodle</strong>-<strong>level</strong> markup on screenshots
								</p>
							</div>
							<div className="flex items-start gap-3">
								<X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#e5e5e5',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									<strong>&quot;Make it pop more&quot;</strong> as the official direction
								</p>
							</div>
							<div className="flex items-start gap-3">
								<X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#e5e5e5',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									<em>final_v9_final-reallyfinal.png</em> haunting your drive or in your email thread
								</p>
							</div>
						</div>
					</div>

					{/* Vynl Fixes It - Solution */}
					<div 
						className="space-y-6 p-8 md:p-10 rounded-xl"
						style={{
							backgroundColor: 'rgba(34, 197, 94, 0.15)',
							border: '2px solid rgba(34, 197, 94, 0.4)',
							boxShadow: '0 4px 20px rgba(34, 197, 94, 0.2)'
						}}
					>
						<div className="mb-6">
							<h2 
								className="text-xl md:text-2xl font-semibold mb-2"
								style={{ 
									color: '#ffffff',
									fontFamily: theme.fonts.heading,
									fontWeight: 600
								}}
							>
								It doesn&apos;t have to be that hard 👇
							</h2>
						</div>
						
						<div className="space-y-5">
							<div className="flex items-start gap-3">
								<CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#ffffff',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									Upload your design or drop a website link.
								</p>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#ffffff',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									<strong>Comments appear exactly</strong> where they should on the design, never decode vague client messages again.
								</p>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#ffffff',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									Every comment, change, and approval gets <strong>tracked automatically and logically</strong>—no chaos, no hunting.
								</p>
							</div>
							<div className="flex items-start gap-3">
								<CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
								<p 
									className="text-lg md:text-xl"
									style={{ 
										color: '#ffffff',
										fontSize: '20px',
										lineHeight: '1.6'
									}}
								>
									Clients stay focused and specific, leading to <strong>faster approvals and fewer revision loops.</strong>
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* CTA */}
				<div className="mt-12 md:mt-16 flex flex-col items-center gap-4">
					<p 
						className="text-lg md:text-xl text-center"
						style={{ 
							color: '#ffffff',
							fontSize: '20px',
							lineHeight: '1.6'
						}}
					>
						No chaos. No confusion. Just clarity.
					</p>
					<style dangerouslySetInnerHTML={{ __html: `
						@keyframes arrow-move {
							0%, 100% {
								transform: translateX(0);
							}
							50% {
								transform: translateX(4px);
							}
						}
						.animated-arrow {
							animation: arrow-move 1.5s ease-in-out infinite;
							display: inline-block;
						}
					`}} />
					<Link href="/sign-up">
						<Button 
							className="w-full md:w-auto flex items-center justify-center gap-2 mx-auto"
							style={{ 
								background: 'linear-gradient(135deg, #dae9fa 0%, #b8d9f5 50%, #9bc9ef 100%)',
								color: '#1a1a1a',
								border: 'none',
								boxShadow: '0 4px 14px rgba(218, 233, 250, 0.5)',
								fontWeight: 400
							}}
						>
							Try it on your next client review
							<ArrowRight className="w-5 h-5 animated-arrow" />
						</Button>
					</Link>
				</div>
			</div>
		</section>
	)
}

