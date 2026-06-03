import Link from 'next/link'

type Item = Record<string, unknown>

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

export function ResultCards({type, items}: {type: 'articles' | 'faqs'; items: Item[]}) {
  if (!items?.length) return null

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => {
        const slug = slugOf(item)
        if (type === 'articles') {
          const title = str(item.title) ?? 'Untitled'
          const card = (
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="font-medium text-gray-900">{title}</p>
              {str(item.summary) && (
                <p className="mt-1 text-sm text-gray-600">{str(item.summary)}</p>
              )}
            </div>
          )
          return (
            <div key={str(item._id) ?? i}>
              {slug ? (
                <Link href={`/articles/${slug}`} className="block hover:border-gray-300">
                  {card}
                </Link>
              ) : (
                card
              )}
            </div>
          )
        }
        return (
          <div key={str(item._id) ?? i} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="font-medium text-gray-900">{str(item.question) ?? 'FAQ'}</p>
            {str(item.answerText) && (
              <p className="mt-1 text-sm text-gray-600">{str(item.answerText)}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
