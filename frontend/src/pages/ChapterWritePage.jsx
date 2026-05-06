import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check, AlertCircle, Loader2, Maximize2, Minimize2, History } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { useAutoSave } from '../hooks/useAutoSave';
import { useChapterActions } from '../hooks/useChapterActions';
import { ChapterEditor } from '../components/novel/ChapterEditor';
import { BrainstormModal } from '../components/novel/BrainstormModal';
import { VersionHistory } from '../components/novel/VersionHistory';
import { formatSaveTime } from '../utils/formatSaveTime';

export function ChapterWritePage() {
  const { projectId, chapterId } = useParams();
  const navigate = useNavigate();
  const {
    currentProject, setCurrentProject, updateProject,
    isGeneratingChapter,
    saveStatus, lastSavedAt, markUnsaved,
  } = useNovelStore();
  const { save } = useAutoSave(projectId, chapterId);
  const { generateChapter, continueChapter } = useChapterActions(chapterId);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const res = await novelApi.getProject(projectId);
      if (res.data.success) {
        setCurrentProject(res.data.project);
      } else {
        navigate('/novel');
      }
    } catch {
      navigate('/novel');
    }
  };

  const savedLabel = lastSavedAt ? `已保存 · ${formatSaveTime(lastSavedAt)}` : '已保存';

  const chapter = currentProject?.chapters?.find((c) => c.id === chapterId);

  

  const handleContentChange = useCallback(({ html }) => {
    if (!currentProject || !chapterId) return;
    const chapters = (currentProject.chapters || []).map((c) =>
      c.id === chapterId ? { ...c, content: html } : c
    );
    updateProject(currentProject.id, { chapters });
    markUnsaved();
  }, [currentProject, chapterId, updateProject, markUnsaved]);

  const handleGenerate = async () => {
    setActiveAction('generate');
    await generateChapter();
    setActiveAction(null);
  };

  const handleContinue = async (selection) => {
    if (selection && !selection.text) {
      toast.warning('请先选中要改写的文字');
      return;
    }
    const actionType = selection?.text ? 'rewrite' : 'continue';
    setActiveAction(actionType);
    await continueChapter(selection);
    setActiveAction(null);
  };

  const handleApplyBrainstormIdea = (item) => {
    const newContent = (chapter?.content || '') + `\n<p><em>【灵感：${item.title} — ${item.description}】</em></p>\n`;
    handleContentChange({ html: newContent, text: '' });
    toast.success('灵感已添加到文档');
  };

  const handleBack = () => {
    navigate(`/novel/${projectId}`);
  };

  if (!currentProject || !chapter) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        加载中...
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isFocusMode ? 'fixed inset-0 z-50 bg-[var(--background)]' : 'h-[calc(100vh-4rem)] -m-4 md:-m-8'}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-[var(--background)]">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-semibold text-sm">{chapter.title}</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>{currentProject.title}</span>
              <span>·</span>
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
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => save()}
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
            title="保存"
          >
            <Save className="h-4 w-4" />
            {saveStatus === 'saving' ? '保存中...' : saveStatus === 'error' ? '重试保存' : '保存'}
          </button>
          <span className="w-px h-5 bg-[var(--border)]" />
          <button
            onClick={() => setShowVersionHistory(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--text-secondary)]"
            title="版本历史"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowBrainstorm(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--text-secondary)]"
            title="头脑风暴"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
            </svg>
          </button>
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--text-secondary)]"
            title={isFocusMode ? '退出专注模式' : '专注模式'}
          >
            {isFocusMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden min-h-0">
        <ChapterEditor
          chapter={chapter}
          onContentChange={handleContentChange}
          onGenerate={handleGenerate}
          onContinue={handleContinue}
          onBrainstorm={() => {
            if (!activeAction) {
              setActiveAction('brainstorm');
              setShowBrainstorm(true);
              setTimeout(() => setActiveAction(null), 300);
            }
          }}
          isGenerating={isGeneratingChapter}
          activeAction={activeAction}
        />
      </div>

      {/* Focus mode status bar */}
      {isFocusMode && (
        <div className="h-1 bg-[var(--primary)]/20 shrink-0">
          <div
            className="h-full bg-[var(--primary)] transition-all"
            style={{
              width: chapter?.content
                ? `${Math.min(100, (chapter.content.replace(/<[^>]+>/g, '').length / 2000) * 100)}%`
                : '0%'
            }}
          />
        </div>
      )}

      <BrainstormModal
        isOpen={showBrainstorm}
        onClose={() => setShowBrainstorm(false)}
        onApplyIdea={handleApplyBrainstormIdea}
      />

      <VersionHistory
        projectId={projectId}
        chapterId={chapterId}
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        onRestore={(content) => {
          handleContentChange({ html: content, text: '' });
        }}
      />
    </div>
  );
}
