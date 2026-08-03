import type {BadgeAssignment, BadgeType, ResolvedBadge} from './types'

/**
 * A badge is active when now is within [startDate, endDate]. Missing bounds are
 * treated as open-ended. Date-gating is enforced at render time so a scheduled
 * "Final Sale" badge appears and disappears without republishing.
 */
export function isBadgeActive(assignment: BadgeAssignment, now: Date = new Date()): boolean {
  const start = assignment.startDate ? new Date(assignment.startDate) : null
  const end = assignment.endDate ? new Date(assignment.endDate) : null
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

function badgeTypeFromSlug(slug: string): BadgeType {
  const known: BadgeType[] = ['sale', 'new', 'final-sale', 'best-seller']
  return known.includes(slug as BadgeType) ? (slug as BadgeType) : 'custom'
}

/**
 * Build a map of product GID -> active badges, resolving the referenced badge
 * vocabulary. Assignments whose badge reference failed to resolve are skipped.
 */
export function resolveBadgeMap(
  assignments: BadgeAssignment[] | null | undefined,
  now: Date = new Date(),
): Map<string, ResolvedBadge[]> {
  const map = new Map<string, ResolvedBadge[]>()
  if (!assignments) return map

  for (const assignment of assignments) {
    if (!assignment.productGid || !assignment.badge) continue
    if (!isBadgeActive(assignment, now)) continue

    const type = badgeTypeFromSlug(assignment.badge.slug)
    const label =
      type === 'custom' && assignment.customLabel ? assignment.customLabel : assignment.badge.label

    const resolved: ResolvedBadge = {
      type,
      label,
      color: assignment.badge.color,
      icon: assignment.badge.icon ?? null,
    }

    const existing = map.get(assignment.productGid)
    if (existing) existing.push(resolved)
    else map.set(assignment.productGid, [resolved])
  }

  return map
}
