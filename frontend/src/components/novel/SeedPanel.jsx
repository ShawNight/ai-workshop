import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { harnessApi } from '../../api';
import { toast } from '../ui/Toast';

const COLOR_MAP = {
  '#6366F1': '靛蓝', '#EC4899': '玫红', '#14B8A6': '青绿', '#F59E0B': '琥珀',
  '#8B5CF6': '紫罗兰', '#EF4444': '赤红', '#3B82F6': '蔚蓝', '#10B981': '翠绿',
};

export function SeedPanel({ projectId, onStateUpdate }) {
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, meta, loading]);

  const handleSend = async () => {
    const text = description.trim();
    if (!text) return;

    const newHistory = [...history, { role: 'user', content: text }];
    setHistory(newHistory);
    setDescription('');
    setLoading(true);

    try {
      const res = await harnessApi.refineMeta({
        description: text,
        currentMeta: meta || {},
        history,
      });
      if (res.data.success) {
        setMeta(res.data.meta);
        setHistory([...newHistory, { role: 'assistant', content: res.data.reply }]);
      } else {
        toast.error(res.data.error || '请求失败');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!meta) return;
    setCreating(true);
    try {
      const res = await harnessApi.start({
        seed: history[0]?.content || '',
        genre: meta.genre,
        style: meta.style,
        title: meta.title,
        coverColor: meta.coverColor,
        synopsis: meta.synopsis,
        targetWords: meta.targetWords,
      });
      if (res.data.success) {
        toast.success('策划师已开始工作！');
        onStateUpdate(res.data.state);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || '启动失败');
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isFirstRound = history.length === 0;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 flex flex-col h-[520px]">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {isFirstRound && (
          <div className="text-center py-8">
            <Sparkles className="h-10 w-10 text-violet-400 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">
              描述你的故事创意，我来帮你确定作品名称、类型和风格
            </p>
          </div>
        )}

        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[80%] rounded-xl px-4 py-2.5 bg-violet-500/10 text-sm text-[var(--text-primary)]">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[80%] text-sm text-[var(--text-secondary)] italic">
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {meta && (
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-4 space-y-3">
            <div className="text-xs font-medium text-violet-400 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />当前设定
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-[10px] text-[var(--text-secondary)]">标题</span>
                <p className="text-[var(--text-primary)] font-medium">{meta.title || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)]">类型</span>
                <p className="text-[var(--text-primary)]">{meta.genre || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)]">风格</span>
                <p className="text-[var(--text-primary)]">{meta.style || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)]">目标字数</span>
                <p className="text-[var(--text-primary)]">{(meta.targetWords || 0).toLocaleString()} 字</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-[var(--text-secondary)]">概要</span>
                <p className="text-[var(--text-primary)] text-xs">{meta.synopsis || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-secondary)]">封面</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: meta.coverColor }} />
                  <span className="text-xs text-[var(--text-secondary)]">{COLOR_MAP[meta.coverColor] || meta.coverColor}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            AI 正在思考...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-[var(--border)] mt-4 space-y-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isFirstRound ? "描述你的故事创意..." : "继续交流..."}
            disabled={loading}
            className="flex-1 h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 disabled:opacity-50"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={loading || !description.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {meta && (
          <Button onClick={handleConfirm} disabled={creating} className="w-full">
            <CheckCircle className="h-4 w-4" />
            {creating ? '启动中...' : '确认，启动 Agent 团队'}
          </Button>
        )}
      </div>
    </div>
  );
}
