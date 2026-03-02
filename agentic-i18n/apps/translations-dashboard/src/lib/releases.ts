import type {ReleaseDocument} from '@sanity/sdk'

/**
 * Build a lookup map from release short ID to display name.
 *
 * Full IDs look like `_.releases.r6JU3YOFf` — this strips the prefix
 * and resolves the best human-readable label for each release.
 */
export function buildReleaseMap(releases: ReleaseDocument[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const release of releases) {
    const shortId = release._id.replace('_.releases.', '')
    const displayName = release.metadata?.title || release.name || shortId
    map.set(shortId, displayName)
  }
  return map
}
