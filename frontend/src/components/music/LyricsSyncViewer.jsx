import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

// 歌词段落时长配置（秒）
const SECTION_DURATIONS = {
  verse: 4,
  chorus: 5,
  bridge: 3.5,
  prechorus: 3.5,
  intro: 2,
  outro: 2,
  solo: 4,
  instrumental: 3,
  default: 4
};

// 识别段落标记
const SECTION_PATTERNS = [
  { pattern: /\[(verse|主歌|pre-chorus|前奏)\]/gi, type: 'verse' },
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

// 解析歌词为带时间戳的格式
const parseLyricsToTimedLines = (lyricsText) => {
  if (!lyricsText) return [];

  const lines = lyricsText.split('\n');
  const timedLines = [];
  let currentTime = 0;
  let currentSection = 'verse';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 检查是否是段落标记行
    const sectionType = getSectionType(line);
    if (sectionType) {
      currentSection = sectionType;
      // 段落标记行本身不显示为歌词
      continue;
    }

    const duration = SECTION_DURATIONS[currentSection] || SECTION_DURATIONS.default;

    timedLines.push({
      time: currentTime,
      duration,
      text: line,
      section: currentSection
    });

    currentTime += duration;
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
  isPlaying = false,
  onSeek,
  className
}) {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);

  // 解析歌词
  const timedLines = useMemo(() => parseLyricsToTimedLines(lyrics), [lyrics]);

  // 计算当前行
  useEffect(() => {
    if (!timedLines.length) {
      setActiveLineIndex(-1);
      return;
    }

    let activeIndex = -1;
    for (let i = 0; i < timedLines.length; i++) {
      if (currentTime >= timedLines[i].time) {
        activeIndex = i;
      } else {
        break;
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

      // 如果当前行不在可见区域内，则滚动
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

  // 总时长
  const totalDuration = timedLines.length > 0
    ? timedLines[timedLines.length - 1].time + timedLines[timedLines.length - 1].duration
    : 0;

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

                  {/* 段落标记 */}
                  {line.section && index === 0 && (
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mt-1 block">
                      {line.section}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部留白，便于滚动到最后一首 */}
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
