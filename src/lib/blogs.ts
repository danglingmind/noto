import 'server-only'

import { promises as fs } from 'fs'
import path from 'path'
import { BlogFrontmatter, BlogListResult, BlogPost, BlogPostMeta } from '@/types/blog'

const BLOG_CONTENT_DIR = path.join(process.cwd(), 'content', 'blogs')
const POSTS_PER_PAGE = 9

function estimateReadingTimeMinutes(content: string): number {
  const words = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length

  return Math.max(1, Math.ceil(words / 200))
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function parseTags(value: string): string[] {
  const normalized = value.trim()

  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    const inner = normalized.slice(1, -1).trim()
    if (!inner) return []

    return inner
      .split(',')
      .map((tag) => stripWrappingQuotes(tag.trim()))
      .filter(Boolean)
  }

  return normalized
    .split(',')
    .map((tag) => stripWrappingQuotes(tag.trim()))
    .filter(Boolean)
}

function parseFrontmatter(frontmatterRaw: string): BlogFrontmatter {
  const lines = frontmatterRaw.split('\n')
  const data: Record<string, string> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf(':')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()

    data[key] = value
  }

  const requiredFields = [
    'title',
    'description',
    'slug',
    'publishedAt',
    'updatedAt',
    'authorName',
    'tags',
    'excerpt',
    'seoTitle',
    'seoDescription',
  ] as const

  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`Missing required frontmatter field: ${field}`)
    }
  }

  return {
    title: stripWrappingQuotes(data.title),
    description: stripWrappingQuotes(data.description),
    slug: stripWrappingQuotes(data.slug),
    publishedAt: stripWrappingQuotes(data.publishedAt),
    updatedAt: stripWrappingQuotes(data.updatedAt),
    authorName: stripWrappingQuotes(data.authorName),
    tags: parseTags(data.tags),
    coverImage: data.coverImage ? stripWrappingQuotes(data.coverImage) : undefined,
    excerpt: stripWrappingQuotes(data.excerpt),
    seoTitle: stripWrappingQuotes(data.seoTitle),
    seoDescription: stripWrappingQuotes(data.seoDescription),
  }
}

function parseMdxFile(fileContent: string): { frontmatter: BlogFrontmatter; content: string } {
  const trimmed = fileContent.trimStart()
  const frontmatterMatch = trimmed.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!frontmatterMatch) {
    throw new Error('Invalid MDX file format. Expected frontmatter wrapped with --- markers.')
  }

  const [, frontmatterRaw, contentRaw] = frontmatterMatch
  const frontmatter = parseFrontmatter(frontmatterRaw)

  return {
    frontmatter,
    content: contentRaw.trim(),
  }
}

function toBlogPostMeta(frontmatter: BlogFrontmatter, content: string): BlogPostMeta {
  return {
    ...frontmatter,
    readingTimeMinutes: estimateReadingTimeMinutes(content),
  }
}

async function readPostFile(fileName: string): Promise<BlogPost> {
  const filePath = path.join(BLOG_CONTENT_DIR, fileName)
  const rawFile = await fs.readFile(filePath, 'utf8')
  const { frontmatter, content } = parseMdxFile(rawFile)

  return {
    ...toBlogPostMeta(frontmatter, content),
    content,
  }
}

export async function getAllPosts(): Promise<BlogPostMeta[]> {
  const files = await fs.readdir(BLOG_CONTENT_DIR)
  const mdxFiles = files.filter((file) => file.endsWith('.mdx'))

  const postPromises = mdxFiles.map(async (fileName) => {
    const post = await readPostFile(fileName)
    return {
      title: post.title,
      description: post.description,
      slug: post.slug,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      authorName: post.authorName,
      tags: post.tags,
      coverImage: post.coverImage,
      excerpt: post.excerpt,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      readingTimeMinutes: post.readingTimeMinutes,
    }
  })

  const posts = await Promise.all(postPromises)

  return posts.sort((a, b) => {
    const aDate = new Date(a.publishedAt).getTime()
    const bDate = new Date(b.publishedAt).getTime()
    return bDate - aDate
  })
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const files = await fs.readdir(BLOG_CONTENT_DIR)
  const mdxFiles = files.filter((file) => file.endsWith('.mdx'))

  for (const fileName of mdxFiles) {
    const post = await readPostFile(fileName)
    if (post.slug === slug) {
      return post
    }
  }

  return null
}

export async function getAllTags(): Promise<string[]> {
  const posts = await getAllPosts()
  const uniqueTags = new Set<string>()

  for (const post of posts) {
    for (const tag of post.tags) {
      uniqueTags.add(tag)
    }
  }

  return Array.from(uniqueTags).sort((a, b) => a.localeCompare(b))
}

export async function getRelatedPosts(slug: string): Promise<BlogPostMeta[]> {
  const posts = await getAllPosts()
  const currentPost = posts.find((post) => post.slug === slug)

  if (!currentPost) return []

  return posts
    .filter((post) => post.slug !== slug)
    .map((post) => {
      const sharedTagsCount = post.tags.filter((tag) => currentPost.tags.includes(tag)).length
      return { post, score: sharedTagsCount }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ post }) => post)
}

export async function getFilteredPosts(params: {
  q?: string
  tag?: string
  page?: string
}): Promise<BlogListResult> {
  const allPosts = await getAllPosts()

  const q = params.q?.trim().toLowerCase() ?? ''
  const tag = params.tag?.trim().toLowerCase() ?? ''
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)

  const filtered = allPosts.filter((post) => {
    const matchesQuery =
      !q ||
      post.title.toLowerCase().includes(q) ||
      post.excerpt.toLowerCase().includes(q) ||
      post.tags.some((postTag) => postTag.toLowerCase().includes(q))

    const matchesTag = !tag || post.tags.some((postTag) => postTag.toLowerCase() === tag)

    return matchesQuery && matchesTag
  })

  const totalPosts = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * POSTS_PER_PAGE
  const end = start + POSTS_PER_PAGE

  return {
    posts: filtered.slice(start, end),
    totalPosts,
    totalPages,
    currentPage,
  }
}
