function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-hover ${className}`} />;
}

export default function BillsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6" aria-busy="true" aria-label="Loading bills">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-4 w-80" />
        </div>
        <SkeletonBlock className="h-10 w-28" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
