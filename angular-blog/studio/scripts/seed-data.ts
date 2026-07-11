import {readFileSync} from 'node:fs'
import type {SanityClient} from '@sanity/client'

export function getSeedDocumentIds(ndjsonPath: string): string[] {
  return readFileSync(ndjsonPath, 'utf8')
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => (JSON.parse(line) as {_id: string})._id)
}

export async function seedDocumentsExist(
  client: SanityClient,
  documentIds: string[],
): Promise<boolean> {
  for (const id of documentIds) {
    const doc = await client.getDocument(id)
    if (!doc) return false
  }
  return documentIds.length > 0
}
