// Root loading fallback — shown by App Router immediately on any navigation
// while a server component renders or a JS chunk is being downloaded.
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-px h-12 bg-gradient-to-b from-transparent via-[#bfa68a]/60 to-transparent animate-pulse" />
        <span className="font-playfair text-[11px] uppercase tracking-[0.45em] text-[#bfa68a]/50">
          Tourbillon
        </span>
        <div className="w-px h-12 bg-gradient-to-b from-transparent via-[#bfa68a]/60 to-transparent animate-pulse" />
      </div>
    </div>
  );
}
