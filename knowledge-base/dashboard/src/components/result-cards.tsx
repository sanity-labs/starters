type Item = Record<string, unknown>

const LABELS: Record<string, string> = {
  articles: 'Help article',
  faqs: 'FAQ',
  playbooks: 'Playbook',
  policies: 'Policy',
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function ResultCards({type, items}: {type: string; items: Item[]}) {
  if (!items?.length) return null
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
      {items.map((item, i) => {
        const title = str(item.title) ?? str(item.question) ?? 'Untitled'
        const critical = item.importance === 'critical'
        return (
          <div
            key={str(item._id) ?? i}
            style={{border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff'}}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <span style={{fontSize: 11, textTransform: 'uppercase', color: '#9ca3af'}}>
                {LABELS[type] ?? type}
              </span>
              {critical && <span style={{fontSize: 11, color: '#b91c1c'}}>critical</span>}
            </div>
            <p style={{margin: '4px 0 0', fontWeight: 500, color: '#111827'}}>{title}</p>
            {str(item.summary) && (
              <p style={{margin: '4px 0 0', fontSize: 13, color: '#6b7280'}}>{str(item.summary)}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
