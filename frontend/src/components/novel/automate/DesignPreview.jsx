import { useState } from 'react';
import { BookOpen, Users, Shield, Eye, ChevronDown, ChevronRight, Edit3, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const tabs = [
  { key: 'outline', icon: BookOpen, label: '大纲' },
  { key: 'characters', icon: Users, label: '角色' },
  { key: 'rules', icon: Shield, label: '世界规则' },
  { key: 'foreshadows', icon: Eye, label: '伏笔' },
];

function OutlinTab({ outline, synopsis, totalChapters, targetWords }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-[var(--text-secondary)] mb-4">
        <strong>{synopsis}</strong> · 目标{targetWords?.toLocaleString()}字 · 约{totalChapters}章
      </div>
      {(outline || []).map((vol, i) => (
        <div key={i} className="rounded-xl bg-[var(--elevated)] border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">
                <span className="text-violet-400 mr-2">卷{i + 1}</span>
                {vol.title}
              </h3>
              <span className="text-xs text-[var(--text-secondary)]">约{vol.chapters}章</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{vol.goal}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-[var(--text-secondary)]">{vol.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CharactersTab({ characters }) {
  return (
    <div className="space-y-3">
      {(characters || []).map((char, i) => (
        <div key={i} className="rounded-xl bg-[var(--elevated)] border border-[var(--border)] p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-violet-400 font-medium text-sm">{char.name?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sm">{char.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">
                  {char.role}
                </span>
              </div>
              {(char.traits || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {char.traits.map((t, j) => (
                    <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-[var(--border)] text-[var(--text-secondary)]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {char.backstory && (
                <p className="text-xs text-[var(--text-secondary)]">{char.backstory}</p>
              )}
              {char.arc && (
                <div className="mt-2 pt-2 border-t border-[var(--border)] grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--text-secondary)]">目标：</span>{char.arc.want}</div>
                  <div><span className="text-[var(--text-secondary)]">需求：</span>{char.arc.need}</div>
                  <div><span className="text-[var(--text-secondary)]">错误信念：</span>{char.arc.lie}</div>
                  <div><span className="text-[var(--text-secondary)]">真相：</span>{char.arc.truth}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RulesTab({ rules }) {
  return (
    <div className="space-y-2">
      {(rules || []).map((rule, i) => (
        <div key={i} className="rounded-xl bg-[var(--elevated)] border border-[var(--border)] p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">{rule.rule}</h3>
              {rule.detail && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">{rule.detail}</p>
              )}
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                {rule.type === 'hard' ? '硬约束 · 不可违反' : '软约束'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ForeshadowsTab({ foreshadows }) {
  return (
    <div className="space-y-2">
      {(foreshadows || []).map((fs, i) => (
        <div key={i} className="rounded-xl bg-[var(--elevated)] border border-[var(--border)] p-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
              fs.importance === '核心' ? 'bg-violet-400' : fs.importance === '重要' ? 'bg-amber-400' : 'bg-[var(--border)]'
            )} />
            <div className="flex-1">
              <p className="text-sm">{fs.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
                <span>埋点：{fs.plant_stage}</span>
                <span className="text-[var(--border)]">→</span>
                <span>回收：{fs.reveal_stage}</span>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded',
                  fs.importance === '核心' ? 'bg-violet-500/10 text-violet-400' :
                  fs.importance === '重要' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-[var(--border)] text-[var(--text-secondary)]'
                )}>
                  {fs.importance}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DesignPreview({ design, className }) {
  const [activeTab, setActiveTab] = useState('outline');

  if (!design) return null;

  const TabContent = {
    outline: OutlinTab,
    characters: CharactersTab,
    rules: RulesTab,
    foreshadows: ForeshadowsTab,
  }[activeTab];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--elevated)] border border-[var(--border)] mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
              activeTab === tab.key
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <TabContent
          outline={design.outline}
          synopsis={design.synopsis}
          totalChapters={design.total_chapters}
          targetWords={design.target_word_count}
          characters={design.characters}
          rules={design.rules}
          foreshadows={design.foreshadows}
        />
      </div>
    </div>
  );
}
