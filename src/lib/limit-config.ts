import { FeatureLimits } from '@/types/subscription'

/**
 * Limit configuration service that reads limit values from environment variables
 * This ensures limits cannot be modified by editing plans.json
 * Follows the same security pattern as Stripe keys
 */

interface LimitEnvConfig {
	workspaces: { max: number; unlimited: boolean }
	projectsPerWorkspace: { max: number; unlimited: boolean }
	filesPerProject: { max: number; unlimited: boolean }
	storage: { maxGB: number; unlimited: boolean }
	fileSizeLimitMB: { max: number; unlimited: boolean }
}

type PlanName = 'free' | 'pro'

/**
 * Parse environment variable value to number, with fallback
 */
function parseEnvInt(envVar: string | undefined, fallback: number): number {
	if (!envVar) return fallback
	const parsed = parseInt(envVar, 10)
	return isNaN(parsed) ? fallback : parsed
}

/**
 * Parse environment variable value to boolean
 */
function parseEnvBool(envVar: string | undefined, fallback: boolean): boolean {
	if (!envVar) return fallback
	return envVar.toLowerCase() === 'true'
}

/**
 * Get limit configuration for a specific plan from environment variables
 * Falls back to safe defaults if env vars are not set
 */
function getLimitConfigForPlan(planName: PlanName): LimitEnvConfig {
	if (planName === 'free') {
		return {
			workspaces: {
				max: parseEnvInt(process.env.FREE_PLAN_MAX_WORKSPACES, 1),
				unlimited: parseEnvBool(process.env.FREE_PLAN_WORKSPACES_UNLIMITED, false)
			},
			projectsPerWorkspace: {
				max: parseEnvInt(process.env.FREE_PLAN_MAX_PROJECTS_PER_WORKSPACE, 1),
				unlimited: parseEnvBool(process.env.FREE_PLAN_PROJECTS_UNLIMITED, false)
			},
			filesPerProject: {
				max: parseEnvInt(process.env.FREE_PLAN_MAX_FILES_PER_PROJECT, 10),
				unlimited: parseEnvBool(process.env.FREE_PLAN_FILES_UNLIMITED, false)
			},
			storage: {
				maxGB: parseEnvInt(process.env.FREE_PLAN_MAX_STORAGE_GB, 1),
				unlimited: parseEnvBool(process.env.FREE_PLAN_STORAGE_UNLIMITED, false)
			},
			fileSizeLimitMB: {
				max: parseEnvInt(process.env.FREE_PLAN_MAX_FILE_SIZE_MB, 20),
				unlimited: parseEnvBool(process.env.FREE_PLAN_FILE_SIZE_UNLIMITED, false)
			}
		}
	}

	// Pro plan
	return {
		workspaces: {
			max: parseEnvInt(process.env.PRO_PLAN_MAX_WORKSPACES, 5),
			unlimited: parseEnvBool(process.env.PRO_PLAN_WORKSPACES_UNLIMITED, false)
		},
		projectsPerWorkspace: {
			max: parseEnvInt(process.env.PRO_PLAN_MAX_PROJECTS_PER_WORKSPACE, 0),
			unlimited: parseEnvBool(process.env.PRO_PLAN_PROJECTS_UNLIMITED, true)
		},
		filesPerProject: {
			max: parseEnvInt(process.env.PRO_PLAN_MAX_FILES_PER_PROJECT, 1000),
			unlimited: parseEnvBool(process.env.PRO_PLAN_FILES_UNLIMITED, false)
		},
		storage: {
			maxGB: parseEnvInt(process.env.PRO_PLAN_MAX_STORAGE_GB, 50),
			unlimited: parseEnvBool(process.env.PRO_PLAN_STORAGE_UNLIMITED, false)
		},
		fileSizeLimitMB: {
			max: parseEnvInt(process.env.PRO_PLAN_MAX_FILE_SIZE_MB, 100),
			unlimited: parseEnvBool(process.env.PRO_PLAN_FILE_SIZE_UNLIMITED, false)
		}
	}
}

/**
 * Get FeatureLimits for a plan from environment variables
 * This is the secure source of truth for limit enforcement
 */
export function getLimitsFromEnv(planName: string): FeatureLimits {
	const normalized = planName.toLowerCase().replace('_annual', '') as PlanName
	return getLimitConfigForPlan(normalized)
}

/**
 * Require limits from environment variables (throws if critical limits missing)
 * For now, we use safe defaults, but this can be enhanced to validate required vars
 */
export function requireLimitsFromEnv(planName: string): FeatureLimits {
	const limits = getLimitsFromEnv(planName)
	
	// Validate that limits are reasonable (security check)
	if (limits.workspaces.max < 0 || limits.projectsPerWorkspace.max < 0 || 
			limits.filesPerProject.max < 0 || limits.storage.maxGB < 0 || 
			limits.fileSizeLimitMB.max < 0) {
		throw new Error(
			`Invalid limit configuration for plan "${planName}". ` +
			'Limit values cannot be negative. Please check your environment variables.'
		)
	}

	return limits
}







