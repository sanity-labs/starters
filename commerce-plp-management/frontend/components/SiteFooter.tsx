export function SiteFooter({itemCount = 0, total = '$0'}: {itemCount?: number; total?: string}) {
  return (
    <footer className="sticky bottom-0 z-40 flex items-center justify-between border-t border-swag-black bg-swag-black px-4 py-2 text-white">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold">Sanity</span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/60">Shop®</span>
      </div>
      <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider">
        <span className="text-white/70">
          Total ({itemCount}): {total}
        </span>
        <button
          type="button"
          className="bg-white px-3 py-1 text-swag-black transition-colors duration-150 hover:bg-swag-yellow"
        >
          Checkout
        </button>
      </div>
    </footer>
  )
}
