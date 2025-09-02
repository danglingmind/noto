import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
	'/',
	'/sign-in(.*)',
	'/sign-up(.*)',
	'/api/webhooks(.*)',
])

const isApiRoute = createRouteMatcher(['/api(.*)'])

export default clerkMiddleware(async (auth, req) => {
	const { userId } = await auth()
	const { pathname } = req.nextUrl

	// Allow public routes
	if (isPublicRoute(req)) {
		return NextResponse.next()
	}

	// Redirect unauthenticated users to sign-in for protected routes
	if (!userId && !isApiRoute(req)) {
		return NextResponse.redirect(new URL('/sign-in', req.url))
	}

	// Redirect authenticated users away from auth pages to dashboard
	if (userId && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
		return NextResponse.redirect(new URL('/dashboard', req.url))
	}

	return NextResponse.next()
})

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		'/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
		// Always run for API routes
		'/(api|trpc)(.*)',
	],
}
