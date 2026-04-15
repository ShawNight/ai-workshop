import { cn } from '../../lib/utils';
import { Clock, Check, Eye, RotateCcw, GitCompare } from 'lucide-react';

export function VersionTimeline({
  versions,
  currentIndex,
  onSelect,
  onRestore,
  onCompare
}) {
  if (!versions || versions.length === 0) {
    return null;
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return '今天';
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--text-secondary)]" />
          版本历史
          <span className="text-xs text-[var(--text-secondary)]">({versions.length})</span>
        </h4>
        {versions.length >= 2 && (
          <button
            onClick={() => onCompare?.(0, versions.length - 1)}
            className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            <GitCompare className="h-3 w-3" />
            对比最新与初始
          </button>
        )}
      </div>

      {/* 时间线 */}
      <div className="relative">
        {/* 时间线轴 */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--border)]" />

        {/* 版本列表 */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {[...versions].reverse().map((version, revIdx) => {
            const actualIndex = versions.length - 1 - revIdx;
            const isSelected = actualIndex === currentIndex;
            const isCurrent = revIdx === 0;

            return (
              <div
                key={version.id}
                className={cn(
                  'relative pl-10 transition-all',
                  isSelected && 'scale-[1.02]'
                )}
              >
                {/* 时间线节点 */}
                <div
                  className={cn(
                    'absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 transition-all',
                    isCurrent
                      ? 'bg-[var(--primary)] border-[var(--primary)]'
                      : isSelected
                        ? 'bg-white dark:bg-gray-800 border-[var(--primary)]'
                        : 'bg-white dark:bg-gray-800 border-[var(--border)]'
                  )}
                />

                {/* 版本卡片 */}
                <div
                  onClick={() => onSelect?.(actualIndex)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm'
                      : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface)]',
                    version.isApproved && 'border-green-500/50 bg-green-50/30 dark:bg-green-900/10'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'text-sm font-medium truncate',
                          isCurrent && 'text-[var(--primary)]'
                        )}>
                          {version.description || `版本 ${actualIndex + 1}`}
                        </span>
                        {version.isApproved && (
                          <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                            <Check className="h-2.5 w-2.5" />
                            已确认
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded">
                            当前
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {formatDate(version.timestamp)} {formatTime(version.timestamp)}
                      </p>
                      {/* 预览首行歌词 */}
                      <p className="text-xs text-[var(--text-secondary)] mt-1 truncate italic">
                        {version.content.split('\n').find(l => l.trim()) || '（空）'}
                      </p>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect?.(actualIndex);
                        }}
                        className={cn(
                          'p-1.5 rounded transition-colors',
                          isSelected
                            ? 'text-[var(--primary)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10'
                        )}
                        title="预览"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {!isCurrent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore?.(actualIndex);
                          }}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                          title="回滚到此版本"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
