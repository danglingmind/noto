import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'
import { UserUsageContent } from '@/components/user-usage-content'
import { FeatureLimits } from '@/types/subscription'

async function UsageData() {
	const user = await currentUser()

	if (!user) {
		redirect('/sign-in')
	}

	// Get user from database
	const dbUser = await prisma.users.findUnique({
		where: { clerkId: user.id }
	})

	if (!dbUser) {
		redirect('/sign-in')
	}

	// Get user's subscription
	const subscription = await SubscriptionService.getUserSubscription(dbUser.id)
	
	// Get limits from subscription or free tier
	let limits: FeatureLimits
	let tier: 'FREE' | 'PRO' = 'FREE'
	
	if (subscription) {
		limits = subscription.plan.featureLimits as unknown as FeatureLimits
		const planName = subscription.plan.name.toUpperCase()
		tier = planName === 'PRO_ANNUAL' ? 'PRO' : (planName as 'FREE' | 'PRO')
	} else {
		limits = await SubscriptionService.getFreeTierLimits()
	}

	// Calculate user-level aggregated usage
	const usage = await SubscriptionService.calculateUserUsage(dbUser.id)

	// Get workspace breakdown for display
	const workspaces = await prisma.workspaces.findMany({
		where: {
			ownerId: dbUser.id
		},
		include: {
			projects: {
				include: {
					files: {
						include: {
							annotations: true
						}
					}
				}
			},
			workspace_members: true
		}
	})

	const workspaceBreakdown = await Promise.all(
		workspaces.map(async (workspace) => {
			const workspaceUsage = await SubscriptionService.calculateWorkspaceUsage(workspace.id)
			return {
				id: workspace.id,
				name: workspace.name,
				usage: workspaceUsage
			}
		})
	)

	return (
		<UserUsageContent
			subscriptionTier={tier}
			limits={limits}
			usage={usage}
			workspaceBreakdown={workspaceBreakdown}
		/>
	)
}

export default function UsagePage() {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<UsageData />
		</Suspense>
	)
}

