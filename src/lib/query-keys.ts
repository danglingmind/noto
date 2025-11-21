/**
 * Centralized query keys for React Query
 * This ensures consistent cache key structure across the application
 * and makes it easier to invalidate related queries
 */

export const queryKeys = {
	// Projects
	projects: {
		all: ['projects'] as const,
		detail: (id: string) => ['projects', id] as const,
		files: (id: string, skip?: number, take?: number) =>
			['projects', id, 'files', { skip, take }] as const,
	},

	// Workspaces
	workspaces: {
		all: ['workspaces'] as const,
		detail: (id: string) => ['workspaces', id] as const,
		projects: (id: string) => ['workspaces', id, 'projects'] as const,
		subscription: (id: string) => ['workspaces', id, 'subscription'] as const,
		members: (id: string) => ['workspaces', id, 'members'] as const,
		access: (id: string) => ['workspaces', id, 'access'] as const,
	},

	// Files
	files: {
		all: ['files'] as const,
		detail: (id: string) => ['files', id] as const,
		annotations: (id: string, viewport?: string) =>
			['files', id, 'annotations', viewport] as const,
		url: (id: string) => ['files', id, 'url'] as const,
		proxyUrl: (id: string, storagePath?: string) =>
			['files', id, 'proxy-url', storagePath] as const,
		snapshot: (id: string) => ['files', id, 'snapshot'] as const,
	},

	// Annotations
	annotations: {
		all: ['annotations'] as const,
		detail: (id: string) => ['annotations', id] as const,
		file: (fileId: string, viewport?: string) =>
			['annotations', 'file', fileId, viewport] as const,
	},

	// Subscriptions
	subscriptions: {
		all: ['subscriptions'] as const,
		user: (userId?: string) => ['subscriptions', 'user', userId] as const,
		workspace: (workspaceId: string) =>
			['subscriptions', 'workspace', workspaceId] as const,
		plans: () => ['subscriptions', 'plans'] as const,
		limits: () => ['subscriptions', 'limits'] as const,
	},

	// User
	user: {
		all: ['user'] as const,
		me: ['user', 'me'] as const,
	},

	// Tasks
	tasks: {
		all: ['tasks'] as const,
		detail: (id: string) => ['tasks', id] as const,
		project: (projectId: string, assignedTo?: string) =>
			['tasks', 'project', projectId, assignedTo] as const,
	},

	// Comments
	comments: {
		all: ['comments'] as const,
		detail: (id: string) => ['comments', id] as const,
		annotation: (annotationId: string) =>
			['comments', 'annotation', annotationId] as const,
	},

	// Notifications
	notifications: {
		all: ['notifications'] as const,
	},

	// Invitations
	invitations: {
		all: ['invitations'] as const,
		detail: (token: string) => ['invitations', token] as const,
	},
}

