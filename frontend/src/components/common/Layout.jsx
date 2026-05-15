import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Music, BookOpen, Home, Sun, Moon, Menu, X, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../store/themeStore';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/music', icon: Music, label: '音乐创作', accent: 'text-cyan-400' },
  { to: '/novel', icon: BookOpen, label: '小说写作', accent: 'text-violet-400' },
];

const bottomNavItems = [
  { to: '/settings', icon: Settings, label: '设置' },
];

export function Sidebar() {
  const { theme, toggleTheme } = useThemeStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 md:hidden rounded-xl bg-[var(--surface)]/80 backdrop-blur-md p-2.5 shadow-lg border border-[var(--border)]"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64',
        'bg-[var(--surface)]/80 backdrop-blur-xl border-r border-[var(--border)]',
        'transform transition-transform duration-300 ease-out md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'pt-16 md:pt-0'
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-[var(--border)]">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
              AI 个人工作坊
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1 tracking-wide">AI Personal Workshop</p>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--elevated)] hover:text-[var(--text-primary)]'
                )}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className={cn('h-5 w-5', item.accent)} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="p-3 border-t border-[var(--border)] space-y-1">
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--elevated)] hover:text-[var(--text-primary)]'
                )}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--elevated)] hover:text-[var(--text-primary)] transition-all duration-200"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              {theme === 'light' ? '深色模式' : '浅色模式'}
            </button>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
