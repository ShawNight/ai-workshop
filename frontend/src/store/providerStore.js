import { create } from 'zustand';
import { providerApi } from '../api/provider';

const useProviderStore = create((set, get) => ({
  providers: [],
  protocols: [],
  textProvider: '',
  musicProvider: '',
  textProviderInfo: null,
  musicProviderInfo: null,
  loading: false,

  fetchProviders: async () => {
    set({ loading: true });
    try {
      const [providersRes, configRes, protocolsRes] = await Promise.all([
        providerApi.getProviders(),
        providerApi.getConfig(),
        providerApi.getProtocols(),
      ]);
      if (providersRes.data.success) {
        set({ providers: providersRes.data.providers });
      }
      if (configRes.data.success) {
        set({
          textProvider: configRes.data.textProvider,
          musicProvider: configRes.data.musicProvider,
          textProviderInfo: configRes.data.textProviderInfo,
          musicProviderInfo: configRes.data.musicProviderInfo,
        });
      }
      if (protocolsRes.data.success) {
        set({ protocols: protocolsRes.data.protocols });
      }
    } catch (e) {
      console.error('Failed to fetch provider config:', e);
    } finally {
      set({ loading: false });
    }
  },

  setTextProvider: async (name) => {
    try {
      await providerApi.updateConfig({ textProvider: name });
      set({ textProvider: name });
      const configRes = await providerApi.getConfig();
      if (configRes.data.success) {
        set({ textProviderInfo: configRes.data.textProviderInfo });
      }
    } catch (e) {
      console.error('Failed to set text provider:', e);
    }
  },

  setMusicProvider: async (name) => {
    try {
      await providerApi.updateConfig({ musicProvider: name });
      set({ musicProvider: name });
      const configRes = await providerApi.getConfig();
      if (configRes.data.success) {
        set({ musicProviderInfo: configRes.data.musicProviderInfo });
      }
    } catch (e) {
      console.error('Failed to set music provider:', e);
    }
  },

  createProvider: async (data) => {
    const res = await providerApi.createProvider(data);
    if (res.data.success) {
      await get().fetchProviders();
    }
    return res.data;
  },

  updateProvider: async (name, data) => {
    const res = await providerApi.updateProvider(name, data);
    if (res.data.success) {
      await get().fetchProviders();
    }
    return res.data;
  },

  deleteProvider: async (name) => {
    const res = await providerApi.deleteProvider(name);
    if (res.data.success) {
      await get().fetchProviders();
    }
    return res.data;
  },

  testProvider: async (name) => {
    const res = await providerApi.testProvider(name);
    return res.data;
  },
}));

export default useProviderStore;
