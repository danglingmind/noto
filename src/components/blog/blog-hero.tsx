import { Sparkles } from 'lucide-react'

interface BlogHeroProps {
  totalPosts: number
}

export function BlogHero({ totalPosts }: BlogHeroProps) {
  return (
    <section className="bg-black px-4 py-16 md:py-20">
      <div className="container mx-auto max-w-4xl px-6 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 px-3 py-1 text-xs font-medium tracking-wide text-white/80">
          <Sparkles className="h-3.5 w-3.5" />
          SEO Knowledge Hub
        </div>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
          VYNL Blogs
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-white/80 md:text-base md:leading-7">
          Practical guides for website feedback, annotation workflows, and collaboration systems. Build faster review cycles and improve design clarity.
        </p>
        <p className="mt-6 text-xs uppercase tracking-wide text-white/60">
          {totalPosts} published articles
        </p>
      </div>
    </section>
  )
}
