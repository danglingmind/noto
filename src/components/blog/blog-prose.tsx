import { Fragment, ReactNode } from 'react'
import { cn } from '@/lib/utils'

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^\)]+\))/g)

  return parts.map((part, index) => {
    if (!part) return null

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`code-${index}`} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`strong-${index}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/)
    if (linkMatch) {
      const [, label, href] = linkMatch
      return (
        <a key={`link-${index}`} href={href} className="underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground" target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
          {label}
        </a>
      )
    }

    return <Fragment key={`text-${index}`}>{part}</Fragment>
  })
}

interface BlogProseProps {
  content: string
  className?: string
}

export function BlogProse({ content, className }: BlogProseProps) {
  const lines = content.split('\n')
  const nodes: ReactNode[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1

      nodes.push(
        <pre key={`pre-${i}`} className="overflow-x-auto rounded-lg border bg-muted p-4 text-sm">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    if (trimmed.startsWith('### ')) {
      nodes.push(
        <h3 key={`h3-${i}`} className="mt-7 text-xl font-semibold tracking-tight">
          {renderInline(trimmed.replace(/^###\s+/, ''))}
        </h3>
      )
      i += 1
      continue
    }

    if (trimmed.startsWith('## ')) {
      nodes.push(
        <h2 key={`h2-${i}`} className="mt-10 text-2xl font-semibold tracking-tight">
          {renderInline(trimmed.replace(/^##\s+/, ''))}
        </h2>
      )
      i += 1
      continue
    }

    if (trimmed.startsWith('# ')) {
      nodes.push(
        <h1 key={`h1-${i}`} className="mt-12 text-3xl font-semibold tracking-tight">
          {renderInline(trimmed.replace(/^#\s+/, ''))}
        </h1>
      )
      i += 1
      continue
    }

    if (trimmed.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().replace(/^-\s+/, ''))
        i += 1
      }

      nodes.push(
        <ul key={`ul-${i}`} className="my-5 list-disc space-y-2 pl-6 text-[15px] leading-7 text-foreground/90">
          {items.map((item, index) => (
            <li key={`li-${index}`}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (trimmed.startsWith('> ')) {
      nodes.push(
        <blockquote key={`blockquote-${i}`} className="my-6 border-l-2 border-black/20 pl-4 text-[15px] italic text-foreground/80">
          {renderInline(trimmed.replace(/^>\s+/, ''))}
        </blockquote>
      )
      i += 1
      continue
    }

    const paragraphLines = [trimmed]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s+|-\s+|>\s+|```)/.test(lines[i].trim())) {
      paragraphLines.push(lines[i].trim())
      i += 1
    }

    nodes.push(
      <p key={`p-${i}`} className="my-4 text-[15px] leading-7 text-foreground/90">
        {renderInline(paragraphLines.join(' '))}
      </p>
    )
  }

  return <div className={cn('max-w-none', className)}>{nodes}</div>
}
