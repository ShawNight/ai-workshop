import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check, AlertCircle, Loader2, Maximize2, Minimize2, History, StickyNote, UserPlus } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { useAutoSave } from '../hooks/useAutoSave';
import { useChapterActions } from '../hooks/useChapterActions';
import { useHotkeys } from '../hooks/useHotkeys';
import { ChapterEditor } from '../components/novel/ChapterEditor';
import { BrainstormModal } from '../components/novel/BrainstormModal';
import { VersionHistory } from '../components/novel/VersionHistory';
import { NotesDrawer } from '../components/novel/NotesDrawer';
import { SummarySuggestion } from '../components/novel/SummarySuggestion';
import { EntityExtractor } from '../components/novel/EntityExtractor';
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
  const { generateChapter, continueChapter, suggestion, setSuggestion } = useChapterActions(chapterId);

  useHotkeys({
    'ctrl+s': () => save(),
    'ctrl+enter': () => continueChapter({}),
    'ctrl+shift+b': () => setShowBrainstorm(true),
  }, [save, continueChapter]);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [extractedEntities, setExtractedEntities] = useState(null);

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

  const handleAcceptSuggestion = ({ title, description }) => {
    if (!currentProject || !suggestion) return;
    const chId = suggestion.chapterId;
    const chapters = (currentProject.chapters || []).map((c) => {
      if (c.id !== chId) return c;
      return { ...c, title: title || c.title, description: description || c.description };
    });
    const outline = (currentProject.outline || []).map((item, idx) => {
      const chapterIdx = chapters.findIndex((c) => c.id === chId);
      if (chapterIdx < 0 || idx !== chapterIdx) return item;
      return { ...item, title: title || item.title, description: description || item.description };
    });
    updateProject(currentProject.id, { chapters, outline });
    markUnsaved();
    setSuggestion(null);
    toast.success('章节概要已更新');
  };

  const handleExtractEntities = async () => {
    if (!currentProject || !chapter) return;
    const plainContent = (chapter.content || '').replace(/<[^>]+>/g, '');
    if (!plainContent.trim()) {
      toast.error('章节内容为空，无法提取');
      return;
    }
    try {
      const res = await novelApi.extractEntities({
        content: plainContent,
        existingCharacters: (currentProject.characters || []).map((c) => ({ name: c.name, role: c.role })),
        existingLocations: (currentProject.locations || []).map((l) => ({ name: l.name, type: l.type })),
        genre: currentProject.genre || '通用',
        premise: currentProject.premise || '',
      });
      if (res.data.success) {
        const chars = res.data.characters || [];
        const locs = res.data.locations || [];
        if (chars.length === 0 && locs.length === 0) {
          toast.info('未发现新的角色或地点');
        } else {
          setExtractedEntities({ characters: chars, locations: locs });
        }
      } else {
        toast.error(res.data.error || '提取失败');
      }
    } catch {
      toast.error('提取实体失败');
    }
  };

  const handleAcceptEntities = async ({ characters, locations }) => {
    if (!currentProject) return;
    const updates = {};
    if (characters.length > 0) {
      updates.characters = [...(currentProject.characters || []), ...characters];
    }
    if (locations.length > 0) {
      updates.locations = [...(currentProject.locations || []), ...locations];
    }
    if (Object.keys(updates).length > 0) {
      updateProject(currentProject.id, updates);
      // 直接持久化到后端，不依赖 auto-save（auto-save 会因 chapters 未变而跳过）
      try {
        await novelApi.updateProject(currentProject.id, updates);
        toast.success(`已添加 ${characters.length} 个角色和 ${locations.length} 个地点`);
      } catch {
        toast.error('保存失败，请手动保存');
      }
    }
    setExtractedEntities(null);
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
      {isFocusMode && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--primary)]/5 via-transparent to-transparent pointer-events-none" />
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 rounded-xl hover:bg-[var(--elevated)] transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-semibold text-sm">{chapter.title}</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>{currentProject.title}</span>
              <span>·</span>
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px] font-medium">
                  <Check className="h-3 w-3" /> {savedLabel}
                </span>
              )}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full text-[10px] font-medium">
                  <Loader2 className="h-3 w-3 animate-spin" /> 保存中...
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px] font-medium">
                  <AlertCircle className="h-3 w-3" /> 未保存
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full text-[10px] font-medium">
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
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              saveStatus === 'unsaved'
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg hover:shadow-amber-500/25 hover:scale-[1.02]'
                : saveStatus === 'error'
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg hover:shadow-red-500/25 hover:scale-[1.02]'
                : saveStatus === 'saving'
                ? 'bg-[var(--elevated)] text-[var(--text-secondary)] cursor-wait'
                : 'bg-[var(--elevated)] text-[var(--text-primary)] hover:bg-[var(--border)] hover:scale-[1.02]'
            }`}
            title="保存"
          >
            <Save className="h-4 w-4" />
            {saveStatus === 'saving' ? '保存中...' : saveStatus === 'error' ? '重试保存' : '保存'}
          </button>
          <span className="w-px h-5 bg-[var(--border)]" />
          <button
            onClick={() => setShowVersionHistory(true)}
            className="p-2 rounded-xl hover:bg-[var(--elevated)] text-[var(--text-secondary)] transition-colors"
            title="版本历史"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowBrainstorm(true)}
            className="p-2 rounded-xl hover:bg-[var(--elevated)] text-[var(--text-secondary)] transition-colors"
            title="头脑风暴"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
            </svg>
          </button>
          <button
            onClick={handleExtractEntities}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl hover:bg-[var(--elevated)] text-[var(--text-secondary)] border border-[var(--border)] transition-colors"
            title="从正文中提取新角色和地点"
          >
            <UserPlus size={16} />
            <span>提取角色</span>
          </button>
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className="p-2 rounded-xl hover:bg-[var(--elevated)] text-[var(--text-secondary)] transition-colors"
            title={isFocusMode ? '退出专注模式' : '专注模式'}
          >
            {isFocusMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden min-h-0">
        {suggestion && (
          <SummarySuggestion
            suggestion={suggestion}
            onAccept={handleAcceptSuggestion}
            onDismiss={() => setSuggestion(null)}
          />
        )}
        {extractedEntities && (
          <EntityExtractor
            entities={extractedEntities}
            onAccept={handleAcceptEntities}
            onDismiss={() => setExtractedEntities(null)}
          />
        )}
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
        onSaveNote={(note) => {
          const notes = [...(currentProject?.notes || []), note];
          updateProject(currentProject.id, { notes });
          markUnsaved();
          toast.success('已保存到笔记');
        }}
      />

      <button
        onClick={() => setShowNotes(!showNotes)}
        className="fixed right-4 bottom-4 z-30 p-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300"
        title="灵感笔记"
      >
        <StickyNote className="h-5 w-5" />
      </button>

      <NotesDrawer
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
        notes={currentProject?.notes || []}
        onNotesChange={(notes) => { updateProject(currentProject.id, { notes }); markUnsaved(); }}
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
