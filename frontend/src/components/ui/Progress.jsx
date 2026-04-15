import { cn } from '../../lib/utils';

export function Progress({ value, className, ...props }) {
  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-[var(--border)]',
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-[var(--primary)] transition-all duration-300 ease-in-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
