/** The notice is assembled from `l10n.uiStrings`, so the copy is editable. */
export function FallbackBanner({notice}: {notice: string}) {
  return (
    <div className="rounded-[var(--radius-md)] border-l-2 border-l-[var(--color-accent)] bg-[var(--color-accent-subtle)] backdrop-blur-xl px-4 py-3 mb-6 text-sm text-[var(--color-text-secondary)]">
      {notice}
    </div>
  )
}
