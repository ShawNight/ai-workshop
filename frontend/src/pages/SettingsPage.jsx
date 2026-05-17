import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Zap, Server, Signal, SignalZero } from 'lucide-react';
import useProviderStore from '../store/providerStore';
import { ProviderEditModal } from '../components/common/ProviderEditModal';

function StatusLabel({ provider }) {
  if (provider.apiKeyBroken) {
    return <span className="text-amber-600 dark:text-amber-400">Key 解密失败</span>;
  }
  if (!provider.apiKeySet) {
    return <span className="text-[var(--text-secondary)]/60">未配置</span>;
  }
  return <span className="text-[var(--text-secondary)]">{provider.apiKeyMasked}</span>;
}

function ProviderCard({ provider, onEdit, onDelete, onTest, testing, testResult }) {
  const statusColor = provider.apiKeyBroken
    ? 'bg-amber-400'
    : provider.apiKeySet
      ? 'bg-emerald-400'
      : 'bg-gray-300 dark:bg-gray-600';

  return (
    <div className="rounded-2xl border border-[var(--border)] overflow-hidden hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5 transition-all duration-300 bg-[var(--surface)]">
      <div className={`h-[3px] ${statusColor}`} />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--primary)]/8 flex-shrink-0">
              <Server className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {provider.displayName}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text-secondary)] flex-shrink-0">
                  {provider.protocol}
                </span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {provider.name}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            {provider.apiKeySet && !provider.apiKeyBroken ? (
              <Signal className="h-4 w-4 text-emerald-500" />
            ) : (
              <SignalZero className="h-4 w-4 text-[var(--text-secondary)]/30" />
            )}
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-[var(--text-secondary)]">模型</span>
            <p className="font-mono text-[var(--text-primary)] mt-0.5 truncate">{provider.chatModel}</p>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">API Key</span>
            <p className="mt-0.5 truncate"><StatusLabel provider={provider} /></p>
          </div>
          <div className="col-span-2">
            <span className="text-[var(--text-secondary)]">API 地址</span>
            <p className="font-mono text-[var(--text-primary)] mt-0.5 truncate text-[11px]">{provider.chatUrl}</p>
          </div>
          {provider.supportsMusic && (
            <>
              <div>
                <span className="text-[var(--text-secondary)]">音乐模型</span>
                <p className="font-mono text-[var(--text-primary)] mt-0.5 truncate">{provider.musicModel || '—'}</p>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">音乐支持</span>
                <p className="mt-0.5 text-emerald-500">已启用</p>
              </div>
            </>
          )}
          {provider.thinkingEnabled && (
            <div>
              <span className="text-[var(--text-secondary)]">思考模式</span>
              <p className="mt-0.5 text-[var(--primary)]">
                已启用 ({provider.protocol === 'anthropic' ? `${provider.thinkingBudget} tokens` : provider.reasoningEffort})
              </p>
            </div>
          )}
        </div>

        {/* Test result */}
        {testResult?.name === provider.name && (
          <div className={`mt-4 text-xs px-3 py-2.5 rounded-lg ${
            testResult.success
              ? 'bg-emerald-50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
              : 'bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/30'
          }`}>
            {testResult.success ? '连接正常' : testResult.error}
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-[var(--border)] mt-4 pt-3 flex items-center gap-3">
          <button
            onClick={() => onTest(provider.name)}
            disabled={testing === provider.name}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--primary)] transition-colors disabled:opacity-50"
          >
            <Zap className={`h-3.5 w-3.5 ${testing === provider.name ? 'animate-pulse' : ''}`} />
            {testing === provider.name ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={() => onEdit(provider)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--primary)] transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
            编辑
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onDelete(provider.name)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-red-50 dark:hover:bg-red-900/15 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const {
    providers, textProvider, musicProvider,
    loading, fetchProviders, setTextProvider, setMusicProvider,
    deleteProvider, testProvider,
  } = useProviderStore();
  const [editModal, setEditModal] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => { fetchProviders(); }, []);

  const musicProviders = providers.filter(p => p.supportsMusic);

  const handleDelete = async (name) => {
    if (!confirm(`确定删除 ${name}？`)) return;
    await deleteProvider(name);
  };

  const handleTest = async (name) => {
    setTesting(name);
    setTestResult(null);
    const result = await testProvider(name);
    setTestResult({ name, ...result });
    setTesting(null);
  };

  const handleEditClose = () => {
    setEditModal(null);
    fetchProviders();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">设置</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">管理 AI 服务提供商配置</p>
      </div>

      {/* Active provider selection */}
      {providers.length > 0 && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">当前服务</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">文本生成</label>
              <select
                value={textProvider}
                onChange={(e) => setTextProvider(e.target.value)}
                className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200 appearance-none"
                style={{ backgroundImage: 'none' }}
              >
                <option value="" className="bg-[var(--surface)] text-[var(--text-primary)]">未选择</option>
                {providers.map(p => (
                  <option key={p.name} value={p.name} className="bg-[var(--surface)] text-[var(--text-primary)]">
                    {p.displayName}{p.apiKeyBroken ? ' (Key 异常)' : !p.apiKeySet ? ' (未配置)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {musicProviders.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">音乐生成</label>
                <select
                  value={musicProvider}
                  onChange={(e) => setMusicProvider(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all duration-200"
                >
                  <option value="">未选择</option>
                  {musicProviders.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.displayName}{p.apiKeyBroken ? ' (Key 异常)' : !p.apiKeySet ? ' (未配置)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Provider list */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Provider 列表</h3>
          <button
            onClick={() => { setTestResult(null); setEditModal({ mode: 'create' }); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            添加 Provider
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
            <div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mr-3" />
            加载中...
          </div>
        ) : (
          <div className="grid gap-4">
            {providers.map(p => (
              <ProviderCard
                key={p.name}
                provider={p}
                testing={testing}
                testResult={testResult}
                onEdit={(prov) => { setTestResult(null); setEditModal({ mode: 'edit', provider: prov }); }}
                onDelete={handleDelete}
                onTest={handleTest}
              />
            ))}
            {providers.length === 0 && (
              <div className="py-16 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--border)]/50 mb-4">
                  <Server className="h-6 w-6 text-[var(--text-secondary)]/40" />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">暂无 Provider</p>
                <button
                  onClick={() => setEditModal({ mode: 'create' })}
                  className="mt-3 text-xs font-medium text-[var(--primary)] hover:underline"
                >
                  添加第一个
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {editModal && (
        <ProviderEditModal
          mode={editModal.mode}
          provider={editModal.provider}
          onClose={handleEditClose}
        />
      )}
    </div>
  );
}
