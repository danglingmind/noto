'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import {
	CreditCard,
	BarChart3,
	LogOut,
	HelpCircle,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useCurrentWorkspace } from '@/hooks/use-workspace-context'
import { useWorkspaceSubscription } from '@/hooks/use-workspace-subscription'

interface UserAvatarDropdownProps {
	hasUsageNotification?: boolean
}

/**
 * Custom user avatar dropdown component
 * Replaces Clerk's UserButton with a custom implementation using shadcn components
 * Includes both Clerk's options and our custom account/billing items
 */
export function UserAvatarDropdown({ hasUsageNotification }: UserAvatarDropdownProps) {
	const { user } = useUser()
	const { signOut } = useClerk()
	const router = useRouter()
	const { currentWorkspace } = useCurrentWorkspace()
	const [isNavigatingToUsage, setIsNavigatingToUsage] = useState(false)
	
	// Get usage notification from workspace subscription if not provided as prop
	const workspaceSubscription = useWorkspaceSubscription(currentWorkspace?.id)
	const showUsageNotification = hasUsageNotification ?? workspaceSubscription.hasUsageNotification

	if (!user) {
		return null
	}

	const userInitials = user.firstName && user.lastName
		? `${user.firstName[0]}${user.lastName[0]}`
		: user.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() || 'U'

	const userEmail = user.emailAddresses[0]?.emailAddress || ''
	const userName = user.fullName || userEmail

	const handleSignOut = async () => {
		await signOut()
		router.push('/')
	}

	const handleUsageClick = async (e: React.MouseEvent) => {
		// If we have a current workspace, let the Link handle it
		if (currentWorkspace?.id) {
			return
		}

		// Otherwise, fetch first workspace and redirect
		e.preventDefault()
		setIsNavigatingToUsage(true)

		try {
			const response = await fetch('/api/workspaces')
			if (response.ok) {
				const data = await response.json()
				const workspaces = data.workspaces || []
				
				if (workspaces.length > 0) {
					// Redirect to first workspace's usage page
					const firstWorkspace = workspaces[0]
					router.push(`/workspace/${firstWorkspace.id}/usage`)
				} else {
					// No workspaces, stay on dashboard
					router.push('/dashboard')
				}
			} else {
				router.push('/dashboard')
			}
		} catch (error) {
			console.error('Error fetching workspaces:', error)
			router.push('/dashboard')
		} finally {
			setIsNavigatingToUsage(false)
		}
	}

	// Determine usage link based on current workspace
	const usageLink = currentWorkspace?.id
		? `/workspace/${currentWorkspace.id}/usage`
		: '#'

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="relative flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
					<Avatar className="h-8 w-8 cursor-pointer">
						<AvatarImage src={user.imageUrl} alt={userName} />
						<AvatarFallback className="bg-blue-600 text-white text-sm font-medium">
							{userInitials}
						</AvatarFallback>
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				{/* User Info */}
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none">{userName}</p>
						<p className="text-xs leading-none text-muted-foreground">
							{userEmail}
						</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />

				{/* Clerk Options */}
				{/* <DropdownMenuGroup> */}
					{/* <DropdownMenuItem asChild>
						<Link href="/user" className="flex items-center">
							<UserCircle className="mr-2 h-4 w-4" />
							<span>Profile</span>
						</Link>
					</DropdownMenuItem> */}
					{/* <DropdownMenuItem asChild>
						<Link href="/user" className="flex items-center">
							<Settings className="mr-2 h-4 w-4" />
							<span>Account Settings</span>
						</Link>
					</DropdownMenuItem> */}
				{/* </DropdownMenuGroup> */}
				{/* <DropdownMenuSeparator /> */}

				{/* Account & Billing */}
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						{currentWorkspace?.id ? (
							<Link href={usageLink} className="flex items-center w-full">
								<BarChart3 className="mr-2 h-4 w-4" />
								<span className="flex-1">Usage</span>
								{showUsageNotification && (
									<Badge
										variant="destructive"
										className="ml-2 h-2 w-2 p-0 rounded-full"
									/>
								)}
							</Link>
						) : (
							<button
								onClick={handleUsageClick}
								disabled={isNavigatingToUsage}
								className="flex items-center w-full"
							>
								<BarChart3 className="mr-2 h-4 w-4" />
								<span className="flex-1">{isNavigatingToUsage ? 'Loading...' : 'Usage'}</span>
								{showUsageNotification && (
									<Badge
										variant="destructive"
										className="ml-2 h-2 w-2 p-0 rounded-full"
									/>
								)}
							</button>
						)}
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/dashboard/billing" className="flex items-center">
							<CreditCard className="mr-2 h-4 w-4" />
							<span>Billing & Payments</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/pricing" className="flex items-center">
							<CreditCard className="mr-2 h-4 w-4" />
							<span>View Plans</span>
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />

				{/* Support */}
				<DropdownMenuItem asChild>
					<Link href="/support" className="flex items-center">
						<HelpCircle className="mr-2 h-4 w-4" />
						<span>Support</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />

				{/* Sign Out */}
				<DropdownMenuItem
					onClick={handleSignOut}
					className="text-red-600 focus:text-red-600 cursor-pointer"
				>
					<LogOut className="mr-2 h-4 w-4" />
					<span>Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

