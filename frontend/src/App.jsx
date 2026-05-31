import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/common/Layout';
import { ToastContainer } from './components/ui/Toast';
import { NovelPage } from './pages/NovelPage';
import { SettingsPage } from './pages/SettingsPage';
import { useThemeStore } from './store/themeStore';

function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.remove('light');
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[var(--background)]">
        <Sidebar />
        <main className="md:pl-64 min-h-screen">
          <div className="p-4 md:p-8 pt-16 md:pt-8">
            <Routes>
              <Route path="/" element={<Navigate to="/novel" replace />} />
              <Route path="/novel/*" element={<NovelPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}

export default App;
