import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, GitBranch, FileText, Activity,
  Play, Pause, RotateCcw, Settings, Eye, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { harnessApi, novelApi } from '../api';
import { toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { ActivityLog } from '../components/novel/ActivityLog';
import { useHarnessSSE } from '../lib/useHarnessSSE';
import { AGENT_META } from '../components/novel/AgentNodeDetailDrawer';
import { cn } from '../lib/utils';

const PHASE_LABELS = {
  idle: '未启动',
  planning: '策划中',
  writing: '写作中',
  reviewing: '审查中',
  revising: '修改中',
  polishing: '润色中',
  checkpoint: '等待审批',
  complete: '已完成',
};

const PHASE_COLORS = {
  idle: 'text-slate-400',
  planning: 'text-violet-300',
  writing: 'text-violet-300',
  reviewing: 'text-amber-300',
  revising: 'text-amber-300',
  polishing: 'text-amber-300',
  checkpoint: 'text-amber-400',
  complete: 'text-green-400',
};

export function ProjectOverviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRunning, setAutoRunning] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, stateRes] = await Promise.all([
        novelApi.getProject(projectId),
        harnessApi.getState(projectId).catch(() => ({ data: { success: false, state: null } })),
      ]);
      if (projRes.data.success) setProject(projRes.data.project);
      if (stateRes.data.success) setState(stateRes.data.state);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleSSE = useCallback((event) => {
    if (event.type === 'init') {
      if (event.state) setState(event.state);
    } else if (['agent_step_done', 'auto_progress', 'task_completed', 'task_failed',
                 'paused', 'checkpoint_approved', 'blueprint_updated'].includes(event.type)) {
      load();
    }
  }, [load]);

  const { connected } = useHarnessSSE(projectId, { onEvent: handleSSE });

  const handleStart = async () => {
    setActing(true);
    try {
      const res = await harnessApi.advance({ projectId });
      if (res.data.success) {
        toast.success('策划师已启动！');
        load();
        navigate(`/novel/${projectId}/workflow`);
      } else {
        toast.error(res.data.error || '启动失败');
      }
    } finally { setActing(false); }
  };

  const handleResume = async () => {
    setAutoRunning(true);
    try {
      await harnessApi.resume({ projectId, batchSize: 5 });
      toast.success('继续创作');
    } catch { toast.error('继续失败'); setAutoRunning(false); }
  };

  const handlePause = async () => {
    try {
      await harnessApi.pause({ projectId });
      setAutoRunning(false);
      toast.success('将在当前章节完成后暂停');
      load();
    } catch { toast.error('暂停失败'); }
  };

  const handleReset = async () => {
    if (!window.confirm('确定要重置整个工作流吗？所有已生成的章节不会被删除，但状态会回到 idle。')) return;
    try {
      await harnessApi.reset(projectId);
      toast.success('已重置');
      load();
    } catch { toast.error('重置失败'); }
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

  if (!project) return <div className="p-8">项目不存在</div>;

  const phase = state?.phase || project.status || 'idle';
  const totalChapters = state?.totalChapters || project.chapters?.length || 0;
  const completedChapters = state?.completedChapters || project.chapters?.filter(c => c.status === 'polished').length || 0;
  const progress = totalChapters > 0 ? Math.round(completedChapters / totalChapters * 100) : 0;
  const isComplete = phase === 'complete';
  const isIdle = phase === 'idle' || !state;
  const isActive = !isIdle && !isComplete;
  const polishedChapters = (project.chapters || []).filter(c => c.status === 'polished' && c.content);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Link to="/novel" className="p-2 rounded-lg hover:bg-[var(--elevated)] transition-colors text-[var(--text-secondary)] flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ backgroundColor: project.coverColor || '#6366F1' }} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold truncate">{project.title}</h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-secondary)] flex-wrap">
                <span>{project.genre}</span>
                <span>·</span>
                <span>{project.writingStyle}</span>
                {project.targetWordCount > 0 && (
                  <>
                    <span>·</span>
                    <span>目标 {(project.targetWordCount / 10000).toFixed(0)}万字</span>
                  </>
                )}
              </div>
              {project.synopsis && (
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 line-clamp-2 italic">
                  {project.synopsis}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isActive && (
            <span className={cn('w-2 h-2 rounded-full', connected ? 'bg-green-400' : 'bg-yellow-400')} />
          )}
          <span className={cn('text-sm font-medium', PHASE_COLORS[phase] || 'text-[var(--text-secondary)]')}>
            {PHASE_LABELS[phase] || phase}
          </span>
        </div>
      </div>

      {/* Progress card */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Stat label="当前阶段" value={PHASE_LABELS[phase] || phase} />
          <Stat label="章节进度" value={totalChapters > 0 ? `${completedChapters} / ${totalChapters}` : '—'} />
          <Stat label="总字数" value={(project.currentWordCount || 0).toLocaleString()} />
          <Stat label="完成度" value={`${progress}%`} />
        </div>
        <div className="h-2 bg-[var(--elevated)] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all duration-500"
               style={{ width: `${progress}%` }} />
        </div>
        {isActive && state?.currentAgent && (
          <div className="mt-3 text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            当前 Agent: {AGENT_META[state.currentAgent]?.label || state.currentAgent}
            （第 {(state.currentChapterIndex || 0) + 1} 章）
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to={`/novel/${projectId}/workflow`}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group">
            <GitBranch className="h-8 w-8 text-violet-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-base font-semibold">工作流</div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {isComplete ? '查看完整 Agent 协作记录' : isIdle ? '启动多 Agent 协作' : '查看 Agent 运行 / 输入 / 输出'}
            </p>
          </div>
        </Link>
        <Link to={`/novel/${projectId}/blueprint`}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group">
            <FileText className="h-8 w-8 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-base font-semibold">设计蓝图</div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              大纲 / 角色 / 世界规则 / 伏笔（每章完成后自动更新）
            </p>
          </div>
        </Link>
        <Link to={`/novel/${projectId}/read`}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group">
            <BookOpen className="h-8 w-8 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-base font-semibold">阅读器</div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {polishedChapters.length > 0
                ? `已发布 ${polishedChapters.length} 章 · 可边读边改`
                : '完成章节后可阅读'}
            </p>
          </div>
        </Link>
      </div>

      {/* Control bar */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 flex flex-wrap items-center gap-2">
        {isIdle && (
          <>
            <Button onClick={handleStart} disabled={acting} size="lg">
              <Play className="h-4 w-4" />启动 Agent 团队
            </Button>
            <span className="text-xs text-[var(--text-secondary)]">
              启动后策划师将基于种子创意生成完整设计蓝图
            </span>
          </>
        )}
        {isActive && (
          <>
            {state?.paused ? (
              <Button onClick={handleResume} disabled={autoRunning}>
                <Play className="h-4 w-4" />继续创作
              </Button>
            ) : (
              <Button variant="outline" onClick={handlePause}>
                <Pause className="h-4 w-4" />暂停
              </Button>
            )}
            <Link to={`/novel/${projectId}/workflow`}>
              <Button variant="outline">
                <Eye className="h-4 w-4" />查看工作流
              </Button>
            </Link>
          </>
        )}
        {isComplete && (
          <span className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4" /> 全部章节已完成
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Link to={`/novel/${projectId}/read`}>
            <Button variant="ghost">
              <BookOpen className="h-4 w-4" />开始阅读
            </Button>
          </Link>
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />重置
          </Button>
        </div>
      </div>

      {/* Activity log */}
      {state?.activityLog && state.activityLog.length > 0 && (
        <ActivityLog log={state.activityLog.slice(-15)} />
      )}

      {/* Settings link */}
      <div className="text-center">
        <Link to="/settings" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1">
          <Settings className="h-3 w-3" />在设置中调整各 Agent 的模型配置
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
