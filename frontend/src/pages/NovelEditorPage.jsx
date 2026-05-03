import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Maximize2, History } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { useSave } from '../hooks/useSave';
import { EditorToolbar } from '../components/novel/EditorToolbar';
import { EditorSidebar } from '../components/novel/EditorSidebar';
import { ChapterEditor } from '../components/novel/ChapterEditor';
import { OutlineTab } from '../components/novel/tabs/OutlineTab';
import { CharacterTab } from '../components/novel/tabs/CharacterTab';
import { WorldTab } from '../components/novel/tabs/WorldTab';
import { StatsPanel } from '../components/novel/StatsPanel';
import { SettingsTab } from '../components/novel/tabs/SettingsTab';
import { ExportTab } from '../components/novel/tabs/ExportTab';
import { BrainstormModal } from '../components/novel/BrainstormModal';
import { VersionHistory } from '../components/novel/VersionHistory';

export function NovelEditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const {
    currentProject, setCurrentProject, clearCurrentProject,
    activeTab, setActiveTab, editingChapterId, setEditingChapterId,
    saveStatus, lastSavedAt, markUnsaved,
    isGeneratingChapter, setIsGeneratingChapter,
    updateProject,
  } = useNovelStore();
  const { save } = useSave();

  const handleBack = useCallback(() => {
    navigate('/novel');
  }, [navigate]);

  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useEffect(() => {
    loadProject();
    return () => {
      clearCurrentProject();
    };
  }, [projectId]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (useNovelStore.getState().isEditorDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const loadProject = async () => {
    try {
      const res = await novelApi.getProject(projectId);
      if (res.data.success) {
        setCurrentProject(res.data.project);
      } else {
        toast.error('项目不存在');
        navigate('/novel');
      }
    } catch {
      toast.error('加载项目失败');
      navigate('/novel');
    }
  };

const performSave = useCallback(async () => {
    const ok = await save();
    if (ok) {
      const proj = useNovelStore.getState().currentProject;
      if (editingChapterId) {
        const ch = (proj?.chapters || []).find((c) => c.id === editingChapterId);
        if (ch?.content) {
          novelApi.saveDraft(proj.id, editingChapterId, {
            content: ch.content,
            wordCount: (ch.content || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length,
          }).catch(() => {});
        }
      }
    }
  }, [editingChapterId, save]);

  const handleChapterContentChange = useCallback(({ html }) => {
    if (!currentProject || !editingChapterId) return;
    const chapters = (currentProject.chapters || []).map((c) =>
      c.id === editingChapterId ? { ...c, content: html } : c
    );
    updateProject(currentProject.id, { chapters });
    markUnsaved();
  }, [currentProject, editingChapterId, updateProject, markUnsaved]);

  const handleGenerateChapter = async () => {
    if (!currentProject || !editingChapterId) return;
    const chapter = (currentProject.chapters || []).find((c) => c.id === editingChapterId);
    if (!chapter) return;

    setIsGeneratingChapter(true);
    try {
      const prevIdx = currentProject.chapters.findIndex((c) => c.id === editingChapterId);
      const prevContent = prevIdx > 0
        ? (currentProject.chapters[prevIdx - 1]?.content || '').replace(/<[^>]+>/g, '')
        : '';

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
        const formattedContent = `<p>${res.data.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        const chapters = currentProject.chapters.map((c) =>
          c.id === editingChapterId ? { ...c, content: formattedContent } : c
        );
        updateProject(currentProject.id, { chapters });
        if (res.data.mock) toast.info(res.data.message);
        else toast.success('章节生成成功');
        markUnsaved();
      }
    } catch {
      toast.error('章节生成失败');
    } finally {
      setIsGeneratingChapter(false);
    }
  };

  const handleContinueChapter = async (selection) => {
    if (!currentProject || !editingChapterId) return;
    const chapter = (currentProject.chapters || []).find((c) => c.id === editingChapterId);
    if (!chapter) return;

    try {
      const plainContent = (chapter.content || '').replace(/<[^>]+>/g, '');

      if (selection?.text) {
        const res = await novelApi.rewriteText({
          selectedText: selection.text,
          instruction: '优化这段文字，使表达更生动流畅',
          genre: currentProject.genre,
          context: (selection.contextBefore || '') + (selection.text || '') + (selection.contextAfter || ''),
          characters: currentProject.characters || [],
          relationships: currentProject.relationships || [],
        });
        if (res.data.success) {
          const before = (chapter.content || '').substring(0, selection.from);
          const after = (chapter.content || '').substring(selection.to);
          // 将 \n\n 转换为段落分隔，单个 \n 用 <br> 保留换行
          const formatted = res.data.content.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
          const newContent = before + `<p>${formatted}</p>` + after;
          handleChapterContentChange({ html: newContent, text: '' });
          if (res.data.mock) toast.info(res.data.message);
          else toast.success('改写完成');
        }
      } else {
        const res = await novelApi.continueChapter({
          currentContent: plainContent,
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
          // 将 \n\n 转换为段落分隔，单个 \n 用 <br> 保留换行
          const formatted = res.data.content.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
          const newContent = (chapter.content || '') + `<p>${formatted}</p>`;
          handleChapterContentChange({ html: newContent, text: '' });
          if (res.data.mock) toast.info(res.data.message);
          else toast.success('续写完成');
        }
      }
    } catch {
      toast.error('操作失败');
    }
  };

  const handleApplyBrainstormIdea = (item) => {
    const chapter = (currentProject?.chapters || []).find((c) => c.id === editingChapterId);
    if (!chapter) return;
    const newContent = (chapter.content || '') + `<p><em>【灵感：${item.title} — ${item.description}】</em></p>`;
    handleChapterContentChange({ html: newContent, text: '' });
    toast.success('灵感已添加到文档');
  };

  const editingChapter = editingChapterId
    ? (currentProject?.chapters || []).find((c) => c.id === editingChapterId)
    : null;

  const totalWords = (currentProject?.chapters || []).reduce(
    (sum, c) => sum + (c.content || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length,
    0
  );

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
        <BookOpen className="h-8 w-8 animate-pulse opacity-50" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col -m-4 md:-m-8">
      <EditorToolbar
        project={currentProject}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        wordCount={totalWords}
        onBack={handleBack}
        onSave={performSave}
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <EditorSidebar activeTab={activeTab} onTabChange={setActiveTab} project={currentProject} />

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {activeTab === 'outline' && (
            editingChapter ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
                  <button
                    onClick={() => setEditingChapterId(null)}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--primary)]"
                  >
                    ← 返回大纲
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{editingChapter.title}</span>
                    <button
                      onClick={() => setShowVersionHistory(true)}
                      className="p-1 rounded hover:bg-[var(--background)]"
                      title="版本历史"
                    >
                      <History className="h-4 w-4 text-[var(--text-secondary)]" />
                    </button>
                    <button
                      onClick={() => navigate(`/novel/${projectId}/write/${editingChapterId}`)}
                      className="p-1 rounded hover:bg-[var(--background)]"
                      title="全屏写作"
                    >
                      <Maximize2 className="h-4 w-4 text-[var(--text-secondary)]" />
                    </button>
                  </div>
                </div>
                <ChapterEditor
                  chapter={editingChapter}
                  onContentChange={handleChapterContentChange}
                  onGenerate={handleGenerateChapter}
                  onContinue={handleContinueChapter}
                  onBrainstorm={() => setShowBrainstorm(true)}
                  isGenerating={isGeneratingChapter}
                />
              </div>
            ) : (
              <OutlineTab />
            )
          )}
          {activeTab === 'characters' && <CharacterTab />}
          {activeTab === 'world' && <WorldTab />}
          {activeTab === 'stats' && <StatsPanel project={currentProject} />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'export' && <ExportTab />}
        </div>
      </div>

      <BrainstormModal
        isOpen={showBrainstorm}
        onClose={() => setShowBrainstorm(false)}
        onApplyIdea={handleApplyBrainstormIdea}
      />

      {editingChapterId && (
        <VersionHistory
          projectId={currentProject.id}
          chapterId={editingChapterId}
          isOpen={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          onRestore={(content) => {
            handleChapterContentChange({ html: content, text: '' });
          }}
        />
      )}
    </div>
  );
}
