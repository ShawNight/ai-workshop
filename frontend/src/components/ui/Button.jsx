import { cn } from '../../lib/utils';

const variants = {
  primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] hover:scale-[1.02] active:scale-[0.98]',
  secondary: 'bg-[var(--secondary)] text-white hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]',
  outline: 'border border-[var(--border)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--elevated)] hover:border-[var(--text-secondary)]/30',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--elevated)] hover:text-[var(--text-primary)]',
  destructive: 'bg-red-500 text-white hover:bg-red-600 hover:scale-[1.02] active:scale-[0.98]'
};

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-10 px-4 py-2 text-sm rounded-lg',
  lg: 'h-12 px-6 text-base rounded-lg'
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  loading,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
