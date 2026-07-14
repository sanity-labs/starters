import type {AdminClient} from './admin'
import type {CollectionEnrichment} from '../types'

/**
 * The `sanity_plp_collection` metaobject is the contract between Sanity and
 * Shopify. Per the PRD decision, the push-sync writes ONE metaobject per
 * collection (not per-product metafields) so the whole enrichment payload lands
 * in a single Admin API call and is readable by the Shopify ecosystem.
 *
 * This definition is version-controlled here and must be kept in sync with the
 * Shopify Admin. `pnpm shopify:setup` idempotently creates/updates it.
 */
export const METAOBJECT_TYPE = 'sanity_plp_collection'

export const METAOBJECT_DEFINITION = {
  type: METAOBJECT_TYPE,
  name: 'Sanity PLP Collection',
  description: 'Editorial enrichment authored in Sanity and synced on publish.',
  fieldDefinitions: [
    // NOTE: `handle` is reserved by Shopify (every metaobject has a built-in
    // handle), so the collection handle is stored as `collection_handle`. The
    // metaobject's own handle is also set to the collection handle on upsert.
    {key: 'collection_handle', name: 'Collection handle', type: 'single_line_text_field'},
    {key: 'collection_type', name: 'Collection type', type: 'single_line_text_field'},
    {key: 'banner', name: 'Banner (JSON)', type: 'json'},
    {key: 'faceout', name: 'Faceout (JSON)', type: 'json'},
    {key: 'editorial_tiles', name: 'Editorial tiles (JSON)', type: 'json'},
    {key: 'badges', name: 'Badges (JSON)', type: 'json'},
    {key: 'facet_config', name: 'Facet config (JSON)', type: 'json'},
    {key: 'product_list', name: 'Product list (JSON)', type: 'json'},
    {key: 'synced_at', name: 'Synced at', type: 'date_time'},
  ],
} as const

export type MetaobjectField = {key: string; value: string}

/** Serialize an enrichment document into metaobject fields. */
export function buildMetaobjectFields(enrichment: CollectionEnrichment): MetaobjectField[] {
  const json = (value: unknown) => JSON.stringify(value ?? null)
  return [
    {key: 'collection_handle', value: enrichment.handle},
    {key: 'collection_type', value: enrichment.collectionType},
    {key: 'banner', value: json(enrichment.banner)},
    {key: 'faceout', value: json(enrichment.faceout)},
    {key: 'editorial_tiles', value: json(enrichment.editorialTiles)},
    {key: 'badges', value: json(enrichment.badges)},
    {key: 'facet_config', value: json(enrichment.facetConfig)},
    {key: 'product_list', value: json(enrichment.productList)},
    {key: 'synced_at', value: new Date().toISOString()},
  ]
}

/**
 * Create the metaobject definition if it does not already exist. Idempotent:
 * an "already taken" error is treated as success.
 */
export async function ensureMetaobjectDefinition(admin: AdminClient): Promise<void> {
  const query = /* GraphQL */ `
    mutation CreateDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          id
          type
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `
  const data = await admin.request<{
    metaobjectDefinitionCreate: {
      metaobjectDefinition: {id: string; type: string} | null
      userErrors: {field: string[]; message: string; code: string}[]
    }
  }>(query, {
    definition: {
      type: METAOBJECT_DEFINITION.type,
      name: METAOBJECT_DEFINITION.name,
      description: METAOBJECT_DEFINITION.description,
      fieldDefinitions: METAOBJECT_DEFINITION.fieldDefinitions.map((f) => ({
        key: f.key,
        name: f.name,
        type: f.type,
      })),
    },
  })

  const errors = data.metaobjectDefinitionCreate.userErrors
  const alreadyExists = errors.some((e) => e.code === 'TAKEN')
  if (errors.length && !alreadyExists) {
    throw new Error(
      `Failed to create metaobject definition: ${errors.map((e) => e.message).join('; ')}`,
    )
  }
}

/**
 * Upsert the collection's metaobject by handle. Uses `metaobjectUpsert` so the
 * same call creates or updates. Returns the metaobject id.
 */
export async function upsertCollectionMetaobject(
  admin: AdminClient,
  enrichment: CollectionEnrichment,
): Promise<string> {
  const query = /* GraphQL */ `
    mutation UpsertMetaobject(
      $handle: MetaobjectHandleInput!
      $metaobject: MetaobjectUpsertInput!
    ) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject {
          id
          handle
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `
  const data = await admin.request<{
    metaobjectUpsert: {
      metaobject: {id: string; handle: string} | null
      userErrors: {field: string[]; message: string; code: string}[]
    }
  }>(query, {
    handle: {type: METAOBJECT_TYPE, handle: enrichment.handle},
    metaobject: {fields: buildMetaobjectFields(enrichment)},
  })

  const errors = data.metaobjectUpsert.userErrors
  if (errors.length || !data.metaobjectUpsert.metaobject) {
    throw new Error(`Failed to upsert metaobject: ${errors.map((e) => e.message).join('; ')}`)
  }
  return data.metaobjectUpsert.metaobject.id
}
