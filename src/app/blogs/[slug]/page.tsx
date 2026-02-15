import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Montserrat } from 'next/font/google'
import { Calendar, Clock, User } from 'lucide-react'
import { BlogCard } from '@/components/blog/blog-card'
import { BlogProse } from '@/components/blog/blog-prose'
import { SupportFooter } from '@/components/support/support-footer'
import { SupportHeader } from '@/components/support/support-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getAllPosts, getPostBySlug, getRelatedPosts } from '@/lib/blogs'
import { landingTheme } from '@/lib/landing-theme'

const BASE_URL = 'https://vynl.in'
const theme = landingTheme

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
})

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    return {
      title: 'Blog Post Not Found | VYNL',
      description: 'The requested blog post could not be found.',
    }
  }

  const canonical = `${BASE_URL}/blogs/${post.slug}`

  return {
    title: post.seoTitle,
    description: post.seoDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      type: 'article',
      url: canonical,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.authorName],
      tags: post.tags,
      ...(post.coverImage
        ? {
            images: [
              {
                url: post.coverImage,
                width: 1200,
                height: 630,
                alt: post.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle,
      description: post.seoDescription,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const relatedPosts = await getRelatedPosts(post.slug)
  const canonical = `${BASE_URL}/blogs/${post.slug}`

  const blogPostingSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url: canonical,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'VYNL',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/vynl-logo.png`,
      },
    },
    keywords: post.tags.join(', '),
    mainEntityOfPage: canonical,
  }
  if (post.coverImage) {
    blogPostingSchema.image = `${BASE_URL}${post.coverImage}`
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --bg-primary: ${theme.colors.background.primary};
              --text-primary: ${theme.colors.text.primary};
              --text-secondary: ${theme.colors.text.secondary};
              --text-tertiary: ${theme.colors.text.tertiary};
              --accent-border: ${theme.colors.accent.border};
            }
          `,
        }}
      />

      <div
        className={`min-h-screen ${montserrat.variable}`}
        style={{
          backgroundColor: 'rgba(248, 247, 243, 1)',
          color: 'var(--text-primary)',
          fontFamily: theme.fonts.body,
        }}
      >
        <SupportHeader />

        <main className="px-4 py-10 md:py-14">
          <article className="container mx-auto max-w-4xl rounded-xl border border-[#f0f0f0] bg-white p-6 md:p-10">
            <div className="mb-6 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="rounded-full bg-black/5">
                  {tag}
                </Badge>
              ))}
            </div>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{post.title}</h1>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{post.description}</p>

            <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
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
            </div>

            {post.coverImage ? (
              <div className="relative mt-8 h-[260px] overflow-hidden rounded-lg border border-[#f0f0f0] md:h-[360px]">
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 896px"
                  priority
                />
              </div>
            ) : null}

            <Separator className="my-8" />
            <BlogProse content={post.content} />
          </article>

          <section className="container mx-auto mt-8 max-w-4xl rounded-xl border border-[#f0f0f0] bg-white p-6 md:p-8">
            <h2 className="text-xl font-semibold tracking-tight">Turn Feedback Into Faster Approvals</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Use VYNL to annotate websites and images, collaborate with stakeholders, and reduce review cycles.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild size="sm">
                <Link href="/sign-up">Start free</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/support">Visit support</Link>
              </Button>
            </div>
          </section>

          {relatedPosts.length > 0 ? (
            <section className="container mx-auto mt-8 max-w-6xl">
              <div className="mb-4 flex items-center justify-between px-1">
                <h2 className="text-xl font-semibold tracking-tight">Related posts</h2>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/blogs">All blogs</Link>
                </Button>
              </div>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                  <BlogCard key={relatedPost.slug} post={relatedPost} />
                ))}
              </div>
            </section>
          ) : null}
        </main>

        <SupportFooter />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogPostingSchema),
        }}
      />
    </>
  )
}
