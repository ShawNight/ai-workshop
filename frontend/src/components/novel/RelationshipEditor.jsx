import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, X, Heart, Sword, ShieldCheck, Users } from 'lucide-react';

const relationTypes = [
  { value: 'friend', label: '朋友', icon: Users, color: '#3B82F6' },
  { value: 'love', label: '恋人', icon: Heart, color: '#EC4899' },
  { value: 'enemy', label: '敌人', icon: Sword, color: '#EF4444' },
  { value: 'ally', label: '盟友', icon: ShieldCheck, color: '#10B981' },
  { value: 'family', label: '家人', icon: Users, color: '#8B5CF6' },
  { value: 'mentor', label: '师徒', icon: Users, color: '#F59E0B' },
  { value: 'rival', label: '对手', icon: Sword, color: '#F97316' },
  { value: 'other', label: '其他', icon: Users, color: '#6B7280' },
];

export function RelationshipEditor({ characters, relationships, onSave, onClose }) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [type, setType] = useState('friend');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!fromId || !toId || fromId === toId) return;
    onSave?.({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      fromId,
      toId,
      type,
      description: description.trim(),
    });
    onClose?.();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">添加关系</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--background)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--text-secondary)]">角色A</label>
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm p-2"
          >
            <option value="">选择角色...</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--text-secondary)]">角色B</label>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm p-2"
          >
            <option value="">选择角色...</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-[var(--text-secondary)]">关系类型</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {relationTypes.map((rt) => {
            const Icon = rt.icon;
            return (
              <button
                key={rt.value}
                onClick={() => setType(rt.value)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  type === rt.value
                    ? 'ring-2 ring-offset-1'
                    : 'hover:bg-[var(--background)]'
                }`}
                style={{
                  backgroundColor: `${rt.color}15`,
                  color: rt.color,
                  ...(type === rt.value ? { ringColor: rt.color } : {}),
                }}
              >
                <Icon className="h-3 w-3" />
                {rt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs text-[var(--text-secondary)]">关系描述（可选）</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="如：青梅竹马、生死之交..."
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm p-2"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!fromId || !toId || fromId === toId}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        添加关系
      </button>
    </div>
  );
}
