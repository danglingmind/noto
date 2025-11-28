import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
	console.log('🌱 Seeding database...')

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

	// Create subscription plans
	const freePlan = await prisma.subscription_plans.upsert({
		where: { name: 'free' },
		update: {},
		create: {
			id: 'free_plan_id',
			name: 'free',
			displayName: 'Free',
			description: '7-day trial with basic features',
			price: 0,
			billingInterval: 'MONTHLY',
			isActive: true,
			sortOrder: 1,
			featureLimits: {
				workspaces: { max: 1, unlimited: false },
				projectsPerWorkspace: { max: 1, unlimited: false },
				filesPerProject: { max: 10, unlimited: false },
				storage: { maxGB: 1, unlimited: false },
				fileSizeLimitMB: { max: 20, unlimited: false }
			}
		},
	})

	// Note: Stripe price/product IDs are now stored only in environment variables
	// We no longer store them in the database to avoid stale data
	// The stripe-plan-config.ts module handles mapping plan names to env vars
	
	const proPlan = await prisma.subscription_plans.upsert({
		where: { name: 'pro' },
		update: {
			// Clear any existing Stripe IDs - they should come from env vars only
			stripePriceId: null,
			stripeProductId: null,
		},
		create: {
			id: 'pro_plan_id',
			name: 'pro',
			displayName: 'Pro',
			description: 'Advanced features for growing teams and agencies',
			price: 29,
			stripePriceId: null, // Stripe IDs come from environment variables only
			stripeProductId: null, // Stripe IDs come from environment variables only
			billingInterval: 'MONTHLY',
			isActive: true,
			sortOrder: 2,
			featureLimits: {
				workspaces: { max: 5, unlimited: false },
				projectsPerWorkspace: { max: 0, unlimited: true },
				filesPerProject: { max: 1000, unlimited: false },
				storage: { maxGB: 50, unlimited: false },
				fileSizeLimitMB: { max: 100, unlimited: false }
			}
		},
	})
	
	const annualProPlan = await prisma.subscription_plans.upsert({
		where: { name: 'pro_annual' },
		update: {
			// Clear any existing Stripe IDs - they should come from env vars only
			stripePriceId: null,
			stripeProductId: null,
		},
		create: {
			id: 'pro_annual_plan_id',
			name: 'pro_annual',
			displayName: 'Pro Annual',
			description: 'Advanced features for growing teams and agencies - Annual billing with 17% savings',
			price: 200,
			stripePriceId: null, // Stripe IDs come from environment variables only
			stripeProductId: null, // Stripe IDs come from environment variables only
			billingInterval: 'YEARLY',
			isActive: true,
			sortOrder: 3,
			featureLimits: {
				workspaces: { max: 5, unlimited: false },
				projectsPerWorkspace: { max: 0, unlimited: true },
				filesPerProject: { max: 1000, unlimited: false },
				storage: { maxGB: 50, unlimited: false },
				fileSizeLimitMB: { max: 100, unlimited: false }
			}
		},
	})

	console.log('✅ Database seeded successfully!')
	console.log({
		user: sampleUser,
		workspace: sampleWorkspace,
		project: sampleProject,
		plans: { freePlan, proPlan, annualProPlan },
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
