import {useCallback, useMemo, useState} from 'react'
import {set, unset, type ObjectInputProps} from 'sanity'
import {Autocomplete, Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {SearchIcon, TrashIcon} from '@sanity/icons'

/**
 * Object-level input that searches the Shopify catalog by name and stores the
 * selected product's GID plus a cached title/image for display in Studio.
 *
 * Uses the public Storefront token (SANITY_STUDIO_SHOPIFY_*), so it runs safely
 * in the browser. We call the Storefront API directly here rather than importing
 * @starter/commerce to keep the Studio bundle free of the Node-oriented client.
 */

type ProductValue = {
  _type?: string
  productGid?: string
  productTitle?: string
  productImageUrl?: string
}

type Suggestion = {value: string; gid: string; title: string; imageUrl?: string}

const DOMAIN = process.env.SANITY_STUDIO_SHOPIFY_STORE_DOMAIN
const TOKEN = process.env.SANITY_STUDIO_SHOPIFY_STOREFRONT_TOKEN
const API_VERSION = process.env.SANITY_STUDIO_SHOPIFY_STOREFRONT_API_VERSION || '2025-07'

const SEARCH_QUERY = /* GraphQL */ `
  query PickerSearch($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        featuredImage {
          url
        }
      }
    }
  }
`

async function searchShopify(term: string): Promise<Suggestion[]> {
  if (!DOMAIN || !TOKEN) return []
  const res = await fetch(`https://${DOMAIN}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN,
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: {query: term ? `title:*${term}*` : '', first: 10},
    }),
  })
  if (!res.ok) return []
  const json = await res.json()
  const nodes = json?.data?.products?.nodes ?? []
  return nodes.map((n: {id: string; title: string; featuredImage?: {url: string}}) => ({
    value: n.id,
    gid: n.id,
    title: n.title,
    imageUrl: n.featuredImage?.url,
  }))
}

export function ProductPickerInput(props: ObjectInputProps<ProductValue>) {
  const {value, onChange, schemaType} = props
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)

  const configured = Boolean(DOMAIN && TOKEN)

  const handleSearch = useCallback(async (term: string) => {
    setLoading(true)
    try {
      setSuggestions(await searchShopify(term))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelect = useCallback(
    (gid: string) => {
      const picked = suggestions.find((s) => s.gid === gid)
      if (!picked) return
      onChange(
        set({
          _type: schemaType.name,
          productGid: picked.gid,
          productTitle: picked.title,
          productImageUrl: picked.imageUrl,
        }),
      )
    },
    [onChange, schemaType.name, suggestions],
  )

  const handleClear = useCallback(() => onChange(unset()), [onChange])

  const options = useMemo(
    () => suggestions.map((s) => ({value: s.value, title: s.title})),
    [suggestions],
  )

  return (
    <Stack space={3}>
      {value?.productGid ? (
        <Card padding={3} radius={2} tone="primary" border>
          <Flex align="center" gap={3}>
            {value.productImageUrl ? (
              <img
                src={value.productImageUrl}
                alt=""
                width={40}
                height={40}
                style={{objectFit: 'cover', borderRadius: 3}}
              />
            ) : null}
            <Box flex={1}>
              <Text weight="semibold" size={1}>
                {value.productTitle || 'Selected product'}
              </Text>
              <Text size={0} muted>
                {value.productGid}
              </Text>
            </Box>
            <Button
              icon={TrashIcon}
              mode="bleed"
              tone="critical"
              onClick={handleClear}
              aria-label="Clear selection"
            />
          </Flex>
        </Card>
      ) : null}

      {configured ? (
        <Autocomplete
          id={`${props.id}-product-picker`}
          icon={SearchIcon}
          loading={loading}
          options={options}
          placeholder="Search products by name…"
          filterOption={() => true}
          onQueryChange={(q) => handleSearch(q ?? '')}
          onSelect={handleSelect}
          renderOption={(option) => (
            <Card as="button" padding={3} radius={2}>
              <Text size={1}>{(option as {title?: string}).title ?? option.value}</Text>
            </Card>
          )}
          openButton
        />
      ) : (
        <Card padding={3} radius={2} tone="caution" border>
          <Text size={1}>
            Set SANITY_STUDIO_SHOPIFY_STORE_DOMAIN and SANITY_STUDIO_SHOPIFY_STOREFRONT_TOKEN in
            studio/.env to search the catalog.
          </Text>
        </Card>
      )}
    </Stack>
  )
}
