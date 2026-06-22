import {useQuery} from '@sanity/sdk-react'
import {useMemo, useState} from 'react'

// One query, authenticated as the logged-in staff user via the Dashboard
// session — no token needed, and it reads the private dataset. Filtering is
// done client-side over the (small) internal content set.
const BROWSE_QUERY = `*[_type in ["playbook", "policy"]] | order(importance desc, title asc){
  _id, _type, title, importance,
  "category": internalCategory->title,
  "topics": topics[]->title
}`

interface BrowseItem {
  _id: string
  _type: 'playbook' | 'policy'
  title: string | null
  importance: string | null
  category: string | null
  topics: (string | null)[] | null
}

export function BrowsePanel() {
  const {data, isPending} = useQuery({query: BROWSE_QUERY})
  const items = useMemo(() => (data ?? []) as unknown as BrowseItem[], [data])

  const [importance, setImportance] = useState<string>('all')
  const [category, setCategory] = useState<string>('all')

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[],
    [items],
  )

  const filtered = items.filter(
    (i) =>
      (importance === 'all' || i.importance === importance) &&
      (category === 'all' || i.category === category),
  )

  return (
    <div style={{padding: 24}}>
      <h2 style={{margin: '0 0 4px', fontSize: 18}}>Internal knowledge</h2>
      <p style={{margin: '0 0 16px', color: '#6b7280', fontSize: 13}}>
        Playbooks and policies for customer-facing teams.
      </p>

      <div style={{display: 'flex', gap: 12, marginBottom: 16, fontSize: 13}}>
        <label>
          Importance{' '}
          <select value={importance} onChange={(e) => setImportance(e.target.value)}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="standard">Standard</option>
          </select>
        </label>
        <label>
          Category{' '}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isPending && <p style={{color: '#9ca3af'}}>Loading…</p>}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {filtered.map((item) => (
          <li key={item._id} style={{border: '1px solid #e5e7eb', borderRadius: 8, padding: 12}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <strong style={{fontSize: 14}}>{item.title}</strong>
              {item.importance === 'critical' && (
                <span
                  style={{
                    fontSize: 11,
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    borderRadius: 4,
                    padding: '1px 6px',
                  }}
                >
                  critical
                </span>
              )}
            </div>
            <div style={{fontSize: 12, color: '#6b7280', marginTop: 4}}>
              {item._type} · {item.category ?? 'Uncategorized'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
