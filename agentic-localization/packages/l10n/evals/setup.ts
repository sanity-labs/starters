import {getClient} from './client'

const SEED_PRODUCT = {
  _id: 'product-eval-source',
  _type: 'article',
  title: 'Sanity Studio: Real-time Structured Content Platform',
  excerpt:
    'Sanity Studio gives your team a real-time environment for managing structured content in the Content Lake. ' +
    'Author rich text with Portable Text, query any field or dataset with GROQ, and preview across draft and published states using Perspectives. ' +
    'Coordinate launches by grouping changes into Releases, and add custom document actions to automate your workflow.',
  language: 'en-US',
}

export async function setup() {
  const client = getClient()
  await client.createIfNotExists(SEED_PRODUCT)
  console.log(`[eval:setup] Seeded ${SEED_PRODUCT._id}`)
}

export async function teardown() {
  const client = getClient()
  await client.delete(SEED_PRODUCT._id)
  console.log(`[eval:teardown] Deleted ${SEED_PRODUCT._id}`)
}
