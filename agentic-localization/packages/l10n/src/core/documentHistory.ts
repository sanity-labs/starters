/**
 * One document, as it was at one revision.
 *
 * The History API is how both halves of the pattern see the past: the analysis
 * diffs the source against the revision it last looked at, and the learning loop
 * diffs a human's approved text against the machine draft `machineRev` recorded.
 * Same request, so one implementation.
 *
 * A revision outside the dataset's retention window answers 404. That is an
 * expected outcome, not a failure — both callers degrade rather than throw.
 */

/** The `request` slice this needs. Satisfied by `@sanity/client` and the engine's. */
export interface HistoryReader {
  request: <T>(options: {url: string; tag?: string}) => Promise<T>
}

export async function documentAtRevision(
  client: HistoryReader,
  args: {dataset: string; documentId: string; revision: string},
): Promise<null | Record<string, unknown>> {
  return read(client, args.dataset, args.documentId, `revision=${args.revision}`)
}

/**
 * The same document as of an instant.
 *
 * The fallback for a write that recorded no revision of its own — a redelivered
 * effect that found the version it had already created answers `{transactionId}`
 * for a commit it did not make. An effect's `ranAt` is stamped at COMPLETION, so
 * it is a valid single instant to read at; it is emphatically NOT the start of an
 * interval (`durationMs` is never written, which is why the bracketing approach
 * the design debate proposed was uncomputable).
 */
export async function documentAtTime(
  client: HistoryReader,
  args: {dataset: string; documentId: string; time: string},
): Promise<null | Record<string, unknown>> {
  return read(client, args.dataset, args.documentId, `time=${encodeURIComponent(args.time)}`)
}

async function read(
  client: HistoryReader,
  dataset: string,
  documentId: string,
  query: string,
): Promise<null | Record<string, unknown>> {
  const response = await client.request<{documents?: Record<string, unknown>[]}>({
    url: `/data/history/${dataset}/documents/${documentId}?${query}`,
    tag: 'get-history',
  })
  return response?.documents?.[0] ?? null
}
