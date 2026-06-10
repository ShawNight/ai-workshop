/**
 * DAGView — 紧凑型 DAG 工作流可视化组件
 *
 * 节点状态：pending | ready | running | done | failed | skipped
 * 特性：紧凑节点、贝塞尔曲线连线、状态角标、hover 运行按钮、彩色 agent 图标
 * 布局：LR（左→右），分支走纵向（pass 上 / fail 下）
 */
import { useState, useCallback } from 'react';
import { Play } from 'lucide-react';

const STATUS_STYLES = {
  pending:   { bg: 'rgba(30,41,59,0.8)',  border: '#4B5563', text: '#9CA3AF', accent: '#6B7280', glow: false, label: '等待中' },
  ready:     { bg: 'rgba(30,27,75,0.8)',   border: '#6366F1', text: '#A5B4FC', accent: '#818CF8', glow: false, label: '就绪' },
  running:   { bg: 'rgba(49,46,129,0.9)',  border: '#818CF8', text: '#C7D2FE', accent: '#A78BFA', glow: true,  label: '运行中' },
  done:      { bg: 'rgba(6,78,59,0.8)',    border: '#10B981', text: '#6EE7B7', accent: '#34D399', glow: false, label: '完成' },
  failed:    { bg: 'rgba(127,29,29,0.85)', border: '#EF4444', text: '#FCA5A5', accent: '#F87171', glow: true,  label: '失败' },
  skipped:   { bg: 'rgba(31,41,55,0.7)',   border: '#6B7280', text: '#9CA3AF', accent: '#6B7280', glow: false, label: '跳过' },
};

