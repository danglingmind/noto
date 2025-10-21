import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { syncUserWithClerk } from '@/lib/auth'
import { BillingContent } from '@/components/billing/billing-content'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'

async function BillingData() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Sync user with our database
  await syncUserWithClerk(user)

  return <BillingContent />
}

export default function BillingPage() {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <BillingData />
    </Suspense>
  )
}
