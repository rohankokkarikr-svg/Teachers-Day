export default function LiveBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`badge-live inline-flex items-center gap-1.5 ${className}`}
      aria-label="Live updates active"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
      </span>
      LIVE
    </span>
  );
}
