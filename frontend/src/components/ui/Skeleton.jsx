import { cn } from '../../lib/utils';

export function Skeleton({ className, width, height, circle }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-[var(--border)]/60 rounded-lg',
        circle && 'rounded-full',
        className
      )}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton circle width={40} height={40} />
        <div className="space-y-2 flex-1">
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <Skeleton width="100%" height={12} />
      <Skeleton width="80%" height={12} />
      <Skeleton width="100%" height={6} />
    </div>
  );
}
