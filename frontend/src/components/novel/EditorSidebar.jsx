import { useState } from 'react';
import { ListTree, Users, Globe, BarChart3, Settings, Download, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const tabs = [
  { key: 'outline', icon: ListTree, label: '大纲' },
  { key: 'characters', icon: Users, label: '角色' },
  { key: 'world', icon: Globe, label: '世界观' },
  { key: 'stats', icon: BarChart3, label: '统计' },
  { key: 'settings', icon: Settings, label: '设定' },
  { key: 'export', icon: Download, label: '导出' },
];

export function EditorSidebar({ activeTab, onTabChange, project }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasCharacters = project?.characters?.length > 0;
  const hasLocations = project?.locations?.length > 0;
  const hasChapters = project?.chapters?.length > 0;
  const showGuide = !hasCharacters && !hasLocations && !hasChapters;

  return (
    <div
      className={cn(
        'flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex items-center justify-end p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-[var(--elevated)] text-[var(--text-secondary)] transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {tabs.map((tab) => {
          const count = tab.key === 'characters' && project?.characters?.length
            ? project.characters.length
            : tab.key === 'world' && project?.locations?.length
              ? project.locations.length
              : null;
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative',
                isActive
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--elevated)] hover:text-[var(--text-primary)]'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[var(--primary)] rounded-r-full" />
              )}
              <TabIcon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{tab.label}</span>
                  {count !== null && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--border)] text-[10px] flex items-center justify-center font-medium">
                      {count}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {showGuide && !collapsed && (
        <div className="mx-2 mt-2 p-3 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 text-xs flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5 font-medium text-[var(--primary)]">
            <Lightbulb className="h-3.5 w-3.5" />
            创作建议
          </div>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            建议先在「角色」和「世界观」中完善设定，再生成大纲，这样 AI 能产出更贴合你设定的内容。
          </p>
        </div>
      )}
    </div>
  );
}
