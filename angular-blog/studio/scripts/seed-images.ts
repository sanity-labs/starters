import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import type {SanityClient} from '@sanity/client'

const SEED_IMAGES = [
  {documentId: 'settings', field: 'logo', file: 'logo.png'},
  {documentId: 'author-1', field: 'image', file: 'author.png'},
  {documentId: 'post-1', field: 'coverImage', file: 'blog-1.png'},
  {documentId: 'post-2', field: 'coverImage', file: 'blog-2.png'},
  {documentId: 'post-3', field: 'coverImage', file: 'blog-3.png'},
] as const

export async function uploadSeedImages(client: SanityClient, imagesDir: string): Promise<void> {
  for (const {documentId, field, file} of SEED_IMAGES) {
    const filePath = join(imagesDir, file)

    if (!existsSync(filePath)) {
      console.warn(`  Skipping ${file} — file not found`)
      continue
    }

    const doc = await client.getDocument(documentId)
    if (!doc) {
      console.warn(`  Skipping ${file} — document ${documentId} not found`)
      continue
    }

    const existing = doc[field] as {asset?: {_ref?: string}} | undefined
    if (existing?.asset?._ref) {
      console.log(`  ${documentId}.${field} already has an image`)
      continue
    }

    const asset = await client.assets.upload('image', readFileSync(filePath), {
      filename: file,
      contentType: 'image/png',
    })

    await client
      .patch(documentId)
      .set({
        [field]: {
          _type: 'image',
          asset: {_type: 'reference', _ref: asset._id},
        },
      })
      .commit()

    console.log(`  Uploaded ${file} → ${documentId}.${field}`)
  }
}
