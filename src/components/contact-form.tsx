'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Mail, Send, X } from 'lucide-react'
import { toast } from 'sonner'

const contactSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
	message: z.string().min(1, 'Message is required'),
})

type ContactFormData = z.infer<typeof contactSchema>

interface ContactFormProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function ContactForm({ open, onOpenChange }: ContactFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)

	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors, isValid },
	} = useForm<ContactFormData>({
		resolver: zodResolver(contactSchema),
		mode: 'onChange', // Enable real-time validation
	})

	// Watch form values to determine if submit button should be enabled
	const watchedValues = watch()
	const isFormValid = watchedValues.name?.trim() && 
		watchedValues.email?.trim() && 
		watchedValues.message?.trim() && 
		isValid

	const onSubmit = async (data: ContactFormData) => {
		setIsSubmitting(true)
		try {
			const response = await fetch('/api/contact', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			})

			if (!response.ok) {
				throw new Error('Failed to send message')
			}

			toast.success('Message sent successfully! We&apos;ll get back to you soon.')
			reset()
			onOpenChange(false)
		} catch (error) {
			console.error('Error sending message:', error)
			toast.error('Failed to send message. Please try again.')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Mail className="h-5 w-5" />
						Contact Us
					</DialogTitle>
					<DialogDescription>
						Send us a message and we&apos;ll get back to you as soon as possible.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name *</Label>
						<Input
							id="name"
							{...register('name')}
							placeholder="Your name"
							disabled={isSubmitting}
							required
						/>
						{errors.name && (
							<p className="text-sm text-red-500">{errors.name.message}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="email">Email *</Label>
						<Input
							id="email"
							type="email"
							{...register('email')}
							placeholder="your.email@example.com"
							disabled={isSubmitting}
							required
						/>
						{errors.email && (
							<p className="text-sm text-red-500">{errors.email.message}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="message">Message *</Label>
						<Textarea
							id="message"
							{...register('message')}
							placeholder="Tell us how we can help you..."
							rows={10}
							className="h-[250px] resize-none overflow-y-auto"
							disabled={isSubmitting}
							required
						/>
						{errors.message && (
							<p className="text-sm text-red-500">{errors.message.message}</p>
						)}
					</div>

					<div className="flex gap-2 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
							className="flex-1"
						>
							<X className="h-4 w-4 mr-2" />
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isSubmitting || !isFormValid}
							className="flex-1"
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Send className="h-4 w-4 mr-2" />
							)}
							{isSubmitting ? 'Sending...' : 'Send Message'}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	)
}
