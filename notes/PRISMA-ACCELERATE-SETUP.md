# Prisma Accelerate Setup Guide

This guide will help you set up Prisma Accelerate for your Noto application to get connection pooling, query caching, and improved performance.

## Step 1: Access Prisma Console

1. Go to [Prisma Console](https://console.prisma.io)
2. Sign in with your account or create a new one
3. You should see your project dashboard

## Step 2: Configure Your Database Connection

### If you haven't connected a database yet:

1. **Click "Connect a database"**
2. **Choose "PostgreSQL"**
3. **Enter your Supabase connection details:**
   ```
   Host: db.[your-project-id].supabase.co
   Port: 5432
   Database: postgres
   Username: postgres
   Password: [your-supabase-password]
   ```

### If you already have a database connected:
- You should see it in your project dashboard

## Step 3: Enable Accelerate

1. **Navigate to "Accelerate" in the sidebar**
2. **Click "Enable Accelerate"**
3. **Choose your region** (closest to your deployment)
4. **Wait for Accelerate to be provisioned** (usually takes 1-2 minutes)

## Step 4: Get Your Connection String

1. **Once Accelerate is enabled**, you'll see:
   - ✅ Connection pooling enabled
   - ✅ Query caching enabled
   - Your Accelerate connection string

2. **Copy the connection string** - it looks like:
   ```
   prisma://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Step 5: Update Your Environment Variables

1. **Create or update your `.env.local` file:**
   ```bash
   cp env.example .env.local
   ```

2. **Add your Prisma Accelerate URL:**
   ```env
   # Prisma Accelerate connection (for your app)
   DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY_HERE"
   
   # Direct database connection (for migrations only)
   DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres"
   ```

## Step 6: Test the Connection

1. **Generate Prisma client:**
   ```bash
   npm run db:generate
   ```

2. **Push your schema to the database:**
   ```bash
   npm run db:push
   ```

3. **Seed your database (optional):**
   ```bash
   npm run db:seed
   ```

4. **Start your development server:**
   ```bash
   npm run dev
   ```

## Step 7: Verify Accelerate is Working

1. **Check the Prisma Console dashboard**
2. **Look for metrics like:**
   - Query response times
   - Cache hit rates
   - Connection pool usage

3. **In your application logs**, you should see faster query responses

## Benefits You'll Get

✅ **Connection Pooling**: Efficient database connections
✅ **Query Caching**: Faster repeated queries  
✅ **Global Edge Network**: Reduced latency
✅ **Monitoring & Analytics**: Query performance insights
✅ **Automatic Scaling**: Handles traffic spikes

## Troubleshooting

### Common Issues:

1. **"Environment variable not found: DATABASE_URL"**
   - Make sure your `.env.local` file is in the project root
   - Verify the environment variable names match exactly

2. **"Connection failed"**
   - Check your Supabase database is running
   - Verify your DIRECT_URL has the correct credentials
   - Ensure your IP is allowed in Supabase (if using IP restrictions)

3. **"API key invalid"**
   - Copy the full Accelerate connection string from Prisma Console
   - Make sure you didn't truncate the API key

### Need Help?

- [Prisma Accelerate Documentation](https://www.prisma.io/docs/accelerate)
- [Prisma Console Support](https://console.prisma.io)
- [Supabase Documentation](https://supabase.com/docs)

## Performance Tips

1. **Use caching strategically** - Accelerate automatically caches queries
2. **Monitor your metrics** in Prisma Console
3. **Use connection pooling** for high-traffic applications
4. **Consider query optimization** for complex queries

Your Noto application is now configured with Prisma Accelerate for optimal database performance! 🚀
