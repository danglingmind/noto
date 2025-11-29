'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FAQItem {
	question: string
	answer: string
}

interface FAQAccordionProps {
	items: FAQItem[]
	theme: {
		colors: {
			text: {
				primary: string
				secondary: string
			}
		}
		fonts: {
			heading: string
		}
	}
}

export function FAQAccordion({ items, theme }: FAQAccordionProps) {
	const [openIndex, setOpenIndex] = useState<number | null>(null)

	const toggleItem = (index: number) => {
		setOpenIndex(openIndex === index ? null : index)
	}

	return (
		<div className="space-y-4">
			{items.map((item, index) => {
				const isOpen = openIndex === index

				return (
					<div
						key={index}
						className="rounded-lg overflow-hidden transition-all"
						style={{
							backgroundColor: '#f9f9f9'
						}}
					>
						<button
							onClick={() => toggleItem(index)}
							className="w-full px-6 py-4 flex items-center justify-between text-left hover:opacity-80 transition-opacity"
							style={{
								color: theme.colors.text.primary
							}}
						>
							<span
								className="text-base font-medium pr-4"
								style={{
									fontFamily: theme.fonts.heading
								}}
							>
								{item.question}
							</span>
							<ChevronDown
								className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
									isOpen ? 'transform rotate-180' : ''
								}`}
								style={{ color: theme.colors.text.primary }}
							/>
						</button>
						{isOpen && (
							<div
								className="px-6 pb-4 pt-0"
								style={{
									color: theme.colors.text.secondary
								}}
							>
								<p className="text-sm leading-relaxed">{item.answer}</p>
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}

