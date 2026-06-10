import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Loader2, Filter, Sparkles, RefreshCw } from 'lucide-react';
import { harnessApi } from '../api';
import { toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { BlueprintPanel } from '../components/novel/BlueprintPanel';
import { useHarnessSSE } from '../lib/useHarnessSSE';
import { cn } from '../lib/utils';

export function BlueprintPage() {
  const { projectId } = useParams();
  const [data, setData] = useState({ design: null, changes: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterNewOnly, setFilterNewOnly] = useState(false);
  const lastDiffRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bpRes, diffRes] = await Promise.all([
        harnessApi.getBlueprint(projectId),
        harnessApi.getBlueprintDiff(projectId),
      ]);
      if (bpRes.data.success) {
        setData(prev => ({ ...prev, design: bpRes.data.design }));
      }
      if (diffRes.data.success) {
        setData(prev => ({ ...prev, changes: diffRes.data.changes }));
      }
    } catch (e) {
      console.error('load blueprint failed', e);
      toast.error('加载设计蓝图失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleSSE = useCallback((event) => {
    if (event.type === 'blueprint_updated') {
      lastDiffRef.current = event.diff;
      const cnt = (event.diff?.newCharacters?.length || 0) + (event.diff?.newForeshadows?.length || 0);
      if (cnt > 0) {
        toast.info(`📜 设计蓝图已更新 (第${event.diff.chapter}章 +${event.diff.newCharacters?.length || 0}角色 +${event.diff.newForeshadows?.length || 0}伏笔)`);
      }
      load();
    }
  }, [load]);

  useHarnessSSE(projectId, { onEvent: handleSSE });

  const handleSave = async (newDesign) => {
    setSaving(true);
    try {
      const res = await harnessApi.updateBlueprint(projectId, newDesign);
      if (res.data.success) {
        setData(prev => ({ ...prev, design: res.data.design }));
        toast.success('设计蓝图已保存');
      } else {
        throw new Error(res.data.error);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--elevated)] rounded" />
          <div className="h-40 bg-[var(--elevated)] rounded-xl" />
        </div>
      </div>
    );
  }

  const changes = data.changes || [];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link to={`/novel/${projectId}`} className="p-2 rounded-lg hover:bg-[var(--elevated)] transition-colors text-[var(--text-secondary)]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-violet-400" />
              设计蓝图
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              大纲 / 角色 / 世界规则 / 力量体系 / 地理 / 伏笔
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />刷新
          </Button>
          <button
            onClick={() => setFilterNewOnly(!filterNewOnly)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 border transition-colors',
              filterNewOnly
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            只看新增
          </button>
        </div>
      </div>

      {changes.length > 0 && (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
          <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            蓝图变更历史 (最近 {Math.min(changes.length, 5)} 条)
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {changes.slice(0, 5).map(c => (
              <div key={c.id} className="text-xs flex items-center gap-2 flex-wrap">
                <span className="text-[var(--text-secondary)]">
                  {new Date(c.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded',
                  c.source === 'user_edit' ? 'bg-blue-500/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300'
                )}>
                  {c.source === 'user_edit' ? '手动编辑' : '自动同步'}
                </span>
                {c.chapterIndex != null && (
                  <span className="text-violet-300">第{c.chapterIndex + 1}章</span>
                )}
                <span className="text-[var(--text-secondary)]">
                  {c.changeData?.new_characters?.length || 0} 角色 / {c.changeData?.new_foreshadows?.length || 0} 伏笔
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <BlueprintPanel
        design={data.design}
        changes={changes}
        filterNewOnly={filterNewOnly}
        editable={true}
        onSave={handleSave}
      />

      {saving && (
        <div className="fixed bottom-4 right-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2 text-xs flex items-center gap-2 shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          保存中...
        </div>
      )}
    </div>
  );
}
