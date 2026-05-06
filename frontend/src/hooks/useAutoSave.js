import { useCallback, useEffect, useRef } from 'react';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { stripHtml } from '../utils/formatContent';

export function useAutoSave(projectId, chapterId = null) {
  const timerRef = useRef(null);

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
      });
      const savedProject = useNovelStore.getState().currentProject;
      await saveDraft(savedProject || project, chapterId);
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
    const state = useNovelStore.getState();
    if (state.isEditorDirty) {
      scheduleSave();
    }
    return () => cancelPending();
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

  return { save, scheduleSave, cancelPending };
}