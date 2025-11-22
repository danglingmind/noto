# Quick Database Setup Guide

## 🎯 You need to replace the placeholders in your `.env` file

### Step 1: Get Supabase Credentials

1. **Go to**: https://supabase.com/dashboard/projects
2. **Select your project** or create a new one
3. **Get these values**:

#### Database Connection (Settings → Database):
```
Host: db.[PROJECT-REF].supabase.co
Database: postgres
Port: 5432
User: postgres
Password: [YOUR-PASSWORD]
```

#### API Keys (Settings → API):
```
Project URL: https://[PROJECT-REF].supabase.co
anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Update Your `.env` File

Replace these placeholders in your `.env` file:

```env
# Replace [YOUR-PASSWORD] with your Supabase database password
# Replace [PROJECT-REF] with your Supabase project reference (like: abcdefghijklmnop)
# Replace [YOUR-ANON-KEY] with your Supabase anon key
# Replace [YOUR-SERVICE-ROLE-KEY] with your Supabase service role key

DATABASE_URL="postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ACTUAL_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_ACTUAL_SERVICE_ROLE_KEY
```

### Step 3: Test the Connection

After updating your `.env` file:

```bash
# Test the database connection
npm run db:push

# If successful, seed some data
npm run db:seed

# Start the development server
npm run dev
```

### 🔧 If you want to use Prisma Accelerate (optional):

1. Go to https://console.prisma.io
2. Create/select your project
3. Add your Supabase connection string
4. Enable Accelerate
5. Replace `DATABASE_URL` with your Accelerate URL
6. Add `DIRECT_URL` with your direct Supabase connection

## ❌ Common Issues:

1. **"Can't reach database server"** → Check your DATABASE_URL
2. **"Authentication failed"** → Check your password
3. **"Database does not exist"** → Make sure you're using "postgres" as the database name
4. **"Connection refused"** → Check your project reference and URL

## ✅ Success Indicators:

- `npm run db:push` completes without errors
- You can see tables created in Supabase dashboard
- Development server starts without database errors
