import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, RotateCcw, BookOpen, Check, AlertCircle,
  Loader2, Copy, ChevronLeft, ChevronRight, Trash2, Type as TypeIcon,
} from 'lucide-react';
import { novelApi } from '../api';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { cn } from '../lib/utils';

export function ChapterEditorPage() {
  const { projectId, chapterIdx } = useParams();
  const navigate = useNavigate();
  const idx = parseInt(chapterIdx, 10) || 0;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [markManual, setMarkManual] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const autoSaveTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await novelApi.getProject(projectId);
      if (res.data.success) {
        setProject(res.data.project);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const chapters = useMemo(() => project?.chapters || [], [project]);
  const current = chapters[idx];

  useEffect(() => {
    if (current) {
      setTitle(current.title || '');
      setContent(current.content || '');
      setOriginalTitle(current.title || '');
      setOriginalContent(current.content || '');
      setSavedAt(null);
    }
  }, [current?.id]);

  const wordCount = useMemo(() => (content || '').replace(/\s/g, '').length, [content]);
  const isDirty = title !== originalTitle || content !== originalContent;

  const handleSave = useCallback(async (markManualFlag = markManual) => {
    if (!current) return;
    setSaving(true);
    try {
      const res = await novelApi.manualEditChapter(projectId, current.id, {
        title,
        content,
        manuallyEdited: markManualFlag,
        status: 'polished',
      });
      if (res.data.success) {
        setOriginalTitle(title);
        setOriginalContent(content);
        setSavedAt(new Date());
        toast.success(markManualFlag ? '已保存（标记为人工编辑，工作流将跳过该章）' : '已保存');
        if (project) {
          const updatedChapters = project.chapters.map(c =>
            c.id === current.id ? { ...c, title, content, wordCount: res.data.chapter?.wordCount || content.length, manuallyEdited: markManualFlag, status: 'polished' } : c
          );
          setProject({ ...project, chapters: updatedChapters, currentWordCount: res.data.totalWordCount });
        }
      } else {
        toast.error(res.data.error || '保存失败');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [projectId, current, title, content, markManual, project]);

  // 3秒自动保存（仅在内容变更后）
  useEffect(() => {
    if (!isDirty || !current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      // 自动保存时不弹提示
      handleSave(markManual);
    }, 3000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [title, content, isDirty, current, markManual, handleSave]);

  const handleReset = () => {
    if (!window.confirm('放弃所有未保存的修改？')) return;
    setTitle(originalTitle);
    setContent(originalContent);
  };

  const handleAllowRewrite = async () => {
    if (!current) return;
    if (!window.confirm('确认要允许工作流重写本章吗？\n\n当前人工编辑的内容将丢失，工作流将重新创作。')) return;
    try {
      await novelApi.resetManualEdit(projectId, current.id);
      toast.success('已清除人工编辑标记，工作流将重写本章');
      navigate(`/novel/${projectId}/workflow`);
    } catch (e) {
      toast.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('已复制全文');
    }).catch(() => toast.error('复制失败'));
  };

  const goPrev = () => {
    if (idx > 0) navigate(`/novel/${projectId}/read/${idx - 1}`);
  };
  const goNext = () => {
    if (current && idx < chapters.length - 1) navigate(`/novel/${projectId}/read/${idx + 1}`);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--elevated)] rounded" />
          <div className="h-10 w-3/4 bg-[var(--elevated)] rounded" />
          <div className="h-96 bg-[var(--elevated)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-400 opacity-50" />
        <p className="text-[var(--text-secondary)]">章节不存在</p>
        <Link to={`/novel/${projectId}/read`} className="text-violet-400 hover:underline text-sm mt-3 inline-block">
          返回阅读器
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/novel/${projectId}/read`} className="p-2 rounded-lg hover:bg-[var(--elevated)] transition-colors text-[var(--text-secondary)] flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-violet-400" />
              章节编辑
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {current.idx ? `第 ${idx + 1} 章` : '编辑当前章节'}
              {savedAt && !isDirty && (
                <span className="ml-2 text-emerald-400">
                  <Check className="inline h-3 w-3" /> 已保存 {savedAt.toLocaleTimeString('zh-CN')}
                </span>
              )}
              {isDirty && !saving && (
                <span className="ml-2 text-amber-400">● 未保存</span>
              )}
              {saving && (
                <span className="ml-2 text-violet-400">
                  <Loader2 className="inline h-3 w-3 animate-spin" /> 保存中...
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" onClick={goPrev} disabled={idx === 0}>
            <ChevronLeft className="h-4 w-4" />上一章
          </Button>
          <Button variant="ghost" onClick={goNext} disabled={idx >= chapters.length - 1}>
            下一章<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
        <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">章节标题</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full mt-1.5 bg-transparent text-xl font-bold outline-none focus:text-violet-300"
          placeholder="输入章节标题..."
        />
      </div>

      {/* Editor / Preview tabs */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
          <div className="flex gap-1">
            <button onClick={() => setShowPreview(false)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5',
                !showPreview ? 'bg-violet-500/15 text-violet-300' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}>
              <TypeIcon className="h-3.5 w-3.5" />编辑
            </button>
            <button onClick={() => setShowPreview(true)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5',
                showPreview ? 'bg-violet-500/15 text-violet-300' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}>
              <BookOpen className="h-3.5 w-3.5" />预览
            </button>
          </div>
          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-3">
            <span>{wordCount.toLocaleString()} 字</span>
            <button onClick={handleCopy} className="hover:text-[var(--text-primary)] flex items-center gap-1">
              <Copy className="h-3 w-3" />复制
            </button>
          </div>
        </div>

        {showPreview ? (
          <div className="p-6 min-h-[500px] prose prose-invert max-w-none"
            style={{ fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif" }}>
            {content.split('\n').filter(p => p.trim()).map((p, i) => (
              <p key={i} style={{ textIndent: '2em', marginBottom: '0.8em' }}>{p}</p>
            ))}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="开始书写或修改本章内容..."
            className="w-full p-6 bg-transparent outline-none resize-none"
            style={{
              minHeight: '500px',
              fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif",
              fontSize: '16px',
              lineHeight: '1.85',
              color: 'var(--text-primary)',
            }}
          />
        )}
      </div>

      {/* Footer actions */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 flex items-center justify-between flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={markManual}
            onChange={e => setMarkManual(e.target.checked)}
            className="accent-violet-500"
          />
          <span className="text-[var(--text-primary)]">标记为人工编辑</span>
          <span className="text-xs text-[var(--text-secondary)]">（工作流将自动跳过该章）</span>
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" onClick={handleReset} disabled={!isDirty || saving}>
            <RotateCcw className="h-4 w-4" />放弃修改
          </Button>
          <Button variant="outline" onClick={handleAllowRewrite} disabled={saving}>
            <Trash2 className="h-4 w-4" />允许工作流重写
          </Button>
          <Button onClick={() => handleSave()} disabled={saving || !isDirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存
          </Button>
        </div>
      </div>

      <p className="text-xs text-center text-[var(--text-secondary)]">
        💡 编辑内容会在停止输入 3 秒后自动保存
      </p>
    </div>
  );
}
