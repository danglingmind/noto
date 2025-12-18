# Running Database Migrations on Vercel

This guide explains how to apply Prisma database migrations to your production database on Vercel.

## Prerequisites

- Your Vercel project is connected to your repository
- Environment variables are configured in Vercel:
  - `DATABASE_URL` - Your Prisma Accelerate connection string
  - `DIRECT_URL` - Your direct PostgreSQL connection string (required for migrations)

## Method 1: Run Migrations During Build (Recommended)

This method automatically runs migrations every time you deploy to Vercel.

### Step 1: Update your `package.json` build script

Add migration step to your build command:

```json
{
  "scripts": {
    "build": "prisma migrate deploy && prisma generate && next build --turbopack"
  }
}
```

Or use the migration script:

```json
{
  "scripts": {
    "build": "npm run db:migrate:prod && next build --turbopack"
  }
}
```

### Step 2: Configure Vercel Build Settings

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Build & Development Settings**
3. Ensure your **Build Command** is set to: `npm run build`
4. Ensure your **Install Command** is set to: `npm install`

### Step 3: Deploy

When you push to your main branch or create a deployment, migrations will run automatically during the build process.

**Note:** This method runs migrations on every deployment. If you want more control, use Method 2 or 3.

---

## Method 2: Run Migrations via Vercel CLI (Manual)

This method gives you full control over when migrations run.

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Link your project

```bash
vercel link
```

### Step 4: Pull environment variables

```bash
vercel env pull .env.local
```

This downloads your production environment variables locally.

### Step 5: Run migrations

```bash
# Using the migration script
npm run db:migrate:prod

# Or directly with Prisma
npx prisma migrate deploy
```

**Important:** Make sure your `.env.local` file has the `DIRECT_URL` variable set, as migrations require a direct database connection (not through Prisma Accelerate).

---

## Method 3: Create a Migration API Route (On-Demand)

This method allows you to trigger migrations via an API endpoint.

### Step 1: Create the migration API route

Create `src/app/api/admin/migrate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

/**
 * POST /api/admin/migrate
 * Run database migrations
 * SECURITY: Protect this endpoint with authentication and authorization
 */
export async function POST(req: NextRequest) {
  try {
    // TODO: Add authentication check
    // const { userId } = await auth()
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    // TODO: Add authorization check (only admins)
    // const user = await prisma.users.findUnique({ where: { clerkId: userId } })
    // if (user?.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // }

    if (!process.env.DIRECT_URL) {
      return NextResponse.json(
        { error: 'DIRECT_URL not configured' },
        { status: 500 }
      )
    }

    // Run migrations
    const output = execSync('npx prisma migrate deploy', {
      encoding: 'utf-8',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DIRECT_URL
      }
    })

    return NextResponse.json({
      success: true,
      output: output.split('\n')
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

### Step 2: Call the endpoint

```bash
curl -X POST https://your-app.vercel.app/api/admin/migrate \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

**⚠️ Security Warning:** This endpoint should be protected with authentication and authorization. Only allow trusted admins to access it.

---

## Method 4: Use Vercel Post-Deploy Hook

You can use Vercel's deployment hooks to trigger migrations after deployment.

### Step 1: Create a migration webhook endpoint

Create `src/app/api/webhooks/migrate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

/**
 * POST /api/webhooks/migrate
 * Triggered by Vercel deployment webhook
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.MIGRATION_WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.DIRECT_URL) {
      return NextResponse.json(
        { error: 'DIRECT_URL not configured' },
        { status: 500 }
      )
    }

    const output = execSync('npx prisma migrate deploy', {
      encoding: 'utf-8',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DIRECT_URL
      }
    })

    return NextResponse.json({
      success: true,
      output: output.split('\n')
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

### Step 2: Configure Vercel Deployment Hook

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Git**
3. Add a **Deployment Hook** that calls: `https://your-app.vercel.app/api/webhooks/migrate`
4. Set the `MIGRATION_WEBHOOK_SECRET` environment variable in Vercel

---

## Recommended Approach

For most use cases, **Method 1** (run migrations during build) is the simplest and most reliable:

1. ✅ Automatic - runs on every deployment
2. ✅ No additional infrastructure needed
3. ✅ Migrations are version-controlled with your code
4. ✅ Easy to rollback by reverting the deployment

### When to Use Other Methods

- **Method 2**: When you need to run migrations manually or on-demand
- **Method 3**: When you want to trigger migrations from external systems
- **Method 4**: When you want migrations to run after deployment completes (not during build)

---

## Troubleshooting

### Error: "DIRECT_URL is required for migrations"

**Solution:** Make sure `DIRECT_URL` is set in your Vercel environment variables. This should be your direct PostgreSQL connection string (not the Prisma Accelerate URL).

### Error: "Migration failed: P3005"

**Solution:** This usually means the database schema is out of sync. Try:
```bash
npx prisma migrate resolve --applied <migration_name>
```

### Error: "Migration failed: P3015"

**Solution:** This means a migration file is missing. Check your `prisma/migrations` directory and ensure all migration files are committed to git.

### Migrations are slow

**Solution:** Migrations use the `DIRECT_URL` connection, which may be slower than Prisma Accelerate. This is expected and normal.

---

## Best Practices

1. **Always test migrations locally first** using `npm run db:migrate`
2. **Backup your database** before running migrations in production
3. **Use migration scripts** for complex migrations that require data transformations
4. **Monitor deployments** to ensure migrations complete successfully
5. **Keep migrations small** - break large changes into multiple migrations
6. **Never edit applied migrations** - create new migrations instead

---

## Current Migration Status

To check which migrations have been applied:

```bash
npx prisma migrate status
```

To see pending migrations:

```bash
npx prisma migrate list
```

