import { useEffect, useState } from 'react';
import { X, Copy, Check, Clock, ChevronRight, FileJson, History } from 'lucide-react';
import { harnessApi } from '../../api';
import { toast } from '../ui/Toast';
import { cn } from '../../lib/utils';
import { AgentRunList } from './AgentRunList';

const AGENT_META = {
  planner:            { icon: '🧠', label: '策划师',     desc: '从种子创意生成完整设计蓝图' },
  outline_planner:    { icon: '📋', label: '大纲策划',   desc: '规划故事大纲骨架' },
  character_designer: { icon: '👤', label: '角色设计',   desc: '设计角色档案' },
  world_builder:      { icon: '🌍', label: '世界观设计', desc: '构建世界规则' },
  foreshadow_planner: { icon: '🔮', label: '伏笔规划',   desc: '规划伏笔时间线' },
  writer:             { icon: '✍️', label: '写手',       desc: '逐章创作小说' },
  critic:             { icon: '🔍', label: '评论家',     desc: '审查章节质量' },
  editor:             { icon: '✨', label: '编辑',       desc: '润色语言表达' },
  memory_keeper:      { icon: '📚', label: '记忆管家',   desc: '维护知识库' },
  blueprint_sync:     { icon: '🔄', label: '蓝图同步',   desc: '回写章节新角色/新伏笔到设计' },
  meta:               { icon: '💡', label: '项目顾问',   desc: '协商项目初始设定' },
};

function StatusBadge({ status }) {
  const styles = {
    running: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    done: 'bg-green-500/20 text-green-300 border-green-500/30',
    error: 'bg-red-500/20 text-red-300 border-red-500/30',
    idle: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };
  const label = { running: '运行中', done: '已完成', error: '异常', idle: '待机' }[status] || status;
  return (
    <span className={cn('px-2 py-0.5 text-xs rounded border', styles[status] || styles.idle)}>
      {label}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text || '').then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          toast.success('已复制');
        }).catch(() => toast.error('复制失败'));
      }}
      className="p-1.5 rounded hover:bg-white/10 text-[var(--text-secondary)]"
      title="复制"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function MessageBlock({ msg }) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';
  const [expanded, setExpanded] = useState(false);
  const tooLong = (msg.content || '').length > 400;
  const display = !expanded && tooLong ? msg.content.slice(0, 400) + '…' : msg.content;

  return (
    <div className={cn('rounded-lg border p-3', isSystem
      ? 'bg-purple-500/5 border-purple-500/20'
      : isUser
        ? 'bg-blue-500/5 border-blue-500/20'
        : 'bg-amber-500/5 border-amber-500/20')}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn('text-[10px] font-medium uppercase tracking-wider',
          isSystem ? 'text-purple-400' : isUser ? 'text-blue-400' : 'text-amber-400')}>
          {msg.role}
        </span>
        <CopyButton text={msg.content || ''} />
      </div>
      <pre className="text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words font-mono leading-relaxed">
        {display}
      </pre>
      {tooLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-violet-400 hover:underline mt-1"
        >
          {expanded ? '收起' : '展开全文'}
        </button>
      )}
    </div>
  );
}

export function AgentNodeDetailDrawer({ projectId, agentKey, agentState, agentConfig, onClose }) {
  const meta = AGENT_META[agentKey] || { icon: '🤖', label: agentKey, desc: '' };
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('latest');
  const [outputMode, setOutputMode] = useState('text');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    harnessApi.getLatestAgentRun(projectId, agentKey)
      .then(res => {
        if (cancelled) return;
        if (res.data.success) setRun(res.data.run);
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, agentKey]);

  const inputMessages = run?.inputMessages || [];
  const output = run?.output || '';
  const outputParsed = run?.outputParsed;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()}
        className="relative w-full max-w-3xl h-full overflow-y-auto shadow-2xl"
        style={{ backgroundColor: 'var(--background)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] backdrop-blur"
          style={{ backgroundColor: 'var(--background)' }}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{meta.icon}</span>
              <div>
                <h2 className="text-lg font-bold">{meta.label}</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{meta.desc}</p>
              </div>
              <StatusBadge status={agentState?.status || 'idle'} />
            </div>
            <button onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--elevated)] text-[var(--text-secondary)]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-6 pb-2 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            {agentConfig?.providerName ? (
              <span className="flex items-center gap-1">
                <span className="opacity-60">Provider:</span>
                <span className="text-[var(--text-primary)]">{agentConfig.providerName}</span>
              </span>
            ) : (
              <span className="text-amber-400">⚠ 未配置 provider，使用默认</span>
            )}
            {agentConfig?.modelName && (
              <span className="flex items-center gap-1">
                <span className="opacity-60">Model:</span>
                <span className="text-[var(--text-primary)]">{agentConfig.modelName}</span>
              </span>
            )}
            {run?.durationMs != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {(run.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {/* Tabs */}
          <div className="px-6 flex gap-1 border-t border-[var(--border)]">
            {[
              { key: 'latest', icon: ChevronRight, label: '本次运行' },
              { key: 'history', icon: History, label: '历史运行' },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={cn(
                    'px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 -mb-[1px]',
                    tab === t.key
                      ? 'border-violet-400 text-violet-400'
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  )}>
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        {tab === 'latest' && (
          <div className="p-6 space-y-5">
            {loading ? (
              <div className="text-center py-8 text-sm text-[var(--text-secondary)]">加载中...</div>
            ) : !run ? (
              <div className="text-center py-12">
                <div className="text-4xl opacity-30 mb-3">{meta.icon}</div>
                <p className="text-sm text-[var(--text-secondary)]">该 agent 暂无运行记录</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 opacity-70">运行后将展示 prompt 输入和 LLM 输出</p>
              </div>
            ) : (
              <>
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      输入 Prompt ({inputMessages.length} 条消息)
                    </h3>
                    {run.chapterIndex != null && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        第 {run.chapterIndex + 1} 章 · {run.phase}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {inputMessages.map((m, i) => (
                      <MessageBlock key={i} msg={m} />
                    ))}
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      LLM 输出
                    </h3>
                    <div className="flex items-center gap-1">
                      {outputParsed != null && (
                        <button
                          onClick={() => setOutputMode(outputMode === 'text' ? 'json' : 'text')}
                          className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:bg-[var(--elevated)] flex items-center gap-1"
                        >
                          <FileJson className="h-3 w-3" />
                          {outputMode === 'text' ? '查看 JSON' : '查看原文'}
                        </button>
                      )}
                      <CopyButton text={output} />
                    </div>
                  </div>
                  {outputMode === 'json' && outputParsed != null ? (
                    <pre className="text-xs font-mono p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
                      {JSON.stringify(outputParsed, null, 2)}
                    </pre>
                  ) : (
                    <pre className="text-xs font-mono p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] whitespace-pre-wrap break-words leading-relaxed">
                      {output || '(空)'}
                    </pre>
                  )}
                  {run.status === 'error' && (
                    <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                      ❌ 错误：{run.error}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {tab === 'history' && (
          <AgentRunList projectId={projectId} agentKey={agentKey} />
        )}
      </div>
    </div>
  );
}

export { AGENT_META };
