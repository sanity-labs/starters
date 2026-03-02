export function FallbackBanner({
  locale,
  fallbackLanguage,
}: {
  locale: string
  fallbackLanguage: string
}) {
  return (
    <div className="rounded-[var(--radius-md)] border-l-2 border-l-[var(--color-accent)] bg-[var(--color-accent-subtle)] backdrop-blur-xl px-4 py-3 mb-6 text-sm text-[var(--color-text-secondary)]">
      This article is not yet available in <strong>{locale}</strong>. Showing the{' '}
      <strong>{fallbackLanguage}</strong> version — the fallback language configured in Sanity.
    </div>
  )
}
