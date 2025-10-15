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
				annotationsPerMonth: { max: 100, unlimited: false },
				teamMembers: { max: 1, unlimited: false },
				storage: { maxGB: 1, unlimited: false },
				fileSizeLimitMB: { max: 20, unlimited: false },
				features: {
					advancedAnalytics: false,
					whiteLabel: false,
					sso: false,
					customIntegrations: false,
					prioritySupport: false,
					apiAccess: false,
				}
			}
		},
	})

	const proPlan = await prisma.subscription_plans.upsert({
		where: { name: 'pro' },
		update: {
			// TODO: Replace with actual Stripe price and product IDs from your Stripe dashboard
			stripePriceId: 'price_1S8vvaE1HozQ7dZMPe7PDOGm',
			stripeProductId: 'prod_T567VtySHxhHEh',
		},
		create: {
			id: 'pro_plan_id',
			name: 'pro',
			displayName: 'Pro',
			description: 'Advanced features for growing teams and agencies',
			price: 29,
		stripePriceId: 'price_1S8vvaE1HozQ7dZMPe7PDOGm',
		stripeProductId: 'prod_T567VtySHxhHEh',
			billingInterval: 'MONTHLY',
			isActive: true,
			sortOrder: 2,
			featureLimits: {
				workspaces: { max: 5, unlimited: false },
				projectsPerWorkspace: { max: 0, unlimited: true },
				filesPerProject: { max: 1000, unlimited: false },
				annotationsPerMonth: { max: 0, unlimited: true },
				teamMembers: { max: 10, unlimited: false },
				storage: { maxGB: 50, unlimited: false },
				features: {
					advancedAnalytics: true,
					whiteLabel: false,
					sso: false,
					customIntegrations: false,
					prioritySupport: true,
					apiAccess: true,
				}
			}
		},
	})

	const enterprisePlan = await prisma.subscription_plans.upsert({
		where: { name: 'enterprise' },
		update: {
			// TODO: Replace with actual Stripe price ID from your Stripe dashboard
			stripePriceId: 'price_1S8vwpE1HozQ7dZMzR4vb8wJ',
		},
		create: {
			id: 'enterprise_plan_id',
			name: 'enterprise',
			displayName: 'Enterprise',
			description: 'Full-featured solution for large organizations',
			price: 99,
			stripePriceId: 'price_1S8vwpE1HozQ7dZMzR4vb8wJ',
			stripeProductId: 'prod_T569JnWCRi6q9E',
			billingInterval: 'MONTHLY',
			isActive: true,
			sortOrder: 3,
			featureLimits: {
				workspaces: { max: 0, unlimited: true },
				projectsPerWorkspace: { max: 0, unlimited: true },
				filesPerProject: { max: 0, unlimited: true },
				annotationsPerMonth: { max: 0, unlimited: true },
				teamMembers: { max: 0, unlimited: true },
				storage: { maxGB: 0, unlimited: true },
				features: {
					advancedAnalytics: true,
					whiteLabel: true,
					sso: true,
					customIntegrations: true,
					prioritySupport: true,
					apiAccess: true,
				}
			}
		},
	})

	console.log('✅ Database seeded successfully!')
	console.log({
		user: sampleUser,
		workspace: sampleWorkspace,
		project: sampleProject,
		plans: { freePlan, proPlan, enterprisePlan },
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
