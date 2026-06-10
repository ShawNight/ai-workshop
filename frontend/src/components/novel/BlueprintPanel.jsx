import { useState } from 'react';
import {
  FileText, Users, Shield, Eye, MapPin, Zap, Edit3, Save, X, Loader2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { BlueprintDiffBadge } from './BlueprintDiffBadge';
import { cn } from '../../lib/utils';

const TABS = [
  { key: 'outline',     icon: FileText, label: '大纲' },
  { key: 'characters',  icon: Users,    label: '角色' },
  { key: 'world_rules', icon: Shield,   label: '世界规则' },
  { key: 'power_system', icon: Zap,     label: '力量体系' },
  { key: 'geography',   icon: MapPin,   label: '地理' },
  { key: 'foreshadows', icon: Eye,      label: '伏笔' },
];

function isNewItem(item, changes) {
  if (!changes || changes.length === 0) return false;
  for (const c of changes) {
    const data = c.changeData || {};
    const list = data.new_characters || data.new_foreshadows || data.newCharacters || data.newForeshadows || [];
    if (list.some(x => JSON.stringify(x) === JSON.stringify(item))) return c;
  }
  return false;
}

function isUpdatedItem(item, changes) {
  if (!changes || changes.length === 0) return false;
  for (const c of changes) {
    const list = c.changeData?.updated_characters || c.changeData?.updatedCharacters || [];
    if (list.some(x => x.name === item.name)) return c;
  }
  return false;
}

function SynopsisBlock({ design, changes }) {
  if (!design.synopsis) return null;
  return (
    <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4 mb-4">
      <div className="text-xs font-medium text-violet-400 mb-1.5">📜 故事概要</div>
      <p className="text-sm text-[var(--text-primary)] italic leading-relaxed">
        {design.synopsis}
      </p>
    </div>
  );
}

function OutlineTab({ design }) {
  const outline = design.outline || [];
  if (outline.length === 0) return <EmptyBlock message="暂无大纲" />;

  return (
    <div className="space-y-3">
      {outline.map((vol, vi) => (
        <div key={vi} className="bg-[var(--elevated)] rounded-lg p-4 border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded">
              第{vol.volume}卷
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{vol.title}</span>
            {vol.chapters != null && (
              <span className="text-xs text-[var(--text-secondary)]">共{vol.chapters}章</span>
            )}
          </div>
          {vol.goal && (
            <p className="text-xs text-[var(--text-secondary)] mb-2">🎯 {vol.goal}</p>
          )}
          {vol.chapters_detail && (
            <div className="space-y-1 pl-2 border-l-2 border-violet-500/20">
              {vol.chapters_detail.map((ch) => (
                <div key={ch.index} className="text-xs flex items-start gap-2">
                  <span className="text-[var(--text-secondary)] w-8 text-right pt-0.5 flex-shrink-0">
                    {ch.index}.
                  </span>
                  <div className="flex-1">
                    <div className="text-[var(--text-primary)] font-medium">{ch.title}</div>
                    {ch.guidance && (
                      <div className="text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                        {ch.guidance}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CharactersTab({ design, changes, filterNewOnly }) {
  const chars = design.characters || [];
  const filtered = filterNewOnly ? chars.filter(c => isNewItem(c, changes)) : chars;

  if (chars.length === 0) return <EmptyBlock message="暂无角色" />;
  if (filtered.length === 0 && filterNewOnly) return <EmptyBlock message="本次无新增角色" />;

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {filtered.map((c, i) => {
        const isNew = isNewItem(c, changes);
        const isUpdated = isUpdatedItem(c, changes);
        return (
          <div key={c.name + i} className={cn(
            'rounded-lg p-3 border transition-all',
            isNew ? 'bg-emerald-500/5 border-emerald-500/30' :
            isUpdated ? 'bg-amber-500/5 border-amber-500/30' :
            'bg-[var(--elevated)] border-[var(--border)]'
          )}>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-sm font-bold text-[var(--text-primary)]">{c.name}</span>
              {c.role && (
                <span className="text-[10px] text-violet-300 bg-violet-500/15 px-1.5 py-0.5 rounded">
                  {c.role}
                </span>
              )}
              {isNew && <BlueprintDiffBadge change={isNew} kind="new" />}
              {isUpdated && !isNew && <BlueprintDiffBadge change={isUpdated} kind="updated" />}
            </div>
            {c.appearance && (
              <p className="text-xs text-[var(--text-secondary)] mb-1">👤 {c.appearance}</p>
            )}
            {c.traits && c.traits.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {c.traits.map((t, ti) => (
                  <span key={ti} className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface)] px-1.5 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {c.backstory && (
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                {c.backstory}
              </p>
            )}
            {c.arc && (c.arc.want || c.arc.need) && (
              <div className="mt-2 pt-2 border-t border-[var(--border)] text-[10px] text-[var(--text-secondary)] space-y-0.5">
                {c.arc.want && <p>🎯 <span className="text-blue-300">想要：</span>{c.arc.want}</p>}
                {c.arc.need && <p>💎 <span className="text-emerald-300">需要：</span>{c.arc.need}</p>}
                {c.arc.truth && <p>✨ <span className="text-amber-300">真相：</span>{c.arc.truth}</p>}
              </div>
            )}
            {c.first_appear && (
              <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">首次出场：{c.first_appear}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RulesTab({ design, changes, filterNewOnly }) {
  const rules = design.world_rules || [];
  const filtered = filterNewOnly ? rules.filter(r => isNewItem(r, changes)) : rules;
  if (rules.length === 0) return <EmptyBlock message="暂无世界规则" />;
  if (filtered.length === 0 && filterNewOnly) return <EmptyBlock message="本次无新增规则" />;
  return (
    <div className="space-y-2">
      {filtered.map((r, i) => {
        const isNew = isNewItem(r, changes);
        return (
          <div key={i} className={cn(
            'rounded-lg p-3 border',
            isNew ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-[var(--elevated)] border-[var(--border)]'
          )}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded',
                r.type === 'hard'
                  ? 'text-red-300 bg-red-500/15 border border-red-500/30'
                  : 'text-blue-300 bg-blue-500/15 border border-blue-500/30'
              )}>
                {r.type === 'hard' ? '硬规则' : '软规则'}
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{r.rule}</span>
              {isNew && <BlueprintDiffBadge change={isNew} kind="new" />}
            </div>
            {r.detail && <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{r.detail}</p>}
            {r.constraints && r.constraints.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {r.constraints.map((c, ci) => (
                  <span key={ci} className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface)] px-1.5 py-0.5 rounded">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PowerSystemTab({ design }) {
  const ps = design.power_system;
  if (!ps) return <EmptyBlock message="暂无力量体系设定" />;
  return (
    <div className="bg-[var(--elevated)] rounded-lg p-4 border border-[var(--border)] space-y-3">
      <h3 className="text-sm font-semibold text-amber-300">⚡ {ps.name || '力量体系'}</h3>
      {ps.source && <p className="text-xs text-[var(--text-secondary)]">📖 力量来源：{ps.source}</p>}
      {ps.levels && ps.levels.length > 0 && (
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-1.5">等级：</div>
          <div className="flex flex-wrap gap-1.5">
            {ps.levels.map((lv, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-200">
                {lv}
              </span>
            ))}
          </div>
        </div>
      )}
      {ps.rules && ps.rules.length > 0 && (
        <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
          {ps.rules.map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
      )}
    </div>
  );
}

function GeographyTab({ design }) {
  const geo = design.geography || [];
  if (geo.length === 0) return <EmptyBlock message="暂无地理设定" />;
  return (
    <div className="grid md:grid-cols-2 gap-2">
      {geo.map((g, i) => (
        <div key={i} className="bg-[var(--elevated)] rounded-lg p-3 border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-blue-300 bg-blue-500/15 px-1.5 py-0.5 rounded">
              {g.type || '地点'}
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{g.name}</span>
          </div>
          {g.description && <p className="text-xs text-[var(--text-secondary)]">{g.description}</p>}
          {g.significance && (
            <p className="text-[10px] text-violet-300 mt-1">📍 剧情意义：{g.significance}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ForeshadowsTab({ design, changes, filterNewOnly }) {
  const fores = design.foreshadows || [];
  const filtered = filterNewOnly ? fores.filter(f => isNewItem(f, changes)) : fores;
  if (fores.length === 0) return <EmptyBlock message="暂无伏笔" />;
  if (filtered.length === 0 && filterNewOnly) return <EmptyBlock message="本次无新增伏笔" />;
  return (
    <div className="space-y-2">
      {filtered.map((f, i) => {
        const isNew = isNewItem(f, changes);
        return (
          <div key={i} className={cn(
            'rounded-lg p-3 border',
            isNew ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-[var(--elevated)] border-[var(--border)]'
          )}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded',
                f.importance === '主要'
                  ? 'text-amber-300 bg-amber-500/15'
                  : 'text-slate-300 bg-slate-500/15'
              )}>
                {f.importance || '次要'}
              </span>
              <span className="text-sm text-[var(--text-primary)] flex-1">{f.description}</span>
              {isNew && <BlueprintDiffBadge change={isNew} kind="new" />}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
              {f.plant_stage && <span>🌱 种下：{f.plant_stage}</span>}
              {f.reveal_stage && <span>🎯 揭示：{f.reveal_stage}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyBlock({ message }) {
  return (
    <div className="text-center py-12 text-sm text-[var(--text-secondary)]">
      {message}
    </div>
  );
}

export function BlueprintPanel({ design, changes = [], filterNewOnly = false, editable = false, onSave }) {
  const [tab, setTab] = useState('outline');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!design) {
    return <EmptyBlock message="暂无设计蓝图，先启动策划阶段" />;
  }

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(design)));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await onSave?.(draft);
      setEditing(false);
      setDraft(null);
    } catch (e) {
      toast.error(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <SynopsisBlock design={design} changes={changes} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap',
                  tab === t.key
                    ? 'text-violet-300 border-violet-400 bg-violet-500/5'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                )}>
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        {editable && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Edit3 className="h-3.5 w-3.5" />编辑蓝图
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
              <X className="h-3.5 w-3.5" />取消
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存
            </Button>
          </div>
        )}
      </div>

      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
        {editing ? (
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[var(--text-secondary)] mb-1 block">故事概要</label>
              <textarea
                value={draft.synopsis || ''}
                onChange={e => setDraft({ ...draft, synopsis: e.target.value })}
                rows={3}
                className="w-full rounded border border-[var(--border)] bg-[var(--elevated)] p-2"
              />
            </div>
            <details open>
              <summary className="cursor-pointer text-[var(--text-secondary)] font-medium">📋 大纲 JSON</summary>
              <textarea
                value={JSON.stringify(draft.outline || [], null, 2)}
                onChange={e => {
                  try { setDraft({ ...draft, outline: JSON.parse(e.target.value) }); } catch (_) { /* keep previous valid json */ }
                }}
                rows={8}
                className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--elevated)] p-2 font-mono"
              />
            </details>
            <details>
              <summary className="cursor-pointer text-[var(--text-secondary)] font-medium">👤 角色 JSON</summary>
              <textarea
                value={JSON.stringify(draft.characters || [], null, 2)}
                onChange={e => {
                  try { setDraft({ ...draft, characters: JSON.parse(e.target.value) }); } catch (_) { /* keep previous valid json */ }
                }}
                rows={8}
                className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--elevated)] p-2 font-mono"
              />
            </details>
            <details>
              <summary className="cursor-pointer text-[var(--text-secondary)] font-medium">🌍 世界规则 JSON</summary>
              <textarea
                value={JSON.stringify(draft.world_rules || [], null, 2)}
                onChange={e => {
                  try { setDraft({ ...draft, world_rules: JSON.parse(e.target.value) }); } catch (_) { /* keep previous valid json */ }
                }}
                rows={6}
                className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--elevated)] p-2 font-mono"
              />
            </details>
            <details>
              <summary className="cursor-pointer text-[var(--text-secondary)] font-medium">🔮 伏笔 JSON</summary>
              <textarea
                value={JSON.stringify(draft.foreshadows || [], null, 2)}
                onChange={e => {
                  try { setDraft({ ...draft, foreshadows: JSON.parse(e.target.value) }); } catch (_) { /* keep previous valid json */ }
                }}
                rows={6}
                className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--elevated)] p-2 font-mono"
              />
            </details>
          </div>
        ) : (
          <>
            {tab === 'outline' && <OutlineTab design={design} />}
            {tab === 'characters' && <CharactersTab design={design} changes={changes} filterNewOnly={filterNewOnly} />}
            {tab === 'world_rules' && <RulesTab design={design} changes={changes} filterNewOnly={filterNewOnly} />}
            {tab === 'power_system' && <PowerSystemTab design={design} />}
            {tab === 'geography' && <GeographyTab design={design} />}
            {tab === 'foreshadows' && <ForeshadowsTab design={design} changes={changes} filterNewOnly={filterNewOnly} />}
          </>
        )}
      </div>
    </div>
  );
}
