interface UsageLimits {
	projects: number
	workspace_members: number
	storage: number
}

interface UsageData {
	projects: number
	workspace_members: number
	storage: number
}

interface WorkspaceCounts {
	projects: number
	workspace_members: number
}

/**
 * Calculate if workspace usage exceeds limits and should show notification
 */
export function calculateUsageNotification(
	workspaceCounts: WorkspaceCounts | undefined,
	storageUsage: number = 45 // Mock storage usage in MB
): boolean {
	// Return false if workspaceCounts is undefined
	if (!workspaceCounts) {
		return false
	}

	// Mock plan limits - in real app, this would come from subscription service
	const currentPlan: UsageLimits = {
		projects: 3,
		workspace_members: 2,
		storage: 100 // MB
	}

	const usage: UsageData = {
		projects: workspaceCounts.projects || 0,
		workspace_members: workspaceCounts.members || 0,
		storage: storageUsage
	}

	const isOverLimit = {
		projects: usage.projects >= currentPlan.projects,
		workspace_members: usage.members >= currentPlan.members,
		storage: usage.storage >= currentPlan.storage
	}

	return Object.values(isOverLimit).some(Boolean)
}
