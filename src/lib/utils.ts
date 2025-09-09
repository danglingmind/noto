import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn (...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format date consistently for SSR/CSR compatibility
 * Uses a fixed format to avoid hydration mismatches
 */
export function formatDate (date: string | Date): string {
  const d = new Date(date)

  // Use a consistent format that works the same on server and client
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC' // Use UTC to ensure consistency
  }

  return d.toLocaleDateString('en-US', options)
}
