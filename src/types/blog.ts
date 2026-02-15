export interface BlogFrontmatter {
  title: string
  description: string
  slug: string
  publishedAt: string
  updatedAt: string
  authorName: string
  tags: string[]
  coverImage?: string
  excerpt: string
  seoTitle: string
  seoDescription: string
}

export interface BlogPostMeta extends BlogFrontmatter {
  readingTimeMinutes: number
}

export interface BlogPost extends BlogPostMeta {
  content: string
}

export interface BlogQueryParams {
  q?: string
  tag?: string
  page?: string
}

export interface BlogListResult {
  posts: BlogPostMeta[]
  totalPosts: number
  totalPages: number
  currentPage: number
}
