# Database - Use Prisma Accelerate URL (get this from Prisma Console)
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=your_accelerate_api_key"

# Direct Database URL (for migrations only)
DIRECT_URL="postgresql://username:password@localhost:5432/noto"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe Configuration
# Use test keys for development, live keys for production
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Product and Price IDs
# Pro Plan (Monthly)
STRIPE_PRO_PRODUCT_ID=prod_...
STRIPE_PRO_PRICE_ID=price_...

# Pro Plan (Annual)
STRIPE_ANNUAL_PRO_PRODUCT_ID=prod_...
STRIPE_ANNUAL_PRO_PRICE_ID=price_1SXDtbE1HozQ7dZMLHaxPoTG

# Cron Jobs
CRON_SECRET=your_secure_random_string_here
