import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

// 段落速度权重（相对于基准速度）
const SECTION_SPEED_WEIGHT = {
  verse: 1.0,      // 主歌 - 正常速度
  chorus: 0.85,    // 副歌 - 通常更快
  bridge: 1.1,     // 桥段 - 通常较慢
  prechorus: 0.95, // 预副歌
  intro: 1.2,      // 前奏 - 较慢
  outro: 1.2,      // 尾声
  solo: 1.0,       // 间奏
  instrumental: 1.0,
  default: 1.0
};

// 识别段落标记
const SECTION_PATTERNS = [
  { pattern: /\[(verse|主歌|pre-chorus)\]/gi, type: 'verse' },
  { pattern: /\[(chorus|副歌|高潮)\]/gi, type: 'chorus' },
  { pattern: /\[(bridge|桥段|过渡)\]/gi, type: 'bridge' },
  { pattern: /\[(pre[- ]?chorus|预副歌)\]/gi, type: 'prechorus' },
  { pattern: /\[(intro|前奏)\]/gi, type: 'intro' },
  { pattern: /\[(outro|尾奏|尾声)\]/gi, type: 'outro' },
  { pattern: /\[(solo|间奏)\]/gi, type: 'solo' },
  { pattern: /\[(instrumental|器乐)\]/gi, type: 'instrumental' }
];

const getSectionType = (line) => {
  for (const { pattern, type } of SECTION_PATTERNS) {
    if (pattern.test(line)) return type;
  }
  return null;
};

// 根据字数估算行时长（基础时长：每个字约0.5秒）
const estimateLineDuration = (text, sectionType) => {
  const charCount = text.length;
  const baseDurationPerChar = 0.5; // 每字0.5秒作为基准
  const weight = SECTION_SPEED_WEIGHT[sectionType] || SECTION_SPEED_WEIGHT.default;

  // 最短2秒，最长根据字数计算
  const estimatedDuration = Math.max(2, Math.min(8, charCount * baseDurationPerChar * weight));
  return estimatedDuration;
};

// 解析歌词为带时间戳的格式，根据总时长动态调整
const parseLyricsToTimedLines = (lyricsText, totalDuration = 0) => {
  if (!lyricsText) return [];

  const lines = lyricsText.split('\n');
  const timedLines = [];
  let currentSection = 'verse';

  // 先收集所有有效歌词行和它们的预估时长
  const rawLines = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionType = getSectionType(line);
    if (sectionType) {
      currentSection = sectionType;
      continue;
    }

    rawLines.push({
      text: line,
      section: currentSection,
      estimatedDuration: estimateLineDuration(line, currentSection)
    });
  }

  if (rawLines.length === 0) return [];

  // 如果有实际总时长，按比例调整每行时长
  const totalEstimatedDuration = rawLines.reduce((sum, l) => sum + l.estimatedDuration, 0);
  const scaleFactor = totalDuration > 0 ? totalDuration / totalEstimatedDuration : 1;

  let currentTime = 0;
  for (const rawLine of rawLines) {
    const adjustedDuration = rawLine.estimatedDuration * scaleFactor;

    timedLines.push({
      time: currentTime,
      duration: adjustedDuration,
      text: rawLine.text,
      section: rawLine.section
    });

    currentTime += adjustedDuration;
  }

  return timedLines;
};

// 格式化时间显示
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function LyricsSyncViewer({
  lyrics,
  currentTime = 0,
  duration = 0,  // 接收实际音频时长
  isPlaying = false,
  onSeek,
  className
}) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);

  // 解析歌词，传入实际时长进行动态调整
  const timedLines = useMemo(() => parseLyricsToTimedLines(lyrics, duration), [lyrics, duration]);

  // 计算当前行
  useEffect(() => {
    if (!timedLines.length) {
      setActiveLineIndex(-1);
      return;
    }

    let activeIndex = -1;
    for (let i = 0; i < timedLines.length; i++) {
      const lineEndTime = timedLines[i].time + timedLines[i].duration;
      if (currentTime >= timedLines[i].time && currentTime < lineEndTime) {
        activeIndex = i;
        break;
      }
      if (currentTime >= timedLines[i].time) {
        activeIndex = i;
      }
    }
    setActiveLineIndex(activeIndex);
  }, [currentTime, timedLines]);

  // 自动滚动到当前行
  useEffect(() => {
    if (activeLineIndex >= 0 && lineRefs.current[activeLineIndex] && containerRef.current) {
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
    }
  }, [activeLineIndex]);

  // 处理点击跳转到指定行
  const handleLineClick = useCallback((index) => {
    if (onSeek && timedLines[index]) {
      onSeek(timedLines[index].time);
    }
  }, [onSeek, timedLines]);

  // 计算总时长（使用实际时长或估算）
  const totalDuration = duration > 0 ? duration :
    (timedLines.length > 0 ? timedLines[timedLines.length - 1].time + timedLines[timedLines.length - 1].duration : 0);

  if (!lyrics) {
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
              <span className="text-xs">正在播放</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <Pause className="h-4 w-4" />
              <span className="text-xs">已暂停</span>
            </div>
          )}
        </div>
        <div className="text-xs text-[var(--text-secondary)]">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

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

            return (
              <div
                key={index}
                ref={(el) => (lineRefs.current[index] = el)}
                onClick={() => handleLineClick(index)}
                className={cn(
                  'relative px-4 py-3 cursor-pointer transition-all duration-300 rounded-lg mx-2',
                  'hover:bg-[var(--border)]/50',
                  isActive && 'bg-[var(--primary)]/10',
                  isPast && 'opacity-50'
                )}
              >
                {/* 时间指示器 */}
                <div className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full transition-all duration-300',
                  isActive ? 'h-full bg-[var(--primary)]' : 'h-0'
                )} />

                {/* 行号 */}
                <div className={cn(
                  'absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono transition-colors',
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)] opacity-30'
                )}>
                  {formatTime(line.time)}
                </div>

                {/* 歌词文字 */}
                <div className="pl-16">
                  <p
                    className={cn(
                      'text-base leading-relaxed transition-all duration-300',
                      isActive && 'text-[var(--primary)] font-medium text-lg',
                      isPast && 'text-[var(--text-secondary)]'
                    )}
                  >
                    {line.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部留白 */}
        <div className="h-32" />
      </div>

      {/* 快捷跳转按钮 */}
      {activeLineIndex >= 0 && (
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => handleLineClick(Math.max(0, activeLineIndex - 1))}
            disabled={activeLineIndex <= 0}
            className={cn(
              'p-2 rounded-full transition-colors',
              activeLineIndex > 0
                ? 'hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                ? 'hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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