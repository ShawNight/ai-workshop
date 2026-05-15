import { cn } from '../../lib/utils';

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-all duration-200 appearance-none',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
