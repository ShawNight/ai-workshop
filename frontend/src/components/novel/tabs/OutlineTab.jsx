import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, ChevronRight, ChevronDown, Maximize2, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { novelApi } from '../../../api';
import { useNovelStore } from '../../../store/novelStore';

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function mergeOutlineToChapters(existingChapters, newOutline) {
  const result = existingChapters.map((c, i) => {
    if (i < newOutline.length) {
      return { ...c, title: newOutline[i].title, description: newOutline[i].description || '' };
    }
    return c;
  });
  for (let i = result.length; i < newOutline.length; i++) {
    result.push({
      id: generateId(),
      title: newOutline[i].title,
      content: '',
      status: 'draft',
      order: i,
      description: newOutline[i].description || '',
    });
  }
  return result;
}

export function OutlineTab() {
  const navigate = useNavigate();
  const { currentProject, updateProject, setIsGeneratingOutline, isGeneratingOutline, setEditingChapterId } = useNovelStore();
  const [expanded, setExpanded] = useState({});

  if (!currentProject) return null;

  const chapters = currentProject.chapters || [];

  const handleGenerateOutline = async () => {
    setIsGeneratingOutline(true);
    try {
      const res = await novelApi.generateOutline({
        premise: currentProject.premise || '一个关于成长和冒险的故事',
        genre: currentProject.genre,
        synopsis: currentProject.synopsis || '',
      });
      if (res.data.success) {
        const newOutline = res.data.outline;
        const mergedChapters = mergeOutlineToChapters(chapters, newOutline);
        updateProject(currentProject.id, { outline: newOutline, chapters: mergedChapters });
        if (res.data.mock) toast.info(res.data.message);
        else toast.success(`大纲生成成功，已更新 ${newOutline.length} 个章节`);
      } else {
        toast.error(res.data.error || '生成失败');
      }
    } catch {
      toast.error('大纲生成失败');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleAddChapter = () => {
    const newChapter = {
      id: generateId(),
      title: `第${chapters.length + 1}章`,
      content: '',
      status: 'draft',
      order: chapters.length,
      description: '',
    };
    updateProject(currentProject.id, { chapters: [...chapters, newChapter] });
  };

  const handleDeleteChapter = (chapterId) => {
    updateProject(currentProject.id, {
      chapters: chapters.filter((c) => c.id !== chapterId),
    });
  };

  const handleUpdateChapter = (chapterId, updates) => {
    updateProject(currentProject.id, {
      chapters: chapters.map((c) => c.id === chapterId ? { ...c, ...updates } : c),
    });
  };

  const toggleExpand = (chapterId) => {
    setExpanded((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">章节大纲</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleAddChapter}>
            <Plus className="h-4 w-4" />
            添加章节
          </Button>
          <Button
            onClick={handleGenerateOutline}
            disabled={isGeneratingOutline}
            loading={isGeneratingOutline}
            variant="secondary"
            size="sm"
          >
            <Sparkles className="h-4 w-4" />
            AI 生成大纲
          </Button>
        </div>
      </div>

      {chapters.length > 0 ? (
        <div className="space-y-1">
          {chapters.map((chapter, idx) => {
            const isExpanded = expanded[chapter.id];
            const wordCount = (chapter.content || '').replace(/<[^>]+>/g, '').replace(/\s/g, '').length;
            const hasDescription = !!(chapter.description || '').trim();

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
                    {hasDescription
                      ? (isExpanded ? <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />)
                      : <span className="w-4" />
                    }
                  </button>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/10 text-blue-500 flex-shrink-0">
                    章
                  </span>
                  <span
                    className="flex-1 text-sm font-medium truncate"
                    onClick={(e) => { e.stopPropagation(); setEditingChapterId(chapter.id); }}
                    role="button"
                    title="点击编辑章节"
                  >
                    {chapter.title || `第${idx + 1}章`}
                  </span>
                  {wordCount > 0 && (
                    <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                      {wordCount} 字
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ opacity: 1 }}
                  >
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
                {isExpanded && hasDescription && (
                  <div className="px-3 pb-2.5 ml-6">
                    <textarea
                      value={chapter.description || ''}
                      onChange={(e) => handleUpdateChapter(chapter.id, { description: e.target.value })}
                      className="w-full text-sm text-[var(--text-secondary)] bg-transparent border border-[var(--border)] rounded-md p-2 resize-none focus:outline-none focus:border-[var(--primary)]/50"
                      rows={2}
                      placeholder="添加写作指导..."
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
          <p className="text-xs text-[var(--text-secondary)] mt-1">或手动添加章节</p>
        </div>
      )}
    </div>
  );
}
