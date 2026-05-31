import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Play, SkipForward, RotateCcw, BookOpen, Pause, Settings,
  PenLine, FileText, ShieldCheck, Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { harnessApi } from '../api';
import { DAGView } from '../components/novel/DAGView';
import { SeedPanel } from '../components/novel/SeedPanel';
import { PreviewPanel } from '../components/novel/PreviewPanel';
import { LiveWritingPanel } from '../components/novel/LiveWritingPanel';
import { CheckpointPanel } from '../components/novel/CheckpointPanel';
import { cn } from '../lib/utils';

// Agent metadata for the status summary strip
const AGENT_META = {
  planner: { icon: '🧠', label: '策划师' },
  outline_planner: { icon: '📋', label: '大纲策划' },
  character_designer: { icon: '👤', label: '角色设计' },
  world_builder: { icon: '🌍', label: '世界观' },
  foreshadow_planner: { icon: '🔮', label: '伏笔规划' },
  writer: { icon: '✍️', label: '写手' },
  critic: { icon: '🔍', label: '评论家' },
  editor: { icon: '✨', label: '编辑' },
  memory_keeper: { icon: '📚', label: '记忆管理' },
};

const STATUS_COLORS = {
  running: 'text-violet-400',
  done: 'text-green-400',
  error: 'text-red-400',
  idle: 'text-[var(--text-secondary)]',
};

/**
 * 自定义 Hook: SSE 实时连接
 */
function useHarnessSSE(projectId) {
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef(null);

  const connect = useCallback((onEvent) => {
    if (!projectId) return;
    if (sourceRef.current) sourceRef.current.close();

    const source = new EventSource(`/api/harness/stream/${projectId}`);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (onEvent) onEvent(event);
      } catch (err) {
        console.error('[SSE] parse error:', err);
      }
    };
    source.onerror = () => setConnected(false);

    return () => { source.close(); sourceRef.current = null; };
  }, [projectId]);

  const disconnect = useCallback(() => {
    if (sourceRef.current) { sourceRef.current.close(); sourceRef.current = null; setConnected(false); }
  }, []);

  useEffect(() => () => { if (sourceRef.current) sourceRef.current.close(); }, []);

  return { connect, disconnect, connected };
}

// Compact agent status summary strip
function AgentStatusSummary({ agentStates }) {
  const states = agentStates || {};
  const running = Object.entries(states).filter(([, s]) => s.status === 'running');
  const done = Object.entries(states).filter(([, s]) => s.status === 'done').length;
  const errors = Object.entries(states).filter(([, s]) => s.status === 'error').length;

  return (
    <div className="flex items-center gap-3 text-xs">
      {running.map(([id]) => {
        const meta = AGENT_META[id] || { icon: '🤖', label: id };
        return (
          <span key={id} className="flex items-center gap-1 text-violet-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            {meta.icon} {meta.label}
          </span>
        );
      })}
      {done > 0 && <span className="text-green-400">✓ {done}完成</span>}
      {errors > 0 && <span className="text-red-400">✕ {errors}失败</span>}
      {!running.length && done === 0 && errors === 0 && (
        <span className="text-[var(--text-secondary)]">等待启动</span>
      )}
    </div>
  );
}

// Context sidebar tabs
const CONTEXT_TABS = [
  { key: 'writing', icon: PenLine, label: '创作' },
  { key: 'preview', icon: FileText, label: '预览' },
  { key: 'checkpoint', icon: ShieldCheck, label: '审批' },
];


