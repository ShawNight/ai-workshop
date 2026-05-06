import { useState, useEffect } from 'react';
import { X, Clock, RotateCcw, History, ChevronRight, GitCompare } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { novelApi } from '../../api';
import { VersionDiff } from './VersionDiff';

export function VersionHistory({ projectId, chapterId, isOpen, onClose, onRestore }) {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [draftContent, setDraftContent] = useState(null);
  const [compareMode, setCompareMode] = useState(null);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [compareContent, setCompareContent] = useState({ old: '', new: '' });
  const [compareLoading, setCompareLoading] = useState(false);

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
    if (compareMode === 'selecting') {
      handleToggleCompare(draft);
      return;
    }
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

  const handleToggleCompare = (draft) => {
    setSelectedForCompare(prev => {
      if (prev.includes(draft.id)) {
        return prev.filter(id => id !== draft.id);
      }
      if (prev.length >= 2) {
        return [prev[1], draft.id];
      }
      return [...prev, draft.id];
    });
  };

  const handleEnterCompareMode = () => {
    setCompareMode('selecting');
    setSelectedForCompare([]);
    setSelectedDraft(null);
    setDraftContent(null);
  };

  const handleShowDiff = async () => {
    if (selectedForCompare.length !== 2) return;
    setCompareLoading(true);
    try {
      const [resOld, resNew] = await Promise.all([
        novelApi.getDraftContent(selectedForCompare[0]),
        novelApi.getDraftContent(selectedForCompare[1]),
      ]);
      const oldDraft = resOld.data.draft;
      const newDraft = resNew.data.draft;
      setCompareContent({ old: oldDraft.content, new: newDraft.content });
      setCompareMode('showing');
    } catch {
      toast.error('加载对比内容失败');
    } finally {
      setCompareLoading(false);
    }
  };

  const handleExitCompare = () => {
    setCompareMode(null);
    setSelectedForCompare([]);
    setCompareContent({ old: '', new: '' });
  };

  if (!isOpen) return null;

  const isInCompareFlow = compareMode === 'selecting' || compareMode === 'showing';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--text-secondary)]" />
          <h2 className="font-semibold">版本历史</h2>
          <span className="text-xs text-[var(--text-secondary)]">({drafts.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {!isInCompareFlow ? (
            <button
              onClick={handleEnterCompareMode}
              className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title="对比版本"
            >
              <GitCompare className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleExitCompare}
              className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--background)] text-[var(--text-secondary)]"
            >
              退出对比
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--background)]">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Compare selecting info bar */}
      {compareMode === 'selecting' && (
        <div className="px-4 py-2 bg-[var(--background)] border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">
            已选择 {selectedForCompare.length}/2 个版本
          </span>
          <Button
            size="sm"
            disabled={selectedForCompare.length !== 2}
            onClick={handleShowDiff}
            loading={compareLoading}
          >
            显示差异
          </Button>
        </div>
      )}

      {/* Compare showing diff */}
      {compareMode === 'showing' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200">删除</span>
            <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200">新增</span>
          </div>
          <VersionDiff oldContent={compareContent.old} newContent={compareContent.new} />
        </div>
      )}

      {/* Normal content (not showing diff) */}
      {compareMode !== 'showing' && (
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
                    compareMode === 'selecting'
                      ? selectedForCompare.includes(draft.id)
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                        : 'border-[var(--border)] hover:border-[var(--primary)]/30'
                      : selectedDraft?.id === draft.id
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                        : 'border-[var(--border)] hover:border-[var(--primary)]/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {compareMode === 'selecting' && (
                      <input
                        type="checkbox"
                        checked={selectedForCompare.includes(draft.id)}
                        onChange={() => handleToggleCompare(draft)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-[var(--border)]"
                      />
                    )}
                    <div className="flex-1">
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
                        {compareMode !== 'selecting' && (
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
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview (only in normal mode) */}
      {compareMode === null && selectedDraft && (
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