import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check, AlertCircle, Loader2, Maximize2, Minimize2, History } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { ChapterEditor } from '../components/novel/ChapterEditor';
import { BrainstormModal } from '../components/novel/BrainstormModal';
import { VersionHistory } from '../components/novel/VersionHistory';
import { formatSaveTime } from '../utils/formatSaveTime';

export function ChapterWritePage() {
  const { projectId, chapterId } = useParams();
  const navigate = useNavigate();
  const {
    currentProject, setCurrentProject, updateProject,
    isGeneratingChapter, setIsGeneratingChapter,
    saveStatus, lastSavedAt, markSaving, markSaved, markUnsaved, setSaveStatus,
  } = useNovelStore();

  const autoSaveTimer = useRef(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'brainstorm' | 'rewrite' | 'continue' | 'generate' | null
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useEffect(() => {
    loadProject();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
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

  const performSave = useCallback(async () => {
    if (!currentProject || saveStatus === 'saving') return;
    markSaving();
    try {
      const res = await novelApi.updateProject(currentProject.id, {
        title: currentProject.title,
        genre: currentProject.genre,
        premise: currentProject.premise,
        synopsis: currentProject.synopsis,
        writingStyle: currentProject.writingStyle,
        coverColor: currentProject.coverColor,
        status: currentProject.status,
        targetWordCount: currentProject.targetWordCount,
        currentWordCount: currentProject.currentWordCount,
        outline: currentProject.outline,
        chapters: currentProject.chapters,
        characters: currentProject.characters,
        locations: currentProject.locations,
        relationships: currentProject.relationships,
        settings: currentProject.settings,
      });
      if (res.data.success) {
        markSaved();
        // Also save draft for current chapter
        if (chapterId) {
          const ch = (currentProject.chapters || []).find((c) => c.id === chapterId);
          if (ch?.content) {
            novelApi.saveDraft(currentProject.id, chapterId, {
              content: ch.content,
              wordCount: (ch.content || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length,
            }).catch(() => {});
          }
        }
      }
    } catch {
      setSaveStatus('error');
    }
  }, [currentProject, chapterId, saveStatus]);

  const debouncedSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    markUnsaved();
    autoSaveTimer.current = setTimeout(() => {
      performSave();
    }, 3000);
  }, [performSave]);

  const handleContentChange = useCallback(({ html, text }) => {
    if (!currentProject || !chapterId) return;
    const chapters = (currentProject.chapters || []).map((c) =>
      c.id === chapterId ? { ...c, content: html } : c
    );
    updateProject(currentProject.id, { chapters });
    debouncedSave();
  }, [currentProject, chapterId, debouncedSave]);

  const handleGenerate = async () => {
    if (!currentProject || !chapter) return;
    setActiveAction('generate');
    setIsGeneratingChapter(true);
    try {
      const prevIdx = currentProject.chapters.findIndex((c) => c.id === chapterId);
      const prevContent = prevIdx > 0 ? currentProject.chapters[prevIdx - 1]?.content : '';

      const res = await novelApi.generateChapter({
        chapterTitle: chapter.title,
        premise: currentProject.premise,
        genre: currentProject.genre,
        previousContent: prevContent,
        writingStyle: currentProject.writingStyle,
        chapterDescription: chapter.description || '',
        characters: currentProject.characters || [],
        relationships: currentProject.relationships || [],
        locations: currentProject.locations || [],
        outline: currentProject.outline || [],
      });

      if (res.data.success) {
        const chapters = currentProject.chapters.map((c) =>
          c.id === chapterId ? { ...c, content: `<p>${res.data.content.replace(/\n/g, '</p><p>')}</p>` } : c
        );
        updateProject(currentProject.id, { chapters });
        if (res.data.mock) toast.info(res.data.message);
        else toast.success('章节生成成功');
        debouncedSave();
      }
    } catch {
      toast.error('章节生成失败');
    } finally {
      setIsGeneratingChapter(false);
      setActiveAction(null);
    }
  };

  const handleContinue = async (selection) => {
    if (!currentProject || !chapter) return;
    // If called with selection but no text (shouldn't happen now after toast, but safe check)
    if (selection && !selection.text) {
      toast.warning('请先选中要改写的文字');
      return;
    }
    const actionType = selection?.text ? 'rewrite' : 'continue';
    setActiveAction(actionType);
    try {
      if (selection?.text) {
        const res = await novelApi.rewriteText({
          selectedText: selection.text,
          instruction: '优化这段文字，使表达更生动流畅',
          genre: currentProject.genre,
          context: selection.contextBefore + selection.text + selection.contextAfter,
          characters: currentProject.characters || [],
          relationships: currentProject.relationships || [],
        });
        if (res.data.success) {
          const content = chapter.content || '';
          const before = content.substring(0, selection.from);
          const after = content.substring(selection.to);
          // 将 \n\n 转换为段落分隔，空段落产生的多余空行
          const formatted = res.data.content.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
          const newContent = before + `<p>${formatted}</p>` + after;
          handleContentChange({ html: newContent, text: '' });
          if (res.data.mock) toast.info(res.data.message);
          else toast.success('改写完成');
        }
      } else {
        const res = await novelApi.continueChapter({
          currentContent: chapter.content?.replace(/<[^>]+>/g, '') || '',
          chapterTitle: chapter.title,
          premise: currentProject.premise,
          genre: currentProject.genre,
          writingStyle: currentProject.writingStyle,
          characters: currentProject.characters || [],
          relationships: currentProject.relationships || [],
          locations: currentProject.locations || [],
          outline: currentProject.outline || [],
        });
        if (res.data.success) {
          // 将 \n\n 转换为段落分隔，空段落产生的多余空行
          const formatted = res.data.content.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
          const newContent = (chapter.content || '') + `<p>${formatted}</p>`;
          handleContentChange({ html: newContent, text: '' });
          if (res.data.mock) toast.info(res.data.message);
          else toast.success('续写完成');
        }
      }
    } catch {
      toast.error('操作失败');
    } finally {
      setActiveAction(null);
    }
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
                  <AlertCircle className="h-3 w-3" /> 保存失败 · 点击重试
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => performSave()}
            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              saveStatus === 'unsaved' || saveStatus === 'error'
                ? 'bg-[var(--primary)] text-white hover:opacity-90'
                : 'bg-[var(--background)] text-[var(--text-tertiary)] cursor-default'
            }`}
            title="保存"
          >
            <Save className="h-4 w-4" />
            保存
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
