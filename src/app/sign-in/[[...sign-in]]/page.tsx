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
				<div className="text-center">
					<div className="flex items-center justify-center mb-6">
						<div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
							<span className="text-white font-bold text-lg">V</span>
						</div>
						<span className="ml-3 text-2xl font-bold text-gray-900">Vynl</span>
					</div>
					<h2 className="text-3xl font-bold text-gray-900">
						Sign in to your account
					</h2>
					<p className="mt-2 text-sm text-gray-600">
						Welcome back! Please sign in to continue.
					</p>
				</div>
				<SignIn afterSignInUrl={afterSignInUrl} />
			</div>
		</div>
	)
}
