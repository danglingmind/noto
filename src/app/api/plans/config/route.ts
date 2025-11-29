import { NextResponse } from 'next/server'
import { PlanConfigService } from '@/lib/plan-config-service'

/**
 * API endpoint to get plan configurations from JSON
 * Returns full plan config including features, badges, and pricing for both intervals
 */
export async function GET() {
	try {
		const plans = PlanConfigService.getActivePlans()
		
		return NextResponse.json({ plans })
	} catch (error) {
		console.error('Error fetching plan config:', error)
		return NextResponse.json(
			{ error: 'Failed to fetch plan configuration' },
			{ status: 500 }
		)
	}
}

