/**
 * DAGView — SVG DAG 可视化组件（增强版）
 *
 * 将工作流节点和边渲染为有向无环图。
 * 节点状态：pending | ready | running | done | failed | skipped
 *
 * Props:
 * - nodes: 节点数组
 * - edges: 边数组
 * - onNodeClick?: (nodeId: string) => void
 * - selectedNodeId?: string
 * - fallback?: boolean — 是否使用紧凑布局
 */
import { useState, useCallback } from 'react';

const STATUS_STYLES = {
  pending:   { bg: '#374151', border: '#4B5563', text: '#9CA3AF', glow: false, label: '等待中' },
  ready:     { bg: '#1E1B4B', border: '#6366F1', text: '#A5B4FC', glow: false, label: '就绪' },
  running:   { bg: '#312E81', border: '#818CF8', text: '#C7D2FE', glow: true, label: '运行中' },
  done:      { bg: '#064E3B', border: '#10B981', text: '#6EE7B7', glow: false, label: '完成' },
  failed:    { bg: '#7F1D1D', border: '#EF4444', text: '#FCA5A5', glow: true, label: '失败' },
  skipped:   { bg: '#1F2937', border: '#6B7280', text: '#9CA3AF', glow: false, label: '跳过' },
};

const NODE_W = 160;
const NODE_H = 56;
const NODE_W_SM = 130;
const NODE_H_SM = 48;

export function DAGView({ nodes = [], edges = [], onNodeClick, selectedNodeId, fallback }) {
  const [hoveredNode, setHoveredNode] = useState(null);

  const nw = fallback ? NODE_W_SM : NODE_W;
  const nh = fallback ? NODE_H_SM : NODE_H;

  const handleNodeClick = useCallback((nodeId) => {
    onNodeClick?.(nodeId);
  }, [onNodeClick]);

  if (!nodes.length) return null;

  // 计算边界
  const xs = nodes.map(n => n.position?.x || 0);
  const ys = nodes.map(n => n.position?.y || 0);
  const minX = Math.min(...xs) - nw;
  const minY = Math.min(...ys) - 20;
  const maxX = Math.max(...xs) + nw * 2;
  const maxY = Math.max(...ys) + nh + 40;
  const width = maxX - minX + 40;
  const height = maxY - minY + 20;

  // Tooltip for hovered node
  const hovered = hoveredNode ? nodes.find(n => n.id === hoveredNode) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`${minX - 20} ${minY - 10} ${width} ${height}`}
        className="w-full"
        style={{ minHeight: fallback ? '200px' : '320px' }}
      >
        {/* 定义滤镜和渐变 */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="selected-glow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 边（连线） */}
        {edges.map((edge, i) => {
          const from = nodes.find(n => n.id === (edge.from || edge.fromNode));
          const to = nodes.find(n => n.id === (edge.to || edge.toNode));
          if (!from || !to) return null;

          const fx = (from.position?.x || 0) + nw / 2;
          const fy = (from.position?.y || 0) + nh;
          const tx = (to.position?.x || 0) + nw / 2;
          const ty = (to.position?.y || 0);

          const isEdgeActive = from.status === 'done' && to.status === 'running';
          const isEdgeDone = from.status === 'done' && (to.status === 'done' || to.status === 'skipped');
          const edgeColor = isEdgeActive ? '#818CF8' : isEdgeDone ? '#10B981' : '#374151';

          return (
            <g key={`edge-${i}`}>
              <line
                x1={fx} y1={fy} x2={tx} y2={ty}
                stroke={edgeColor}
                strokeWidth={isEdgeActive ? 2.5 : 1.5}
                strokeDasharray={edge.condition ? '6,3' : 'none'}
                opacity={isEdgeDone ? 0.6 : 1}
              />
              {/* 箭头 */}
              <polygon
                points={`${tx},${ty} ${tx - 6},${ty - 10} ${tx + 6},${ty - 10}`}
                fill={edgeColor}
              />
              {/* 条件标签 */}
              {edge.condition && (
                <text
                  x={(fx + tx) / 2 + 10}
                  y={(fy + ty) / 2 + 3}
                  fill={isEdgeActive ? '#A5B4FC' : '#6B7280'}
                  fontSize="9"
                  textAnchor="start"
                >
                  {edge.condition}
                </text>
              )}
            </g>
          );
        })}

        {/* 节点 */}
        {nodes.map((node) => {
          const x = node.position?.x || 0;
          const y = node.position?.y || 0;
          const style = STATUS_STYLES[node.status] || STATUS_STYLES.pending;
          const isSelected = selectedNodeId === node.id;

          return (
            <g
              key={node.id}
              filter={isSelected ? 'url(#selected-glow)' : style.glow ? 'url(#glow)' : undefined}
              onClick={() => handleNodeClick(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
            >
              {/* 选中高亮环 */}
              {isSelected && (
                <rect
                  x={x - 3} y={y - 3}
                  width={nw + 6} height={nh + 6}
                  rx={12} ry={12}
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="2"
                  opacity="0.6"
                />
              )}

              {/* 节点背景 */}
              <rect
                x={x} y={y}
                width={nw} height={nh}
                rx={10} ry={10}
                fill={style.bg}
                stroke={style.border}
                strokeWidth={node.status === 'running' || isSelected ? 2.5 : 1.5}
              />

              {/* 运行中的脉冲动画 */}
              {node.status === 'running' && (
                <rect
                  x={x} y={y}
                  width={nw} height={nh}
                  rx={10} ry={10}
                  fill="none"
                  stroke={style.border}
                  strokeWidth="2"
                  opacity="0.5"
                >
                  <animate
                    attributeName="opacity"
                    values="0.5;0.1;0.5"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </rect>
              )}

              {/* 节点文字 */}
              <text
                x={x + nw / 2}
                y={y + nh / 2 + 4}
                fill={style.text}
                fontSize={fallback ? "11" : "12"}
                fontWeight="500"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {node.label || node.id}
              </text>

              {/* 状态小圆点 */}
              <circle
                cx={x + nw - 14}
                cy={y + 14}
                r="4"
                fill={style.border}
              >
                {node.status === 'running' && (
                  <animate
                    attributeName="r"
                    values="3;5;3"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>

              {/* 错误标记 */}
              {node.status === 'failed' && (
                <text
                  x={x + nw - 14}
                  y={y + 18}
                  fill="#FCA5A5"
                  fontSize="10"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  ✕
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="absolute z-10 px-3 py-2 rounded-lg text-xs max-w-xs pointer-events-none"
          style={{
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#F1F5F9',
            top: 8,
            right: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <div className="font-medium mb-0.5">{hovered.label || hovered.id}</div>
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

      {/* Status legend */}
      {!fallback && (
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {Object.entries(STATUS_STYLES).map(([key, s]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs" style={{ color: s.text }}>
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.border }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
