import { Sparkles, Edit3, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

export function BlueprintDiffBadge({ change, kind = 'new', className = '' }) {
  if (!change) return null;
  const { chapterIndex, source } = change;
  const isNew = kind === 'new';
  const Icon = source === 'user_edit' ? Edit3 : isNew ? Plus : Sparkles;
  const colorClass = source === 'user_edit'
    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    : isNew
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border whitespace-nowrap',
      colorClass,
      className
    )}>
      <Icon className="h-2.5 w-2.5" />
      第{chapterIndex != null ? chapterIndex + 1 : '?'}章
    </span>
  );
}
