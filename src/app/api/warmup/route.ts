import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET (req: Request) {
	const token = process.env.WARMUP_TOKEN
	const provided = req.headers.get('x-warmup-token') || ''

	if (!token || provided !== token) {
		return NextResponse.json({ ok: false }, { status: 401 })
	}

	try {
		await prisma.$queryRaw`SELECT 1`
		return NextResponse.json({ ok: true })
	} catch (err) {
		return NextResponse.json({ ok: false }, { status: 500 })
	}
}

export const revalidate = 0

