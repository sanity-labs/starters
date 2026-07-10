import {createReadStream} from 'node:fs'
import {resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import type {SanityClient} from '@sanity/client'
import {fixtureProvider, runSync, type SyncClient} from '@starter/analytics-sync'
import {articles} from './articles'

const IMAGES_DIR = resolve(import.meta.dirname!, 'images')

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function toPortableText(paragraphs: string[]) {
  return paragraphs.map((text) => ({
    _type: 'block',
    _key: randomUUID(),
    style: 'normal',
    markDefs: [],
    children: [{_type: 'span', _key: randomUUID(), text, marks: []}],
  }))
}

// Seed the demo dataset: categories, authors, articles (with uploaded images),
// then run the analytics sync so the companion `articlePerformance` documents,
// triage queue, and trending rail are all populated on first run.
export async function seed(client: SanityClient): Promise<void> {
  const imageCache = new Map<string, string>()

  async function uploadImage(file: string): Promise<string> {
    if (imageCache.has(file)) return imageCache.get(file)!
    const asset = await client.assets.upload('image', createReadStream(resolve(IMAGES_DIR, file)), {
      filename: file,
    })
    imageCache.set(file, asset._id)
    return asset._id
  }

  // Categories
  const categoryNames = [...new Set(articles.map((a) => a.category))]
  const categoryId = new Map<string, string>()
  for (const name of categoryNames) {
    const _id = `category-${slugify(name)}`
    await client.createOrReplace({
      _id,
      _type: 'category',
      title: name,
      slug: {_type: 'slug', current: slugify(name)},
    })
    categoryId.set(name, _id)
  }
  console.log(`  ✓ ${categoryNames.length} categories`)

  // Authors
  const authorNames = [...new Set(articles.flatMap((a) => a.authors))]
  const authorId = new Map<string, string>()
  for (const name of authorNames) {
    const _id = `author-${slugify(name)}`
    await client.createOrReplace({
      _id,
      _type: 'author',
      name,
      slug: {_type: 'slug', current: slugify(name)},
    })
    authorId.set(name, _id)
  }
  console.log(`  ✓ ${authorNames.length} authors`)

  // Articles
  for (const article of articles) {
    const assetId = await uploadImage(article.image)
    await client.createOrReplace({
      _id: `article-${article.slug}`,
      _type: 'article',
      title: article.title,
      slug: {_type: 'slug', current: article.slug},
      excerpt: article.dek,
      publishedAt: new Date(article.publishedAt).toISOString(),
      sourceUrl: article.sourceUrl,
      mainImage: {_type: 'image', asset: {_type: 'reference', _ref: assetId}},
      category: {_type: 'reference', _ref: categoryId.get(article.category)!},
      authors: article.authors.map((name) => ({
        _type: 'reference',
        _key: randomUUID(),
        _ref: authorId.get(name)!,
      })),
      body: toPortableText(article.body),
      agentReview: {status: 'idle'},
    })
  }
  console.log(`  ✓ ${articles.length} articles`)

  // Populate performance signal so the demo is fully interactive out of the box.
  const result = await runSync({
    client: client as unknown as SyncClient,
    provider: fixtureProvider(),
  })
  console.log(
    `  ✓ analytics sync — ${result.counts.trending} trending, ${result.counts.stale} stale, ` +
      `${result.newlyQueued} queued for triage`,
  )
}
