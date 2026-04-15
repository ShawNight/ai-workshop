import { create } from 'zustand';

export const useWorkflowStore = create((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  selectedNode: null,
  executionStatus: null,
  
  setWorkflows: (workflows) => set({ workflows }),
  
  setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),
  
  addWorkflow: (workflow) => set((state) => ({
    workflows: [...state.workflows, workflow]
  })),
  
  updateWorkflow: (id, updates) => set((state) => ({
    workflows: state.workflows.map(w => w.id === id ? { ...w, ...updates } : w),
    currentWorkflow: state.currentWorkflow?.id === id 
      ? { ...state.currentWorkflow, ...updates } 
      : state.currentWorkflow
  })),
  
  removeWorkflow: (id) => set((state) => ({
    workflows: state.workflows.filter(w => w.id !== id),
    currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow
  })),
  
  setSelectedNode: (node) => set({ selectedNode: node }),
  
  setExecutionStatus: (status) => set({ executionStatus: status }),
  
  clearCurrentWorkflow: () => set({ currentWorkflow: null, selectedNode: null })
}));
