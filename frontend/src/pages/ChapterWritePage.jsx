import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Maximize2, Minimize2, History } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { ChapterEditor } from '../components/novel/ChapterEditor';
import { BrainstormModal } from '../components/novel/BrainstormModal';
import { VersionHistory } from '../components/novel/VersionHistory';

export function ChapterWritePage() {
  const { projectId, chapterId } = useParams();
  const navigate = useNavigate();
  const {
    currentProject, setCurrentProject, updateProject,
    isGeneratingChapter, setIsGeneratingChapter,
    markUnsaved,
  } = useNovelStore();

  const [isFocusMode, setIsFocusMode] = useState(false);
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

  const chapter = currentProject?.chapters?.find((c) => c.id === chapterId);

  const handleContentChange = useCallback(({ html, text }) => {
    if (!currentProject || !chapterId) return;
    const chapters = (currentProject.chapters || []).map((c) =>
      c.id === chapterId ? { ...c, content: html } : c
    );
    updateProject(currentProject.id, { chapters });
    markUnsaved();
  }, [currentProject, chapterId]);

  const handleGenerate = async () => {
    if (!currentProject || !chapter) return;
    setIsGeneratingChapter(true);
    try {
      const prevIdx = currentProject.chapters.findIndex((c) => c.id === chapterId);
      const prevContent = prevIdx > 0 ? currentProject.chapters[prevIdx - 1]?.content : '';
      const outlineItem = (currentProject.outline || [])[prevIdx];

      const res = await novelApi.generateChapter({
        chapterTitle: chapter.title,
        premise: currentProject.premise,
        genre: currentProject.genre,
        previousContent: prevContent,
        writingStyle: currentProject.writingStyle,
        chapterDescription: outlineItem?.description || '',
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
      }
    } catch {
      toast.error('章节生成失败');
    } finally {
      setIsGeneratingChapter(false);
    }
  };

  const handleContinue = async (selection) => {
    if (!currentProject || !chapter) return;
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
          const newContent = before + `<p>${res.data.content.replace(/\n/g, '</p><p>')}</p>` + after;
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
          const newContent = (chapter.content || '') + `<p>${res.data.content.replace(/\n/g, '</p><p>')}</p>`;
          handleContentChange({ html: newContent, text: '' });
          if (res.data.mock) toast.info(res.data.message);
          else toast.success('续写完成');
        }
      }
    } catch {
      toast.error('操作失败');
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
      {(!isFocusMode || true) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-[var(--background)]">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-semibold text-sm">{chapter.title}</h1>
              <p className="text-xs text-[var(--text-secondary)]">{currentProject.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <ChapterEditor
          chapter={chapter}
          onContentChange={handleContentChange}
          onGenerate={handleGenerate}
          onContinue={handleContinue}
          onBrainstorm={() => setShowBrainstorm(true)}
          isGenerating={isGeneratingChapter}
        />
      </div>

      {/* Focus mode status bar */}
      {isFocusMode && (
        <div className="h-1 bg-[var(--primary)]/20">
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
