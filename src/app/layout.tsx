import type { Metadata } from 'next'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'sonner'
import { UserContextProvider } from '@/contexts/user-context'
import { WorkspaceContextProvider } from '@/contexts/workspace-context'
import { QueryProvider } from '@/providers/query-provider'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'
import { GoogleAnalytics } from '@/components/google-analytics'

export const metadata: Metadata = {
  title: 'Vynl - Collaborative Feedback & Annotation',
  description: 'A powerful tool for visual collaboration, feedback, and annotation on digital content',
  icons: {
    icon: '/vynl-logo.png',
    shortcut: '/vynl-logo.png',
    apple: '/vynl-logo.png'
  }
}

export default function RootLayout ({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get Clerk publishable key
  // During build, if not available, use a valid-looking placeholder to prevent errors
  // The actual key will be available at runtime via Fly.io secrets
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 
    (process.env.NODE_ENV === 'production' ? 'pk_live_placeholder' : 'pk_test_placeholder')

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <QueryProvider>
        <UserContextProvider>
          <WorkspaceContextProvider>
            <html lang="en">
              <body className="antialiased">
                <GoogleAnalytics />
                <ServiceWorkerRegistration />
                {children}
                <Toaster position="top-right" />
              </body>
            </html>
          </WorkspaceContextProvider>
        </UserContextProvider>
      </QueryProvider>
    </ClerkProvider>
  )
}
