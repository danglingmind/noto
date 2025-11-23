'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
	CreditCard,
	BarChart3,
	LogOut,
	Settings,
	UserCircle,
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

	// Determine usage link based on current workspace
	const usageLink = currentWorkspace?.id
		? `/workspace/${currentWorkspace.id}/usage`
		: '/dashboard/usage'

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
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link href="/user" className="flex items-center">
							<UserCircle className="mr-2 h-4 w-4" />
							<span>Profile</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/user" className="flex items-center">
							<Settings className="mr-2 h-4 w-4" />
							<span>Account Settings</span>
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />

				{/* Account & Billing */}
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link href={usageLink} className="flex items-center justify-between w-full">
							<div className="flex items-center">
								<BarChart3 className="mr-2 h-4 w-4" />
								<span>Usage</span>
							</div>
							{showUsageNotification && (
								<Badge
									variant="destructive"
									className="ml-2 h-2 w-2 p-0 rounded-full"
								/>
							)}
						</Link>
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

