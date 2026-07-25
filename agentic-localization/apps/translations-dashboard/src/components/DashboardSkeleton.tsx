/**
 * Full-page dashboard skeleton — shown during SDK initialization.
 *
 * Matches the actual dashboard layout shape so the user sees the
 * page structure immediately instead of a blank "Loading..." screen.
 * This is the first thing rendered, before SanityApp even resolves.
 */

function Pulse({className = ''}: {className?: string}) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
}

function SummaryBarSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
        <Pulse className="h-4 w-20 mb-2" />
        <Pulse className="h-8 w-16 mb-2" />
        <Pulse className="h-4 w-24" />
      </div>
      <div className="rounded-lg border border-gray-200 p-4">
        <Pulse className="h-4 w-20 mb-2" />
        <Pulse className="h-8 w-16 mb-2" />
        <Pulse className="h-4 w-24" />
      </div>
    </div>
  )
}

function HeatmapSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <Pulse className="h-5 w-40 mb-4" />
      <div className="space-y-2">
        {Array.from({length: 4}).map((_, row) => (
          <div className="flex gap-2" key={row}>
            <Pulse className="h-8 w-24" />
            {Array.from({length: 4}).map((_, col) => (
              <Pulse className="h-8 flex-1" key={col} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentChangesSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <Pulse className="h-5 w-32 mb-4" />
      <div className="space-y-3">
        {Array.from({length: 3}).map((_, i) => (
          <div className="flex items-center gap-3" key={i}>
            <Pulse className="h-4 w-4" />
            <Pulse className="h-4 flex-1" />
            <Pulse className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="h-full space-y-0">
      <div className="px-4 pt-4 pb-2">
        <SummaryBarSkeleton />
      </div>

      <div className="px-4 pb-2">
        <HeatmapSkeleton />
      </div>

      <div className="px-4 pb-4">
        <RecentChangesSkeleton />
      </div>
    </div>
  )
}

export default DashboardSkeleton
