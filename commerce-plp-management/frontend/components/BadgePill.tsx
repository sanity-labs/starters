import type {ResolvedBadge} from '@starter/commerce/types'

const BADGE_BG: Record<string, string> = {
  sale: 'bg-swag-orange text-swag-black',
  new: 'bg-swag-blue text-white',
  'final-sale': 'bg-swag-black text-white',
  'best-seller': 'bg-swag-yellow text-swag-black',
  neutral: 'bg-swag-gray text-white',
}

export function BadgePill({badge}: {badge: ResolvedBadge}) {
  const cls = BADGE_BG[badge.color] ?? BADGE_BG.neutral
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}
    >
      {badge.icon ? <span aria-hidden>{badge.icon}</span> : null}
      {badge.label}
    </span>
  )
}
