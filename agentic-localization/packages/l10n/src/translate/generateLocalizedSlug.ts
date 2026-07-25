/**
 * Generate a localized slug for a translated document.
 *
 * Simple slug generation that prepends the locale code to the base slug.
 * Replaces the Sanetti-specific generateUrlSlug + URL_PREFIXES logic.
 *
 * @param title - The translated document title
 * @param localeCode - The target locale code (e.g., 'es-MX')
 * @returns A slug object with `current` and `fullUrl` fields
 */
export function generateLocalizedSlug(
  title: string,
  localeCode: string,
): {current: string; fullUrl: string} {
  // Convert title to a URL-safe slug
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
    .slice(0, 60) // Max length

  const localePath = localeCode.toLowerCase()
  const current = slug
  const fullUrl = `/${localePath}/${slug}`

  return {current, fullUrl}
}
