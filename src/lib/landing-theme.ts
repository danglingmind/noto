/**
 * Landing Page Theme Configuration
 * 
 * Easily customize colors, fonts, and styling by modifying this object.
 * All values are used throughout the landing page for consistent theming.
 */

export interface LandingTheme {
	colors: {
		// Background colors
		background: {
			primary: string
			secondary: string
			tertiary: string
			card: string
			cardHover: string
		}
		// Section-specific backgrounds (can be gradient or solid color)
		sections: {
			hero: string  // Hero section background
			howItWorks: string  // How It Works section background
			features: string  // Feature Highlights section background
			builtFor: string  // Built for Small Design Teams section background
			socialProof: string  // Social Proof section background
			pricing: string  // Pricing section background
			cta: string  // Final CTA section background
		}
		// Text colors
		text: {
			primary: string
			secondary: string
			tertiary: string
			muted: string
		}
		// Accent colors
		accent: {
			primary: string
			primaryHover: string
			secondary: string
			border: string
		}
		// Status colors
		status: {
			success: string
		}
	}
	fonts: {
		heading: string
		body: string
	}
}

export const landingTheme: LandingTheme = {
	colors: {
		background: {
			primary: '#FFFFFF',      // Main page background (white)
			secondary: '#FAFAFA',    // Section backgrounds (off-white)
			tertiary: '#F5F5F5',     // Hover states (light gray)
			card: '#FFFFFF',          // Card backgrounds (white)
			cardHover: '#FAFAFA',    // Card hover state (off-white)
		},
		sections: {
			hero: '#EEE9DD',  // Hero section - white
			howItWorks: '#FFFFFF',  // How It Works - off-white
			features: '#FAFAFA',  // Feature Highlights - white
			builtFor: '#FFFFFF',  // Built for Small Design Teams - off-white
			socialProof: '#FAFAFA',  // Social Proof - white
			pricing: '#FFFFFF',  // Pricing - off-white
			cta: '#FAFAFA',  // Final CTA - white
		},
		text: {
			primary: '#000000',      // Main headings (black)
			secondary: '#1A1A1A',    // Body text (dark gray)
			tertiary: '#4A4A4A',     // Secondary text (medium gray)
			muted: '#6B6B6B',        // Muted text (light gray)
		},
		accent: {
			primary: '#000000',      // Primary buttons (black)
			primaryHover: '#1A1A1A', // Primary button hover (dark gray)
			secondary: '#4A4A4A',   // Secondary accents (medium gray)
			border: '#F0F0F0',       // Borders (very light gray)
		},
		status: {
			success: '#000000',      // Success/checkmarks (black)
		},
	},
	fonts: {
		heading: 'var(--font-montserrat), Montserrat, system-ui, sans-serif',
		body: 'var(--font-montserrat), Montserrat, system-ui, sans-serif',
	},
}

