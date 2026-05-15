import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 rounded-2xl',
        'border border-dashed border-[var(--border)] bg-[var(--surface)]/50',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)]/20 to-[var(--secondary)]/20 flex items-center justify-center mb-4">
        {Icon && <Icon className="h-8 w-8 text-[var(--primary)]" />}
      </div>
      <p className="text-lg font-medium text-[var(--text-secondary)]">{title}</p>
      {description && (
        <p className="text-sm text-[var(--text-secondary)]/70 mt-1 mb-6 max-w-sm text-center">
          {description}
        </p>
      )}
      {action}
    </motion.div>
  );
}
