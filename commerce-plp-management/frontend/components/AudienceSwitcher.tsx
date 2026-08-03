'use client'

import {useRouter} from 'next/navigation'
import {useTransition} from 'react'

const COOKIE = 'swag_audience'

const SEGMENTS = [
  {tag: '', label: 'Guest'},
  {tag: 'loyalty-member', label: 'Loyalty'},
]

/**
 * Demo control for the interim variantOverrides personalization. Sets the
 * first-party audience cookie the storefront reads at the edge. In production
 * the segment comes from your identity/edge layer, not a visible switcher.
 */
export function AudienceSwitcher({current}: {current: string | null}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function select(tag: string) {
    document.cookie = `${COOKIE}=${tag}; path=/; max-age=${tag ? 60 * 60 * 24 * 30 : 0}`
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-center gap-1" aria-busy={pending}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-swag-black/50">
        Audience
      </span>
      {SEGMENTS.map((seg) => {
        const active = (current ?? '') === seg.tag
        return (
          <button
            key={seg.label}
            type="button"
            onClick={() => select(seg.tag)}
            className={`px-2 py-1 font-mono text-[10px] uppercase tracking-wider hairline ${
              active ? 'bg-swag-black text-white' : 'bg-white text-swag-black'
            }`}
          >
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}
