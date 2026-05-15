import { cn } from '../../lib/utils';
import { ArrowLeft, Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { formatSaveTime } from '../../utils/formatSaveTime';
import { motion, AnimatePresence } from 'framer-motion';

export function EditorToolbar({ project, saveStatus, lastSavedAt, wordCount, onBack, onSave }) {
  const savedLabel = lastSavedAt ? `已保存 · ${formatSaveTime(lastSavedAt)}` : '已保存';

  const statusConfig = {
    saved: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10', text: savedLabel },
    saving: { icon: Loader2, color: 'text-[var(--primary)]', bg: 'bg-[var(--primary)]/10', text: '保存中...' },
    unsaved: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', text: '有未保存的更改' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', text: '保存失败' },
  };

  const config = statusConfig[saveStatus] || statusConfig.saved;
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)] sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-[var(--elevated)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text-secondary)]" />
        </button>
        <div>
          <h1 className="font-semibold text-sm text-[var(--text-primary)]">{project?.title || '未命名'}</h1>
          <div className="flex items-center gap-2 text-xs">
            <AnimatePresence mode="wait">
              <motion.span
                key={saveStatus}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color} text-xs font-medium`}
              >
                <StatusIcon className={cn('h-3 w-3', saveStatus === 'saving' && 'animate-spin')} />
                {config.text}
              </motion.span>
            </AnimatePresence>
            {wordCount > 0 && (
              <span className="text-[var(--text-secondary)]">· {wordCount.toLocaleString()} 字</span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saveStatus === 'saving'}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
          saveStatus === 'unsaved'
            ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg hover:shadow-amber-500/25 hover:scale-[1.02]'
            : saveStatus === 'error'
            ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-red-500/25 hover:scale-[1.02]'
            : saveStatus === 'saving'
            ? 'bg-[var(--elevated)] text-[var(--text-secondary)] cursor-wait'
            : 'bg-[var(--elevated)] text-[var(--text-primary)] hover:bg-[var(--border)] hover:scale-[1.02]'
        )}
      >
        <Save className="h-4 w-4" />
        {saveStatus === 'saving' ? '保存中...' : saveStatus === 'error' ? '重试保存' : '保存'}
      </button>
    </div>
  );
}
