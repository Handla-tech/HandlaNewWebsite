// Route-level loading skeleton for /erp
// Next.js App Router renders this automatically while the page suspends.

export default function ErpLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header skeleton */}
      <div className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0a0a0a] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-36 animate-pulse rounded bg-[#1e1e1e]" />
            <div className="h-3 w-52 animate-pulse rounded bg-[#1a1a1a]" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded-xl bg-[#1a1a1a]" />
        </div>

        {/* Stats grid skeleton */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-3 py-2.5">
              <div className="h-6 w-8 animate-pulse rounded bg-[#1e1e1e]" />
              <div className="mt-1 h-3 w-16 animate-pulse rounded bg-[#1a1a1a]" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter / search bar skeleton */}
      <div className="flex-shrink-0 border-b border-[#1a1a1a] bg-[#0a0a0a] px-6 py-3">
        <div className="flex gap-3">
          <div className="h-9 flex-1 animate-pulse rounded-xl bg-[#141414]" />
          <div className="flex gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 w-20 animate-pulse rounded-lg bg-[#141414]" />
            ))}
          </div>
        </div>
      </div>

      {/* Row skeletons */}
      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3.5"
          >
            <div className="h-9 w-9 animate-pulse rounded-full bg-[#1e1e1e]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 animate-pulse rounded bg-[#1e1e1e]" />
              <div className="h-3 w-48 animate-pulse rounded bg-[#1a1a1a]" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded-full bg-[#1a1a1a]" />
            <div className="h-7 w-7 animate-pulse rounded-lg bg-[#1a1a1a]" />
          </div>
        ))}
      </div>
    </div>
  );
}
