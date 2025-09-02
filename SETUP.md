# Noto - Setup Guide

This is the MVP setup guide for the Noto collaborative feedback and annotation platform.

## Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database (or Supabase account)
- Clerk account for authentication

## Environment Setup

1. **Copy environment variables:**
   ```bash
   cp env.example .env.local
   ```

2. **Configure your environment variables in `.env.local`:**

### Database (Prisma Accelerate + Supabase)
```
# Get this from your Prisma Console (https://console.prisma.io)
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=your_accelerate_api_key"

# Your direct Supabase connection (for migrations)
DIRECT_URL="postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres"
```

### Clerk Authentication
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Prisma Accelerate Setup

1. **Go to your Prisma Console**: https://console.prisma.io
2. **Create a new project** or use your existing project
3. **Connect your database**: Add your Supabase connection string
4. **Enable Accelerate**: Get your Accelerate connection string
5. **Copy the API key**: You'll need this for your `DATABASE_URL`

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma client:**
   ```bash
   npm run db:generate
   ```

3. **Push database schema:**
   ```bash
   npm run db:push
   ```

4. **Seed the database (optional):**
   ```bash
   npm run db:seed
   ```

## Development

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Commands

- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations  
- `npm run db:push` - Push schema changes to database
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

## Project Structure

```
noto/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts               # Database seed script
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/             # API routes (BFF layer)
│   │   ├── dashboard/       # Dashboard page
│   │   ├── workspace/[id]/  # Workspace pages
│   │   ├── project/[id]/    # Project pages
│   │   └── layout.tsx       # Root layout
│   ├── components/          # React components
│   │   ├── ui/             # Shadcn UI components
│   │   └── *.tsx           # App-specific components
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utility libraries
│       ├── prisma.ts       # Prisma client
│       ├── supabase.ts     # Supabase client
│       └── auth.ts         # Auth utilities
└── public/                 # Static assets
```

## MVP Features Included

✅ **Phase 1 (MVP) - Core Features:**
- User Authentication (Clerk)
- Workspace Management
- Project Creation
- File Upload Infrastructure
- Basic Annotation System
- Visual Commenting
- Team Collaboration
- Secure Data Storage

## Next Steps

After completing the setup:

1. **Configure Supabase Storage:**
   - Create a storage bucket named "files"
   - Set up proper RLS policies

2. **Test the Application:**
   - Create an account
   - Create a workspace
   - Create a project
   - Upload a file (when file upload UI is implemented)

3. **Phase 2 Development:**
   - File & Folder Organization
   - Real-time Notifications  
   - Task Status Management
   - Chrome Extension

## Troubleshooting

### Common Issues:

1. **Database Connection Issues:**
   - Verify DATABASE_URL is correct
   - Ensure database is accessible
   - Check Supabase project is active

2. **Authentication Issues:**
   - Verify Clerk keys are correct
   - Check domain settings in Clerk dashboard

3. **Build Issues:**
   - Run `npm run db:generate` after schema changes
   - Clear `.next` folder and rebuild

## Support

For development questions or issues, refer to:
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
