'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
	{
		question: 'How is VYNL different from Figma comments?',
		answer: "Figma is a design tool vs VYNL is a review tool. Clients don't need to navigate Figma's interface. VYNL works on any image or website URL, keeps feedback organized by revision, and is purpose-built for the review-approve workflow with non-designer clients."
	},
	{
		question: 'Can I annotate live websites, not just images?',
		answer: 'Yes. Paste any website URL and VYNL captures a screenshot you can annotate directly. Your whole team sees the same view with all comments pinned in place.'
	},
	{
		question: 'Does VYNL work on mobile?',
		answer: 'No, VYNL is designed to work on larger screens, mobile is too small and using it on mobile will not give a good experience.'
	},
	{
		question: 'How does version tracking work?',
		answer: "Upload a new version of your design anytime. VYNL keeps all previous versions with their annotations intact, so you can compare feedback across revisions and see exactly what changed — and when."
	},
	{
		question: 'Is my data secure?',
		answer: "All files are encrypted in transit and at rest. We don't share your data or use it to train any models."
	},
	{
		question: 'Can I cancel anytime?',
		answer: "Absolutely. No contracts, no lock-in. Cancel from your account settings at any time. Your data remains accessible until the end of your billing period."
	},
	{
		question: 'Will my clients need to create an account to leave feedback?',
		answer: "Yes. But we made it frictionless and it's very quick, just log in using google. You invite clients via a shareable link. They can view designs and leave comments zero friction on their end."
	},
]

export function FAQAccordion() {
	const [openIndex, setOpenIndex] = useState<number | null>(null)

	return (
		<div style={{ borderTop: '1px solid #E5E7EB' }}>
			{faqs.map((faq, index) => (
				<div key={index} style={{ borderBottom: '1px solid #E5E7EB' }}>
					<button
						className="w-full text-left py-5 flex items-start justify-between gap-4"
						onClick={() => setOpenIndex(openIndex === index ? null : index)}
					>
						<span className="text-base font-medium leading-snug" style={{ color: '#111111' }}>
							{faq.question}
						</span>
						<ChevronDown
							size={18}
							style={{
								color: '#9CA3AF',
								transform: openIndex === index ? 'rotate(180deg)' : 'rotate(0deg)',
								transition: 'transform 0.2s ease',
								flexShrink: 0,
								marginTop: '2px'
							}}
						/>
					</button>
					{openIndex === index && (
						<div className="pb-5 pr-8">
							<p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
								{faq.answer}
							</p>
						</div>
					)}
				</div>
			))}
		</div>
	)
}
