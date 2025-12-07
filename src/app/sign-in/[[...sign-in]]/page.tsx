import { SignIn } from '@clerk/nextjs'

interface SignInPageProps {
	searchParams: Promise<{ redirect?: string }>
}

export default async function Page({ searchParams }: SignInPageProps) {
	const { redirect } = await searchParams
	const afterSignInUrl = redirect ? decodeURIComponent(redirect) : '/dashboard'

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<div className="max-w-md w-full space-y-8">
				<SignIn afterSignInUrl={afterSignInUrl} />
			</div>
		</div>
	)
}
