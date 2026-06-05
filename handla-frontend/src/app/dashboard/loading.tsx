// Route-level loading skeleton for /dashboard
// Next.js App Router renders this automatically while the page suspends.

export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar strip skeleton */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2.5">
        <div className="h-5 w-20 animate-pulse rounded-full bg-[#1e1e1e]" />
        <div className="h-4 w-32 animate-pulse rounded-full bg-[#1a1a1a]" />
        <div className="ml-auto h-7 w-32 animate-pulse rounded-xl bg-[#1a1a1a]" />
      </div>

      {/* Chat skeleton */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
        {/* Header */}
        <div className="flex items-center gap-3 rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] p-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[#1e1e1e]" />
          <div className="space-y-1.5">
            <div className="h-4 w-28 animate-pulse rounded bg-[#1e1e1e]" />
            <div className="h-3 w-16 animate-pulse rounded bg-[#1a1a1a]" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-2 px-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="h-9 animate-pulse rounded-2xl bg-[#1a1a1a]"
                style={{ width: `${40 + (i * 17) % 35}%` }}
              />
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="h-12 animate-pulse rounded-2xl bg-[#1a1a1a]" />
      </div>
    </div>
  );
}
