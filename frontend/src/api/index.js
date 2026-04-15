import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const musicApi = {
  generateLyrics: (data) => api.post('/music/lyrics', data),
  generateMusic: (data) => api.post('/music/generate', data),
  getStatus: (jobId) => api.get(`/music/status/${jobId}`),
  download: (filename) => api.get(`/music/download/${filename}`, { responseType: 'blob' }),
  chat: (data) => api.post('/music/chat', data),
  exportForNetEase: (data) => api.post('/music/export/netease', data, { responseType: 'blob' })
};

export const novelApi = {
  getProjects: () => api.get('/novel/projects'),
  createProject: (data) => api.post('/novel/projects', data),
  getProject: (id) => api.get(`/novel/projects/${id}`),
  updateProject: (id, data) => api.put(`/novel/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/novel/projects/${id}`),
  generateOutline: (data) => api.post('/novel/generate-outline', data),
  generateChapter: (data) => api.post('/novel/generate-chapter', data),
  createCharacter: (data) => api.post('/novel/character', data)
};

export const workflowApi = {
  getWorkflows: () => api.get('/workflows'),
  createWorkflow: (data) => api.post('/workflows', data),
  getWorkflow: (id) => api.get(`/workflows/${id}`),
  updateWorkflow: (id, data) => api.put(`/workflows/${id}`, data),
  deleteWorkflow: (id) => api.delete(`/workflows/${id}`),
  executeWorkflow: (id) => api.post(`/workflows/${id}/execute`)
};

export default api;
