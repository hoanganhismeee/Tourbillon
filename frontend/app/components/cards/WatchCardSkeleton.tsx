// Shimmer skeleton matching WatchCard dimensions — used in TrinityShowcase loading state.
// Replaces the spinner to maintain the luxury feel during data fetch.
export default function WatchCardSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="w-full h-80 bg-white/5" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 w-1/3 bg-white/8 rounded" />
        <div className="h-4 w-3/4 bg-white/6 rounded" />
        <div className="h-3 w-1/2 bg-white/5 rounded" />
        <div className="h-3 w-1/4 bg-white/8 rounded" />
      </div>
    </div>
  );
}
