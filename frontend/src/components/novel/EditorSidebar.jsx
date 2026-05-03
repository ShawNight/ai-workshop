import { ListTree, Users, Globe, BarChart3, Settings, Download, Lightbulb } from 'lucide-react';

const tabs = [
  { key: 'outline', icon: ListTree, label: '大纲' },
  { key: 'characters', icon: Users, label: '角色' },
  { key: 'world', icon: Globe, label: '世界观' },
  { key: 'stats', icon: BarChart3, label: '统计' },
  { key: 'settings', icon: Settings, label: '设定' },
  { key: 'export', icon: Download, label: '导出' },
];

export function EditorSidebar({ activeTab, onTabChange, project }) {
  const hasCharacters = project?.characters?.length > 0;
  const hasLocations = project?.locations?.length > 0;
  const hasChapters = project?.chapters?.length > 0;
  const showGuide = !hasCharacters && !hasLocations && !hasChapters;

  return (
    <div className="w-56 flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col">
      <nav className="p-2 space-y-1">
        {tabs.map((tab) => {
          const count = tab.key === 'characters' && project?.characters?.length
            ? ` (${project.characters.length})`
            : tab.key === 'world' && project?.locations?.length
              ? ` (${project.locations.length})`
              : '';
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--background)]'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}{count}
            </button>
          );
        })}
      </nav>

      {showGuide && (
        <div className="mx-2 mt-2 p-3 rounded-lg bg-[var(--primary)]/5 border border-[var(--primary)]/20 text-xs flex-shrink-0">
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