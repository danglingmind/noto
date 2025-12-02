import { PrismaClient } from '@prisma/client'
import { PlanConfigService } from '../src/lib/plan-config-service'
import { requireLimitsFromEnv } from '../src/lib/limit-config'

const prisma = new PrismaClient()

async function main() {
	console.log('🌱 Seeding database...')
	
	// Load plans from JSON config
	const planConfigs = PlanConfigService.getActivePlans()
	console.log(`📋 Found ${planConfigs.length} plans in configuration`)

	// Create a sample user (this would normally be created by Clerk)
	const sampleUser = await prisma.users.upsert({
		where: { clerkId: 'clerk_sample_user_id' },
		update: {},
		create: {
			id: 'demo_user_id',
			clerkId: 'clerk_sample_user_id',
			email: 'demo@markup-clone.com',
			name: 'Demo User',
		},
	})

	// Create a sample workspace
	const sampleWorkspace = await prisma.workspaces.upsert({
		where: { id: 'sample-workspace-id' },
		update: {},
		create: {
			id: 'sample-workspace-id',
			name: 'My First Workspace',
			ownerId: sampleUser.id,
		},
	})

	// Add the owner as an admin member
	await prisma.workspace_members.upsert({
		where: { 
			userId_workspaceId: {
				userId: sampleUser.id,
				workspaceId: sampleWorkspace.id
			}
		},
		update: {},
		create: {
			id: 'demo_workspace_member_id',
			userId: sampleUser.id,
			workspaceId: sampleWorkspace.id,
			role: 'ADMIN',
		},
	})

	// Create a sample project
	const sampleProject = await prisma.projects.upsert({
		where: { id: 'sample-project-id' },
		update: {},
		create: {
			id: 'sample-project-id',
			name: 'Website Redesign',
			description: 'Feedback and annotations for the new website design',
			workspaceId: sampleWorkspace.id,
			ownerId: sampleUser.id,
		},
	})

	// Sync subscription plans from JSON config to database
	// This ensures database stays in sync with config/plans.json
	const seededPlans = []
	
	for (const planConfig of planConfigs) {
		// Get feature limits from environment variables (secure source of truth)
		const featureLimits = requireLimitsFromEnv(planConfig.name)
		
		// Create/update plan for monthly billing
		const monthlyPlan = await prisma.subscription_plans.upsert({
			where: { name: planConfig.name },
			update: {
				displayName: planConfig.displayName,
				description: planConfig.description,
				price: planConfig.pricing.monthly.price,
				billingInterval: 'MONTHLY',
				featureLimits: featureLimits as unknown as any,
				isActive: planConfig.isActive,
				sortOrder: planConfig.sortOrder,
				// Clear Stripe IDs - they come from env vars only
				stripePriceId: null,
				stripeProductId: null,
			},
			create: {
				id: planConfig.id,
				name: planConfig.name,
				displayName: planConfig.displayName,
				description: planConfig.description,
				price: planConfig.pricing.monthly.price,
				billingInterval: 'MONTHLY',
				featureLimits: featureLimits as unknown as any,
				isActive: planConfig.isActive,
				sortOrder: planConfig.sortOrder,
				stripePriceId: null, // Stripe IDs come from environment variables only
				stripeProductId: null, // Stripe IDs come from environment variables only
			},
		})
		seededPlans.push(monthlyPlan)

		// If plan has yearly pricing with Stripe config, create yearly plan entry
		// Note: Yearly plans use the same feature limits as monthly (from env vars)
		if (planConfig.pricing.yearly.stripePriceIdEnv) {
			const yearlyPlanId = `${planConfig.id}_annual`
			const yearlyPlan = await prisma.subscription_plans.upsert({
				where: { name: `${planConfig.name}_annual` },
				update: {
					displayName: `${planConfig.displayName} Annual`,
					description: planConfig.description,
					price: planConfig.pricing.yearly.price,
					billingInterval: 'YEARLY',
					featureLimits: featureLimits as unknown as any, // Same limits as monthly (from env vars)
					isActive: planConfig.isActive,
					sortOrder: planConfig.sortOrder + 0.5, // Place yearly plans after monthly
					stripePriceId: null,
					stripeProductId: null,
				},
				create: {
					id: yearlyPlanId,
					name: `${planConfig.name}_annual`,
					displayName: `${planConfig.displayName} Annual`,
					description: planConfig.description,
					price: planConfig.pricing.yearly.price,
					billingInterval: 'YEARLY',
					featureLimits: featureLimits as unknown as any, // Same limits as monthly (from env vars)
					isActive: planConfig.isActive,
					sortOrder: planConfig.sortOrder + 0.5,
					stripePriceId: null,
					stripeProductId: null,
				},
			})
			seededPlans.push(yearlyPlan)
		}
	}

	console.log('✅ Database seeded successfully!')
	console.log({
		user: sampleUser,
		workspace: sampleWorkspace,
		project: sampleProject,
		plans: seededPlans,
	})
}

main()
	.catch((e) => {
		console.error('❌ Error seeding database:', e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
