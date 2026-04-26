import { useState } from 'react';
import { ChevronRight, ChevronDown, GripVertical, Plus, Trash2, Edit3 } from 'lucide-react';
import { Input } from '../ui/Input';

const typeConfig = {
  volume: { label: '卷', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  chapter: { label: '章', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  scene: { label: '节', color: 'text-green-500', bg: 'bg-green-500/10' },
};

export function OutlineNode({ node, depth = 0, onUpdate, onDelete, onAddChild, onSelect, onEdit }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(node.title || '');

  const hasChildren = node.children && node.children.length > 0;
  const config = typeConfig[node.type] || typeConfig.chapter;
  const wordCount = (node.content || '').replace(/\s/g, '').length;

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditTitle(node.title || '');
  };

  const handleTitleSave = () => {
    if (editTitle.trim()) {
      onUpdate?.({ ...node, title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg group hover:bg-[var(--background)] transition-colors ${
          depth > 0 ? `ml-${Math.min(depth * 4, 16)}` : ''
        }`}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 flex-shrink-0"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--text-secondary)]" />}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* Type badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${config.bg} ${config.color}`}>
          {config.label}
        </span>

        {/* Title */}
        <div className="flex-1 min-w-0 flex items-center gap-1">
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setIsEditing(false); }}
              className="text-sm h-6 py-0 border-0 bg-transparent focus:ring-1"
              autoFocus
            />
          ) : (
            <button
              onClick={() => onSelect?.(node)}
              onDoubleClick={handleDoubleClick}
              className={`text-sm truncate text-left flex-1 ${
                node.status === 'completed' ? 'line-through text-[var(--text-secondary)]' : ''
              } ${node.status === 'writing' ? 'text-[var(--primary)]' : ''}`}
            >
              {node.title || '未命名'}
            </button>
          )}
          {wordCount > 0 && (
            <span className="text-[10px] text-[var(--text-secondary)] flex-shrink-0">
              {wordCount}字
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {node.type !== 'scene' && (
            <button
              onClick={() => onAddChild?.(node)}
              className="p-1 rounded hover:bg-[var(--surface)]"
              title={`添加${node.type === 'volume' ? '章' : '节'}`}
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => onEdit?.(node)}
            className="p-1 rounded hover:bg-[var(--surface)]"
            title="编辑"
          >
            <Edit3 className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete?.(node)}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <OutlineNode
              key={child.id || idx}
              node={child}
              depth={depth + 1}
              onUpdate={(updated) => {
                const newChildren = [...node.children];
                newChildren[idx] = updated;
                onUpdate?.({ ...node, children: newChildren });
              }}
              onDelete={() => {
                onUpdate?.({ ...node, children: node.children.filter((_, i) => i !== idx) });
              }}
              onAddChild={(parent) => {
                const newItem = createNewNode(parent.type === 'volume' ? 'chapter' : 'scene');
                onUpdate?.({ ...node, children: [...node.children, newItem] });
              }}
              onSelect={onSelect}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function createNewNode(type) {
  const titles = {
    volume: '新卷',
    chapter: '新章节',
    scene: '新场景',
  };
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    type,
    title: titles[type] || '新节点',
    content: '',
    status: 'draft',
    children: [],
  };
}

export { createNewNode };
