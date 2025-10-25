import { loadStripe } from '@stripe/stripe-js'
import { STRIPE_PUBLISHABLE_KEY } from './stripe'

export const getStripe = () => {
  return loadStripe(STRIPE_PUBLISHABLE_KEY)
}

