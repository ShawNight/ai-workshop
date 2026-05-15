import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: newTheme });
        const html = document.documentElement;
        if (newTheme === 'dark') {
          html.classList.remove('light');
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
          html.classList.add('light');
        }
      },
      setTheme: (theme) => {
        set({ theme });
        const html = document.documentElement;
        if (theme === 'dark') {
          html.classList.remove('light');
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
          html.classList.add('light');
        }
      }
    }),
    {
      name: 'ai-workshop-theme'
    }
  )
);
