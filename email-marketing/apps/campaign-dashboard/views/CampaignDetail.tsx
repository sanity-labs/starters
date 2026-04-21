import {useQuery} from '@sanity/sdk-react'

const CAMPAIGN_DETAIL_QUERY = `
  *[_type == "campaign" && _id == $id][0] {
    _id,
    _createdAt,
    title,
    primaryMessage,
    startDate,
    endDate,
    "urgencyStage": urgencyStage->{title},
    "segments": segments[]->{_id, name, engagementTier},
    "promotions": *[_type == "promotion" && campaign._ref == ^._id] | order(isBasePromotion desc) {
      _id,
      subjectLine,
      preheader,
      isBasePromotion,
      "segment": segment->{_id, name, engagementTier},
      "workflowStatus": *[_type == "workflow.state" && promotionId._ref == ^._id][0].status,
      "sentAt": *[_type == "workflow.state" && promotionId._ref == ^._id][0].sentAt,
      campaignPerformance,
    }
  }
`

type Promotion = {
  _id: string
  subjectLine: string | null
  preheader: string | null
  isBasePromotion: boolean | null
  segment: {_id: string; name: string | null; engagementTier: string | null} | null
  workflowStatus: string | null
  sentAt: string | null
  campaignPerformance: {
    openRate: number | null
    clickThroughRate: number | null
    conversionRate: number | null
  } | null
}

type CampaignWithPromotions = {
  _id: string
  _createdAt: string
  title: string | null
  primaryMessage: string | null
  startDate: string | null
  endDate: string | null
  urgencyStage: {title: string | null} | null
  segments: Array<{_id: string; name: string | null; engagementTier: string | null}> | null
  promotions: Promotion[] | null
}

const STATUS_STYLES: Record<string, {background: string; color: string}> = {
  draft: {background: '#f3f4f6', color: '#374151'},
  'in-review': {background: '#fef3c7', color: '#92400e'},
  approved: {background: '#d1fae5', color: '#065f46'},
  sent: {background: '#dbeafe', color: '#1e40af'},
  rejected: {background: '#fee2e2', color: '#991b1b'},
}

function Metric({label, value}: {label: string; value: string}) {
  return (
    <div
      style={{textAlign: 'center', padding: '12px 16px', background: '#f9fafb', borderRadius: 8}}
    >
      <div style={{fontSize: 22, fontWeight: 700}}>{value}</div>
      <div style={{fontSize: 11, color: '#6b7280', marginTop: 2}}>{label}</div>
    </div>
  )
}

export function CampaignDetail({campaignId, onBack}: {campaignId: string; onBack: () => void}) {
  const {data: campaign} = useQuery<CampaignWithPromotions | null>({
    query: CAMPAIGN_DETAIL_QUERY,
    params: {id: campaignId},
  })

  if (!campaign) return <p style={{color: '#999', fontSize: 14}}>Campaign not found.</p>

  const promotions = campaign.promotions ?? []
  const base = promotions.find((p) => p.isBasePromotion)
  const variants = promotions.filter((p) => !p.isBasePromotion)
  const allSent = promotions.filter((p) => p.workflowStatus === 'sent')

  const avgOpenRate =
    allSent.length > 0
      ? allSent.reduce((s, p) => s + (p.campaignPerformance?.openRate ?? 0), 0) / allSent.length
      : null
  const avgCtr =
    allSent.length > 0
      ? allSent.reduce((s, p) => s + (p.campaignPerformance?.clickThroughRate ?? 0), 0) /
        allSent.length
      : null

  const approved = promotions.filter(
    (p) => p.workflowStatus === 'approved' || p.workflowStatus === 'sent',
  ).length
  const coverage = promotions.length > 0 ? `${approved}/${promotions.length}` : '—'

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          padding: 0,
          fontSize: 14,
          marginBottom: 16,
        }}
      >
        ← Campaigns
      </button>

      <h1 style={{fontSize: 22, fontWeight: 600, marginBottom: 4}}>
        {campaign.title ?? 'Untitled'}
      </h1>
      {campaign.urgencyStage?.title && (
        <p style={{color: '#6b7280', fontSize: 13, marginBottom: 16}}>
          {campaign.urgencyStage.title}
        </p>
      )}
      {campaign.primaryMessage && (
        <p style={{fontSize: 14, color: '#374151', marginBottom: 20, maxWidth: 560}}>
          {campaign.primaryMessage}
        </p>
      )}

      <div
        style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32}}
      >
        <Metric label="Variant Coverage" value={coverage} />
        <Metric
          label="Avg Open Rate"
          value={avgOpenRate != null ? `${avgOpenRate.toFixed(1)}%` : '—'}
        />
        <Metric label="Avg CTR" value={avgCtr != null ? `${avgCtr.toFixed(1)}%` : '—'} />
      </div>

      {base && <PromotionRow promotion={base} label="Base" />}
      {variants.map((p) => (
        <PromotionRow key={p._id} promotion={p} />
      ))}
    </div>
  )
}

function PromotionRow({promotion: p, label}: {promotion: Promotion; label?: string}) {
  const status = p.workflowStatus ?? 'draft'
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['draft']
  const segmentLabel = label ?? p.segment?.name ?? 'Unassigned'

  return (
    <div
      style={{
        borderBottom: '1px solid #f0f0f0',
        padding: '14px 0',
        display: 'grid',
        gridTemplateColumns: '180px 1fr auto',
        gap: 16,
        alignItems: 'start',
      }}
    >
      <div>
        <div style={{fontSize: 13, fontWeight: 500}}>{segmentLabel}</div>
        {p.segment?.engagementTier && !p.isBasePromotion && (
          <div style={{fontSize: 11, color: '#9ca3af', marginTop: 2}}>
            {p.segment.engagementTier}
          </div>
        )}
        <span
          style={{
            display: 'inline-block',
            marginTop: 6,
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 11,
            ...style,
          }}
        >
          {status.replace('-', ' ')}
        </span>
      </div>
      <div>
        {p.subjectLine ? (
          <div style={{fontSize: 14, fontWeight: 500}}>{p.subjectLine}</div>
        ) : (
          <div style={{fontSize: 14, color: '#9ca3af', fontStyle: 'italic'}}>No subject line</div>
        )}
        {p.preheader && (
          <div style={{fontSize: 13, color: '#6b7280', marginTop: 2}}>{p.preheader}</div>
        )}
      </div>
      {p.campaignPerformance && (
        <div style={{fontSize: 12, color: '#6b7280', textAlign: 'right'}}>
          {p.campaignPerformance.openRate != null && (
            <div>{p.campaignPerformance.openRate.toFixed(1)}% open</div>
          )}
          {p.campaignPerformance.clickThroughRate != null && (
            <div>{p.campaignPerformance.clickThroughRate.toFixed(1)}% CTR</div>
          )}
        </div>
      )}
    </div>
  )
}
