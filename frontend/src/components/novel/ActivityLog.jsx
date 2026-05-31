import { useEffect, useRef } from 'react';

export function ActivityLog({ log }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  if (!log || log.length === 0) return null;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">活动日志</h3>
      </div>
      <div className="max-h-64 overflow-y-auto p-4 space-y-2">
        {log.map((entry, idx) => (
          <div key={idx} className="flex items-start gap-3 text-sm">
            <span className="text-xs text-[var(--text-secondary)] w-12 flex-shrink-0 pt-0.5">
              {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
            <span className="flex-shrink-0">{entry.agent_icon || '•'}</span>
            <div>
              <span className="font-medium text-[var(--text-primary)]">{entry.agent_label || entry.agent}</span>
              <span className="text-[var(--text-secondary)] ml-1">
                {entry.action === 'started' ? '开始工作' :
                 entry.action === 'completed' ? '完成' :
                 entry.action === 'approved' ? '审查通过 ✓' :
                 entry.action === 'revision' ? '需要修改' :
                 entry.action === 'drafted' ? '草稿完成' :
                 entry.action === 'next_chapter' ? '进入下一章' :
                 entry.action === 'complete' ? '全部完成 🎉' :
                 entry.action === 'error' ? '出错' : entry.action}
              </span>
              {entry.summary && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{entry.summary}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
