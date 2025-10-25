import { STRIPE_ENV } from './stripe'
import { StripeEnvironmentConfig } from '@/types/stripe'

// Stripe product and price IDs for different environments
export const STRIPE_PRODUCTS: StripeEnvironmentConfig = {
  test: {
    pro: {
      priceId: 'price_1SM1jfSOzfdP0mOgD9aBgg5q',
      productId: 'prod_TIcz74D1je7aLe',
    },
    enterprise: {
      priceId: 'price_1SM3fCSOzfdP0mOgVO2ziyt2', 
      productId: 'prod_TIezOAkSu5QqZs',
    },
  },
  live: {
    pro: {
      priceId: 'price_1S8vvaE1HozQ7dZMPe7PDOGm',
      productId: 'prod_TIezOAkSu5QqZs',
    },
    enterprise: {
      priceId: 'price_1S8vwpE1HozQ7dZMzR4vb8wJ',
      productId: 'prod_T569JnWCRi6q9E',
    },
  },
}

// Get current environment's product IDs
export const getStripeProductIds = () => {
  return STRIPE_PRODUCTS[STRIPE_ENV as keyof StripeEnvironmentConfig]
}

// Helper function to get product IDs for a specific plan
export const getStripeProductId = (planName: 'pro' | 'enterprise') => {
  const products = getStripeProductIds()
  return products[planName]
}
