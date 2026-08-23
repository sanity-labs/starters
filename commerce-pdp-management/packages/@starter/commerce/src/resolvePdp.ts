import type {AttributeRule, ControlPlane, ResolvedAttribute} from './types'

export type ResolveInput = {
  /** Shopify product tags — the matching input. */
  productTags: string[]
  /** Shopify product type — selects a productTypeScope override, if any. */
  productType?: string | null
  /** The control plane singleton, or null if none is published. */
  controlPlane: ControlPlane | null
}

/**
 * Resolve which attribute rules apply to a product, per the PRD algorithm.
 *
 *  1. Pick the priority list: a matching `productTypeScope` overrides the global
 *     `priorityList`; otherwise use the global list.
 *  2. Walk the list in priority order. A rule matches when ALL of its `tags` are
 *     present on the product AND NONE of its `excludedTags` are.
 *  3. First-match wins within a `category`: once a category has a match, later
 *     rules in the same category are suppressed.
 *  4. Sort the matched set by each rule's `order` for display.
 *
 * Only `approved` rules are considered (the control plane query already filters
 * to approved, but we guard here too so the resolver is safe in isolation).
 */
export function resolveAttributeRules(input: ResolveInput): ResolvedAttribute[] {
  const {controlPlane} = input
  if (!controlPlane) return []

  const tagSet = new Set(input.productTags)
  const priority = selectPriorityList(controlPlane, input.productType)

  const seenCategories = new Set<string>()
  const matched: AttributeRule[] = []

  for (const rule of priority) {
    if (rule.status !== 'approved') continue
    if (seenCategories.has(rule.category)) continue
    if (!ruleMatches(rule, tagSet)) continue

    matched.push(rule)
    seenCategories.add(rule.category)
  }

  return matched
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((rule) => ({
      ruleId: rule._id,
      category: rule.category,
      name: rule.name,
      description: rule.description ?? null,
      iconUrl: rule.iconUrl ?? null,
      order: rule.order,
    }))
}

/** A rule matches when every included tag is present and no excluded tag is. */
function ruleMatches(rule: AttributeRule, productTags: Set<string>): boolean {
  const includesAll = rule.tags.every((tag) => productTags.has(tag))
  if (!includesAll) return false
  const excludedHit = rule.excludedTags.some((tag) => productTags.has(tag))
  return !excludedHit
}

/**
 * Choose the effective priority list. If the product's type matches a
 * `productTypeScope`, reorder the global rules by that scope's `ruleIds`
 * (rules absent from the scope are appended in their global order).
 */
function selectPriorityList(
  controlPlane: ControlPlane,
  productType: string | null | undefined,
): AttributeRule[] {
  const scope = productType
    ? controlPlane.productTypeScopes?.find((s) => s.productType === productType)
    : undefined
  if (!scope?.ruleIds?.length) return controlPlane.priorityList

  const byId = new Map(controlPlane.priorityList.map((rule) => [rule._id, rule]))
  const scoped: AttributeRule[] = []
  for (const id of scope.ruleIds) {
    const rule = byId.get(id)
    if (rule) {
      scoped.push(rule)
      byId.delete(id)
    }
  }
  return [...scoped, ...byId.values()]
}
