# Multiple Price IDs Implementation Plan

## Overview
Implement country-based pricing using multiple Stripe price IDs per product, with automatic country detection and price selection.

## Current Architecture Analysis

### Current Price ID Usage Points:
1. **Checkout Session Creation** (`src/lib/subscription.ts:592-613`)
   - Uses single `stripeConfig.priceId` from environment variables
   - Currently validates USD currency only

2. **Proration Service** (`src/lib/proration.ts:159-330`)
   - Uses `newPlan.stripePriceId` for subscription updates
   - Needs to handle country-specific price IDs

3. **Plan Configuration** (`config/plans.json`)
   - Single `stripePriceIdEnv` per plan/billing interval
   - Environment variables: `STRIPE_PRO_PRICE_ID`, `STRIPE_ANNUAL_PRO_PRICE_ID`

4. **Price ID Lookup** (`src/lib/stripe-plan-config.ts`)
   - `getPlanNameByPriceId()` - reverse lookup from price ID to plan
   - Currently only handles single price ID per plan

5. **Webhook Handlers** (if any)
   - Need to identify webhook handlers that process price IDs
   - Must handle any price ID from the country-specific set

## Implementation Requirements

### 1. Country Detection Strategy

**Options:**
- **A. IP Geolocation** (Recommended)
  - Use service like `@vercel/functions` geo headers or `geoip-lite`
  - Pros: Automatic, no user input needed
  - Cons: Can be inaccurate with VPNs
  
- **B. Browser Locale/Headers**
  - Use `Accept-Language` header or `navigator.language`
  - Pros: Client-side, fast
  - Cons: User can change browser settings
  
- **C. User Preference**
  - Store country in user profile
  - Pros: Most accurate
  - Cons: Requires user input, extra UI

**Recommended: Hybrid Approach**
- Primary: IP Geolocation (server-side)
- Fallback: Browser locale (client-side)
- Optional: User preference override

### 2. Price ID Mapping Structure

**Configuration Format:**
```json
{
  "pricing": {
    "monthly": {
      "price": 29,
      "currency": "USD",
      "stripePriceIds": {
        "default": "STRIPE_PRO_PRICE_ID_USD",
        "countries": {
          "IN": "STRIPE_PRO_PRICE_ID_INR",
          "GB": "STRIPE_PRO_PRICE_ID_GBP",
          "EU": "STRIPE_PRO_PRICE_ID_EUR"
        }
      }
    }
  }
}
```

**Environment Variables:**
```env
# Default (USD)
STRIPE_PRO_PRICE_ID_USD=price_xxx
STRIPE_ANNUAL_PRO_PRICE_ID_USD=price_xxx

# India (INR)
STRIPE_PRO_PRICE_ID_INR=price_yyy
STRIPE_ANNUAL_PRO_PRICE_ID_INR=price_yyy

# UK (GBP)
STRIPE_PRO_PRICE_ID_GBP=price_zzz
STRIPE_ANNUAL_PRO_PRICE_ID_GBP=price_zzz

# EU (EUR)
STRIPE_PRO_PRICE_ID_EUR=price_aaa
STRIPE_ANNUAL_PRO_PRICE_ID_EUR=price_aaa
```

### 3. Code Changes Required

#### A. New Files to Create

1. **`src/lib/country-detection.ts`**
   - Country detection utilities
   - IP geolocation service
   - Browser locale parsing
   - Country code normalization (ISO 3166-1 alpha-2)

2. **`src/lib/price-id-resolver.ts`**
   - Resolve price ID based on country and plan
   - Handle country-to-price-ID mapping
   - Fallback logic (default country if no match)
   - Reverse lookup: price ID → country → plan

3. **`src/types/pricing.ts`** (if needed)
   - Type definitions for country-based pricing

#### B. Files to Modify

1. **`config/plans.json`**
   - Update structure to support `stripePriceIds` object
   - Add country mappings
   - Maintain backward compatibility

2. **`src/lib/subscription.ts`**
   - `createSubscription()`: Accept country parameter, use price resolver
   - Remove/enhance USD-only validation
   - Update checkout session creation

3. **`src/lib/proration.ts`**
   - `updateSubscriptionWithProration()`: Handle country-specific prices
   - Consider country when switching plans

4. **`src/lib/stripe-plan-config.ts`**
   - Update `getPlanNameByPriceId()` to handle multiple price IDs
   - Create reverse lookup map for all country price IDs

5. **`src/lib/plan-adapter.ts`**
   - Update `toSubscriptionPlan()` to support country parameter
   - Resolve price ID based on country

