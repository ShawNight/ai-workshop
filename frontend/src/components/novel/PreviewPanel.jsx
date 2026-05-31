import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Users, Shield, Eye } from 'lucide-react';

const TABS = [
  { key: 'outline', icon: FileText, label: '大纲' },
  { key: 'characters', icon: Users, label: '角色' },
  { key: 'rules', icon: Shield, label: '世界规则' },
  { key: 'foreshadows', icon: Eye, label: '伏笔' },
];

export function PreviewPanel({ state }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('outline');

  if (!state?.design) return null;

  const design = state.design;

  const renderOutline = () => (
    <div className="space-y-3">
      {design.synopsis && (
        <div className="text-sm text-[var(--text-secondary)] bg-[var(--elevated)] rounded-lg p-3 italic">
          {design.synopsis}
        </div>
      )}
      {design.outline?.map((vol) => (
        <div key={vol.volume} className="bg-[var(--elevated)] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded">
              第{vol.volume}卷
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{vol.title}</span>
          </div>
          {vol.goal && (
            <p className="text-xs text-[var(--text-secondary)] mb-2">目标: {vol.goal}</p>
          )}
          <div className="space-y-1">
            {vol.chapters_detail?.map((ch) => (
              <div key={ch.index} className="flex items-center gap-2 text-xs">
                <span className="text-[var(--text-secondary)] w-6 text-right">{ch.index}.</span>
                <span className="text-[var(--text-primary)]">{ch.title}</span>
                {ch.guidance && (
                  <span className="text-[var(--text-secondary)] truncate">— {ch.guidance}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCharacters = () => (
    <div className="grid md:grid-cols-2 gap-3">
      {design.characters?.map((c) => (
        <div key={c.name} className="bg-[var(--elevated)] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-[var(--text-primary)]">{c.name}</span>
            <span className="text-[10px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">{c.role}</span>
          </div>
          {c.traits?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {c.traits.map((t) => (
                <span key={t} className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg)] px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
          {c.backstory && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{c.backstory}</p>
          )}
          {c.arc?.want && (
            <p className="text-xs text-green-400 mt-1">目标: {c.arc.want} → 需求: {c.arc.need}</p>
          )}
        </div>
      ))}
    </div>
  );

  const renderRules = () => (
    <div className="space-y-2">
      {design.world_rules?.map((r, i) => (
        <div key={i} className="bg-[var(--elevated)] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.type === 'hard' ? 'text-red-400 bg-red-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
              {r.type === 'hard' ? '硬规则' : '软规则'}
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">{r.rule}</span>
          </div>
          {r.detail && <p className="text-xs text-[var(--text-secondary)]">{r.detail}</p>}
        </div>
      ))}
    </div>
  );

  const renderForeshadows = () => (
    <div className="space-y-2">
      {design.foreshadows?.map((f, i) => (
        <div key={i} className="bg-[var(--elevated)] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${f.importance === '主要' ? 'text-amber-400 bg-amber-400/10' : 'text-gray-400 bg-gray-400/10'}`}>
              {f.importance}
            </span>
            <span className="text-sm text-[var(--text-primary)]">{f.description}</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            种下: {f.plant_stage || '早期'} → 揭示: {f.reveal_stage || '后期'}
          </p>
        </div>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'outline': return renderOutline();
      case 'characters': return renderCharacters();
      case 'rules': return renderRules();
      case 'foreshadows': return renderForeshadows();
      default: return null;
    }
  };

  const TabIcon = TABS.find(t => t.key === activeTab)?.icon;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[var(--elevated)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {TabIcon && <TabIcon className="h-4 w-4 text-violet-400" />}
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">设计蓝图预览</h3>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" /> : <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />}
      </button>

      {expanded && (
        <>
          <div className="flex border-b border-[var(--border)] px-5 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
                  activeTab === tab.key
                    ? 'border-violet-400 text-violet-400'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-5 max-h-96 overflow-y-auto">
            {renderContent()}
          </div>
        </>
      )}
    </div>
  );
}
