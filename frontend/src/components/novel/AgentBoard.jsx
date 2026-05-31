/**
 * AgentBoard — 动态Agent协作面板
 *
 * 从 state.agentStates 动态渲染所有Agent，不再硬编码。
 * 按状态排序：running → done/error → idle
 * 活跃Agent突出显示。
 */

// Agent 元信息（图标 + 描述）
const AGENT_META = {
  planner:            { icon: '🧠', label: '策划师',     desc: '设计故事蓝图' },
  outline_planner:    { icon: '📋', label: '大纲策划',   desc: '规划故事大纲' },
  character_designer: { icon: '👤', label: '角色设计',   desc: '设计角色档案' },
  world_builder:      { icon: '🌍', label: '世界观设计', desc: '构建世界规则' },
  foreshadow_planner: { icon: '🔮', label: '伏笔规划',   desc: '规划伏笔时间线' },
  writer:             { icon: '✍️', label: '写手',       desc: '逐章创作小说' },
  critic:             { icon: '🔍', label: '评论家',     desc: '审查章节质量' },
  editor:             { icon: '✨', label: '编辑',       desc: '润色语言表达' },
  memory_keeper:      { icon: '📚', label: '记忆管家',   desc: '维护知识库' },
};

// 状态排序权重
const STATUS_ORDER = { running: 0, done: 1, error: 2, idle: 3 };

// 状态样式
const STATUS_STYLE = {
  running: { border: 'border-violet-400', bg: 'bg-violet-500/5', text: 'text-violet-400', pulse: true },
  done:    { border: 'border-green-500/40', bg: 'bg-green-500/5', text: 'text-green-400', pulse: false },
  error:   { border: 'border-red-500/40', bg: 'bg-red-500/5', text: 'text-red-400', pulse: true },
  idle:    { border: 'border-[var(--border)]', bg: 'bg-transparent', text: 'text-[var(--text-secondary)]', pulse: false },
};

const STATUS_LABEL = { running: '工作中', done: '已完成', error: '异常', idle: '待机' };


function AgentChip({ agentKey, state, isActive }) {
  const meta = AGENT_META[agentKey] || { icon: '🤖', label: agentKey, desc: '' };
  const status = state?.status || 'idle';
  const style = STATUS_STYLE[status] || STATUS_STYLE.idle;

  return (
    <div className={`
      flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all
      ${style.border} ${style.bg}
      ${isActive ? 'ring-2 ring-violet-400/30' : ''}
    `}>
      {/* 图标 */}
      <span className="text-lg flex-shrink-0">{meta.icon}</span>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--text-primary)]">{meta.label}</span>
          <span className={`text-[10px] font-medium ${style.text}`}>
            {STATUS_LABEL[status] || status}
            {style.pulse && (
              <span className="inline-block ml-1 w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            )}
          </span>
        </div>
        <p className="text-[10px] text-[var(--text-secondary)] truncate">{meta.desc}</p>
        {state?.error && status === 'error' && (
          <p className="text-[10px] text-red-400 truncate mt-0.5" title={state.error}>
            ⚠ {state.error}
          </p>
        )}
      </div>
    </div>
  );
}


export function AgentBoard({ state }) {
  if (!state) return null;

  const agentStates = state.agentStates || {};
  const currentAgent = state.currentAgent || '';
  const phase = state.phase;

  // 动态提取所有有状态的Agent
  const agents = Object.entries(agentStates)
    .filter(([_, s]) => s && typeof s === 'object' && s.status && s.status !== 'idle' || AGENT_META[_])
    .map(([key, s]) => ({
      key,
      status: s?.status || 'idle',
      sortWeight: STATUS_ORDER[s?.status] ?? 4,
    }))
    .sort((a, b) => a.sortWeight - b.sortWeight);

  // 阶段标签
  const phaseLabel = {
    planning: '策划中', writing: '写作中', reviewing: '审查中',
    revising: '修改中', polishing: '润色中', checkpoint: '等待审批',
    complete: '已完成',
  }[phase] || phase;

  // 统计
  const running = agents.filter(a => a.status === 'running').length;
  const done = agents.filter(a => a.status === 'done').length;
  const errored = agents.filter(a => a.status === 'error').length;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            phase === 'complete' ? 'bg-green-400' :
            running > 0 ? 'bg-violet-400 animate-pulse' :
            errored > 0 ? 'bg-red-400' : 'bg-yellow-400'
          }`} />
          Agent 协作面板
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
          {phase && <span>阶段: {phaseLabel}</span>}
          <span>{done}✓ {running > 0 && `${running}⚡`} {errored > 0 && `${errored}✗`}</span>
        </div>
      </div>

      {/* Agent 网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {agents.map(a => (
          <AgentChip
            key={a.key}
            agentKey={a.key}
            state={agentStates[a.key]}
            isActive={currentAgent === a.key}
          />
        ))}
      </div>

      {/* 无Agent时的提示 */}
      {agents.length === 0 && (
        <p className="text-xs text-[var(--text-secondary)] text-center py-4">
          等待 Agent 启动...
        </p>
      )}
    </div>
  );
}
