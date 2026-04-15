import { cn } from '../../lib/utils';
import { User, Bot, Sparkles, RefreshCw } from 'lucide-react';

export function ConversationPanel({ messages, onRetry }) {
  return (
    <div className="flex flex-col h-full">
      <h3 className="font-semibold mb-3">创作对话</h3>
      
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
            <Bot className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">在这里与AI对话</p>
            <p className="text-xs mt-1">优化和迭代你的歌词</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-3',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                msg.role === 'user'
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--secondary)] text-white'
              )}>
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              
              <div className={cn(
                'flex-1 max-w-[80%]',
                msg.role === 'user' ? 'text-right' : 'text-left'
              )}>
                <div className={cn(
                  'inline-block p-3 rounded-lg text-sm',
                  msg.role === 'user'
                    ? 'bg-[var(--primary)] text-white rounded-tr-none'
                    : 'bg-[var(--surface)] border border-[var(--border)] rounded-tl-none'
                )}>
                  {msg.content}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {messages.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => onRetry?.(messages[messages.length - 1]?.content)}
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            基于上一条优化
          </button>
        </div>
      )}
    </div>
  );
}

export function InputPanel({ input, setInput, onSubmit, loading }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSubmit(input);
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入你的想法或修改请求..."
        disabled={loading}
        className={cn(
          'flex-1 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm',
          'placeholder:text-[var(--text-secondary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2',
          'disabled:opacity-50'
        )}
      />
      <button
        type="submit"
        disabled={!input.trim() || loading}
        className={cn(
          'h-10 px-4 rounded-md font-medium transition-colors',
          'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading ? (
          <Sparkles className="h-4 w-4 animate-pulse" />
        ) : (
          '发送'
        )}
      </button>
    </form>
  );
}