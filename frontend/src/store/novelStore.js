import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useNovelStore = create(
  persist(
    (set, get) => ({
      projects: [],
      currentProject: null,

      // Editor state (not persisted)
      activeTab: 'outline',
      saveStatus: 'saved',
      lastSavedAt: null,
      editingChapterId: null,
      isEditorDirty: false,

      // Generation state
      isGeneratingOutline: false,
      isGeneratingChapter: false,
      isGeneratingCharacter: false,

      // ==================== Project Actions ====================

      setProjects: (projects) => set({ projects }),

      setCurrentProject: (project) => set({
        currentProject: project,
        activeTab: 'outline',
        editingChapterId: null,
        saveStatus: 'saved',
        lastSavedAt: null,
        isEditorDirty: false
      }),

      addProject: (project) => set((state) => ({
        projects: [project, ...state.projects]
      })),

      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
        currentProject: state.currentProject?.id === id
          ? { ...state.currentProject, ...updates }
          : state.currentProject
      })),

      removeProject: (id) => set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject
      })),

      clearCurrentProject: () => set({
        currentProject: null,
        activeTab: 'outline',
        editingChapterId: null,
        saveStatus: 'saved',
        lastSavedAt: null,
        isEditorDirty: false
      }),

      // ==================== Editor State Actions ====================

      setActiveTab: (tab) => set({ activeTab: tab }),

      setEditingChapterId: (id) => set({ editingChapterId: id }),

      setSaveStatus: (status) => set({ saveStatus: status }),

      setEditorDirty: (dirty) => set({ isEditorDirty: dirty }),

      markSaved: () => set({ saveStatus: 'saved', lastSavedAt: Date.now(), isEditorDirty: false }),

      markSaving: () => set({ saveStatus: 'saving' }),

      markUnsaved: () => set({ saveStatus: 'unsaved', isEditorDirty: true }),

      // ==================== Generation State Actions ====================

      setIsGeneratingOutline: (val) => set({ isGeneratingOutline: val }),

      setIsGeneratingChapter: (val) => set({ isGeneratingChapter: val }),

      setIsGeneratingCharacter: (val) => set({ isGeneratingCharacter: val }),
    }),
    {
      name: 'ai-workshop-novel',
      partialize: (state) => ({ projects: state.projects }),
    }
  )
);
