import { useCallback } from 'react';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';

export function useSave() {
  const { currentProject, markSaving, markSaved, setSaveStatus } = useNovelStore();

  const save = useCallback(async (project) => {
    const p = project || useNovelStore.getState().currentProject;
    if (!p) return false;
    const { markSaving: ms, markSaved: md, setSaveStatus: ss } = useNovelStore.getState();
    ms();
    try {
      const res = await novelApi.updateProject(p.id, {
        title: p.title,
        genre: p.genre,
        premise: p.premise,
        synopsis: p.synopsis,
        writingStyle: p.writingStyle,
        coverColor: p.coverColor,
        status: p.status,
        targetWordCount: p.targetWordCount,
        currentWordCount: p.currentWordCount,
        outline: p.outline,
        chapters: p.chapters,
        characters: p.characters,
        locations: p.locations,
        relationships: p.relationships,
        settings: p.settings,
      });
      if (res.data.success) {
        md();
        return true;
      } else {
        ss('error');
        return false;
      }
    } catch {
      ss('error');
      return false;
    }
  }, []);

  return { save };
}