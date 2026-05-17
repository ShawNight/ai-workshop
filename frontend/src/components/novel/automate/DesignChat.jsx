import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/Button';
import { novelApi } from '../../../api';
import { toast } from '../../ui/Toast';

export function DesignChat({ design, onDesignUpdate, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setIsProcessing(true);

    const context = messages.map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.text}`).join('\n');

    try {
      const res = await novelApi.reviseDesign({
        design,
        instruction: userMsg,
        context,
      });

      if (res.data.success) {
        const aiMsg = '已根据你的要求更新设计文档。';
        setMessages((prev) => [...prev, { role: 'ai', text: aiMsg }]);
        onDesignUpdate(res.data.design);
        toast.success('设计已更新');
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: res.data.error || '修改失败，请重试' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: '网络错误，请重试' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          设计对话
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--elevated)] transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-secondary)]">
              你可以用对话方式修改设计，例如：
            </p>
            <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
              <p>"把反派变成主角的哥哥"</p>
              <p>"增加一个修炼等级"</p>
              <p>"删除第3个角色"</p>
              <p>"把故事背景改为蒸汽朋克风格"</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[85%] rounded-xl px-3 py-2 text-sm',
              msg.role === 'user'
                ? 'ml-auto bg-violet-500/20 text-[var(--text-primary)]'
                : 'bg-[var(--elevated)] border border-[var(--border)] text-[var(--text-secondary)]'
            )}
          >
            {msg.text}
          </div>
        ))}
        {isProcessing && (
          <div className="bg-[var(--elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] animate-pulse">
            AI 正在修改设计...
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="告诉 AI 你想怎么修改设计..."
            className="flex-1 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
            disabled={isProcessing}
          />
          <Button size="sm" onClick={handleSend} disabled={!input.trim() || isProcessing}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
