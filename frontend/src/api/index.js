import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000,  // 5 分钟总超时
  headers: {
    'Content-Type': 'application/json'
  }
});


export const novelApi = {
  getProjects: () => api.get('/novel/projects'),
  createProject: (data) => api.post('/novel/projects', data),
  getProject: (id) => api.get(`/novel/projects/${id}`),
  updateProject: (id, data) => api.put(`/novel/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/novel/projects/${id}`),
  generateOutline: (data) => api.post('/novel/generate-outline', data),
  generateOutlineDirections: (data) => api.post('/novel/generate-outline-directions', data),
  generateChapter: (data) => api.post('/novel/generate-chapter', data),
  createCharacter: (data) => api.post('/novel/character', data),
  generateCharacters: (data) => api.post('/novel/generate-characters', data),
  generateLocations: (data) => api.post('/novel/generate-locations', data),
  generateLocation: (data) => api.post('/novel/generate-location', data),
  continueChapter: (data) => api.post('/novel/continue-chapter', data),
  rewriteText: (data) => api.post('/novel/rewrite', data),
  brainstorm: (data) => api.post('/novel/brainstorm', data),
  chat: (data) => api.post('/novel/chat', data),
  getStats: (projectId) => api.get(`/novel/projects/${projectId}/stats`),
  saveDraft: (projectId, chapterId, data) => api.post(`/novel/projects/${projectId}/drafts/${chapterId}`, data),
  updateChapter: (projectId, chapterId, data) => api.put(`/novel/projects/${projectId}/chapters/${chapterId}`, data),
  getDrafts: (projectId, chapterId) => api.get(`/novel/projects/${projectId}/drafts/${chapterId}`),
  getDraftContent: (draftId) => api.get(`/novel/drafts/${draftId}`),
  logWriting: (projectId, data) => api.post(`/novel/projects/${projectId}/stats/log`, data),
  extractEntities: (data) => api.post('/novel/extract-entities', data),
  // 全自动小说 Harness
  generateDesign: (data) => api.post('/novel/generate-design', data),
  autoChapter: (data) => api.post('/novel/auto-chapter', data),
  qualityCheck: (data) => api.post('/novel/quality-check', data),
  reviseDesign: (data) => api.post('/novel/revise-design', data),
  reviseBlock: (data) => api.post('/novel/revise-block', data),
  // 章节人工编辑
  manualEditChapter: (projectId, chapterId, data) =>
    api.put(`/novel/projects/${projectId}/chapters/${chapterId}/manual-edit`, data),
  resetManualEdit: (projectId, chapterId) =>
    api.delete(`/novel/projects/${projectId}/chapters/${chapterId}/reset-manual`),
};

export const harnessApi = {
  start: (data) => api.post('/harness/start', data),
  getState: (projectId) => api.get(`/harness/state/${projectId}`),
  advance: (data) => api.post('/harness/advance', data),
  autoAdvance: (data) => api.post('/harness/auto', data),
  reset: (projectId) => api.post(`/harness/reset/${projectId}`),
  intervene: (data) => api.post('/harness/intervene', data),
  approve: (data) => api.post('/harness/approve', data),
  pause: (data) => api.post('/harness/pause', data),
  resume: (data) => api.post('/harness/resume', data),
  getAgentConfig: () => api.get('/harness/agent-config'),
  updateAgentConfig: (data) => api.put('/harness/agent-config', data),
  refineMeta: (data) => api.post('/harness/refine-meta', data),
  // Agent 运行历史
  listAgentRuns: (projectId, params = {}) =>
    api.get(`/harness/agent-runs/${projectId}`, { params }),
  getAgentRun: (runId) => api.get(`/harness/agent-run/${runId}`),
  getLatestAgentRun: (projectId, agentName) =>
    api.get(`/harness/agent-latest/${projectId}/${agentName}`),
  retryAgent: (projectId, agentName, phase) =>
    api.post('/harness/retry-agent', { projectId, agentName, phase }),
  runSingleAgent: (projectId, agentName) =>
    api.post('/harness/run-single-agent', { projectId, agentName }),
  // 设计蓝图
  getBlueprint: (projectId) => api.get(`/harness/blueprint/${projectId}`),
  updateBlueprint: (projectId, design) =>
    api.put(`/harness/blueprint/${projectId}`, { design }),
  getBlueprintDiff: (projectId) => api.get(`/harness/blueprint-diff/${projectId}`),
};

export default api;