6. **`src/lib/plan-config-service.ts`**
   - Add methods to get country-specific price IDs
   - Validate country mappings

7. **`src/app/api/subscriptions/route.ts`**
   - Extract country from request (headers, IP)
   - Pass country to subscription service

8. **`src/app/pricing/page.tsx`**
   - Detect country on client side
   - Display country-specific pricing
   - Pass country when creating subscription

9. **`env.example`**
   - Add all country-specific price ID variables
   - Document country codes

#### C. Webhook Handlers (if exist)

- Update any webhook handlers to use reverse lookup
- Handle any price ID from country-specific set
- Map price ID back to plan correctly

### 4. Database Considerations

**No schema changes needed** - Price IDs are stored in environment variables, not database.

**Considerations:**
- Store user's country preference (optional enhancement)
- Track which country price was used for subscription (metadata)

### 5. Testing Requirements

1. **Unit Tests:**
   - Country detection logic
   - Price ID resolution
   - Fallback mechanisms
   - Reverse lookup

2. **Integration Tests:**
   - Checkout flow with different countries
   - Subscription creation with country-specific prices
   - Proration with country changes

3. **Manual Testing:**
   - Test with VPN to simulate different countries
   - Verify correct price ID selection
   - Test fallback to default

## Implementation Effort Breakdown

### Phase 1: Foundation (2-3 hours)
- [ ] Create country detection service
- [ ] Create price ID resolver
- [ ] Update plans.json structure
- [ ] Update environment variables structure

### Phase 2: Core Subscription Logic (3-4 hours)
- [ ] Update `subscription.ts` to use country-based pricing
- [ ] Update `plan-adapter.ts` for country support
- [ ] Update `stripe-plan-config.ts` for reverse lookup
- [ ] Remove/enhance currency validation

### Phase 3: API & Frontend (2-3 hours)
- [ ] Update subscription API to detect country
- [ ] Update pricing page for country detection
- [ ] Display country-specific pricing
- [ ] Pass country to subscription creation

### Phase 4: Proration & Edge Cases (2-3 hours)
- [ ] Update proration service for country prices
- [ ] Handle country changes during subscription
- [ ] Update webhook handlers (if needed)
- [ ] Error handling and fallbacks

### Phase 5: Testing & Documentation (2-3 hours)
- [ ] Write unit tests
- [ ] Integration testing
- [ ] Update documentation
- [ ] Update setup instructions

**Total Estimated Effort: 11-16 hours**

## Edge Cases & Considerations

1. **Country Detection Failure**
   - Fallback to default (USD) price
   - Log detection failures for monitoring

2. **Country Not Supported**
   - Use default price ID
   - Consider adding new countries easily

3. **User Changes Location**
   - Keep existing subscription on original price
   - New subscriptions use new country's price
   - Consider proration if switching mid-cycle

4. **Webhook Processing**
   - Must handle any price ID from country set
   - Reverse lookup must work for all price IDs

5. **Pricing Display**
   - Show correct currency symbol
   - Format prices according to locale
   - Handle currency conversion display (if showing USD equivalent)

6. **Stripe Dashboard Setup**
   - Create prices for each country/currency
   - Ensure all prices are on same product
   - Document price IDs for each country

## Migration Strategy

1. **Backward Compatibility**
   - Support old `stripePriceIdEnv` format
   - Migrate gradually
   - Default to USD if country not detected

2. **Rollout Plan**
   - Start with 2-3 countries (e.g., US, IN, EU)
   - Add more countries incrementally
   - Monitor price ID selection accuracy

## Dependencies

**New Packages (if needed):**
- `geoip-lite` or similar for IP geolocation (optional)
- Or use Vercel's built-in geo headers
- Or use browser's `Intl` API

**No new packages required** if using:
- Vercel geo headers (if deployed on Vercel)
- Browser `navigator.language`
- Request headers (`Accept-Language`)

## Risk Assessment

**Low Risk:**
- Country detection (can fallback)
- Price ID resolution (straightforward mapping)

**Medium Risk:**
- Reverse lookup for webhooks (must handle all price IDs)
- Proration with country changes (edge case)

**Mitigation:**
- Comprehensive testing
- Fallback mechanisms
- Logging for debugging

## Success Criteria

1. ✅ User from India sees INR pricing
2. ✅ User from US sees USD pricing
3. ✅ Checkout uses correct country-specific price ID
4. ✅ Webhooks process subscriptions correctly regardless of price ID
5. ✅ Proration works with country-specific prices
6. ✅ Fallback to default price if country not detected
7. ✅ Easy to add new countries

