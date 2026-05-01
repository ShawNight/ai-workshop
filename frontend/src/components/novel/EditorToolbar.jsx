import { ArrowLeft, Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { formatSaveTime } from '../../utils/formatSaveTime';

export function EditorToolbar({ project, saveStatus, lastSavedAt, wordCount, onBack, onSave }) {
  const savedLabel = lastSavedAt ? `已保存 · ${formatSaveTime(lastSavedAt)}` : '已保存';

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-semibold text-sm">{project?.title || '未命名'}</h1>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600">
                <Check className="h-3 w-3" /> {savedLabel}
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-[var(--primary)]">
                <Loader2 className="h-3 w-3 animate-spin" /> 保存中...
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertCircle className="h-3 w-3" /> 有未保存的更改
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="h-3 w-3" /> 保存失败
              </span>
            )}
            {wordCount > 0 && <span>· {wordCount.toLocaleString()} 字</span>}
          </div>
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saveStatus === 'saving'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          saveStatus === 'unsaved'
            ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
            : saveStatus === 'error'
            ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
            : saveStatus === 'saving'
            ? 'bg-[var(--border)] text-[var(--text-secondary)] cursor-wait'
            : 'bg-[var(--background)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
        }`}
      >
        <Save className="h-4 w-4" />
        {saveStatus === 'saving' ? '保存中...' : saveStatus === 'error' ? '重试保存' : '保存'}
      </button>
    </div>
  );
}