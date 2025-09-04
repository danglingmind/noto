/**
 * Migration utilities for backward compatibility
 * Helps transition from legacy coordinate system to new target system
 */

import { prisma } from './prisma'
import { migrateLegacyCoordinates, isLegacyAnnotation } from './annotation-types'

/**
 * Migrate all legacy annotations to use the new target system
 * This function can be run safely multiple times
 */
export async function migrateLegacyAnnotations() {
	console.log('Starting migration of legacy annotations...')
	
	try {
		// Find all annotations that have coordinates but no target
		const legacyAnnotations = await prisma.annotation.findMany({
			where: {
				coordinates: { not: null },
				target: null
			},
			include: {
				file: true
			}
		})
		
		console.log(`Found ${legacyAnnotations.length} legacy annotations to migrate`)
		
		let migratedCount = 0
		
		for (const annotation of legacyAnnotations) {
			try {
				// Convert legacy coordinates to new target format
				const target = migrateLegacyCoordinates(
					annotation.coordinates as any,
					annotation.file.fileType
				)
				
				// Update the annotation with the new target
				await prisma.annotation.update({
					where: { id: annotation.id },
					data: {
						target: target as any,
						// Keep coordinates for now (will be removed in future migration)
						coordinates: annotation.coordinates
					}
				})
				
				migratedCount++
				console.log(`Migrated annotation ${annotation.id}`)
			} catch (error) {
				console.error(`Failed to migrate annotation ${annotation.id}:`, error)
			}
		}
		
		console.log(`Successfully migrated ${migratedCount} annotations`)
		return { success: true, migratedCount }
		
	} catch (error) {
		console.error('Migration failed:', error)
		return { success: false, error }
	}
}

/**
 * Validate that all annotations have either coordinates or target
 * Useful for ensuring data integrity after migration
 */
export async function validateAnnotationIntegrity() {
	const invalidAnnotations = await prisma.annotation.findMany({
		where: {
			AND: [
				{ coordinates: null },
				{ target: null }
			]
		}
	})
	
	if (invalidAnnotations.length > 0) {
		console.warn(`Found ${invalidAnnotations.length} annotations without coordinates or target`)
		return false
	}
	
	console.log('All annotations have valid positioning data')
	return true
}

/**
 * Get annotation position data, preferring target over legacy coordinates
 */
export function getAnnotationPosition(annotation: any) {
	// Prefer the new target system
	if (annotation.target) {
		return {
			type: 'target',
			data: annotation.target
		}
	}
	
	// Fallback to legacy coordinates
	if (annotation.coordinates) {
		return {
			type: 'coordinates',
			data: annotation.coordinates
		}
	}
	
	throw new Error(`Annotation ${annotation.id} has no positioning data`)
}

/**
 * Update file metadata to match the new structure
 * This ensures existing files work with the new metadata system
 */
export async function normalizeFileMetadata() {
	console.log('Normalizing file metadata...')
	
	const files = await prisma.file.findMany({
		where: {
			OR: [
				{ metadata: null },
				{ status: { in: ['PENDING', 'READY', 'FAILED'] } } // Files that might need status update
			]
		}
	})
	
	let updatedCount = 0
	
	for (const file of files) {
		try {
			let updates: any = {}
			
			// Ensure all files have a status
			if (!file.status) {
				updates.status = 'READY'
			}
			
			// Add basic metadata if missing
			if (!file.metadata) {
				switch (file.fileType) {
					case 'IMAGE':
						updates.metadata = {
							intrinsic: { width: 0, height: 0 } // Will be updated when image is processed
						}
						break
					case 'PDF':
						updates.metadata = {
							pages: [] // Will be populated when PDF is processed
						}
						break
					case 'VIDEO':
						updates.metadata = {
							duration: 0,
							dimensions: { width: 0, height: 0 }
						}
						break
					case 'WEBSITE':
						updates.metadata = {
							snapshotId: `legacy_${file.id}`,
							capture: {
								url: file.fileUrl,
								timestamp: file.createdAt.toISOString(),
								document: { scrollWidth: 1440, scrollHeight: 900 },
								viewport: { width: 1440, height: 900 }
							},
							assets: { baseUrl: '' }
						}
						break
				}
			}
			
			if (Object.keys(updates).length > 0) {
				await prisma.file.update({
					where: { id: file.id },
					data: updates
				})
				updatedCount++
			}
			
		} catch (error) {
			console.error(`Failed to update file ${file.id}:`, error)
		}
	}
	
	console.log(`Updated metadata for ${updatedCount} files`)
	return { success: true, updatedCount }
}

/**
 * Complete migration script that runs all migration steps
 */
export async function runCompleteMigration() {
	console.log('Starting complete migration process...')
	
	const results = {
		fileMetadata: await normalizeFileMetadata(),
		annotations: await migrateLegacyAnnotations(),
		validation: await validateAnnotationIntegrity()
	}
	
	console.log('Migration completed:', results)
	return results
}
