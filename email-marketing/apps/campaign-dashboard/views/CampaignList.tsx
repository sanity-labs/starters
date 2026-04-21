import {useQuery} from '@sanity/sdk-react'

const CAMPAIGNS_QUERY = `
  *[_type == "campaign"] | order(startDate desc) {
    _id,
    _createdAt,
    title,
    startDate,
    endDate,
    "urgencyStage": urgencyStage->{title},
    "promotionCount": count(*[_type == "promotion" && campaign._ref == ^._id]),
    "approvedCount": count(*[_type == "workflow.state" && status == "approved" &&
      promotionId._ref in *[_type == "promotion" && campaign._ref == ^._id]._id]),
    "sentCount": count(*[_type == "workflow.state" && status == "sent" &&
      promotionId._ref in *[_type == "promotion" && campaign._ref == ^._id]._id]),
    "avgOpenRate": math::avg(*[_type == "promotion" && campaign._ref == ^._id &&
      defined(campaignPerformance.openRate)].campaignPerformance.openRate),
  }
`

type Campaign = {
  _id: string
  _createdAt: string
  title: string | null
  startDate: string | null
  endDate: string | null
  urgencyStage: {title: string | null} | null
  promotionCount: number
  approvedCount: number
  sentCount: number
  avgOpenRate: number | null
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
}

export function CampaignList({onSelect}: {onSelect: (id: string) => void}) {
  const {data: campaigns} = useQuery<Campaign[]>({query: CAMPAIGNS_QUERY})
  const list = campaigns ?? []

  return (
    <div>
      <h1 style={{fontSize: 24, fontWeight: 600, marginBottom: 4}}>Campaigns</h1>
      <p style={{color: '#666', fontSize: 14, marginBottom: 24}}>
        {list.length} campaign{list.length !== 1 ? 's' : ''}
      </p>

      {list.length === 0 ? (
        <p style={{color: '#999', fontSize: 14}}>No campaigns yet.</p>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 14}}>
          <thead>
            <tr style={{borderBottom: '2px solid #e5e5e5'}}>
              {['Campaign', 'Urgency', 'Dates', 'Coverage', 'Avg Open Rate'].map((h) => (
                <th
                  key={h}
                  style={{textAlign: 'left', padding: '8px 12px', color: '#444', fontWeight: 600}}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const coverage =
                c.promotionCount > 0 ? `${c.approvedCount + c.sentCount}/${c.promotionCount}` : '—'
              const openRate = c.avgOpenRate != null ? `${c.avgOpenRate.toFixed(1)}%` : '—'

              return (
                <tr
                  key={c._id}
                  style={{borderBottom: '1px solid #f0f0f0', cursor: 'pointer'}}
                  onClick={() => onSelect(c._id)}
                >
                  <td style={{padding: '10px 12px', fontWeight: 500}}>{c.title ?? 'Untitled'}</td>
                  <td style={{padding: '10px 12px', color: '#666'}}>
                    {c.urgencyStage?.title ?? '—'}
                  </td>
                  <td style={{padding: '10px 12px', color: '#666'}}>
                    {c.startDate
                      ? `${formatDate(c.startDate)}${c.endDate ? ` – ${formatDate(c.endDate)}` : ''}`
                      : '—'}
                  </td>
                  <td style={{padding: '10px 12px'}}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 12,
                        background:
                          c.approvedCount + c.sentCount === c.promotionCount && c.promotionCount > 0
                            ? '#d1fae5'
                            : '#f3f4f6',
                        color:
                          c.approvedCount + c.sentCount === c.promotionCount && c.promotionCount > 0
                            ? '#065f46'
                            : '#374151',
                      }}
                    >
                      {coverage}
                    </span>
                  </td>
                  <td style={{padding: '10px 12px', color: '#666'}}>{openRate}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
