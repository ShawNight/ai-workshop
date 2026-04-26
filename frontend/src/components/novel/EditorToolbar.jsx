import { ArrowLeft, Save, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

export function EditorToolbar({ project, saveStatus, wordCount, onBack, onSave }) {
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
                <Check className="h-3 w-3" /> 已保存
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-[var(--primary)]">
                <Save className="h-3 w-3 animate-pulse" /> 保存中...
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertCircle className="h-3 w-3" /> 未保存
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

      <Button
        size="sm"
        variant="outline"
        onClick={onSave}
        disabled={saveStatus === 'saved' || saveStatus === 'saving'}
      >
        <Save className="h-4 w-4" />
        保存
      </Button>
    </div>
  );
}
