import { useState, useEffect } from 'react';
import { X, Server, MessageSquare, Music, Key, Brain } from 'lucide-react';
import useProviderStore from '../../store/providerStore';

const inputClass = [
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)]',
  'px-3 py-2 text-sm text-[var(--text-primary)]',
  'placeholder:text-[var(--text-secondary)]/50',
  'focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]',
  'transition-colors',
].join(' ');

const labelClass = 'block text-xs font-medium text-[var(--text-secondary)] mb-1.5';
const selectClass = inputClass + ' cursor-pointer';

const urlPlaceholders = {
  openai: 'https://api.deepseek.com/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-3.5 w-3.5 text-[var(--primary)]" />
      <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wide">{title}</span>
    </div>
  );
}

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
    thinkingEnabled: false,
    reasoningEffort: 'high',
    thinkingBudget: 10000,
    supportsMusic: false,
    musicUrl: '',
    musicModel: '',
    lyricsUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedProtocol = protocols.find(p => p.name === form.protocol);
  const showThinking = selectedProtocol?.supportsThinking;

  useEffect(() => {
    if (isEdit && provider) {
      setForm({
        name: provider.name,
        displayName: provider.displayName,
        protocol: provider.protocol,
        chatUrl: provider.chatUrl,
        chatModel: provider.chatModel,
        apiKey: (provider?.apiKeyBroken || !provider?.apiKeyMasked) ? '' : (provider.apiKeyMasked || ''),
        thinkingEnabled: provider.thinkingEnabled || false,
        reasoningEffort: provider.reasoningEffort || 'high',
        thinkingBudget: provider.thinkingBudget || 10000,
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Server className="h-4 w-4 text-[var(--primary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {isEdit ? '编辑' : '添加'} Provider
            </h3>
            {isEdit && provider?.displayName && (
              <span className="text-xs text-[var(--text-secondary)]">— {provider.displayName}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-[var(--text-secondary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-800/30">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <section>
            <SectionTitle icon={Server} title="基本信息" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    标识名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value.replace(/\s/g, ''))}
                    disabled={isEdit}
                    placeholder="如 deepseek"
                    className={`${inputClass} disabled:opacity-50`}
                  />
                </div>
                <div>
                  <label className={labelClass}>显示名称</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => handleChange('displayName', e.target.value)}
                    placeholder="如 DeepSeek"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>协议类型</label>
                <select
                  value={form.protocol}
                  onChange={(e) => handleChange('protocol', e.target.value)}
                  className={selectClass}
                >
                  {protocols.map(p => (
                    <option key={p.name} value={p.name}>{p.displayName}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Chat API */}
          <section>
            <SectionTitle icon={MessageSquare} title="文本生成" />
            <div className="space-y-3">
              <div>
                <label className={labelClass}>
                  API 地址 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.chatUrl}
                  onChange={(e) => handleChange('chatUrl', e.target.value)}
                  placeholder={urlPlaceholders[form.protocol] || urlPlaceholders.openai}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    模型名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.chatModel}
                    onChange={(e) => handleChange('chatModel', e.target.value)}
                    placeholder="deepseek-chat"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    <span className="inline-flex items-center gap-1">
                      <Key className="h-3 w-3" /> API Key
                    </span>
                  </label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => handleChange('apiKey', e.target.value)}
                    placeholder={isEdit ? (provider?.apiKeyBroken ? '请重新输入' : '留空则不修改') : 'sk-...'}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Thinking Mode */}
          {showThinking && (
            <section>
              <button
                type="button"
                onClick={() => handleChange('thinkingEnabled', !form.thinkingEnabled)}
                className="flex items-center gap-3 w-full"
              >
                <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${form.thinkingEnabled ? 'bg-[var(--primary)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.thinkingEnabled ? 'translate-x-4' : ''}`} />
                </div>
                <SectionTitle icon={Brain} title="思考模式" />
              </button>

              {form.thinkingEnabled && (
                <div className="mt-3 pl-4 border-l-2 border-[var(--primary)]/20 space-y-3">
                  {form.protocol === 'anthropic' ? (
                    <div>
                      <label className={labelClass}>思考预算 (tokens)</label>
                      <input
                        type="number"
                        value={form.thinkingBudget}
                        onChange={(e) => handleChange('thinkingBudget', parseInt(e.target.value) || 10000)}
                        min={1024}
                        max={128000}
                        className={inputClass}
                      />
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                        模型在思考阶段可使用的最大 token 数
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className={labelClass}>思考强度</label>
                      <select
                        value={form.reasoningEffort}
                        onChange={(e) => handleChange('reasoningEffort', e.target.value)}
                        className={selectClass}
                      >
                        <option value="high">High — 适合一般任务</option>
                        <option value="max">Max — 适合复杂推理</option>
                      </select>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                        开启后模型会先输出思维链再给出回答，temperature 等参数将被忽略
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Music */}
          <section>
            <button
              type="button"
              onClick={() => handleChange('supportsMusic', !form.supportsMusic)}
              className="flex items-center gap-3 w-full"
            >
              <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${form.supportsMusic ? 'bg-[var(--primary)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.supportsMusic ? 'translate-x-4' : ''}`} />
              </div>
              <SectionTitle icon={Music} title="音乐生成" />
            </button>

            {form.supportsMusic && (
              <div className="mt-3 pl-4 border-l-2 border-[var(--primary)]/20 space-y-3">
                <div>
                  <label className={labelClass}>音乐 API 地址</label>
                  <input
                    type="text"
                    value={form.musicUrl}
                    onChange={(e) => handleChange('musicUrl', e.target.value)}
                    placeholder="https://api.example.com/v1/music_generation"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>音乐模型</label>
                    <input
                      type="text"
                      value={form.musicModel}
                      onChange={(e) => handleChange('musicModel', e.target.value)}
                      placeholder="music-2.6"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>歌词 API</label>
                    <input
                      type="text"
                      value={form.lyricsUrl}
                      onChange={(e) => handleChange('lyricsUrl', e.target.value)}
                      placeholder="https://api.example.com/v1/lyrics"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 h-14 border-t border-[var(--border)] flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-1.5 text-sm rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
