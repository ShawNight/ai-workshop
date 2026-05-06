import { useCallback } from 'react';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { formatAIContent } from '../utils/formatContent';
import { toast } from '../components/ui/Toast';

export function useChapterActions(directChapterId = null) {
  const { currentProject, updateProject, setIsGeneratingChapter, markUnsaved } = useNovelStore();

  const generateChapter = useCallback(async () => {
    const project = currentProject;
    const chId = directChapterId || useNovelStore.getState().editingChapterId;
    if (!project || !chId) return;
    const chapter = (project.chapters || []).find((c) => c.id === chId);
    if (!chapter) return;

    setIsGeneratingChapter(true);
    try {
      const chapters = project.chapters || [];
      const idx = chapters.findIndex((c) => c.id === chId);
      const previousContent = idx > 0 ? (chapters[idx - 1].content || '').replace(/<[^>]+>/g, '') : '';

      const res = await novelApi.generateChapter({
        chapterTitle: chapter.title,
        premise: project.premise || '',
        genre: project.genre || '通用',
        previousContent,
        writingStyle: project.writingStyle || '',
        chapterDescription: chapter.description || '',
        characters: project.characters || [],
        relationships: project.relationships || [],
        locations: project.locations || [],
        outline: (project.outline || []).slice(0, 20),
      });

      if (res.data.success) {
        const formatted = formatAIContent(res.data.content);
        const updatedChapters = (project.chapters || []).map((c) =>
          c.id === chId ? { ...c, content: formatted } : c
        );
        updateProject(project.id, { chapters: updatedChapters });
        markUnsaved();
        if (res.data.mock) toast.info(res.data.message);
        else toast.success('章节生成成功');
      } else {
        toast.error(res.data.error || '章节生成失败');
      }
    } catch {
      toast.error('章节生成失败');
    } finally {
      setIsGeneratingChapter(false);
    }
  }, [currentProject, directChapterId, updateProject, setIsGeneratingChapter, markUnsaved]);

  const continueChapter = useCallback(async (selection) => {
    const project = currentProject;
    const chId = directChapterId || useNovelStore.getState().editingChapterId;
    if (!project || !chId) return;
    const chapter = (project.chapters || []).find((c) => c.id === chId);
    if (!chapter) return;

    const html = chapter.content || '';

    if (selection?.text) {
      try {
        const res = await novelApi.rewriteText({
          selectedText: selection.text,
          instruction: '优化这段文字，使表达更生动流畅',
          genre: project.genre || '通用',
          context: (selection.contextBefore || '') + (selection.text || '') + (selection.contextAfter || ''),
          characters: project.characters || [],
          relationships: project.relationships || [],
        });
        if (res.data.success) {
          const formatted = formatAIContent(res.data.content);
          const before = html.substring(0, selection.from);
          const after = html.substring(selection.to);
          const newContent = before + formatted + after;
          const updatedChapters = (project.chapters || []).map((c) =>
            c.id === chId ? { ...c, content: newContent } : c
          );
          updateProject(project.id, { chapters: updatedChapters });
          markUnsaved();
          if (res.data.mock) toast.info(res.data.message);
          else toast.success('改写完成');
        } else {
          toast.error(res.data.error || '改写失败');
        }
      } catch {
        toast.error('改写失败');
      }
    } else {
      const currentText = html.replace(/<[^>]+>/g, '');
      try {
        const res = await novelApi.continueChapter({
          currentContent: currentText,
          chapterTitle: chapter.title,
          premise: project.premise || '',
          genre: project.genre || '通用',
          writingStyle: project.writingStyle || '',
          characters: project.characters || [],
          relationships: project.relationships || [],
          locations: project.locations || [],
          outline: (project.outline || []).slice(0, 20),
        });
        if (res.data.success) {
          const formatted = formatAIContent(res.data.content);
          const newContent = html + formatted;
          const updatedChapters = (project.chapters || []).map((c) =>
            c.id === chId ? { ...c, content: newContent } : c
          );
          updateProject(project.id, { chapters: updatedChapters });
          markUnsaved();
          if (res.data.mock) toast.info(res.data.message);
          else toast.success('续写完成');
        } else {
          toast.error(res.data.error || '续写失败');
        }
      } catch {
        toast.error('续写失败');
      }
    }
  }, [currentProject, directChapterId, updateProject, markUnsaved]);

  return { generateChapter, continueChapter };
}