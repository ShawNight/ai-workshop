import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, BookOpen, List, X,
  Sun, Moon, Minus, Plus, ChevronDown,
} from 'lucide-react';
import { novelApi } from '../api';
import { cn } from '../lib/utils';

const FONT_SIZES = [14, 16, 18, 20, 22];
const THEMES = [
  { key: 'light', label: '明亮', icon: Sun, color: '#FFFFFF' },
  { key: 'dark', label: '暗黑', icon: Moon, color: '#1a1a2e' },
  { key: 'sepia', label: '护眼', icon: BookOpen, color: '#f4ecd8' },
];

export function ReaderPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reader preferences — persisted to localStorage
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('reader-font-size');
    return saved ? parseInt(saved, 10) : 18;
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('reader-theme') || 'dark';
  });
  const [tocExpanded, setTocExpanded] = useState({});

  useEffect(() => { localStorage.setItem('reader-font-size', fontSize); }, [fontSize]);
  useEffect(() => { localStorage.setItem('reader-theme', theme); }, [theme]);

  useEffect(() => { loadProject(); }, [projectId]);

  const loadProject = async () => {
    try {
      const res = await novelApi.getProject(projectId);
      if (res.data.success) {
        setProject(res.data.project);
      }
    } catch (e) {
      console.error('Failed to load project:', e);
    } finally {
      setLoading(false);
    }
  };

  const chapters = useMemo(
    () => project?.chapters?.filter(c => c.content) || [],
    [project]
  );
  const current = chapters[currentIdx];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < chapters.length - 1;
  const progress = chapters.length ? ((currentIdx + 1) / chapters.length * 100) : 0;

  // Group chapters by volume for TOC
  const volumes = useMemo(() => {
    const map = {};
    chapters.forEach((ch, idx) => {
      const vol = ch.volume || 1;
      const volTitle = ch.volume_title || `第${vol}卷`;
      if (!map[vol]) map[vol] = { title: volTitle, chapters: [] };
      map[vol].chapters.push({ ...ch, idx });
    });
    return Object.values(map);
  }, [chapters]);

  const goToChapter = useCallback((idx) => {
    setCurrentIdx(idx);
    setShowToc(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (hasPrev) goToChapter(currentIdx - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (hasNext) goToChapter(currentIdx + 1);
      } else if (e.key === 'Escape') {
        setShowToc(false);
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, hasPrev, hasNext, goToChapter]);

  // Auto-expand the volume containing current chapter
  useEffect(() => {
    if (current) {
      const vol = current.volume || 1;
      setTocExpanded(prev => ({ ...prev, [vol]: true }));
    }
  }, [current]);

  if (loading) {
    return (
      <div className={`reader-theme-${theme} min-h-screen`} style={{ backgroundColor: 'var(--reader-bg)' }}>
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 rounded" style={{ backgroundColor: 'var(--reader-surface)' }} />
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-4 rounded" style={{ backgroundColor: 'var(--reader-surface)', width: `${80 + Math.random() * 20}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className={`reader-theme-${theme} min-h-screen transition-colors duration-300`}
         style={{ backgroundColor: 'var(--reader-bg)', color: 'var(--reader-text)' }}>

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5"
           style={{ backgroundColor: 'var(--reader-border)' }}>
        <div className="h-full transition-all duration-500 ease-out"
             style={{ width: `${progress}%`, backgroundColor: '#818CF8' }} />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 border-b"
           style={{ backgroundColor: 'var(--reader-bg)', borderColor: 'var(--reader-border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to={`/novel/${projectId}`}
            className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
            style={{ color: 'var(--reader-text-secondary)' }}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>

          {current && (
            <span className="text-sm font-medium truncate mx-4 hidden sm:block"
                  style={{ color: 'var(--reader-text)' }}>
              {current.title}
            </span>
          )}

          <div className="flex items-center gap-2">
            {/* Settings toggle */}
            <button onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg transition-colors text-sm"
              style={{ color: 'var(--reader-text-secondary)' }}
              title="阅读设置">
              <Sun className="h-4 w-4" />
            </button>
            {/* TOC toggle */}
            <button onClick={() => setShowToc(!showToc)}
              className="p-2 rounded-lg transition-colors text-sm flex items-center gap-1.5"
              style={{ color: 'var(--reader-text-secondary)' }}
              title="目录">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">{chapters.length}章</span>
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="max-w-4xl mx-auto px-6 py-3 border-t flex items-center gap-6 flex-wrap"
               style={{ borderColor: 'var(--reader-border)' }}>
            {/* Font size */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--reader-text-secondary)' }}>字号</span>
              <button onClick={() => setFontSize(FONT_SIZES[Math.max(0, FONT_SIZES.indexOf(fontSize) - 1)])}
                disabled={fontSize <= FONT_SIZES[0]}
                className="p-1 rounded hover:opacity-80 disabled:opacity-30 transition-opacity"
                style={{ color: 'var(--reader-text)' }}>
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-xs w-6 text-center" style={{ color: 'var(--reader-text)' }}>{fontSize}</span>
              <button onClick={() => setFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, FONT_SIZES.indexOf(fontSize) + 1)])}
                disabled={fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
                className="p-1 rounded hover:opacity-80 disabled:opacity-30 transition-opacity"
                style={{ color: 'var(--reader-text)' }}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {/* Theme */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--reader-text-secondary)' }}>主题</span>
              {THEMES.map(t => (
                <button key={t.key} onClick={() => setTheme(t.key)}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-transform',
                    theme === t.key ? 'scale-110' : 'opacity-60 hover:opacity-100'
                  )}
                  style={{
                    backgroundColor: t.color,
                    borderColor: theme === t.key ? '#818CF8' : 'var(--reader-border)',
                  }}
                  title={t.label} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TOC sidebar */}
      {showToc && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowToc(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative w-80 h-full overflow-y-auto shadow-2xl"
            style={{ backgroundColor: 'var(--reader-surface)', borderLeft: '1px solid var(--reader-border)' }}>
            <div className="flex items-center justify-between p-4 border-b"
                 style={{ borderColor: 'var(--reader-border)' }}>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--reader-text)' }}>
                <BookOpen className="h-4 w-4 text-violet-400" />
                目录 · {chapters.length}章
              </h3>
              <button onClick={() => setShowToc(false)}
                className="p-1 rounded hover:opacity-70 transition-opacity"
                style={{ color: 'var(--reader-text-secondary)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2">
              {volumes.map((vol, vi) => (
                <div key={vi} className="mb-1">
                  <button
                    onClick={() => setTocExpanded(prev => ({ ...prev, [vi]: !prev[vi] }))}
                    className="w-full text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1 rounded hover:opacity-80"
                    style={{ color: 'var(--reader-text-secondary)' }}>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', tocExpanded[vi] ? '' : '-rotate-90')} />
                    {vol.title} ({vol.chapters.length})
                  </button>
                  {tocExpanded[vi] && vol.chapters.map(ch => (
                    <button key={ch.id} onClick={() => goToChapter(ch.idx)}
                      className={cn(
                        'w-full text-left pl-7 pr-3 py-1.5 text-sm rounded transition-colors',
                      )}
                      style={{
                        color: ch.idx === currentIdx ? '#818CF8' : 'var(--reader-text-secondary)',
                        backgroundColor: ch.idx === currentIdx ? 'var(--reader-highlight)' : 'transparent',
                      }}>
                      {ch.idx + 1}. {ch.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chapter content */}
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        {current ? (
          <article>
            <header className="text-center mb-12">
              <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--reader-text)' }}>
                {current.title}
              </h1>
              <p className="text-sm" style={{ color: 'var(--reader-text-secondary)' }}>
                第 {currentIdx + 1} 章 · 约 {current.content?.length || 0} 字
              </p>
              <div className="mt-6 mx-auto w-16 h-px" style={{ backgroundColor: 'var(--reader-border)' }} />
            </header>
            <div style={{
              fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif",
              fontSize: `${fontSize}px`,
              lineHeight: '1.8',
              color: 'var(--reader-text)',
            }}>
              {current.content?.split('\n').map((para, i) => (
                para.trim() ? (
                  <p key={i} style={{ textIndent: '2em', marginBottom: '0.8em' }}>
                    {para}
                  </p>
                ) : null
              ))}
            </div>
          </article>
        ) : (
          <div className="text-center py-20" style={{ color: 'var(--reader-text-secondary)' }}>
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>暂无章节内容</p>
          </div>
        )}

        {/* Navigation footer */}
        {chapters.length > 1 && (
          <div className="flex items-center justify-between mt-16 pt-8 border-t"
               style={{ borderColor: 'var(--reader-border)' }}>
            <button onClick={() => goToChapter(currentIdx - 1)} disabled={!hasPrev}
              className={cn(
                'flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg transition-colors',
                hasPrev ? 'hover:opacity-80' : 'opacity-30 cursor-not-allowed'
              )}
              style={{ color: 'var(--reader-text-secondary)', backgroundColor: hasPrev ? 'var(--reader-surface)' : 'transparent' }}>
              <ChevronLeft className="h-4 w-4" />上一章
            </button>
            <span className="text-xs" style={{ color: 'var(--reader-text-secondary)' }}>
              {currentIdx + 1} / {chapters.length} · {Math.round(progress)}%
            </span>
            <button onClick={() => goToChapter(currentIdx + 1)} disabled={!hasNext}
              className={cn(
                'flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg transition-colors',
                hasNext ? 'hover:opacity-80' : 'opacity-30 cursor-not-allowed'
              )}
              style={{ color: 'var(--reader-text-secondary)', backgroundColor: hasNext ? 'var(--reader-surface)' : 'transparent' }}>
              下一章<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
