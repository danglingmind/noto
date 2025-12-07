import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { SubscriptionService } from '@/lib/subscription'
import { WorkspaceLoading } from '@/components/loading/workspace-loading'
import { WorkspacePageClientWrapper } from '@/components/workspace-page-client-wrapper'
import { WorkspaceUsageContent } from '@/components/workspace-usage-content'
import { FeatureLimits } from '@/types/subscription'

interface UsagePageProps {
	params: Promise<{ id: string }>
}

async function UsageData({ params }: UsagePageProps) {
	const { id: workspaceId } = await params
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

	// Fetch workspace data - check if user is owner OR member
	const workspace = await prisma.workspaces.findFirst({
		where: {
			id: workspaceId,
			OR: [
				{
					users: {
						clerkId: user.id
					}
				},
				{
					workspace_members: {
						some: {
							users: {
								clerkId: user.id
							}
						}
					}
				}
			]
		},
		include: {
			users: {
				select: {
					id: true,
					name: true,
					email: true,
					avatarUrl: true
				}
			}
		}
	})

	if (!workspace) {
		redirect('/dashboard')
	}

	// Get user's subscription for user-level limits
	const subscription = await SubscriptionService.getUserSubscription(dbUser.id)
	
	// Get limits from subscription or free tier
	let userLimits: FeatureLimits
	let tier: 'FREE' | 'PRO' = 'FREE'
	
	if (subscription) {
		userLimits = subscription.plan.featureLimits as unknown as FeatureLimits
		const planName = subscription.plan.name.toUpperCase()
		tier = planName === 'PRO_ANNUAL' ? 'PRO' : (planName as 'FREE' | 'PRO')
	} else {
		userLimits = await SubscriptionService.getFreeTierLimits()
	}

	// Calculate user-level aggregated usage
	const userUsage = await SubscriptionService.calculateUserUsage(dbUser.id)

	// Calculate workspace-level usage
	const workspaceUsage = await SubscriptionService.calculateWorkspaceUsage(workspaceId)

	// Get workspace subscription info (uses workspace owner's subscription, which should be the same as user's)
	const workspaceSubscriptionInfo = await SubscriptionService.getWorkspaceSubscriptionInfo(workspaceId)
	// Use workspace limits if available, otherwise fall back to user limits
	const workspaceLimits: FeatureLimits = workspaceSubscriptionInfo?.limits ?? userLimits

	// Wrap with client component to use context
	return (
		<WorkspacePageClientWrapper workspaceId={workspaceId}>
			<WorkspaceUsageContent
				subscriptionTier={tier}
				userLimits={userLimits}
				userUsage={userUsage}
				workspaceLimits={workspaceLimits as typeof userLimits}
				workspaceUsage={workspaceUsage}
				workspaceName={workspace.name}
			/>
		</WorkspacePageClientWrapper>
	)
}

export default function UsagePage({ params }: UsagePageProps) {
	return (
		<Suspense fallback={<WorkspaceLoading />}>
			<UsageData params={params} />
		</Suspense>
	)
}
