import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
	try {
		const user = await currentUser()
		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { searchParams } = new URL(request.url)
		const query = searchParams.get('q')

		if (!query || query.trim().length < 2) {
			return NextResponse.json({ users: [] })
		}

		// Search for users by name or email
		const users = await prisma.user.findMany({
			where: {
				OR: [
					{
						name: {
							contains: query.trim(),
							mode: 'insensitive'
						}
					},
					{
						email: {
							contains: query.trim(),
							mode: 'insensitive'
						}
					}
				]
			},
			select: {
				id: true,
				name: true,
				email: true,
				avatarUrl: true
			},
			take: 10,
			orderBy: {
				name: 'asc'
			}
		})

		return NextResponse.json({ users })
	} catch (error) {
		console.error('Error searching users:', error)
		return NextResponse.json(
			{ error: 'Failed to search users' },
			{ status: 500 }
		)
	}
}