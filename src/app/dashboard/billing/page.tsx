import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { syncUserWithClerk } from '@/lib/auth'
import { createBillingPortalUrl } from '@/lib/billing-portal'
import { BillingContent } from '@/components/billing/billing-content'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'

async function LegacyBillingData() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    redirect('/sign-in')
  }

  await syncUserWithClerk(clerkUser)
  return <BillingContent />
}

export default async function BillingPage() {
  // Revert switch:
  // Set USE_STRIPE_CUSTOMER_PORTAL=false to restore legacy in-app billing UI.
  const useStripeCustomerPortal = process.env.USE_STRIPE_CUSTOMER_PORTAL !== 'false'

  if (!useStripeCustomerPortal) {
    // Legacy billing page kept intentionally for easy rollback.
    return (
      <Suspense fallback={<WorkspaceLoading />}>
        <LegacyBillingData />
      </Suspense>
    )
  }

  const clerkUser = await currentUser()

  if (!clerkUser) {
    redirect('/sign-in')
  }

  // Sync user with our database
  const dbUser = await syncUserWithClerk(clerkUser)

  try {
    const portalUrl = await createBillingPortalUrl(dbUser.id)
    redirect(portalUrl)
  } catch (error) {
    console.error('Failed to redirect to Stripe billing portal:', error)
    redirect('/dashboard')
  }

  return null
}
