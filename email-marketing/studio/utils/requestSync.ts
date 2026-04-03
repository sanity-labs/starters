import type {SanityClient} from 'sanity'

/**
 * Request a sync to the external provider by setting syncState to 'requested' and publishing.
 * Pass an optional `publish` callback (from useDocumentOperation) when syncing the current document.
 * When syncing a referenced document, omit `publish` and the function will publish via client operations.
 */
export async function requestSync(
  client: SanityClient,
  {id, document}: {id: string; document: Record<string, any>},
  publish?: () => void,
) {
  const draftId = `drafts.${id}`
  await client.createIfNotExists({...document, _id: draftId} as any)
  await client.patch(draftId).set({syncState: 'requested'}).commit()
  if (publish) {
    publish()
  } else {
    const updated = await client.getDocument(draftId)
    if (updated) {
      await client
        .transaction()
        .createOrReplace({...updated, _id: id})
        .delete(draftId)
        .commit()
    }
  }
}
