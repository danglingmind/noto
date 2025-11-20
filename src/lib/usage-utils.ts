import { WorkspaceSubscriptionInfo } from '@/types/subscription'

/**
 * Determine if the workspace has exceeded any plan limits using subscription data
 */
export function hasUsageExceededLimits(subscriptionInfo?: WorkspaceSubscriptionInfo | null): boolean {
	if (!subscriptionInfo) {
		return false
	}

	const { limits, usage } = subscriptionInfo

	const overProjects =
		!limits.projectsPerWorkspace.unlimited &&
		usage.projects >= limits.projectsPerWorkspace.max

	const overMembers =
		!limits.teamMembers.unlimited &&
		usage.teamMembers >= limits.teamMembers.max

	const overStorage =
		!limits.storage.unlimited &&
		usage.storageGB >= limits.storage.maxGB

	return overProjects || overMembers || overStorage
}
