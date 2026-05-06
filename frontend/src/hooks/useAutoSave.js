import { useCallback, useEffect, useRef } from 'react';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { stripHtml } from '../utils/formatContent';

export function useAutoSave(projectId, chapterId = null) {
  const timerRef = useRef(null);
  const lastSavedHashRef = useRef(null);

  const saveDraft = useCallback(async (project, chId) => {
    if (!chId) return;
    const chapter = (project?.chapters || []).find((c) => c.id === chId);
    if (chapter?.content) {
      const wordCount = stripHtml(chapter.content).length;
      await novelApi.saveDraft(project.id, chId, {
        content: chapter.content,
        wordCount,
      }).catch(() => {});
    }
  }, []);

  const save = useCallback(async () => {
    const project = useNovelStore.getState().currentProject;
    if (!project?.id) return false;

    const currentHash = JSON.stringify(project.chapters);

    if (chapterId && currentHash === lastSavedHashRef.current) {
      return true;
    }

    useNovelStore.getState().markSaving();

    try {
      if (chapterId) {
        const chapter = (project.chapters || []).find((c) => c.id === chapterId);
        if (chapter) {
          await novelApi.updateChapter(project.id, chapterId, {
            content: chapter.content,
            title: chapter.title,
          });
          await saveDraft(project, chapterId);
          lastSavedHashRef.current = currentHash;
          useNovelStore.getState().markSaved();
          return true;
        }
      }

      await novelApi.updateProject(project.id, {
        title: project.title,
        genre: project.genre,
        premise: project.premise,
        synopsis: project.synopsis,
        writingStyle: project.writingStyle,
        coverColor: project.coverColor,
        status: project.status,
        targetWordCount: project.targetWordCount,
        currentWordCount: project.currentWordCount,
        outline: project.outline,
        chapters: project.chapters,
        characters: project.characters,
        locations: project.locations,
        relationships: project.relationships,
        settings: project.settings,
        notes: project.notes,
      });
      const savedProject = useNovelStore.getState().currentProject;
      if (chapterId) {
        await saveDraft(savedProject || project, chapterId);
      }
      lastSavedHashRef.current = JSON.stringify(savedProject?.chapters || project.chapters);
      useNovelStore.getState().markSaved();
      return true;
    } catch {
      useNovelStore.getState().setSaveStatus('error');
      return false;
    }
  }, [chapterId, saveDraft]);

  const forceFullSave = useCallback(async () => {
    const project = useNovelStore.getState().currentProject;
    if (!project?.id) return false;
    useNovelStore.getState().markSaving();
    try {
      await novelApi.updateProject(project.id, {
        title: project.title,
        genre: project.genre,
        premise: project.premise,
        synopsis: project.synopsis,
        writingStyle: project.writingStyle,
        coverColor: project.coverColor,
        status: project.status,
        targetWordCount: project.targetWordCount,
        currentWordCount: project.currentWordCount,
        outline: project.outline,
        chapters: project.chapters,
        characters: project.characters,
        locations: project.locations,
        relationships: project.relationships,
        settings: project.settings,
        notes: project.notes,
      });
      if (chapterId) {
        await saveDraft(useNovelStore.getState().currentProject || project, chapterId);
      }
      lastSavedHashRef.current = JSON.stringify(project.chapters);
      useNovelStore.getState().markSaved();
      return true;
    } catch {
      useNovelStore.getState().setSaveStatus('error');
      return false;
    }
  }, [chapterId, saveDraft]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save();
    }, 3000);
  }, [save]);

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = useNovelStore.subscribe((state, prevState) => {
      if (state.isEditorDirty && !prevState.isEditorDirty) {
        scheduleSave();
      }
    });
    return unsubscribe;
  }, [scheduleSave]);

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

  return { save, forceFullSave, scheduleSave, cancelPending };
}