import { useEffect, useState } from 'react';
import { Loader2, Check, X, ChevronRight, FileText } from 'lucide-react';
import { harnessApi } from '../../api';
import { cn } from '../../lib/utils';

const STATUS_BADGE = {
  success: { icon: Check, className: 'text-green-400', label: '成功' },
  error:   { icon: X,     className: 'text-red-400',   label: '失败' },
};

export function AgentRunList({ projectId, agentKey, onSelectRun, compact = false }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chapterFilter, setChapterFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (agentKey) params.agent = agentKey;
      if (chapterFilter !== '') params.chapter = chapterFilter;
      const res = await harnessApi.listAgentRuns(projectId, params);
      if (res.data.success) setRuns(res.data.runs);
    } catch (e) {
      console.error('load runs failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, agentKey, chapterFilter]);

  return (
    <div className={cn('p-6', compact && 'p-0')}>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-[var(--text-secondary)]">章节筛选</label>
        <input
          type="number"
          min="0"
          value={chapterFilter}
          onChange={e => setChapterFilter(e.target.value)}
          placeholder="全部"
          className="w-24 h-8 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-xs"
        />
        <span className="text-xs text-[var(--text-secondary)] ml-auto">
          共 {runs.length} 条运行
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />加载中...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--text-secondary)]">
          暂无运行记录
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => {
            const badge = STATUS_BADGE[run.status] || STATUS_BADGE.success;
            const Icon = badge.icon;
            return (
              <button
                key={run.id}
                onClick={() => onSelectRun?.(run)}
                className="w-full text-left p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--elevated)] transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', badge.className)} />
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    {new Date(run.createdAt).toLocaleString('zh-CN')}
                  </span>
                  {run.chapterIndex != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
                      第 {run.chapterIndex + 1} 章
                    </span>
                  )}
                  {run.phase && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-300">
                      {run.phase}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-[var(--text-secondary)]">
                    {run.durationMs ? (run.durationMs / 1000).toFixed(1) + 's' : '—'}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] line-clamp-2 font-mono">
                  {run.output ? run.output.slice(0, 160) : '(无输出)'}
                </div>
                {run.error && (
                  <div className="text-xs text-red-400 mt-1 line-clamp-1">
                    ⚠ {run.error}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
