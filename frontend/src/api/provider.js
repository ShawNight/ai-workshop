import api from './index';

export const providerApi = {
  getProviders: () => api.get('/provider/providers'),
  getConfig: () => api.get('/provider/config'),
  updateConfig: (data) => api.put('/provider/config', data),
};
