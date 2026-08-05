function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-hover ${className}`} />;
}

export default function TransactionsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6" aria-busy="true" aria-label="Loading transactions">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-40" />
          <SkeletonBlock className="h-4 w-64" />
        </div>
        <SkeletonBlock className="h-10 w-36" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>

      <SkeletonBlock className="h-20" />

      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
