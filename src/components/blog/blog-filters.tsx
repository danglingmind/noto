import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface BlogFiltersProps {
  tags: string[]
  currentTag?: string
  currentQuery?: string
}

function buildHref(params: { q?: string; tag?: string; page?: string }): string {
  const searchParams = new URLSearchParams()

  if (params.q) searchParams.set('q', params.q)
  if (params.tag) searchParams.set('tag', params.tag)
  if (params.page) searchParams.set('page', params.page)

  const query = searchParams.toString()
  return query ? `/blogs?${query}` : '/blogs'
}

export function BlogFilters({ tags, currentTag, currentQuery }: BlogFiltersProps) {
  return (
    <section className="px-4 py-8">
      <div className="container mx-auto max-w-6xl px-6">
        <form action="/blogs" method="get" className="mb-5">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search topics, workflows, and guides"
              defaultValue={currentQuery ?? ''}
              className="h-10 rounded-lg border-[#f0f0f0] bg-white pl-9"
            />
            {currentTag ? <input type="hidden" name="tag" value={currentTag} /> : null}
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          <Link href={buildHref({ q: currentQuery })}>
            <Badge variant={!currentTag ? 'default' : 'outline'} className="rounded-full px-3 py-1 text-xs">
              All
            </Badge>
          </Link>
          {tags.map((tag) => {
            const isActive = currentTag?.toLowerCase() === tag.toLowerCase()

            return (
              <Link key={tag} href={buildHref({ q: currentQuery, tag })}>
                <Badge variant={isActive ? 'default' : 'outline'} className="rounded-full px-3 py-1 text-xs">
                  {tag}
                </Badge>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