export function HarnessPage() {
  const { projectId } = useParams();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [showBatchSelect, setShowBatchSelect] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [contextTab, setContextTab] = useState('writing');
  const pollTimerRef = useRef(null);

  const { connect: connectSSE, disconnect: disconnectSSE, connected: sseConnected } = useHarnessSSE(projectId);

  const loadState = useCallback(async () => {
    try {
      const res = await harnessApi.getState(projectId);
      if (res.data.success) {
        setState(res.data.state);
      } else if (res.data.error === '项目未初始化 Harness') {
        setState({ phase: 'seed', projectId });
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadState(); }, [loadState]);

  // Auto-switch to checkpoint tab when waiting
  useEffect(() => {
    if (state?.waitingForUser) setContextTab('checkpoint');
    else if (state?.currentAgent === 'writer') setContextTab('writing');
  }, [state?.waitingForUser, state?.currentAgent]);

  // SSE
  useEffect(() => {
    if (!projectId || !state) return;
    const phase = state?.phase;
    if (phase === 'seed' || phase === 'idle' || phase === 'complete') return;

    const cleanup = connectSSE((event) => {
      if (event.type === 'init') {
        if (event.state) setState(event.state);
      } else if (event.type === 'agent_step_done' || event.type === 'auto_progress') {
        loadState();
      } else if (event.type === 'task_completed') {
        setAutoRunning(false); setAdvancing(false); loadState();
        toast.success('创作任务完成');
      } else if (event.type === 'task_failed') {
        setAutoRunning(false); setAdvancing(false); loadState();
        if (event.error) toast.error(`Agent 执行失败: ${event.error}`);
      } else if (event.type === 'paused' || event.type === 'checkpoint_approved') {
        loadState();
      }
    });
    return cleanup;
  }, [projectId, state?.phase, connectSSE, loadState]);

  // Polling fallback
  useEffect(() => {
    if (autoRunning && !sseConnected) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await harnessApi.getState(projectId);
          if (res.data.success) {
            setState(res.data.state);
            if (res.data.state.phase === 'complete') setAutoRunning(false);
          }
        } catch {}
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
      setState({ phase: 'seed', projectId }); setAutoRunning(false); setAdvancing(false);
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
        if (res.data.state) {
          setState({
            ...res.data.state, phase: 'planning', currentAgent: 'planner',
            agentStates: { ...(res.data.state.agentStates || {}), planner: { status: 'running' } },
          });
        }
        setTimeout(() => loadState(), 1000);
      } else { toast.error(res.data.error || '启动失败'); }
    } catch (e) { toast.error(e.response?.data?.error || '启动失败'); }
    finally { setTimeout(() => setAdvancing(false), 1000); }
  };

  // Build fallback DAG for writing phase (when backend doesn't send workflow)
  const workflowData = useMemo(() => {
    const wf = state?.workflow;
    if (wf && wf.nodes && wf.nodes.length > 0) {
      return wf;
    }
    // Fallback: construct a simple 3-node pipeline from agentStates
    const agents = state?.agentStates || {};
    return {
      nodes: [
        { id: 'writer', label: '✍️ 写手', status: agents.writer?.status || 'idle', position: { x: 200, y: 0 } },
        { id: 'critic', label: '🔍 评论家', status: agents.critic?.status || 'idle', position: { x: 200, y: 100 } },
        { id: 'editor', label: '✨ 编辑', status: agents.editor?.status || 'idle', position: { x: 200, y: 200 } },
      ],
      edges: [
        { from: 'writer', to: 'critic' },
        { from: 'critic', to: 'editor' },
      ],
    };
  }, [state?.workflow, state?.agentStates]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
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
  const isActive = phase !== 'seed' && phase !== 'idle';

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/novel" className="p-2 rounded-lg hover:bg-[var(--elevated)] transition-colors text-[var(--text-secondary)]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-violet-400" />
              创作工坊
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {state?.seed ? state.seed.slice(0, 40) + (state.seed.length > 40 ? '...' : '') : '多 Agent 协作创作'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase !== 'seed' && phase !== 'idle' && (
            <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-yellow-400'}`}
                  title={sseConnected ? '实时连接中' : '连接断开，使用轮询'} />
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

      {/* Seed phase */}
      {phase === 'seed' && <SeedPanel projectId={projectId} onStateUpdate={setState} />}

      {/* Idle phase — ready to start */}
      {phase === 'idle' && state?.seed && (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-8 text-center space-y-6">
          <div className="text-4xl">📖</div>
          <div>
            <h2 className="text-xl font-bold mb-2">准备就绪</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              AI Agent 团队将根据你的故事创意协作创作小说。策划师、写手、评论家、编辑将按流程依次工作。
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

      {/* Active phase: DAG + Context sidebar layout */}
      {isActive && (
        <div className="flex gap-5">
          {/* Left: DAG View (60%) */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* DAG container */}
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {phase === 'planning' || phase === 'checkpoint' ? '📋 策划流程' : `✍️ 第 ${(state?.currentChapterIndex || 0) + 1} 章 · 写作流程`}
                </h3>
                <AgentStatusSummary agentStates={state?.agentStates} />
              </div>
              <DAGView
                nodes={workflowData.nodes}
                edges={workflowData.edges}
                onNodeClick={setSelectedNode}
                selectedNodeId={selectedNode}
              />
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">
                  进度: {state?.completedChapters || 0}/{state?.totalChapters || 0} 章
                </span>
                <span className="text-[var(--text-secondary)]">{state?.progressPercent || 0}%</span>
              </div>
              <div className="h-2 bg-[var(--elevated)] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all duration-500"
                     style={{ width: `${state?.progressPercent || 0}%` }} />
              </div>
            </div>
          </div>

          {/* Right: Context Sidebar (40%) */}
          <div className="w-[400px] flex-shrink-0">
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden flex flex-col"
                 style={{ minHeight: '500px' }}>
              {/* Tab bar */}
              <div className="flex border-b border-[var(--border)]">
                {CONTEXT_TABS.map(tab => {
                  const Icon = tab.icon;
                  const active = contextTab === tab.key;
                  const showBadge = tab.key === 'checkpoint' && state?.waitingForUser;
                  return (
                    <button key={tab.key} onClick={() => setContextTab(tab.key)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative',
                        active ? 'text-violet-400 border-b-2 border-violet-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      )}>
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                      {showBadge && (
                        <span className="absolute top-1.5 right-4 w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-4">
                {contextTab === 'writing' && (
                  <div className="space-y-4">
                    {state?.chapters?.length > 0 ? (
                      <LiveWritingPanel
                        chapter={state.chapters[state.currentChapterIndex]}
                        isActive={state.currentAgent === 'writer' || state.currentAgent === 'editor'}
                      />
                    ) : (
                      <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
                        <PenLine className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        等待创作开始...
                      </div>
                    )}
                  </div>
                )}

                {contextTab === 'preview' && (
                  <PreviewPanel state={state} />
                )}

                {contextTab === 'checkpoint' && (
                  <div>
                    {state?.waitingForUser ? (
                      <CheckpointPanel state={state} onApprove={handleApprove} onStateUpdate={setState} />
                    ) : (
                      <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
                        <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        暂无待审批内容
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
