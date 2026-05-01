import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RotateCcw, X, MessageCircle } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Textarea } from '../../ui/Input';
import { toast } from '../../ui/Toast';
import { novelApi } from '../../../api';
import { useNovelStore } from '../../../store/novelStore';
import { SuggestionCard } from './SuggestionCard';

function getQuickActions(mode, entityId, project) {
  if (mode === 'character') {
    const char = (project.characters || []).find(c => c.id === entityId);
    const charName = char?.name || '角色';
    return [
      { label: `${charName}的核心动机是什么？`, question: `帮我分析${charName}的核心动机是什么？ta最渴望什么，最恐惧什么？` },
      { label: `挖掘${charName}的内心矛盾`, question: `${charName}有什么内心矛盾？这些矛盾如何在故事中体现？` },
      { label: `完善${charName}的成长弧线`, question: `帮我设计${charName}从故事开始到结束的成长变化弧线` },
      { label: `探索${charName}的关系发展`, question: `${charName}和其他角色之间可以发展出什么样的关系张力？` },
    ];
  } else if (mode === 'world') {
    const loc = (project.locations || []).find(l => l.id === entityId);
    const locName = loc?.name || '世界观';
    return [
      { label: `完善${locName}的历史`, question: `帮我完善${locName}的历史背景，这里发生过什么重大事件？` },
      { label: `设计${locName}的社会结构`, question: `${locName}的社会结构是怎样的？权力、阶层、经济体系？` },
      { label: `建立地点间的关联`, question: `各地点之间有什么地理、政治或文化上的关联？` },
      { label: `检查世界观的逻辑一致性`, question: `帮我检查当前世界观设定是否有逻辑漏洞或不一致之处` },
    ];
  }
  return [];
}

function buildContext(project) {
  return {
    genre: project.genre || '通用',
    premise: project.premise || '',
    characters: project.characters || [],
    relationships: project.relationships || [],
    locations: project.locations || [],
    outline: project.outline || [],
  };
}

export function ChatPanel({ mode, entityId, onApplySuggestion, onClose }) {
  const { currentProject } = useNovelStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text = input) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await novelApi.chat({
        projectId: currentProject.id,
        mode,
        entityId,
        messages: newMessages,
        context: buildContext(currentProject),
      });

      if (res.data.success) {
        const assistantMsg = {
          role: 'assistant',
          content: res.data.reply.content,
          suggestions: res.data.reply.suggestions || [],
          applied: [],
        };
        setMessages([...newMessages, assistantMsg]);
      } else {
        toast.error(res.data.error || '对话失败');
        setMessages(newMessages);
      }
    } catch {
      toast.error('请求失败');
      setMessages(newMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestion = (suggestion, msgIndex) => {
    if (suggestion.type === 'ask_question') {
      handleSend(suggestion.value);
      return;
    }
    onApplySuggestion?.(suggestion);
    setMessages(prev => prev.map((msg, i) => {
      if (i === msgIndex) {
        return { ...msg, applied: [...(msg.applied || []), suggestion] };
      }
      return msg;
    }));
  };

  const handleQuickAction = (question) => {
    handleSend(question);
  };

  const handleClear = () => {
    setMessages([]);
  };

  const quickActions = currentProject ? getQuickActions(mode, entityId, currentProject) : [];
  const title = mode === 'character' ? '角色探讨' : '世界观探讨';

  return (
    <div className="flex flex-col h-full bg-[var(--surface)]">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" />
          与 AI 探讨{title}
        </span>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button size="sm" variant="ghost" onClick={handleClear} title="清空对话">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose} title="关闭">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-8 w-8 mx-auto mb-3 text-[var(--primary)] opacity-40" />
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              与 AI 深入探讨{mode === 'character' ? '角色' : '世界观'}设定
            </p>
            {quickActions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(action.question)}
                    className="px-3 py-1.5 rounded-full bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-xs text-[var(--primary)] transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, msgIndex) => (
              <div key={msgIndex}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-[var(--primary)] text-white rounded-br-sm'
                        : 'bg-[var(--background)] border border-[var(--border)] rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 ml-2 space-y-1.5 max-w-[85%]">
                    {msg.suggestions.map((suggestion, sugIndex) => {
                      const isApplied = msg.applied?.some(s => s === suggestion || s.value === suggestion.value);
                      return (
                        <SuggestionCard
                          key={sugIndex}
                          suggestion={suggestion}
                          applied={isApplied}
                          onApply={() => handleApplySuggestion(suggestion, msgIndex)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{animationDelay: '0ms'}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{animationDelay: '150ms'}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{animationDelay: '300ms'}} />
                </div>
                <span>AI 正在思考...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={mode === 'character' ? '问问关于这个角色的问题...' : '探讨世界观设定...'}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
