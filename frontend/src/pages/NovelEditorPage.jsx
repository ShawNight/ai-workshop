import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Maximize2, History, StickyNote } from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { useAutoSave } from '../hooks/useAutoSave';
import { useChapterActions } from '../hooks/useChapterActions';
import { useHotkeys } from '../hooks/useHotkeys';
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
import { NotesDrawer } from '../components/novel/NotesDrawer';

export function NovelEditorPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const {
    currentProject, setCurrentProject, clearCurrentProject,
    activeTab, setActiveTab, editingChapterId, setEditingChapterId,
    saveStatus, lastSavedAt, markUnsaved,
    isGeneratingChapter,
    updateProject,
  } = useNovelStore();
  const { save } = useAutoSave(currentProject?.id, editingChapterId);
  const { generateChapter, continueChapter } = useChapterActions();

  const handleBack = useCallback(() => {
    navigate('/novel');
  }, [navigate]);

  useHotkeys({
    'ctrl+s': () => save(),
    'ctrl+enter': () => generateChapter(),
    'ctrl+shift+b': () => setShowBrainstorm(true),
  }, [save, generateChapter]);

  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    loadProject();
    return () => {
      clearCurrentProject();
    };
  }, [projectId]);

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



  const handleChapterContentChange = useCallback(({ html }) => {
    if (!currentProject || !editingChapterId) return;
    const chapters = (currentProject.chapters || []).map((c) =>
      c.id === editingChapterId ? { ...c, content: html } : c
    );
    updateProject(currentProject.id, { chapters });
    markUnsaved();
  }, [currentProject, editingChapterId, updateProject, markUnsaved]);

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
        onSave={save}
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
onGenerate={generateChapter}
                  onContinue={continueChapter}
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

      <button
        onClick={() => setShowNotes(!showNotes)}
        className="fixed right-4 bottom-4 z-30 p-3 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors"
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
