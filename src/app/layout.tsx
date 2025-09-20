import type { Metadata } from 'next'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { FloatingContactIcon } from '@/components/floating-contact-icon'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Vynl - Collaborative Feedback & Annotation',
  description: 'A powerful tool for visual collaboration, feedback, and annotation on digital content'
}

export default function RootLayout ({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html lang="en">
        <body className="antialiased">
          {children}
          <FloatingContactIcon />
          <Toaster position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  )
}
