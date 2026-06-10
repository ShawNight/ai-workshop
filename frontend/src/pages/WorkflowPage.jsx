import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Play, SkipForward, RotateCcw, BookOpen, Pause, Settings,
  PenLine, ShieldCheck, Loader2, GitBranch, History, Activity,
  FileText, Users, Globe, Lightbulb, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { harnessApi } from '../api';
import { DAGView } from '../components/novel/DAGView';
import { LiveWritingPanel } from '../components/novel/LiveWritingPanel';
import { CheckpointPanel } from '../components/novel/CheckpointPanel';
import { AgentNodeDetailDrawer, AGENT_META } from '../components/novel/AgentNodeDetailDrawer';
import { AgentRunList } from '../components/novel/AgentRunList';
import { ActivityLog } from '../components/novel/ActivityLog';
import { useHarnessSSE } from '../lib/useHarnessSSE';
import { cn } from '../lib/utils';

const STATUS_COLORS = {
  running: 'text-violet-400',
  done: 'text-green-400',
  error: 'text-red-400',
  idle: 'text-[var(--text-secondary)]',
};

function AgentStatusSummary({ agentStates }) {
  const states = agentStates || {};
  const running = Object.entries(states).filter(([, s]) => s.status === 'running');
  const done = Object.entries(states).filter(([, s]) => s.status === 'done').length;
  const errors = Object.entries(states).filter(([, s]) => s.status === 'error').length;

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      {running.map(([id]) => {
        const meta = AGENT_META[id] || { icon: '', label: id };
        return (
          <span key={id} className="flex items-center gap-1.5 text-violet-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{meta.label}</span>
            <LongTaskHint agentName={id} />
          </span>
        );
      })}
      {done > 0 && <span className="text-green-400">{done} 完成</span>}
      {errors > 0 && <span className="text-red-400">{errors} 失败</span>}
      {!running.length && done === 0 && errors === 0 && (
        <span className="text-[var(--text-secondary)]">等待启动</span>
      )}
    </div>
  );
}

function LongTaskHint({ agentName }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 30000);
    return () => clearTimeout(t);
  }, [agentName]);
  if (!show) return null;
  return (
    <span className="text-[10px] text-amber-300/80 italic">
      思考中...
    </span>
  );
}

// Phase Stepper
function PhaseStepper({ phase, currentChapterIndex, totalChapters }) {
  const steps = [
    { key: 'planning', label: '策划', active: ['idle', 'planning', 'checkpoint'].includes(phase) },
    {
      key: 'writing', label: phase === 'writing' || phase === 'reviewing' || phase === 'revising' || phase === 'polishing'
        ? `写作 · 第${(currentChapterIndex || 0) + 1}章`
        : '写作', active: ['writing', 'reviewing', 'revising', 'polishing'].includes(phase)
    },
    { key: 'complete', label: '完成', active: phase === 'complete' },
  ];

  const planningDone = ['writing', 'reviewing', 'revising', 'polishing', 'complete'].includes(phase);

  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const completed = (step.key === 'planning' && planningDone) ||
          (step.key === 'complete' && phase === 'complete');
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                'w-2 h-2 rounded-full',
                completed ? 'bg-green-400' :
                  step.active ? 'bg-violet-400 animate-pulse' :
                    'bg-[var(--text-secondary)]/30'
              )} />
              <span className={cn(
                'text-xs font-medium',
                completed ? 'text-green-400' :
                  step.active ? 'text-violet-400' :
                    'text-[var(--text-secondary)]'
              )}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <ChevronRight className="h-3 w-3 text-[var(--text-secondary)]/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Blueprint Tab Content
