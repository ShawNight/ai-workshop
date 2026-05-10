import { useEffect, useState } from 'react';
import { Settings, Plus, Edit3, Trash2, Zap } from 'lucide-react';
import useProviderStore from '../../store/providerStore';
import { ProviderEditModal } from './ProviderEditModal';

export function ProviderManager() {
  const {
    providers, textProvider, musicProvider,
    loading, fetchProviders, setTextProvider, setMusicProvider, deleteProvider, testProvider,
  } = useProviderStore();

  const [editModal, setEditModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', provider }
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const textProviders = providers;
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

  if (loading && providers.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <Settings className="h-3.5 w-3.5" />
            <span>AI 服务</span>
          </div>
          <button
            onClick={() => { setTestResult(null); setEditModal({ mode: 'create' }); }}
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"
            title="添加 Provider"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {providers.length > 0 && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="block text-xs text-[var(--text-secondary)] px-1">文本生成</label>
              <select
                value={textProvider}
                onChange={(e) => setTextProvider(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                <option value="">-- 未选择 --</option>
                {textProviders.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.displayName} {!p.apiKeySet && '(未配置 Key)'}
                  </option>
                ))}
              </select>
            </div>
            {musicProviders.length > 0 && (
              <div className="space-y-1">
                <label className="block text-xs text-[var(--text-secondary)] px-1">音乐生成</label>
                <select
                  value={musicProvider}
                  onChange={(e) => setMusicProvider(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                >
                  <option value="">-- 未选择 --</option>
                  {musicProviders.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.displayName} {!p.apiKeySet && '(未配置 Key)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          {providers.map(p => (
            <div key={p.name} className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${p.apiKeySet ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-medium truncate">{p.displayName}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[var(--text-secondary)]">
                    {p.protocol}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] truncate">
                  {p.chatModel} · {p.apiKeyMasked}
                </div>
              </div>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={() => handleTest(p.name)}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)]"
                  title="测试连接"
                  disabled={testing === p.name}
                >
                  <Zap className="h-3 w-3" />
                </button>
                <button
                  onClick={() => { setTestResult(null); setEditModal({ mode: 'edit', provider: p }); }}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-[var(--text-secondary)]"
                  title="编辑"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDelete(p.name)}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-red-400"
                  title="删除"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {providers.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)] px-2 py-1">暂无 Provider，点击 + 添加</p>
          )}
        </div>

        {testResult && (
          <div className={`text-xs px-2 py-1.5 rounded ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
            {testResult.success ? '连接成功' : `连接失败: ${testResult.error}`}
          </div>
        )}
      </div>

      {editModal && (
        <ProviderEditModal
          mode={editModal.mode}
          provider={editModal.provider}
          onClose={() => setEditModal(null)}
        />
      )}
    </>
  );
}
