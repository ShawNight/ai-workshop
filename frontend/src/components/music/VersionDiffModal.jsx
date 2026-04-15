import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { X, RotateCcw, Plus, Minus, ArrowRight } from 'lucide-react';

export function VersionDiffModal({
  isOpen,
  onClose,
  versionA,
  versionB,
  diff,
  onRestoreA,
  onRestoreB
}) {
  const [activeSide, setActiveSide] = useState('A');

  if (!isOpen || !versionA || !versionB) return null;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const linesA = versionA.content.split('\n');
  const linesB = versionB.content.split('\n');

  // 构建行号映射
  const removedSet = new Set(diff?.removed?.map(d => d.line.trim()) || []);
  const addedSet = new Set(diff?.added?.map(d => d.line.trim()) || []);
  const unchangedSet = new Set(diff?.unchanged?.map(d => d.line.trim()) || []);

  const handleRestore = () => {
    if (activeSide === 'A') {
      onRestoreA?.();
    } else {
      onRestoreB?.();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 模态框 */}
      <div className="relative bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold">版本对比</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              <span className="text-red-500">← 左侧被删除</span>
              <span className="mx-2">|</span>
              <span className="text-green-500">右侧新增 →</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--border)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 版本标签 */}
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setActiveSide('A')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeSide === 'A'
                ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] bg-[var(--primary)]/5'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <span>{versionA.description}</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-xs opacity-60">{formatTime(versionA.timestamp)}</span>
            </div>
          </button>
          <button
            onClick={() => setActiveSide('B')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeSide === 'B'
                ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] bg-[var(--primary)]/5'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <span>{versionB.description}</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-xs opacity-60">{formatTime(versionB.timestamp)}</span>
            </div>
          </button>
        </div>

        {/* 对比内容 */}
        <div className="flex-1 overflow-hidden flex">
          {/* 左侧版本 */}
          <div className="flex-1 overflow-y-auto p-4 border-r border-[var(--border)]">
            <div className="space-y-1">
              {linesA.map((line, idx) => {
                const trimmed = line.trim();
                const isRemoved = removedSet.has(trimmed) && !addedSet.has(trimmed);
                const isUnchanged = unchangedSet.has(trimmed);

                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex font-mono text-sm',
                      isRemoved && 'bg-red-500/10 text-red-600 dark:text-red-400',
                      !isUnchanged && !isRemoved && line.trim() && 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    )}
                  >
                    <span className="w-10 flex-shrink-0 text-right pr-3 text-[var(--text-secondary)] opacity-50 select-none">
                      {idx + 1}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-all">
                      {line || ' '}
                    </span>
                    {isRemoved && (
                      <Minus className="h-4 w-4 text-red-500 flex-shrink-0 ml-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右侧版本 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {linesB.map((line, idx) => {
                const trimmed = line.trim();
                const isAdded = addedSet.has(trimmed) && !removedSet.has(trimmed);
                const isUnchanged = unchangedSet.has(trimmed);

                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex font-mono text-sm',
                      isAdded && 'bg-green-500/10 text-green-600 dark:text-green-400',
                      !isUnchanged && !isAdded && line.trim() && 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    )}
                  >
                    <span className="w-10 flex-shrink-0 text-right pr-3 text-[var(--text-secondary)] opacity-50 select-none">
                      {idx + 1}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-all">
                      {line || ' '}
                    </span>
                    {isAdded && (
                      <Plus className="h-4 w-4 text-green-500 flex-shrink-0 ml-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="text-sm text-[var(--text-secondary)]">
            <span className="text-red-500">{diff?.removed?.length || 0} 行被删除</span>
            <span className="mx-2">·</span>
            <span className="text-green-500">{diff?.added?.length || 0} 行新增</span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              关闭
            </Button>
            <Button variant="primary" onClick={handleRestore}>
              <RotateCcw className="h-4 w-4" />
              回滚到 {activeSide === 'A' ? '左侧' : '右侧'} 版本
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
