import { FeatureLimits } from '@/types/subscription'

/**
 * Single source of truth for how plan feature limits are displayed as strings.
 *
 * To add a new limit:
 *   1. Add it to FeatureLimits in types/subscription.ts
 *   2. Add env-var parsing in lib/limit-config.ts
 *   3. Add a definition here — both landing page and /pricing update automatically.
 */
export interface PlanFeatureDefinition {
	label: string
	getValue: (limits: FeatureLimits) => string
}

export const PLAN_FEATURE_DEFINITIONS: PlanFeatureDefinition[] = [
	{
		label: 'Workspaces',
		getValue: (limits) =>
			limits.workspaces.unlimited
				? 'Unlimited workspaces'
				: `${limits.workspaces.max} workspace${limits.workspaces.max !== 1 ? 's' : ''}`,
	},
	{
		label: 'Projects per workspace',
		getValue: (limits) =>
			limits.projectsPerWorkspace.unlimited
				? 'Unlimited projects per workspace'
				: `${limits.projectsPerWorkspace.max} project${limits.projectsPerWorkspace.max !== 1 ? 's' : ''} per workspace`,
	},
	{
		label: 'Files per project',
		getValue: (limits) =>
			limits.filesPerProject.unlimited
				? 'Unlimited files per project'
				: `${limits.filesPerProject.max} files per project`,
	},
	{
		label: 'Storage',
		getValue: (limits) =>
			limits.storage.unlimited ? 'Unlimited storage' : `${limits.storage.maxGB}GB storage`,
	},
	{
		label: 'File size limit',
		getValue: (limits) =>
			limits.fileSizeLimitMB.unlimited
				? 'Unlimited file size'
				: `${limits.fileSizeLimitMB.max}MB file size limit`,
	},
]

/**
 * Returns formatted feature strings for a given set of limits.
 * Used by the landing page pricing cards.
 */
export function getPlanFeatureStrings(limits: FeatureLimits): string[] {
	return PLAN_FEATURE_DEFINITIONS.map(({ getValue }) => getValue(limits))
}
