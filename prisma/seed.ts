import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
	console.log('🌱 Seeding database...')

	// Create a sample user (this would normally be created by Clerk)
	const sampleUser = await prisma.user.create({
		data: {
			clerkId: 'clerk_sample_user_id',
			email: 'demo@markup-clone.com',
			name: 'Demo User',
		},
	})

	// Create a sample workspace
	const sampleWorkspace = await prisma.workspace.create({
		data: {
			name: 'My First Workspace',
			ownerId: sampleUser.id,
		},
	})

	// Add the owner as an admin member
	await prisma.workspaceMember.create({
		data: {
			userId: sampleUser.id,
			workspaceId: sampleWorkspace.id,
			role: 'ADMIN',
		},
	})

	// Create a sample project
	const sampleProject = await prisma.project.create({
		data: {
			name: 'Website Redesign',
			description: 'Feedback and annotations for the new website design',
			workspaceId: sampleWorkspace.id,
			ownerId: sampleUser.id,
		},
	})

	console.log('✅ Database seeded successfully!')
	console.log({
		user: sampleUser,
		workspace: sampleWorkspace,
		project: sampleProject,
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
