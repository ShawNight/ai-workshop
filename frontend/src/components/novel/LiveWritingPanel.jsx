import { useState, useEffect, useRef } from 'react';

/**
 * LiveWritingPanel — 实时展示正在创作的章节内容
 *
 * 通过 SSE 接收章节内容片段，打字机效果展示。
 * 当 Writer 完成后显示完整章节。
 */
export function LiveWritingPanel({ chapter, isActive }) {
  const [displayText, setDisplayText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const contentRef = useRef(null);

  // 当章节内容更新时，显示完整内容
  useEffect(() => {
    if (chapter?.content) {
      setDisplayText(chapter.content);
      setIsStreaming(false);
    }
  }, [chapter?.content]);

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [displayText]);

  if (!chapter) return null;

  const wordCount = displayText.length;
  const status = chapter.status;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--elevated)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            第{chapter.index}章 {chapter.title}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-xs text-violet-400">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              创作中
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span>{wordCount.toLocaleString()} 字</span>
          {status === 'draft' && <span className="text-yellow-400">草稿</span>}
          {status === 'polished' && <span className="text-green-400">已润色</span>}
          {status === 'pending' && <span className="text-[var(--text-secondary)]">待创作</span>}
        </div>
      </div>

      {/* 内容区域 */}
      <div
        ref={contentRef}
        className="p-6 max-h-[500px] overflow-y-auto"
      >
        {displayText ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="text-sm leading-7 text-[var(--text-primary)] whitespace-pre-wrap">
              {displayText}
              {isActive && (
                <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            {isActive ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-violet-400">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">正在创作中...</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  AI 正在构思并撰写本章内容，请稍候
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                章节内容创作完成后将在此显示
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
