import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Play, Pause, SkipBack, SkipForward, Crosshair, RotateCcw, Plus, Minus } from 'lucide-react';
import { parseLrcWithOffsets } from '../../utils/lrcCalibration';

// 格式化时间显示
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function LyricsSyncViewer({
  lyrics,
  lrc,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onSeek,
  className,
  // 校准模式相关 props
  isCalibrationMode = false,
  globalOffset = 0,
  lrcOffsets = {},
  onGlobalOffsetChange,
  onLineOffsetChange,
  onMarkCurrentTime,
}) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);

  // 解析歌词（支持偏移叠加）
  const timedLines = useMemo(() => {
    if (lrc) {
      return parseLrcWithOffsets(lrc, globalOffset, lrcOffsets);
    }
    return [];
  }, [lrc, globalOffset, lrcOffsets]);

  // 计算当前行
  useEffect(() => {
    if (!timedLines.length || isCalibrationMode) {
      setActiveLineIndex(-1);
      return;
    }

    let lo = 0, hi = timedLines.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (timedLines[mid].time <= currentTime) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    setActiveLineIndex(idx);
  }, [currentTime, timedLines, isCalibrationMode]);

  // 自动滚动到当前行
  useEffect(() => {
    if (isCalibrationMode || activeLineIndex < 0 || !lineRefs.current[activeLineIndex] || !containerRef.current) return;
    const lineEl = lineRefs.current[activeLineIndex];
    const containerEl = containerRef.current;
    const lineTop = lineEl.offsetTop;
    const lineHeight = lineEl.offsetHeight;
    const containerHeight = containerEl.clientHeight;
    const scrollTop = containerEl.scrollTop;

    if (lineTop < scrollTop + lineHeight * 2 || lineTop > scrollTop + containerHeight - lineHeight * 2) {
      containerEl.scrollTo({
        top: lineTop - containerHeight / 2 + lineHeight / 2,
        behavior: 'smooth'
      });
    }
  }, [activeLineIndex, isCalibrationMode]);

  // 处理点击跳转到指定行
  const handleLineClick = useCallback((index) => {
    if (onSeek && timedLines[index]) {
      onSeek(timedLines[index].time);
    }
  }, [onSeek, timedLines]);

  // 计算总时长
  const totalDuration = duration > 0 ? duration :
    (timedLines.length > 0 ? timedLines[timedLines.length - 1].time + timedLines[timedLines.length - 1].duration : 0);

  // 判断是否某行已校准
  const isLineCalibrated = (originalIndex) => {
    return globalOffset !== 0 || (lrcOffsets[originalIndex] || 0) !== 0;
  };

  if (!lyrics && !lrc) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <p className="text-[var(--text-secondary)] text-sm">暂无歌词</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 头部信息 */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          {isPlaying ? (
            <div className="flex items-center gap-1 text-[var(--primary)]">
              <Play className="h-4 w-4" />
              <span className="text-xs">{isCalibrationMode ? '校准模式' : '同步播放'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <Pause className="h-4 w-4" />
              <span className="text-xs">{isCalibrationMode ? '校准模式' : '已暂停'}</span>
            </div>
          )}
        </div>
        <div className="text-xs text-[var(--text-secondary)]">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

      {/* 校准模式：全局偏移控制 */}
      {isCalibrationMode && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--elevated)] border border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)]">全局偏移</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                {globalOffset > 0 ? '+' : ''}{globalOffset}ms
              </span>
              <button
                onClick={onGlobalOffsetChange ? () => onGlobalOffsetChange(0) : undefined}
                className="p-1 rounded-lg hover:bg-[var(--surface)] text-[var(--text-secondary)] transition-colors"
                title="重置全局偏移"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </div>
          <input
            type="range"
            min={-5000}
            max={5000}
            step={50}
            value={globalOffset}
            onChange={(e) => onGlobalOffsetChange?.(parseInt(e.target.value, 10))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[var(--border)] accent-[var(--primary)]"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
            <span>-5s</span>
            <span>0</span>
            <span>+5s</span>
          </div>
        </div>
      )}

      {/* 歌词列表 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-hide relative"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="py-4">
          {timedLines.map((line, index) => {
            const isActive = index === activeLineIndex;
            const isPast = index < activeLineIndex;
            const calibrated = isLineCalibrated(line.originalIndex);

            return (
              <div
                key={index}
                ref={(el) => (lineRefs.current[index] = el)}
                onClick={() => !isCalibrationMode && handleLineClick(index)}
                className={cn(
                  'relative px-4 py-3 rounded-xl mx-2 transition-all duration-200',
                  !isCalibrationMode && 'cursor-pointer hover:bg-[var(--elevated)]',
                  isActive && !isCalibrationMode && 'bg-[var(--primary)]/10',
                  isPast && !isCalibrationMode && 'opacity-50',
                  isCalibrationMode && 'hover:bg-[var(--elevated)]/50'
                )}
              >
                {/* 左侧指示器 */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {calibrated && (
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                  )}
                  {!isCalibrationMode && (
                    <div className={cn(
                      'w-1 rounded-full transition-all duration-300',
                      isActive ? 'h-full bg-[var(--primary)]' : 'h-0'
                    )} />
                  )}
                </div>

                {/* 时间戳 */}
                <div className={cn(
                  'text-xs font-mono transition-colors',
                  calibrated ? 'text-emerald-400' : 'text-[var(--text-secondary)] opacity-50'
                )}>
                  {formatTime(line.time)}
                </div>

                {/* 歌词文字 */}
                <div className="pl-0 mt-1">
                  <p
                    className={cn(
                      'text-base leading-relaxed transition-all duration-300',
                      isActive && !isCalibrationMode && 'text-[var(--primary)] font-medium text-lg',
                      isPast && !isCalibrationMode && 'text-[var(--text-secondary)]',
                      isCalibrationMode && 'text-[var(--text-primary)]'
                    )}
                  >
                    {line.text}
                  </p>
                </div>

                {/* 校准模式：操作按钮 */}
                {isCalibrationMode && (
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      onClick={() => onMarkCurrentTime?.(line.originalIndex)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors"
                      title="将当前播放时间设为该行时间戳"
                    >
                      <Crosshair className="h-3 w-3" />
                      标记当前时间
                    </button>
                    <button
                      onClick={() => onLineOffsetChange?.(line.originalIndex, (lrcOffsets[line.originalIndex] || 0) - 50)}
                      className="p-1 rounded-lg hover:bg-[var(--surface)] text-[var(--text-secondary)] transition-colors"
                      title="提前 50ms"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] text-[var(--text-secondary)] font-mono w-12 text-center">
                      {(lrcOffsets[line.originalIndex] || 0) > 0 ? '+' : ''}{lrcOffsets[line.originalIndex] || 0}ms
                    </span>
                    <button
                      onClick={() => onLineOffsetChange?.(line.originalIndex, (lrcOffsets[line.originalIndex] || 0) + 50)}
                      className="p-1 rounded-lg hover:bg-[var(--surface)] text-[var(--text-secondary)] transition-colors"
                      title="延后 50ms"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部留白 */}
        <div className="h-32" />
      </div>

      {/* 快捷跳转按钮（仅在非校准模式下显示） */}
      {!isCalibrationMode && activeLineIndex >= 0 && (
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => handleLineClick(Math.max(0, activeLineIndex - 1))}
            disabled={activeLineIndex <= 0}
            className={cn(
              'p-2 rounded-full transition-colors',
              activeLineIndex > 0
                ? 'hover:bg-[var(--elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                : 'text-[var(--border)] cursor-not-allowed'
            )}
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleLineClick(Math.min(timedLines.length - 1, activeLineIndex + 1))}
            disabled={activeLineIndex >= timedLines.length - 1}
            className={cn(
              'p-2 rounded-full transition-colors',
              activeLineIndex < timedLines.length - 1
                ? 'hover:bg-[var(--elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                : 'text-[var(--border)] cursor-not-allowed'
            )}
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
