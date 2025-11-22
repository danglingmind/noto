# Fix: DATABASE_URL Error in Server Component

## Error
```
DATABASE_URL is not defined
at createDatabaseUrl (src/lib/prisma.ts:11:9)
```

## Root Cause
The error occurs when a server component (that uses Prisma) is imported into a client component. Next.js tries to bundle the server component's dependencies into the client bundle, which fails because `DATABASE_URL` is not available on the client.

## Solution Applied

### 1. Server Component Structure
- ✅ `project-files-stream-server.tsx` - Server component (NO 'use client')
- ✅ Uses Prisma via `getProjectData` and `getProjectMembership`
- ✅ Only imported in `page.tsx` (server component)

### 2. Component Hierarchy
```
page.tsx (server)
  └─> ProjectPageClientWrapper (client)
      └─> ProjectPageServerData (client)
          └─> {children} - ProjectFilesStream (server, passed as children)
```

### 3. Key Points
- Server component is **NOT imported** in any client component
- Server component is **passed as children** from server to client
- This is the correct Next.js App Router pattern

## If Error Persists

### Option 1: Clear Build Cache
```bash
rm -rf .next
npm run dev
```

### Option 2: Verify File Structure
- Ensure `project-files-stream-server.tsx` has NO 'use client' directive
- Ensure it's only imported in `page.tsx` (server component)
- Ensure it's passed as children, not imported in client components

### Option 3: Check Environment Variables
- Ensure `DATABASE_URL` is set in `.env.local`
- Restart the dev server after adding environment variables

## Current File Structure

```
src/
├── app/
│   └── project/[id]/
│       └── page.tsx (server) - imports ProjectFilesStream
├── components/
│   ├── project-files-stream-server.tsx (server, NO 'use client')
│   ├── project-page-server-data.tsx (client, receives children)
│   └── project-page-client-wrapper.tsx (client)
```

## Verification Checklist

- [x] Server component has no 'use client' directive
- [x] Server component only imported in server components
- [x] Server component passed as children to client components
- [x] No direct imports of server component in client components
- [x] Prisma only used in server components




