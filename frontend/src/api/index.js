import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const musicApi = {
  generatePrompt: (data) => api.post('/music/prompt', data),
  generateLyrics: (data) => api.post('/music/lyrics', data),
  modifyLyrics: (data) => api.post('/music/lyrics/modify', data),
  generateMusic: (data) => api.post('/music/generate', data),
  getStatus: (jobId) => api.get(`/music/status/${jobId}`),
  download: (filename) => api.get(`/music/download/${filename}`, { responseType: 'blob' }),
  chat: (data) => api.post('/music/chat', data),
  getHistory: () => api.get('/music/history'),
  deleteHistory: (id) => api.delete(`/music/history/${id}`),
  exportForNetEase: (data) => api.post('/music/export/netease', data, { responseType: 'blob' }),
  checkMusicApi: () => api.get('/music/check'),
  generateLrc: (data) => api.post('/music/lrc', data)
};

export const novelApi = {
  getProjects: () => api.get('/novel/projects'),
  createProject: (data) => api.post('/novel/projects', data),
  getProject: (id) => api.get(`/novel/projects/${id}`),
  updateProject: (id, data) => api.put(`/novel/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/novel/projects/${id}`),
  generateOutline: (data) => api.post('/novel/generate-outline', data),
  generateChapter: (data) => api.post('/novel/generate-chapter', data),
  createCharacter: (data) => api.post('/novel/character', data),
  continueChapter: (data) => api.post('/novel/continue-chapter', data),
  rewriteText: (data) => api.post('/novel/rewrite', data),
  brainstorm: (data) => api.post('/novel/brainstorm', data),
  chat: (data) => api.post('/novel/chat', data),
  getStats: (projectId) => api.get(`/novel/projects/${projectId}/stats`),
  saveDraft: (projectId, chapterId, data) => api.post(`/novel/projects/${projectId}/drafts/${chapterId}`, data),
  getDrafts: (projectId, chapterId) => api.get(`/novel/projects/${projectId}/drafts/${chapterId}`),
  getDraftContent: (draftId) => api.get(`/novel/drafts/${draftId}`),
  logWriting: (projectId, data) => api.post(`/novel/projects/${projectId}/stats/log`, data),
};

export const workflowApi = {
  getWorkflows: () => api.get('/workflows'),
  createWorkflow: (data) => api.post('/workflows', data),
  getWorkflow: (id) => api.get(`/workflows/${id}`),
  updateWorkflow: (id, data) => api.put(`/workflows/${id}`, data),
  deleteWorkflow: (id) => api.delete(`/workflows/${id}`),
  executeWorkflow: (id, data) => api.post(`/workflows/${id}/execute`, data),
  getExecutionStatus: (executionId) => api.get(`/workflows/execution/${executionId}`)
};

export default api;
