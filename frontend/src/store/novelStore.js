import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useNovelStore = create(
  persist(
    (set) => ({
      projects: [],
      currentProject: null,

      setProjects: (projects) => set({ projects }),

      setCurrentProject: (project) => set({ currentProject: project }),

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

      clearCurrentProject: () => set({ currentProject: null }),
    }),
    {
      name: 'ai-workshop-novel',
      partialize: (state) => ({ projects: state.projects }),
    }
  )
);
