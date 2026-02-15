import Link from 'next/link'
import { SupportHeader } from '@/components/support/support-header'
import { SupportFooter } from '@/components/support/support-footer'
import { Button } from '@/components/ui/button'

export default function BlogPostNotFound() {
  return (
    <div className="min-h-screen bg-[#f8f7f3]">
      <SupportHeader />
      <main className="container mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Blog post not found</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          The article you requested does not exist or has moved.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/blogs">Browse blogs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </main>
      <SupportFooter />
    </div>
  )
}
