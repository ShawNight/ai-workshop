import { useState } from 'react';
import { Plus, Sparkles, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { novelApi } from '../../../api';
import { useNovelStore } from '../../../store/novelStore';
import { OutlineNode, createNewNode } from '../OutlineNode';

export function OutlineTab() {
  const { currentProject, updateProject, setIsGeneratingOutline, isGeneratingOutline } = useNovelStore();
  const [expanded, setExpanded] = useState({});

  if (!currentProject) return null;

  const outline = currentProject.outline || [];
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
        updateProject(currentProject.id, { outline: res.data.outline });
        if (res.data.mock) toast.info(res.data.message);
        else toast.success('大纲生成成功');
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
    // 如果已生成大纲，优先使用大纲对应序号的标题
    const nextIdx = chapters.length;
    const outlineTitle = outline[nextIdx]?.title;
    const newChapter = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: outlineTitle || `第${chapters.length + 1}章`,
      content: '',
      status: 'draft',
      order: chapters.length,
    };
    updateProject(currentProject.id, { chapters: [...chapters, newChapter] });
  };

  const handleImportFromOutline = () => {
    if (outline.length === 0) {
      toast.info('请先生成大纲');
      return;
    }
    const newChapters = outline.map((item, idx) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: item.title,
      content: '',
      status: 'draft',
      order: idx,
    }));
    updateProject(currentProject.id, { chapters: [...chapters, ...newChapters] });
    toast.success(`已从大纲导入 ${newChapters.length} 个章节`);
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

  const toggleExpand = (idx) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">故事大纲</h2>
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

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            AI 生成的章节纲要
          </h3>
          {outline.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--text-secondary)]">{outline.length} 章大纲</span>
                <Button size="sm" variant="ghost" onClick={handleImportFromOutline}>
                  <Plus className="h-3 w-3 mr-1" />
                  一键导入为章节
                </Button>
              </div>
              {outline.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-[var(--border)] hover:border-[var(--primary)]/30 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(idx)}
                >
                  <div className="flex items-center gap-2">
                    {expanded[idx] ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--text-secondary)]" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--text-secondary)]" />}
                    <div className="flex-1">
                      <span className="font-medium text-sm">{item.title}</span>
                    </div>
                    {item.wordCount && <span className="text-xs text-[var(--text-secondary)]">{item.wordCount}字</span>}
                  </div>
                  {expanded[idx] && (
                    <div className="mt-2 ml-6">
                      <p className="text-sm text-[var(--text-secondary)]">{item.description}</p>
                      {item.subChapters && item.subChapters.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.subChapters.map((sub, si) => (
                            <div key={si} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] pl-2 border-l-2 border-[var(--border)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]/30" />
                              {sub.title || sub}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-[var(--border)] rounded-xl">
              <Sparkles className="h-8 w-8 mx-auto mb-2 text-[var(--text-secondary)] opacity-50" />
              <p className="text-sm text-[var(--text-secondary)]">点击「AI 生成大纲」自动生成故事结构</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">或手动在下方添加章节</p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            章节列表 ({chapters.length})
          </h3>
          {chapters.length > 0 ? (
            <div className="space-y-1">
              {chapters.map((chapter, idx) => (
                <div
                  key={chapter.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--background)] transition-colors group"
                >
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/10 text-blue-500 flex-shrink-0">
                    章
                  </span>
                  <span className="flex-1 text-sm truncate">
                    {chapter.title || `第${idx + 1}章`}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {(chapter.content || '').replace(/\s/g, '').length > 0
                      ? `${(chapter.content || '').replace(/\s/g, '').length} 字`
                      : ''}
                  </span>
                  <button
                    onClick={() => handleDeleteChapter(chapter.id)}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-[var(--border)] rounded-xl">
              <p className="text-sm text-[var(--text-secondary)]">点击上方按钮添加章节</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
