import type {Banner, CollectionEnrichment, EditorialTile, Faceout, VariantOverride} from './types'

export type ResolvedEnrichmentView = {
  banner: Banner | null
  faceout: Faceout | null
  editorialTiles: EditorialTile[]
  audienceTag: string | null
}

/**
 * Interim Content Variants resolution.
 *
 * Selects the matching `variantOverride` for the visitor's audience tag and
 * layers it over the base enrichment. Because all variant content ships in the
 * GROQ response, this is only appropriate for non-sensitive segmentation
 * (loyalty vs. new visitor). When Content Variants ships, delete this file and
 * resolve variants via the API instead — the `variantOverrides` array becomes a
 * reference array to Content Variant documents.
 */
export function resolveEnrichmentForAudience(
  enrichment: CollectionEnrichment,
  audienceTag?: string | null,
): ResolvedEnrichmentView {
  const base: ResolvedEnrichmentView = {
    banner: enrichment.banner ?? null,
    faceout: enrichment.faceout ?? null,
    editorialTiles: enrichment.editorialTiles ?? [],
    audienceTag: null,
  }

  if (!audienceTag || !enrichment.variantOverrides?.length) return base

  const override: VariantOverride | undefined = enrichment.variantOverrides.find(
    (v) => v.audienceTag === audienceTag,
  )
  if (!override) return base

  return {
    banner: override.banner ?? base.banner,
    faceout: override.faceout ?? base.faceout,
    editorialTiles: override.editorialTiles?.length ? override.editorialTiles : base.editorialTiles,
    audienceTag,
  }
}
