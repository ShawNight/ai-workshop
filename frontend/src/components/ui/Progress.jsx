import { cn } from '../../lib/utils';

export function Progress({ value, className, ...props }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--border)]',
        className
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] transition-all duration-500 ease-out relative overflow-hidden"
        style={{ width: `${clamped}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      </div>
    </div>
  );
}
