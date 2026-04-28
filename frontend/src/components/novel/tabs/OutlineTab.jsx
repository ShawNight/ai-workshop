import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, ChevronDown, Maximize2, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { novelApi } from '../../../api';
import { useNovelStore } from '../../../store/novelStore';

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function appendOutlineToChapters(existingChapters, newOutline, startIndex) {
  const newChapters = newOutline.map((item, i) => ({
    id: generateId(),
    title: item.title,
    content: '',
    status: 'draft',
    order: startIndex + i,
    description: item.description || '',
  }));
  return [...existingChapters, ...newChapters];
}

export function OutlineTab() {
  const navigate = useNavigate();
  const { currentProject, updateProject, setIsGeneratingOutline, isGeneratingOutline, markUnsaved, markSaving, markSaved, setSaveStatus } = useNovelStore();
  const [expanded, setExpanded] = useState({});
  const [chapterCount, setChapterCount] = useState(8);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const inputRef = useRef(null);
  const autoSaveTimer = useRef(null);

  const debouncedSave = useCallback(() => {
    if (!currentProject) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    markUnsaved();
    autoSaveTimer.current = setTimeout(async () => {
      if (!currentProject) return;
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
        if (res.data.success) markSaved();
        else setSaveStatus('error');
      } catch {
        setSaveStatus('error');
      }
    }, 2000);
  }, [currentProject, markUnsaved, markSaving, markSaved, setSaveStatus]);

  useEffect(() => {
    if (editingTitleId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTitleId]);

  if (!currentProject) return null;

  const chapters = currentProject.chapters || [];

  const handleGenerateOutline = async () => {
    setIsGeneratingOutline(true);
    try {
      const existingChapters = chapters.map((c) => ({
        title: c.title,
        description: c.description || '',
      }));

      const res = await novelApi.generateOutline({
        premise: currentProject.premise || '一个关于成长和冒险的故事',
        genre: currentProject.genre,
        synopsis: currentProject.synopsis || '',
        chapterCount: chapterCount,
        existingChapters: existingChapters,
      });

      if (res.data.success) {
        const newOutline = res.data.outline;
        let updatedChapters;

        if (chapters.length > 0) {
          updatedChapters = appendOutlineToChapters(chapters, newOutline, chapters.length);
        } else {
          updatedChapters = appendOutlineToChapters([], newOutline, 0);
        }

        const newOutlineItems = chapters.length > 0
          ? [...(currentProject.outline || []), ...newOutline]
          : newOutline;

        updateProject(currentProject.id, { outline: newOutlineItems, chapters: updatedChapters });
        debouncedSave();

        if (res.data.mock) toast.info(res.data.message);
        else {
          const msg = chapters.length > 0
            ? `追加成功，新增 ${newOutline.length} 个章节`
            : `大纲生成成功，已生成 ${newOutline.length} 个章节`;
          toast.success(msg);
        }
      } else {
        toast.error(res.data.error || '生成失败');
      }
    } catch {
      toast.error('大纲生成失败');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleDeleteChapter = (chapterId) => {
    updateProject(currentProject.id, {
      chapters: chapters.filter((c) => c.id !== chapterId),
    });
    debouncedSave();
  };

  const handleUpdateChapter = (chapterId, updates) => {
    updateProject(currentProject.id, {
      chapters: chapters.map((c) => c.id === chapterId ? { ...c, ...updates } : c),
    });
    debouncedSave();
  };

  const handleTitleDoubleClick = (chapter) => {
    setEditingTitleId(chapter.id);
    setEditingTitleValue(chapter.title || '');
  };

  const handleTitleConfirm = (chapterId) => {
    if (editingTitleValue.trim()) {
      handleUpdateChapter(chapterId, { title: editingTitleValue.trim() });
    }
    setEditingTitleId(null);
    setEditingTitleValue('');
  };

  const handleTitleKeyDown = (e, chapterId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleConfirm(chapterId);
    } else if (e.key === 'Escape') {
      setEditingTitleId(null);
      setEditingTitleValue('');
    }
  };

  const toggleExpand = (chapterId) => {
    setExpanded((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">章节大纲</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-[var(--text-secondary)]">章节数</label>
            <input
              type="number"
              min={1}
              max={50}
              value={chapterCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) setChapterCount(v);
              }}
              className="w-14 h-7 text-sm text-center border border-[var(--border)] rounded-md bg-[var(--surface)] focus:outline-none focus:border-[var(--primary)]/50"
            />
          </div>
          <Button
            onClick={handleGenerateOutline}
            disabled={isGeneratingOutline}
            loading={isGeneratingOutline}
            variant="secondary"
            size="sm"
          >
            <Sparkles className="h-4 w-4" />
            {chapters.length > 0 ? 'AI 追加章节' : 'AI 生成大纲'}
          </Button>
        </div>
      </div>

      {chapters.length > 0 ? (
        <div className="space-y-1">
          {chapters.map((chapter, idx) => {
            const isExpanded = expanded[chapter.id];
            const wordCount = (chapter.content || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length;
            const hasDescription = !!(chapter.description || '').trim();
            const descriptionPlaceholder = hasDescription ? '添加写作指导...' : '暂无章节简介，点击添加...';
            const isEditingTitle = editingTitleId === chapter.id;

            return (
              <div
                key={chapter.id}
                className="rounded-lg border border-[var(--border)] hover:border-[var(--primary)]/30 transition-colors"
              >
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                  onClick={() => toggleExpand(chapter.id)}
                >
                  <button className="p-0.5 flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleExpand(chapter.id); }}>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />}
                  </button>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/10 text-blue-500 flex-shrink-0">
                    {idx + 1}
                  </span>
                  {isEditingTitle ? (
                    <input
                      ref={inputRef}
                      value={editingTitleValue}
                      onChange={(e) => setEditingTitleValue(e.target.value)}
                      onBlur={() => handleTitleConfirm(chapter.id)}
                      onKeyDown={(e) => handleTitleKeyDown(e, chapter.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-sm font-medium bg-[var(--surface)] border border-[var(--primary)]/50 rounded px-1.5 py-0.5 focus:outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm font-medium truncate cursor-text"
                      onDoubleClick={(e) => { e.stopPropagation(); handleTitleDoubleClick(chapter); }}
                      title="双击编辑标题"
                    >
                      {chapter.title || `第${idx + 1}章`}
                    </span>
                  )}
                  {wordCount > 0 && (
                    <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                      {wordCount} 字
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 flex-shrink-0" style={{ opacity: 1 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/novel/${currentProject.id}/write/${chapter.id}`); }}
                      className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-secondary)]"
                      title="全屏写作"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chapter.id); }}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-2.5 ml-6">
                    <textarea
                      value={chapter.description || ''}
                      onChange={(e) => handleUpdateChapter(chapter.id, { description: e.target.value })}
                      className="w-full text-sm text-[var(--text-secondary)] bg-transparent border border-[var(--border)] rounded-md p-2 resize-none focus:outline-none focus:border-[var(--primary)]/50"
                      rows={2}
                      placeholder={descriptionPlaceholder}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-[var(--border)] rounded-xl">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-[var(--text-secondary)] opacity-50" />
          <p className="text-sm text-[var(--text-secondary)]">点击「AI 生成大纲」自动生成故事结构</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">可设置章节数目，生成后双击标题可编辑</p>
        </div>
      )}
    </div>
  );
}