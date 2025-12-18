/**
 * Prisma Enum Types
 * 
 * These types are defined locally to avoid TypeScript errors with @prisma/client imports.
 * The actual enum values come from the generated Prisma schema.
 */

export const Role = {
	VIEWER: 'VIEWER',
	COMMENTER: 'COMMENTER',
	EDITOR: 'EDITOR',
	REVIEWER: 'REVIEWER',
	ADMIN: 'ADMIN'
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const AnnotationType = {
	PIN: 'PIN',
	BOX: 'BOX',
	HIGHLIGHT: 'HIGHLIGHT',
	TIMESTAMP: 'TIMESTAMP'
} as const

export type AnnotationType = (typeof AnnotationType)[keyof typeof AnnotationType]

export const CommentStatus = {
	OPEN: 'OPEN',
	IN_PROGRESS: 'IN_PROGRESS',
	RESOLVED: 'RESOLVED'
} as const

export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus]

export const FileStatus = {
	PENDING: 'PENDING',
	READY: 'READY',
	FAILED: 'FAILED'
} as const

export type FileStatus = (typeof FileStatus)[keyof typeof FileStatus]

export const FileType = {
	IMAGE: 'IMAGE',
	PDF: 'PDF',
	VIDEO: 'VIDEO',
	WEBSITE: 'WEBSITE'
} as const

export type FileType = (typeof FileType)[keyof typeof FileType]

export const NotificationType = {
	COMMENT_ADDED: 'COMMENT_ADDED',
	COMMENT_REPLY: 'COMMENT_REPLY',
	COMMENT_MENTION: 'COMMENT_MENTION',
	COMMENT_RESOLVED: 'COMMENT_RESOLVED',
	ANNOTATION_ADDED: 'ANNOTATION_ADDED',
	PROJECT_SHARED: 'PROJECT_SHARED',
	FILE_UPLOADED: 'FILE_UPLOADED',
	WORKSPACE_INVITE: 'WORKSPACE_INVITE',
	WORKSPACE_LOCKED: 'WORKSPACE_LOCKED',
	WORKSPACE_UNLOCKED: 'WORKSPACE_UNLOCKED'
} as const

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

export const PaymentStatus = {
	SUCCEEDED: 'SUCCEEDED',
	FAILED: 'FAILED',
	PENDING: 'PENDING',
	REFUNDED: 'REFUNDED'
} as const

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const SharePermission = {
	VIEW_ONLY: 'VIEW_ONLY',
	COMMENT: 'COMMENT',
	ANNOTATE: 'ANNOTATE'
} as const

export type SharePermission = (typeof SharePermission)[keyof typeof SharePermission]

export const SubscriptionStatus = {
	ACTIVE: 'ACTIVE',
	CANCELED: 'CANCELED',
	PAST_DUE: 'PAST_DUE',
	UNPAID: 'UNPAID',
	TRIALING: 'TRIALING'
} as const

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]

export const SubscriptionTier = {
	FREE: 'FREE',
	PRO: 'PRO'
} as const

export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier]

export const TaskPriority = {
	LOW: 'LOW',
	MEDIUM: 'MEDIUM',
	HIGH: 'HIGH',
	URGENT: 'URGENT'
} as const

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority]

export const TaskStatus = {
	TODO: 'TODO',
	IN_PROGRESS: 'IN_PROGRESS',
	REVIEW: 'REVIEW',
	DONE: 'DONE',
	CANCELLED: 'CANCELLED'
} as const

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

export const InvitationStatus = {
	PENDING: 'PENDING',
	ACCEPTED: 'ACCEPTED',
	EXPIRED: 'EXPIRED',
	CANCELLED: 'CANCELLED'
} as const

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus]

export const ViewportType = {
	DESKTOP: 'DESKTOP',
	TABLET: 'TABLET',
	MOBILE: 'MOBILE'
} as const

export type ViewportType = (typeof ViewportType)[keyof typeof ViewportType]

export const BillingInterval = {
	MONTHLY: 'MONTHLY',
	YEARLY: 'YEARLY'
} as const

export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval]
