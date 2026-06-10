import api from './index';

export const providerApi = {
  getProviders: () => api.get('/provider/providers'),
  getProvider: (name) => api.get(`/provider/providers/${name}`),
  createProvider: (data) => api.post('/provider/providers', data),
  updateProvider: (name, data) => api.put(`/provider/providers/${name}`, data),
  deleteProvider: (name) => api.delete(`/provider/providers/${name}`),
  testProvider: (name) => api.post(`/provider/providers/${name}/test`),
  getProtocols: () => api.get('/provider/protocols'),
  getTemplates: () => api.get('/provider/templates'),
  getConfig: () => api.get('/provider/config'),
  updateConfig: (data) => api.put('/provider/config', data),
  // 模型管理
  getModels: (name) => api.get(`/provider/providers/${name}/models`),
  addModel: (name, data) => api.post(`/provider/providers/${name}/models`, data),
  updateModel: (name, modelId, data) => api.put(`/provider/providers/${name}/models/${modelId}`, data),
  deleteModel: (name, modelId) => api.delete(`/provider/providers/${name}/models/${modelId}`),
};