// Agent 图标（SVG path）
const AGENT_ICONS = {
  outline_planner:    { path: 'M4 4h16v16H4z M8 8h8M8 12h6M8 16h4', viewBox: '0 0 24 24' },
  character_designer: { path: 'M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z', viewBox: '0 0 24 24' },
  world_builder:      { path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', viewBox: '0 0 24 24' },
  foreshadow_planner: { path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z', viewBox: '0 0 24 24' },
  writer:             { path: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z', viewBox: '0 0 24 24' },
  critic:             { path: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z', viewBox: '0 0 24 24' },
  editor:             { path: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z', viewBox: '0 0 24 24' },
  default:            { path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z', viewBox: '0 0 24 24' },
};

// Agent 主题色（用于图标着色 + 节点边框装饰）
const AGENT_COLORS = {
  outline_planner:    '#6366F1', // indigo
  character_designer: '#10B981', // emerald
  world_builder:      '#06B6D4', // cyan
  foreshadow_planner: '#A855F7', // purple
  writer:             '#F97316', // orange
  critic:             '#EAB308', // yellow
  editor:             '#EC4899', // pink
  default:            '#94A3B8', // slate
};

function getAgentIcon(nodeId) {
  if (AGENT_ICONS[nodeId]) return AGENT_ICONS[nodeId];
  const m = nodeId.match(/^ch\d+_(\w+)$/);
  if (m && AGENT_ICONS[m[1]]) return AGENT_ICONS[m[1]];
  return AGENT_ICONS.default;
}

function getAgentColor(nodeId) {
  if (AGENT_COLORS[nodeId]) return AGENT_COLORS[nodeId];
  const m = nodeId.match(/^ch\d+_(\w+)$/);
  if (m && AGENT_COLORS[m[1]]) return AGENT_COLORS[m[1]];
  return AGENT_COLORS.default;
}

const NODE_W = 116;
const NODE_H = 36;
const PADDING = 20;

// Extract agent key from node id for run-single-agent
function nodeToAgentKey(nodeId) {
  const map = {
    outline_planner: 'outline_planner',
    character_designer: 'character_designer',
    world_builder: 'world_builder',
    foreshadow_planner: 'foreshadow_planner',
    planning_done: null,
  };
  if (map[nodeId] !== undefined) return map[nodeId];
  const m = nodeId.match(/^ch\d+_(\w+)$/);
  if (m) {
    const suffix = m[1];
    if (suffix === 'done' || suffix === 'revise') return null;
    return suffix === 're_review' ? 'critic' : suffix;
  }
  return nodeId;
}

export function DAGView({ nodes = [], edges = [], onNodeClick, onRunAgent, selectedNodeId }) {
  const [hoveredNode, setHoveredNode] = useState(null);

  const handleNodeClick = useCallback((nodeId) => {
    onNodeClick?.(nodeId);
  }, [onNodeClick]);

  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] text-sm">
        <div className="text-center">
          <div className="text-xl mb-2 opacity-40">⏳</div>
          <div>等待工作流初始化...</div>
        </div>
      </div>
    );
  }

  // Calculate bounds
  const xs = nodes.map(n => n.position?.x || 0);
  const ys = nodes.map(n => n.position?.y || 0);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  const maxX = Math.max(...xs) + NODE_W + PADDING;
  const maxY = Math.max(...ys) + NODE_H + PADDING;
  const width = maxX - minX + 16;
  const height = maxY - minY + 16;

  const hovered = hoveredNode ? nodes.find(n => n.id === hoveredNode) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`${minX - 8} ${minY - 8} ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: 480 }}
      >
        <defs>
          <filter id="node-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="selected-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ===== Edges (LR 布局：从源节点右侧 → 目标节点左侧) ===== */}
        {edges.map((edge, i) => {
          const from = nodes.find(n => n.id === (edge.from || edge.fromNode));
          const to = nodes.find(n => n.id === (edge.to || edge.toNode));
          if (!from || !to) return null;

          const fx = (from.position?.x || 0) + NODE_W;
          const fy = (from.position?.y || 0) + NODE_H / 2;
          const tx = (to.position?.x || 0);
          const ty = (to.position?.y || 0) + NODE_H / 2;

          const midX = (fx + tx) / 2;
          const path = `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`;

          const isEdgeActive = from.status === 'done' && to.status === 'running';
          const isEdgeDone = from.status === 'done' && (to.status === 'done' || to.status === 'skipped');
          const edgeColor = isEdgeActive ? '#818CF8' : isEdgeDone ? '#10B981' : '#334155';

          return (
            <g key={`edge-${i}`}>
              <path
                d={path}
                fill="none"
                stroke={edgeColor}
                strokeWidth={isEdgeActive ? 2 : 1.2}
                strokeDasharray={edge.condition ? '6,3' : 'none'}
                opacity={isEdgeDone ? 0.55 : 1}
              />
              {isEdgeActive && (
                <path
                  d={path}
                  fill="none"
                  stroke="rgba(129,140,248,0.5)"
                  strokeWidth={1.5}
                  strokeDasharray="4,8"
                >
                  <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="1s" repeatCount="indefinite" />
                </path>
              )}
              {/* 箭头：指向右侧（→） */}
              <polygon
                points={`${tx - 2},${ty} ${tx + 6},${ty - 3} ${tx + 6},${ty + 3}`}
                fill={edgeColor}
                opacity={isEdgeDone ? 0.55 : 1}
              />
              {edge.condition && (
                <text
                  x={midX}
                  y={Math.min(fy, ty) - 6}
                  fill={isEdgeActive ? '#A5B4FC' : '#9CA3AF'}
                  fontSize="9"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {edge.condition}
                </text>
              )}
            </g>
          );
        })}

        {/* ===== Nodes ===== */}
        {nodes.map((node) => {
          const x = node.position?.x || 0;
          const y = node.position?.y || 0;
          const style = STATUS_STYLES[node.status] || STATUS_STYLES.pending;
          const isSelected = selectedNodeId === node.id;
          const isRunning = node.status === 'running';
          const isDone = node.status === 'done';
          const isFailed = node.status === 'failed';
          const label = node.label || node.id;
          const icon = getAgentIcon(node.id);
          const agentColor = getAgentColor(node.id);

          return (
            <g
              key={node.id}
              filter={isSelected ? 'url(#selected-glow)' : style.glow ? 'url(#node-glow)' : undefined}
              onClick={() => handleNodeClick(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
            >
              {isSelected && (
                <rect
                  x={x - 2} y={y - 2}
                  width={NODE_W + 4} height={NODE_H + 4}
                  rx={9} ry={9}
                  fill="none"
                  stroke={agentColor}
                  strokeWidth="1.5"
                  opacity="0.6"
                />
              )}

              {/* 节点背景（状态色） */}
              <rect
                x={x} y={y}
                width={NODE_W} height={NODE_H}
                rx={7} ry={7}
                fill={style.bg}
                stroke={style.border}
                strokeWidth={isRunning || isSelected ? 1.5 : 1}
              />

              {/* 左侧 agent 色彩条（4px 装饰条） */}
              <rect
                x={x} y={y}
                width={4} height={NODE_H}
                rx={2} ry={2}
                fill={agentColor}
                opacity={isFailed ? 0.5 : 0.95}
              />

              {/* Running pulse */}
              {isRunning && (
                <rect
                  x={x} y={y}
                  width={NODE_W} height={NODE_H}
                  rx={7} ry={7}
                  fill="none"
                  stroke={style.accent}
                  strokeWidth="1"
                  opacity="0.4"
                >
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                </rect>
              )}

              {/* Agent 图标（彩色） */}
              <g transform={`translate(${x + 12}, ${y + NODE_H / 2})`}>
                <svg width="16" height="16" viewBox={icon.viewBox} fill="none">
                  <path d={icon.path} fill={agentColor} opacity="0.95" />
                </svg>
              </g>

              {/* Label */}
              <text
                x={x + 34}
                y={y + NODE_H / 2 + 1}
                fill={style.text}
                fontSize="11"
                fontWeight="600"
                textAnchor="start"
                dominantBaseline="middle"
              >
                {label}
              </text>

              {/* Status dot (top-right) */}
              <circle
                cx={x + NODE_W - 8}
                cy={y + 8}
                r="2.8"
                fill={style.border}
              >
                {isRunning && (
                  <animate attributeName="r" values="2.2;3.6;2.2" dur="1.2s" repeatCount="indefinite" />
                )}
              </circle>
              {isDone && (
                <path
                  d={`M${x + NODE_W - 10},${y + 8} L${x + NODE_W - 8.2},${y + 9.8} L${x + NODE_W - 6.2},${y + 6.5}`}
                  stroke="white" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"
                />
              )}

              {/* Run button on hover */}
              {hoveredNode === node.id && !isRunning && nodeToAgentKey(node.id) && (
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    const agentKey = nodeToAgentKey(node.id);
                    if (agentKey && onRunAgent) onRunAgent(agentKey);
                  }}
                  style={{ cursor: 'pointer' }}
                  transform={`translate(${x + 4}, ${y + NODE_H - 6})`}
                >
                  <circle r="6" fill="rgba(99,102,241,0.85)" />
                  <polygon points="-2,-2 -2,2 2.5,0" fill="white" transform="translate(0.5,0)" />
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="absolute z-10 px-3 py-2 rounded-lg text-xs max-w-[240px] pointer-events-none"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: `1px solid ${getAgentColor(hovered.id)}55`,
            color: '#F1F5F9',
            top: 8,
            right: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <div className="font-medium mb-0.5 flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: getAgentColor(hovered.id) }}
            />
            {hovered.label || hovered.id}
          </div>
          <div style={{ color: STATUS_STYLES[hovered.status]?.text || '#9CA3AF' }}>
            {STATUS_STYLES[hovered.status]?.label || hovered.status}
          </div>
          {hovered.error && (
            <div className="mt-1 text-red-400 truncate" style={{ maxWidth: 200 }}>
              {hovered.error}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {Object.entries(STATUS_STYLES).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1 text-[10px]" style={{ color: s.text }}>
            <span className="inline-block w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: s.border }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
