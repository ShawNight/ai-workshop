import { NavLink } from 'react-router-dom';
import { Music, BookOpen, Workflow, Home, Sun, Moon, Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../store/themeStore';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/music', icon: Music, label: '音乐创作' },
  { to: '/novel', icon: BookOpen, label: '小说写作' },
  { to: '/workflows', icon: Workflow, label: '工作流编排' }
];

export function Sidebar() {
  const { theme, toggleTheme } = useThemeStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 md:hidden rounded-md bg-[var(--surface)] p-2 shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 bg-[var(--surface)] border-r border-[var(--border)]',
        'transform transition-transform duration-200 ease-in-out md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'pt-16 md:pt-0'
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-[var(--border)]">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
              AI 个人工作坊
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">AI Personal Workshop</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-[var(--border)]">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              {theme === 'light' ? '深色模式' : '浅色模式'}
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
