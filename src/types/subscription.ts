export interface FeatureLimits {
  workspaces: {
    max: number
    unlimited: boolean
  }
  projectsPerWorkspace: {
    max: number
    unlimited: boolean
  }
  filesPerProject: {
    max: number
    unlimited: boolean
  }
  storage: {
    maxGB: number
    unlimited: boolean
  }
  fileSizeLimitMB: {
    max: number
    unlimited: boolean
  }
}

export interface UsageStats {
  workspaces: number
  projects: number
  files: number
  annotations: number
  storageGB: number
}

export interface SubscriptionWithPlan {
  id: string
  userId: string
  planId: string
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  status: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  trialStart: Date | null
  trialEnd: Date | null
  createdAt: Date
  updatedAt: Date
  plan: {
    id: string
    name: string
    displayName: string
    description: string | null
    price: number
    billingInterval: string
    stripePriceId: string | null
    stripeProductId: string | null
    isActive: boolean
    sortOrder: number
    featureLimits: FeatureLimits
  }
  usageRecords: Array<{
    id: string
    feature: string
    usage: number
    limit: number
    period: Date
  }>
}

export interface LimitCheckResult {
  allowed: boolean
  limit: number
  usage: number
  message?: string
}

export interface CreateSubscriptionRequest {
  planId: string
  paymentMethodId?: string
}

export interface CheckLimitsRequest {
  feature: keyof FeatureLimits
  currentUsage: number
}

export interface SubscriptionPlan {
  id: string
  name: string
  displayName: string
  description: string | null
  price: number
  billingInterval: 'MONTHLY' | 'YEARLY'
  stripePriceId: string | null
  stripeProductId: string | null
  isActive: boolean
  sortOrder: number
  featureLimits: FeatureLimits
}

export interface WorkspaceSubscriptionInfo {
  tier: 'FREE' | 'PRO'
  limits: FeatureLimits
  usage: UsageStats
  canUpgrade: boolean
  canDowngrade: boolean
}

export interface ProrationPreview {
  currentPlanCost: number
  newPlanCost: number
  prorationAmount: number
  nextInvoiceAmount: number
  immediateCharge: number
  currency: string
  periodEnd: Date
}

export interface ChangeSubscriptionRequest {
  newPlanId: string
  prorationBehavior?: 'always_invoice' | 'create_prorations' | 'none'
  applyImmediately?: boolean
}

export interface ChangeSubscriptionResponse {
  success: boolean
  subscription?: SubscriptionWithPlan
  prorationPreview?: ProrationPreview
  message?: string
}

