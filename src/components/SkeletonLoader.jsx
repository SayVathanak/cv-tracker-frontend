const SkeletonLoader = () => (
  <div className="p-3 rounded border border-zinc-100 bg-white">
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2.5 w-full">
        <div className="w-8 h-8 rounded bg-zinc-200 animate-pulse flex-none"></div>
        <div className="flex-1 space-y-1.5 overflow-hidden">
          <div className="h-3 bg-zinc-200 rounded w-1/3 animate-pulse"></div>
          <div className="h-2 bg-zinc-100 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 mt-2">
      <div className="h-2 bg-zinc-100 rounded animate-pulse"></div>
      <div className="h-2 bg-zinc-100 rounded animate-pulse"></div>
      <div className="h-2 bg-zinc-100 rounded animate-pulse"></div>
    </div>
  </div>
)

export default SkeletonLoader