function BlueprintPanel({ design }) {
  if (!design || !design.outline) {
    return (
      <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
        <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
        等待策划完成...
      </div>
    );
  }

  const outline = design.outline || [];
  const characters = design.characters || [];
  const worldRules = design.world_rules || [];
  const foreshadows = design.foreshadows || [];
  const totalChapters = outline.reduce((sum, vol) => sum + (vol.chapters || 0), 0);

  return (
    <div className="space-y-6">
      {/* Synopsis */}
      {design.synopsis && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">故事梗概</h4>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed bg-[var(--elevated)] rounded-lg p-3">
            {design.synopsis}
          </p>
        </div>
      )}

      {/* Outline */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          大纲 ({outline.length} 卷 / {totalChapters} 章)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {outline.map((vol, i) => (
            <div key={i} className="bg-[var(--elevated)] rounded-lg p-3 border border-[var(--border)]">
              <div className="text-sm font-medium text-[var(--text-primary)]">
                第{vol.volume}卷 · {vol.title}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                {vol.chapters} 章 {vol.goal ? `— ${vol.goal}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Characters */}
      {characters.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> 角色 ({characters.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {characters.map((ch, i) => (
              <div key={i} className="bg-[var(--elevated)] rounded-lg p-3 border border-[var(--border)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{ch.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">{ch.role}</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {ch.traits?.join('、')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* World Rules */}
      {worldRules.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> 世界规则 ({worldRules.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {worldRules.map((rule, i) => (
              <div key={i} className="bg-[var(--elevated)] rounded-lg p-3 border border-[var(--border)]">
                <div className="text-sm font-medium text-[var(--text-primary)]">{rule.rule}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">{rule.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Foreshadows */}
      {foreshadows.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> 伏笔 ({foreshadows.length})
          </h4>
          <div className="space-y-2">
            {foreshadows.map((fs, i) => (
              <div key={i} className="bg-[var(--elevated)] rounded-lg p-3 border border-[var(--border)] flex items-start gap-3">
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex-shrink-0">
                  {fs.importance === '主要' ? '主要' : '次要'}
                </span>
                <div>
                  <div className="text-sm text-[var(--text-primary)]">{fs.description}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    种下: {fs.plant_stage} → 揭示: {fs.reveal_stage}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const BOTTOM_TABS = [
  { key: 'blueprint', icon: FileText, label: '蓝图' },
  { key: 'writing', icon: PenLine, label: '创作' },
  { key: 'log', icon: Activity, label: '活动日志' },
  { key: 'checkpoint', icon: ShieldCheck, label: '审批' },
  { key: 'history', icon: History, label: '运行历史' },
];

const STAGE_TABS = [
  { key: 'planning', icon: GitBranch, label: '策划' },
  { key: 'writing', icon: PenLine, label: '写作' },
  { key: 'complete', icon: CheckCircle2, label: '完成' },
];

export function WorkflowPage() {
  const { projectId } = useParams();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [showBatchSelect, setShowBatchSelect] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [contextTab, setContextTab] = useState('blueprint');
  const [activeStage, setActiveStage] = useState('planning');
  const [userHasChosenStage, setUserHasChosenStage] = useState(false);
  const [agentConfigs, setAgentConfigs] = useState({});
  const pollTimerRef = useRef(null);

  const loadState = useCallback(async () => {
    try {
      const res = await harnessApi.getState(projectId);
      if (res.data.success) {
        setState(res.data.state);
      } else if (res.data.error === '项目未初始化 Harness') {
        setState({ phase: 'idle', projectId });
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleSSEEvent = useCallback((event) => {
    if (event.type === 'init') {
      if (event.state) setState(event.state);
    } else if (event.type === 'workflow_node') {
      setState(prev => {
        if (!prev) return prev;
        const next = { ...prev, workflow: event.workflow };
        if (event.workflows) next.workflows = event.workflows;
        return next;
      });
    } else if (event.type === 'agent_step_done' || event.type === 'auto_progress') {
      if (event.workflow || event.workflows) {
        setState(prev => {
          if (!prev) return prev;
          const next = { ...prev };
          if (event.phase) next.phase = event.phase;
          if (event.workflow) next.workflow = event.workflow;
          if (event.workflows) next.workflows = event.workflows;
          return next;
        });
      } else {
        loadState();
      }
    } else if (event.type === 'task_completed') {
      setAutoRunning(false); setAdvancing(false); loadState();
      toast.success('创作任务完成');
    } else if (event.type === 'task_failed') {
      setAutoRunning(false); setAdvancing(false); loadState();
      if (event.error) toast.error(`Agent 执行失败: ${event.error}`);
    } else if (event.type === 'paused' || event.type === 'checkpoint_approved') {
      loadState();
    } else if (event.type === 'blueprint_updated') {
      toast.info(`蓝图已更新 (+${event.diff?.newCharacters?.length || 0}角色 +${event.diff?.newForeshadows?.length || 0}伏笔)`);
    }
  }, [loadState]);

  const { connected: sseConnected } = useHarnessSSE(projectId, { onEvent: handleSSEEvent });

  useEffect(() => { loadState(); }, [loadState]);

  useEffect(() => {
    harnessApi.getAgentConfig()
      .then(res => {
        if (res.data.success) {
          const map = {};
          (res.data.configs || []).forEach(c => { map[c.agentName] = c; });
          setAgentConfigs(map);
        }
      })
      .catch(() => { /* noop */ });
  }, []);

  // ===== 工作流阶段 Tab 切换 =====
  const currentStage = useMemo(() => {
    if (state?.phase === 'complete') return 'complete';
    if (['writing', 'reviewing', 'revising', 'polishing'].includes(state?.phase)) return 'writing';
    return 'planning';
  }, [state?.phase]);

  const workflows = useMemo(() => state?.workflows || {}, [state?.workflows]);
  const availableTabs = useMemo(() => STAGE_TABS.filter(t =>
    t.key === 'planning'
    || (t.key === 'writing' && (workflows.writing || state?.workflow))
    || (t.key === 'complete' && state?.phase === 'complete')
  ), [workflows, state?.workflow, state?.phase]);

  // 首次进入有数据时未做选择 → 自动跟随当前阶段；用户已选则保留用户选择
  const effectiveActiveStage = useMemo(() => {
    if (userHasChosenStage) return activeStage;
    return currentStage;
  }, [userHasChosenStage, activeStage, currentStage]);

  const activeWorkflowData = useMemo(() => {
    const stage = availableTabs.find(t => t.key === effectiveActiveStage)
      ? effectiveActiveStage
      : currentStage;
    return workflows[stage] || state?.workflow || { nodes: [], edges: [] };
  }, [workflows, effectiveActiveStage, currentStage, state?.workflow, availableTabs]);

  // 用户点击 Tab → 锁定为用户选择（停止自动跟随当前阶段）
  const handleStageTabChange = useCallback((key) => {
    setUserHasChosenStage(true);
    setActiveStage(key);
  }, []);

  useEffect(() => {
    if (state?.waitingForUser) setContextTab('checkpoint');
    else if (state?.currentAgent === 'writer') setContextTab('writing');
  }, [state?.waitingForUser, state?.currentAgent]);

  useEffect(() => {
    if (autoRunning && !sseConnected) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await harnessApi.getState(projectId);
          if (res.data.success) {
            setState(res.data.state);
            if (res.data.state.phase === 'complete') setAutoRunning(false);
          }
        } catch { }
      }, 2000);
    }
    return () => { if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; } };
  }, [autoRunning, sseConnected, projectId]);

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const res = await harnessApi.advance({ projectId });
      if (res.data.success) {
        if (res.data.state) setState(res.data.state);
        setTimeout(() => { loadState(); setAdvancing(false); }, 500);
      } else { toast.error(res.data.error || '推进失败'); setAdvancing(false); }
    } catch (e) { toast.error(e.response?.data?.error || '推进失败'); setAdvancing(false); }
  };

  const handleAutoAdvance = async () => {
    setAutoRunning(true);
    try {
      const res = await harnessApi.autoAdvance({ projectId, maxSteps: 200 });
      if (res.data.success) toast.success('自动创作已启动');
      else { toast.error(res.data.error || '自动推进失败'); setAutoRunning(false); }
    } catch (e) { toast.error(e.response?.data?.error || '自动推进失败'); setAutoRunning(false); }
  };

  const handleReset = async () => {
    try {
      await harnessApi.reset(projectId);
      setState({ phase: 'idle', projectId }); setAutoRunning(false); setAdvancing(false);
      toast.success('已重置');
    } catch { toast.error('重置失败'); }
  };

  const handleApprove = async (updates) => {
    const res = await harnessApi.approve({ projectId, updates });
    if (res.data.success) { setState(res.data.state); toast.success('已审批，继续创作'); }
    else throw new Error(res.data.error || '审批失败');
  };

  const handlePause = async () => {
    try {
      const res = await harnessApi.pause({ projectId });
      if (res.data.success) { setState(res.data.state); setAutoRunning(false); toast.success('将在当前章节完成后暂停'); }
    } catch { toast.error('暂停失败'); }
  };

  const handleResume = async () => {
    setAutoRunning(true);
    try {
      const res = await harnessApi.resume({ projectId, batchSize });
      if (res.data.success) toast.success('继续创作');
    } catch { toast.error('继续失败'); setAutoRunning(false); }
  };

  const handleStart = async () => {
    setAdvancing(true);
    try {
      const res = await harnessApi.advance({ projectId });
      if (res.data.success) {
        if (res.data.state) setState(res.data.state);
        setTimeout(() => loadState(), 1000);
      } else { toast.error(res.data.error || '启动失败'); }
    } catch (e) { toast.error(e.response?.data?.error || '启动失败'); }
    finally { setTimeout(() => setAdvancing(false), 1000); }
  };

  const handleNodeClick = useCallback((nodeId) => {
    if (!nodeId) return;
    const map = {
      outline_planner: 'outline_planner',
      character_designer: 'character_designer',
      world_builder: 'world_builder',
      foreshadow_planner: 'foreshadow_planner',
      planning_done: 'planner',
      memory_keeper: 'memory_keeper',
      blueprint_sync: 'blueprint_sync',
    };
    if (map[nodeId]) {
      setSelectedAgent(map[nodeId]);
      return;
    }
    const m = nodeId.match(/^ch\d+_(writer|critic|editor|revise|re_review)$/);
    if (m) {
      setSelectedAgent(m[1] === 'revise' || m[1] === 're_review' ? 'writer' : m[1]);
    }
  }, []);

  const handleRunSingleAgent = useCallback(async (agentName) => {
    try {
      const res = await harnessApi.runSingleAgent(projectId, agentName);
      if (res.data.success) {
        toast.success(`已启动 ${AGENT_META[agentName]?.label || agentName}`);
        setTimeout(loadState, 500);
      } else {
        toast.error(res.data.error || '启动失败');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '启动失败');
    }
  }, [projectId, loadState]);

  if (loading) {
    return (
      <div>
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[var(--elevated)] rounded" />
          <div className="h-40 bg-[var(--elevated)] rounded-xl" />
          <div className="h-80 bg-[var(--elevated)] rounded-xl" />
        </div>
      </div>
    );
  }

  const phase = state?.phase || 'idle';
  const isComplete = phase === 'complete';
  const isActive = phase !== 'idle' && !isComplete;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/novel/${projectId}`} className="p-2 rounded-lg hover:bg-[var(--elevated)] transition-colors text-[var(--text-secondary)]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-violet-400" />
              Agent 协作工作流
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {state?.seed ? state.seed.slice(0, 80) + (state.seed.length > 80 ? '...' : '') : '多 Agent 协作创作'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-yellow-400'}`}
              title={sseConnected ? '实时连接中' : '连接断开'} />
          )}
          {isComplete ? (
            <Link to={`/novel/${projectId}/read`}>
              <Button variant="outline"><BookOpen className="h-4 w-4" />开始阅读</Button>
            </Link>
          ) : (
            <>
              <Button variant="ghost" onClick={handleReset} disabled={advancing}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              {isActive && !autoRunning && !state?.paused && (
                <div className="relative">
                  <Button variant="ghost" onClick={() => setShowBatchSelect(!showBatchSelect)}>
                    <Settings className="h-4 w-4" />
                    <span className="text-xs ml-1">{batchSize === 0 ? '全部' : `${batchSize}章`}/批</span>
                  </Button>
                  {showBatchSelect && (
                    <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg py-1 z-10 min-w-[100px]">
                      {[1, 3, 5, 10, 0].map(n => (
                        <button key={n} onClick={() => { setBatchSize(n); setShowBatchSelect(false); }}
                          className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--elevated)] transition-colors',
                            batchSize === n ? 'text-violet-400 font-medium' : 'text-[var(--text-primary)]')}>
                          {n === 0 ? '全部章节' : `${n} 章/批`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button variant="outline" onClick={handleAdvance} disabled={advancing || autoRunning}>
                <SkipForward className="h-4 w-4" />单步
              </Button>
              {autoRunning && !state?.paused ? (
                <Button variant="outline" onClick={handlePause} className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                  <Pause className="h-4 w-4" />暂停
                </Button>
              ) : state?.paused ? (
                <Button onClick={handleResume}><Play className="h-4 w-4" />继续</Button>
              ) : (
                <Button onClick={handleAutoAdvance} disabled={advancing}>
                  <Play className="h-4 w-4" />自动运行
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Idle phase */}
      {phase === 'idle' && state?.seed && (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-8 text-center space-y-6">
          <div className="text-4xl">📖</div>
          <div>
            <h2 className="text-xl font-bold mb-2">准备就绪</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              AI Agent 团队将根据你的故事创意协作创作小说。点击下方按钮启动策划师开始工作。
            </p>
          </div>
          <div className="bg-[var(--elevated)] rounded-xl p-4 text-left max-w-md mx-auto space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">创意</span>
              <span className="text-[var(--text-primary)]">{state.seed.slice(0, 40)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">类型</span>
              <span className="text-[var(--text-primary)]">{state.genre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">风格</span>
              <span className="text-[var(--text-primary)]">{state.style}</span>
            </div>
          </div>
          <Button onClick={handleStart} disabled={advancing} size="lg">
            <Play className="h-4 w-4" />开始创作
          </Button>
        </div>
      )}

      {/* Active phase: full-width layout */}
      {isActive && (
        <>
          {/* Phase Stepper + Progress */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] px-5 py-3">
            <div className="flex items-center justify-between">
              <PhaseStepper
                phase={phase}
                currentChapterIndex={state?.currentChapterIndex}
                totalChapters={state?.totalChapters}
              />
              <AgentStatusSummary agentStates={state?.agentStates} />
            </div>
            {(state?.totalChapters > 0) && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-[var(--elevated)] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all duration-500"
                    style={{ width: `${state?.progressPercent || 0}%` }} />
                </div>
                <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                  {state?.completedChapters || 0}/{state?.totalChapters || 0} 章
                </span>
              </div>
            )}
          </div>

          {/* DAG Panel (full width) */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {activeStage === 'planning' ? '策划流程'
                  : activeStage === 'complete' ? '完成流程'
                    : `第 ${(state?.currentChapterIndex || 0) + 1} 章 · 写作流程`}
              </h3>
              <span className="text-xs text-[var(--text-secondary)]">点击节点查看详情</span>
            </div>
            {/* 阶段 Tab 切换 */}
            <div className="flex items-center gap-1 mb-4 border-b border-[var(--border)]">
              {availableTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeStage === tab.key;
                const isCurrent = currentStage === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleStageTabChange(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'text-violet-400 border-b-2 border-violet-400 -mb-px'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
            <DAGView
              nodes={activeWorkflowData.nodes}
              edges={activeWorkflowData.edges}
              onNodeClick={handleNodeClick}
              onRunAgent={handleRunSingleAgent}
              selectedNodeId={selectedAgent}
            />
          </div>

          {/* Bottom Tabs (full width) */}
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="flex border-b border-[var(--border)]">
              {BOTTOM_TABS.map(tab => {
                const Icon = tab.icon;
                const active = contextTab === tab.key;
                const showBadge = tab.key === 'checkpoint' && state?.waitingForUser;
                return (
                  <button key={tab.key} onClick={() => setContextTab(tab.key)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative',
                      active ? 'text-violet-400 border-b-2 border-violet-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}>
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {showBadge && (
                      <span className="absolute top-1.5 right-3 w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {contextTab === 'blueprint' && (
                <BlueprintPanel design={state?.design} />
              )}

              {contextTab === 'writing' && (
                state?.chapters?.length > 0 ? (
                  <LiveWritingPanel
                    chapter={state.chapters[state.currentChapterIndex]}
                    isActive={state.currentAgent === 'writer' || state.currentAgent === 'editor'}
                  />
                ) : (
                  <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
                    <PenLine className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    等待创作开始...
                  </div>
                )
              )}

              {contextTab === 'log' && (
                <ActivityLog log={state?.activityLog} />
              )}

              {contextTab === 'checkpoint' && (
                state?.waitingForUser ? (
                  <CheckpointPanel state={state} onApprove={handleApprove} onStateUpdate={setState} />
                ) : (
                  <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    暂无待审批内容
                  </div>
                )
              )}

              {contextTab === 'history' && (
                <AgentRunList projectId={projectId} />
              )}
            </div>
          </div>
        </>
      )}

      {selectedAgent && (
        <AgentNodeDetailDrawer
          projectId={projectId}
          agentKey={selectedAgent}
          agentState={state?.agentStates?.[selectedAgent]}
          agentConfig={agentConfigs[selectedAgent]}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
