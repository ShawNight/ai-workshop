import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import useProviderStore from '../../store/providerStore';

export function ProviderEditModal({ mode, provider, onClose }) {
  const { protocols, createProvider, updateProvider } = useProviderStore();
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    name: '',
    displayName: '',
    protocol: 'openai',
    chatUrl: '',
    chatModel: '',
    apiKey: '',
    supportsMusic: false,
    musicUrl: '',
    musicModel: '',
    lyricsUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit && provider) {
      setForm({
        name: provider.name,
        displayName: provider.displayName,
        protocol: provider.protocol,
        chatUrl: provider.chatUrl,
        chatModel: provider.chatModel,
        apiKey: provider.apiKeyMasked || '',
        supportsMusic: provider.supportsMusic,
        musicUrl: provider.musicUrl || '',
        musicModel: provider.musicModel || '',
        lyricsUrl: provider.lyricsUrl || '',
      });
    }
  }, [mode, provider]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('标识名称不能为空'); return; }
    if (!form.chatUrl.trim()) { setError('API 地址不能为空'); return; }
    if (!form.chatModel.trim()) { setError('模型名称不能为空'); return; }

    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit) {
        const result = await updateProvider(form.name, payload);
        if (!result.success) { setError(result.error); return; }
      } else {
        const result = await createProvider(payload);
        if (!result.success) { setError(result.error); return; }
      }
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">{isEdit ? '编辑' : '添加'} Provider</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">标识名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value.replace(/\s/g, ''))}
                disabled={isEdit}
                placeholder="如 deepseek, moonshot"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">显示名称</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                placeholder="如 DeepSeek"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">协议类型</label>
            <select
              value={form.protocol}
              onChange={(e) => handleChange('protocol', e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {protocols.map(p => (
                <option key={p.name} value={p.name}>{p.displayName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">API 地址</label>
            <input
              type="text"
              value={form.chatUrl}
              onChange={(e) => handleChange('chatUrl', e.target.value)}
              placeholder="https://api.deepseek.com/chat/completions"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">模型名称</label>
              <input
                type="text"
                value={form.chatModel}
                onChange={(e) => handleChange('chatModel', e.target.value)}
                placeholder="deepseek-chat"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">API Key</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => handleChange('apiKey', e.target.value)}
                placeholder={isEdit ? '不修改请留空' : 'sk-...'}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={form.supportsMusic}
                onChange={(e) => handleChange('supportsMusic', e.target.checked)}
                className="rounded"
              />
              <span>支持音乐生成</span>
            </label>

            {form.supportsMusic && (
              <div className="mt-2 space-y-2">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">音乐 API 地址</label>
                  <input
                    type="text"
                    value={form.musicUrl}
                    onChange={(e) => handleChange('musicUrl', e.target.value)}
                    placeholder="https://api.minimaxi.com/v1/music_generation"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">音乐模型</label>
                    <input
                      type="text"
                      value={form.musicModel}
                      onChange={(e) => handleChange('musicModel', e.target.value)}
                      placeholder="music-2.6"
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">歌词 API</label>
                    <input
                      type="text"
                      value={form.lyricsUrl}
                      onChange={(e) => handleChange('lyricsUrl', e.target.value)}
                      placeholder="https://api.minimaxi.com/v1/lyrics_generation"
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
