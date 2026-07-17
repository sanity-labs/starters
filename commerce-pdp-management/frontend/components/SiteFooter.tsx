export function SiteFooter() {
  return (
    <footer className="sticky bottom-0 z-40 flex items-center justify-between border-t border-swag-black bg-swag-black px-4 py-2 text-white">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold">Sanity</span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/60">Shop®</span>
      </div>
      <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider">
        <span className="text-white/70">PDP enrichment · pull-only</span>
      </div>
    </footer>
  )
}
