import { loadStripe } from '@stripe/stripe-js'
import { STRIPE_PUBLISHABLE_KEY } from './stripe'

export const getStripe = () => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    throw new Error('STRIPE_PUBLISHABLE_KEY is not set')
  }
  return loadStripe(STRIPE_PUBLISHABLE_KEY)
}

