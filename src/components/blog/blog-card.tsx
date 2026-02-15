import Image from 'next/image'
import Link from 'next/link'
import { Calendar, Clock, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { BlogPostMeta } from '@/types/blog'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

interface BlogCardProps {
  post: BlogPostMeta
  featured?: boolean
}

export function BlogCard({ post, featured = false }: BlogCardProps) {
  const hasImage = Boolean(post.coverImage)

  return (
    <Card className="overflow-hidden border-[#f0f0f0] bg-white py-0 shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/blogs/${post.slug}`} className="block">
        <div className={featured && hasImage ? 'grid md:grid-cols-2' : ''}>
          {hasImage ? (
            <div className={featured ? 'relative min-h-[240px]' : 'relative min-h-[180px]'}>
              <Image
                src={post.coverImage!}
                alt={post.title}
                fill
                className="object-cover"
                sizes={featured ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 100vw, 33vw'}
              />
            </div>
          ) : null}

          <div className="flex flex-col">
            <CardHeader className="gap-3 px-5 py-5 md:px-6 md:py-6">
              <div className="flex flex-wrap gap-2">
                {post.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-full bg-black/5 text-[11px] font-medium text-black">
                    {tag}
                  </Badge>
                ))}
              </div>
              <CardTitle className={featured ? 'text-2xl leading-tight' : 'text-lg leading-tight'}>{post.title}</CardTitle>
            </CardHeader>

            <CardContent className="px-5 pb-4 md:px-6">
              <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
            </CardContent>

            <CardFooter className="mt-auto flex flex-wrap items-center gap-4 border-t px-5 py-4 text-xs text-muted-foreground md:px-6">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {post.authorName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(post.publishedAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {post.readingTimeMinutes} min read
              </span>
            </CardFooter>
          </div>
        </div>
      </Link>
    </Card>
  )
}
