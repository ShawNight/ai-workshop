import { useEffect } from 'react';
import { Settings } from 'lucide-react';
import useProviderStore from '../../store/providerStore';

export function ProviderSelector() {
  const {
    providers, textProvider, musicProvider,
    loading, fetchProviders, setTextProvider, setMusicProvider
  } = useProviderStore();

  useEffect(() => {
    fetchProviders();
  }, []);

  const textProviders = providers;
  const musicProviders = providers.filter(p => p.supportsMusic);

  if (loading || providers.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] px-1">
        <Settings className="h-3.5 w-3.5" />
        <span>AI 服务</span>
      </div>
      <div className="space-y-1">
        <label className="block text-xs text-[var(--text-secondary)] px-1">文本生成</label>
        <select
          value={textProvider}
          onChange={(e) => setTextProvider(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        >
          {textProviders.map(p => (
            <option key={p.name} value={p.name}>
              {p.displayName} {!p.hasApiKey && '(未配置 Key)'}
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
            {musicProviders.map(p => (
              <option key={p.name} value={p.name}>
                {p.displayName} {!p.hasApiKey && '(未配置 Key)'}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
