import { ListTree, Users, Globe, BarChart3, Settings, Download } from 'lucide-react';

const tabs = [
  { key: 'outline', icon: ListTree, label: '大纲' },
  { key: 'characters', icon: Users, label: '角色' },
  { key: 'world', icon: Globe, label: '世界观' },
  { key: 'stats', icon: BarChart3, label: '统计' },
  { key: 'settings', icon: Settings, label: '设定' },
  { key: 'export', icon: Download, label: '导出' },
];

export function EditorSidebar({ activeTab, onTabChange }) {
  return (
    <div className="w-56 flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)]">
      <nav className="p-2 space-y-1">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === key
                ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                : 'text-[var(--text-secondary)] hover:bg-[var(--background)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
