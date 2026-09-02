interface LoadingSkeletonProps {
  variant?: 'text' | 'card' | 'avatar' | 'button' | 'stat';
  lines?: number;
  className?: string;
}

function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      className="skeleton h-4 rounded"
      style={{ width }}
    />
  );
}

export default function LoadingSkeleton({
  variant = 'text',
  lines = 3,
  className = '',
}: LoadingSkeletonProps) {
  if (variant === 'avatar') {
    return <div className={`skeleton w-12 h-12 rounded-full ${className}`} />;
  }

  if (variant === 'button') {
    return <div className={`skeleton h-11 w-32 rounded-xl ${className}`} />;
  }

  if (variant === 'stat') {
    return (
      <div className={`glass-card p-5 space-y-3 ${className}`}>
        <div className="skeleton h-4 w-20 rounded" />
        <div className="skeleton h-8 w-28 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`glass-card p-5 space-y-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="skeleton w-12 h-12 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
        </div>
      </div>
    );
  }

  // Text variant
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '60%' : `${85 + Math.random() * 15}%`}
        />
      ))}
    </div>
  );
}

// Skeleton grid for loading states
export function SkeletonGrid({ count = 6, type = 'card' }: { count?: number; type?: 'card' | 'stat' }) {
  return (
    <div className={`grid gap-4 ${
      type === 'stat' 
        ? 'grid-cols-2 md:grid-cols-4' 
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
    }`}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} variant={type} />
      ))}
    </div>
  );
}
