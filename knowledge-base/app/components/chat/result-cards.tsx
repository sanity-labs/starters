import Link from 'next/link'

type Item = Record<string, unknown>
export type CardType = 'products' | 'faqs' | 'policies' | 'articles'

function slugOf(item: Item): string | undefined {
  const slug = item.slug
  if (typeof slug === 'string') return slug
  if (slug && typeof slug === 'object' && 'current' in slug) {
    return String((slug as {current: unknown}).current)
  }
  return undefined
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function Card({children}: {children: React.ReactNode}) {
  return <div className="rounded-sm border border-border-faint bg-bg-card p-3">{children}</div>
}

export function ResultCards({type, items}: {type: CardType; items: Item[]}) {
  if (!items?.length) return null

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const key = str(item._id) ?? i
        if (type === 'articles') {
          const title = str(item.title) ?? 'Untitled'
          const slug = slugOf(item)
          const card = (
            <Card>
              <p className="font-medium text-fg-base">{title}</p>
              {str(item.summary) && (
                <p className="mt-1 text-sm text-fg-muted">{str(item.summary)}</p>
              )}
            </Card>
          )
          return <div key={key}>{slug ? <Link href={`/articles/${slug}`}>{card}</Link> : card}</div>
        }
        if (type === 'products') {
          const price = num(item.priceMonthly)
          return (
            <Card key={key}>
              <p className="font-medium text-fg-base">{str(item.title) ?? 'Product'}</p>
              <p className="mt-1 font-mono text-micro uppercase tracking-wide text-fg-subtle">
                {[str(item.planTier), price !== undefined && `$${price}/mo`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {str(item.description) && (
                <p className="mt-1 text-sm text-fg-muted">{str(item.description)}</p>
              )}
            </Card>
          )
        }
        if (type === 'policies') {
          return (
            <Card key={key}>
              <p className="font-medium text-fg-base">{str(item.title) ?? 'Policy'}</p>
              <p className="mt-1 font-mono text-micro uppercase tracking-wide text-fg-subtle">
                {[str(item.importance), str(item.owner)].filter(Boolean).join(' · ')}
              </p>
              {str(item.summary) && (
                <p className="mt-1 text-sm text-fg-muted">{str(item.summary)}</p>
              )}
            </Card>
          )
        }
        return (
          <Card key={key}>
            <p className="font-medium text-fg-base">{str(item.question) ?? 'FAQ'}</p>
            {str(item.answerText) && (
              <p className="mt-1 text-sm text-fg-muted">{str(item.answerText)}</p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
