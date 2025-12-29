import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
	'/',
	'/sign-in(.*)',
	'/sign-up(.*)',
	'/pricing(.*)',
	'/contact(.*)',
	'/support(.*)',
	'/legal(.*)',
	'/api/webhooks(.*)',
	'/invite/(.*)',
	'/api/invitations/(.*)'
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
	// Preserve the original URL as a redirect parameter
	if (!userId && !isApiRoute(req)) {
		const signInUrl = new URL('/sign-in', req.url)
		signInUrl.searchParams.set('redirect', pathname + req.nextUrl.search)
		return NextResponse.redirect(signInUrl)
	}

	// Redirect authenticated users away from auth pages
	// If there's a redirect parameter, use it; otherwise go to dashboard
	if (userId && (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up'))) {
		const redirectParam = req.nextUrl.searchParams.get('redirect')
		let redirectUrl = '/dashboard'
		
		if (redirectParam) {
			try {
				redirectUrl = decodeURIComponent(redirectParam)
				// Validate that the redirect URL is a valid path (prevent open redirects)
				if (!redirectUrl.startsWith('/')) {
					redirectUrl = '/dashboard'
				}
			} catch {
				// If decoding fails, use default dashboard
				redirectUrl = '/dashboard'
			}
		}
		
		return NextResponse.redirect(new URL(redirectUrl, req.url))
	}

	return NextResponse.next()
})

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		'/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
		// Always run for API routes
		'/(api|trpc)(.*)'
	]
}
