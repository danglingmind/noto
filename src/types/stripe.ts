export type StripeEnvironment = 'test' | 'live'

export interface StripeProductIds {
  priceId: string
  productId: string
}

export interface StripeEnvironmentConfig {
  test: {
    pro: StripeProductIds
    enterprise: StripeProductIds
  }
  live: {
    pro: StripeProductIds
    enterprise: StripeProductIds
  }
}

export interface StripeKeys {
  secretKey: string
  publishableKey: string
  webhookSecret: string
}
