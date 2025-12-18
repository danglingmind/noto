import { prisma } from './prisma'

/**
 * Signoff Service
 * Handles revision signoff business logic
 * Follows Single Responsibility Principle (SRP)
 */
export class SignoffService {
	/**
	 * Check if a revision is signed off
	 */
	static async isRevisionSignedOff(fileId: string): Promise<boolean> {
		const signoff = await prisma.revision_signoffs.findUnique({
			where: { fileId }
		})
		return !!signoff
	}

	/**
	 * Get signoff details for a revision
	 */
	static async getSignoffDetails(fileId: string) {
		return prisma.revision_signoffs.findUnique({
			where: { fileId },
			include: {
				users: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				}
			}
		})
	}

	/**
	 * Sign off a revision
	 */
	static async signOffRevision(
		fileId: string,
		signedOffBy: string,
		notes?: string
	) {
		// Check if already signed off
		const existingSignoff = await prisma.revision_signoffs.findUnique({
			where: { fileId }
		})

		if (existingSignoff) {
			throw new Error('Revision is already signed off')
		}

		// Create signoff record
		return prisma.revision_signoffs.create({
			data: {
				id: `signoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				fileId,
				signedOffBy,
				signedOffAt: new Date(),
				notes: notes || null
			},
			include: {
				users: {
					select: {
						id: true,
						name: true,
						email: true,
						avatarUrl: true
					}
				}
			}
		})
	}

	/**
	 * Remove signoff from a revision (for admin/owner use)
	 */
	static async removeSignoff(fileId: string) {
		return prisma.revision_signoffs.delete({
			where: { fileId }
		})
	}
}

