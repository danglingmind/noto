import type { Metadata } from 'next'
import Link from 'next/link'
import { Montserrat } from 'next/font/google'
import { SupportFooter } from '@/components/support/support-footer'
import { SupportHeader } from '@/components/support/support-header'
import { BlogCard } from '@/components/blog/blog-card'
import { BlogFilters } from '@/components/blog/blog-filters'
import { BlogHero } from '@/components/blog/blog-hero'
import { BlogPagination } from '@/components/blog/blog-pagination'
import { Button } from '@/components/ui/button'
import { getAllPosts, getAllTags, getFilteredPosts } from '@/lib/blogs'
import { landingTheme } from '@/lib/landing-theme'
import { BlogQueryParams } from '@/types/blog'

const theme = landingTheme
const BASE_URL = 'https://vynl.in'

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'VYNL Blogs | Website Review, Annotation, and Collaboration Guides',
  description:
    'Read compact, practical guides from VYNL on website review workflows, annotation best practices, and collaboration systems for design and product teams.',
  keywords:
    'website review blog, annotation workflow, design feedback process, collaboration best practices, visual feedback guides',
  alternates: {
    canonical: `${BASE_URL}/blogs`,
  },
  openGraph: {
    title: 'VYNL Blogs',
    description:
      'Actionable guides on website feedback and collaboration workflows.',
    url: `${BASE_URL}/blogs`,
    type: 'website',
    images: [
      {
        url: '/vynl-logo.png',
        width: 1200,
        height: 630,
        alt: 'VYNL Blogs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VYNL Blogs',
    description: 'Actionable guides on website feedback and collaboration workflows.',
    images: ['/vynl-logo.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<BlogQueryParams>
}) {
  const params = await searchParams
  const [allPosts, allTags, filteredResult] = await Promise.all([
    getAllPosts(),
    getAllTags(),
    getFilteredPosts(params),
  ])

  const featuredPost = !params.q && !params.tag && filteredResult.currentPage === 1 ? allPosts[0] : null
  const postsToRender = featuredPost
    ? filteredResult.posts.filter((post) => post.slug !== featuredPost.slug)
    : filteredResult.posts

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'VYNL Blogs',
    description:
      'Practical articles about website review tools, annotation strategy, and team collaboration workflows.',
    url: `${BASE_URL}/blogs`,
    inLanguage: 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      name: 'VYNL',
      url: BASE_URL,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: filteredResult.posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${BASE_URL}/blogs/${post.slug}`,
        name: post.title,
      })),
    },
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

        <BlogHero totalPosts={allPosts.length} />

        <BlogFilters tags={allTags} currentTag={params.tag} currentQuery={params.q} />

        <main className="px-4 pb-16">
          <div className="container mx-auto max-w-6xl px-6">
            {featuredPost ? (
              <section className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-tight">Featured article</h2>
                </div>
                <BlogCard post={featuredPost} featured />
              </section>
            ) : null}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Latest posts</h2>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {filteredResult.totalPosts} result{filteredResult.totalPosts === 1 ? '' : 's'}
                </p>
              </div>

              {postsToRender.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e5e5e5] bg-white p-8 text-center">
                  <p className="mb-4 text-sm text-muted-foreground">No posts matched your filters.</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/blogs">Reset filters</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {postsToRender.map((post) => (
                    <BlogCard key={post.slug} post={post} />
                  ))}
                </div>
              )}

              <BlogPagination
                currentPage={filteredResult.currentPage}
                totalPages={filteredResult.totalPages}
                q={params.q}
                tag={params.tag}
              />
            </section>
          </div>
        </main>

        <SupportFooter />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionSchema),
        }}
      />
    </>
  )
}
