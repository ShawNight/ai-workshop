import { useState, useEffect } from 'react';
import { X, Clock, RotateCcw, History, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { novelApi } from '../../api';

export function VersionHistory({ projectId, chapterId, isOpen, onClose, onRestore }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [draftContent, setDraftContent] = useState(null);

  useEffect(() => {
    if (isOpen && projectId && chapterId) {
      loadDrafts();
    }
  }, [isOpen, projectId, chapterId]);

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const res = await novelApi.getDrafts(projectId, chapterId);
      if (res.data.success) {
        setDrafts(res.data.drafts || []);
      }
    } catch {
      console.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDraft = async (draft) => {
    setSelectedDraft(draft);
    try {
      const res = await novelApi.getDraftContent(draft.id);
      if (res.data.success) {
        setDraftContent(res.data.draft);
      }
    } catch {
      toast.error('加载草稿失败');
    }
  };

  const handleRestore = async (draft) => {
    setRestoringId(draft.id);
    try {
      const res = await novelApi.getDraftContent(draft.id);
      if (res.data.success) {
        onRestore?.(res.data.draft.content);
        toast.success(`已恢复到版本 ${draft.version}`);
        onClose();
      }
    } catch {
      toast.error('恢复失败');
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--text-secondary)]" />
          <h2 className="font-semibold">版本历史</h2>
          <span className="text-xs text-[var(--text-secondary)]">({drafts.length})</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--background)]">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse opacity-50" />
            <p className="text-sm">加载中...</p>
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-10 w-10 mx-auto mb-3 text-[var(--text-secondary)] opacity-30" />
            <p className="text-sm text-[var(--text-secondary)]">暂无版本历史</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">编辑并保存章节后会自动创建版本</p>
          </div>
        ) : (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                onClick={() => handleSelectDraft(draft)}
                className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                  selectedDraft?.id === draft.id
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">
                    版本 {draft.version}
                    {draft.version === drafts[0]?.version && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30">最新</span>
                    )}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {draft.wordCount.toLocaleString()} 字
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(draft.createdAt).toLocaleString('zh-CN', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handleRestore(draft); }}
                    loading={restoringId === draft.id}
                    disabled={restoringId === draft.id}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    恢复
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {selectedDraft && (
        <div className="border-t border-[var(--border)] max-h-64 overflow-y-auto p-4 bg-[var(--background)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">版本 {selectedDraft.version} 预览</span>
          </div>
          <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-6">
            {draftContent?.content
              ? draftContent.content.replace(/<[^>]+>/g, '').slice(0, 300) + '...'
              : '加载中...'}
          </div>
        </div>
      )}
    </div>
  );
}
