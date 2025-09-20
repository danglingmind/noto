import { SignUp } from '@clerk/nextjs'

export default function Page () {
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
						Create your account
					</h2>
					<p className="mt-2 text-sm text-gray-600">
						Join thousands of teams collaborating with visual feedback.
					</p>
				</div>
				<SignUp />
			</div>
		</div>
	)
}
