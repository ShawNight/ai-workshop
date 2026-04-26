import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Users, Heart, Sword } from 'lucide-react';

const relationColors = {
  friend: '#3B82F6', love: '#EC4899', enemy: '#EF4444',
  ally: '#10B981', family: '#8B5CF6', mentor: '#F59E0B',
  rival: '#F97316', other: '#6B7280',
};

const relationIcons = { friend: Users, love: Heart, enemy: Sword };

export function RelationshipGraph({ characters, relationships, onDelete, onSelect, className = '' }) {
  const svgRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: null });
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current) {
        const parent = svgRef.current.parentElement;
        setDimensions({ width: parent.clientWidth - 32, height: Math.max(400, Math.min(600, parent.clientHeight - 200)) });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const nodePositions = useMemo(() => {
    if (!characters || characters.length === 0) return [];
    const n = characters.length;
    if (n === 1) return [{ id: characters[0].id, x: dimensions.width / 2, y: dimensions.height / 2 }];

    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const rx = dimensions.width / 2 - 80;
    const ry = dimensions.height / 2 - 80;

    return characters.map((ch, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return {
        id: ch.id,
        name: ch.name,
        role: ch.role,
        traits: ch.traits || [],
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
      };
    });
  }, [characters, dimensions]);

  const edgeLines = useMemo(() => {
    if (!relationships || relationships.length === 0) return [];
    const posMap = {};
    nodePositions.forEach((np) => { posMap[np.id] = np; });
    return relationships
      .filter((r) => posMap[r.fromId] && posMap[r.toId])
      .map((r) => ({
        ...r,
        x1: posMap[r.fromId].x,
        y1: posMap[r.fromId].y,
        x2: posMap[r.toId].x,
        y2: posMap[r.toId].y,
        fromName: posMap[r.fromId]?.name,
        toName: posMap[r.toId]?.name,
      }));
  }, [relationships, nodePositions]);

  const handleNodeHover = (e, node) => {
    setHoveredNode(node.id);
    const rect = svgRef.current.getBoundingClientRect();
    setTooltip({
      show: true,
      x: e.clientX - rect.left + 10,
      y: e.clientY - rect.top - 10,
      content: (
        <div className="p-2 text-xs">
          <p className="font-medium">{node.name}</p>
          {node.role && <p className="text-[var(--text-secondary)]">{node.role}</p>}
          {node.traits.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {node.traits.slice(0, 3).map((t, i) => (
                <span key={i} className="px-1 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">{t}</span>
              ))}
            </div>
          )}
        </div>
      ),
    });
  };

  const handleEdgeHover = (e, edge) => {
    setHoveredEdge(edge.id);
    const rect = svgRef.current.getBoundingClientRect();
    setTooltip({
      show: true,
      x: e.clientX - rect.left + 10,
      y: e.clientY - rect.top - 10,
      content: (
        <div className="p-2 text-xs">
          <p><span className="font-medium">{edge.fromName}</span> → <span className="font-medium">{edge.toName}</span></p>
          <p style={{ color: relationColors[edge.type] }}>{edge.type}</p>
          {edge.description && <p className="text-[var(--text-secondary)]">{edge.description}</p>}
        </div>
      ),
    });
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
    setHoveredEdge(null);
    setTooltip({ show: false, x: 0, y: 0, content: null });
  };

  if (!characters || characters.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-secondary)]">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无角色关系</p>
        <p className="text-xs mt-1">先创建角色，再添加关系</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} onMouseLeave={handleMouseLeave}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="overflow-visible"
      >
        {/* Edges */}
        {edgeLines.map((edge) => {
          const color = relationColors[edge.type] || '#6B7280';
          const isHovered = hoveredEdge === edge.id;
          const hasHover = hoveredNode || hoveredEdge;
          const isDimmed = hasHover && !isHovered;

          return (
            <g key={edge.id}>
              <line
                x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                stroke={color}
                strokeWidth={isHovered ? 3 : 1.5}
                opacity={isDimmed ? 0.15 : 0.6}
                className="cursor-pointer transition-all"
                onMouseEnter={(e) => handleEdgeHover(e, edge)}
                onClick={() => onDelete?.(edge.id)}
              />
              {/* Label on line midpoint */}
              <text
                x={(edge.x1 + edge.x2) / 2}
                y={(edge.y1 + edge.y2) / 2 - 8}
                textAnchor="middle"
                fontSize="10"
                fill={color}
                opacity={isDimmed ? 0.15 : 0.8}
                className="pointer-events-none select-none"
              >
                {edge.type}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodePositions.map((node) => {
          const isHovered = hoveredNode === node.id;
          const hasHover = hoveredNode || hoveredEdge;
          const isDimmed = hasHover && !isHovered;
          const outgoingRels = edgeLines.filter((e) => e.fromId === node.id || e.toId === node.id);
          const nodeColor = outgoingRels.length > 0 ? relationColors[outgoingRels[0].type] : 'var(--primary)';

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onMouseEnter={(e) => handleNodeHover(e, node)}
              onClick={() => onSelect?.(node.id)}
            >
              {/* Pulse ring */}
              <circle
                cx={node.x} cy={node.y} r={isHovered ? 38 : 32}
                fill="none"
                stroke={nodeColor}
                strokeWidth={isHovered ? 2 : 1}
                opacity={isDimmed ? 0.2 : isHovered ? 0.4 : 0.2}
              />
              {/* Node circle */}
              <circle
                cx={node.x} cy={node.y} r={28}
                fill={`${nodeColor}15`}
                stroke={nodeColor}
                strokeWidth={isHovered ? 2.5 : 1.5}
                opacity={isDimmed ? 0.3 : 1}
                className="transition-all"
              />
              {/* Initial */}
              <text
                x={node.x} y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="14"
                fontWeight="bold"
                fill={nodeColor}
                opacity={isDimmed ? 0.3 : 1}
                className="pointer-events-none select-none"
              >
                {node.name?.charAt(0)}
              </text>
              {/* Name label */}
              <text
                x={node.x} y={node.y + 48}
                textAnchor="middle"
                fontSize="11"
                fill="currentColor"
                opacity={isDimmed ? 0.3 : 0.8}
                className="pointer-events-none select-none"
              >
                {node.name?.length > 4 ? node.name.slice(0, 4) + '..' : node.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip.show && (
        <div
          className="absolute z-20 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Legend */}
      {edgeLines.length > 0 && (
        <div className="absolute bottom-2 right-2 flex flex-wrap gap-1.5 bg-[var(--surface)]/90 rounded-lg p-2 border border-[var(--border)]">
          {relationTypes().map((rt) => (
            <span
              key={rt.value}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${rt.color}15`, color: rt.color }}
            >
              {rt.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function relationTypes() {
  return [
    { value: 'friend', label: '朋友', color: '#3B82F6' },
    { value: 'love', label: '恋人', color: '#EC4899' },
    { value: 'enemy', label: '敌人', color: '#EF4444' },
    { value: 'ally', label: '盟友', color: '#10B981' },
    { value: 'family', label: '家人', color: '#8B5CF6' },
    { value: 'mentor', label: '师徒', color: '#F59E0B' },
    { value: 'rival', label: '对手', color: '#F97316' },
  ];
}
