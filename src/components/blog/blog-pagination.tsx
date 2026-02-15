import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface BlogPaginationProps {
  currentPage: number
  totalPages: number
  q?: string
  tag?: string
}

function createHref(page: number, q?: string, tag?: string): string {
  const params = new URLSearchParams()

  if (q) params.set('q', q)
  if (tag) params.set('tag', tag)
  if (page > 1) params.set('page', String(page))

  const query = params.toString()
  return query ? `/blogs?${query}` : '/blogs'
}

export function BlogPagination({ currentPage, totalPages, q, tag }: BlogPaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
      <Button asChild variant="outline" size="sm" disabled={currentPage <= 1}>
        <Link href={createHref(Math.max(1, currentPage - 1), q, tag)}>Previous</Link>
      </Button>

      {pages.map((page) => (
        <Button key={page} asChild variant={page === currentPage ? 'default' : 'outline'} size="sm">
          <Link href={createHref(page, q, tag)}>{page}</Link>
        </Button>
      ))}

      <Button asChild variant="outline" size="sm" disabled={currentPage >= totalPages}>
        <Link href={createHref(Math.min(totalPages, currentPage + 1), q, tag)}>Next</Link>
      </Button>
    </div>
  )
}
