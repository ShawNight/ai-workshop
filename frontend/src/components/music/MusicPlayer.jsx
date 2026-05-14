import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Play, Pause, Download, RefreshCw, CheckCircle, XCircle, ListMusic } from 'lucide-react';
import { LyricsSyncViewer } from './LyricsSyncViewer';

export function MusicPlayer({
  audioUrl,
  lyrics,
  status,
  progress,
  onGenerate,
  onDownload,
  lrc: lrcProp,
  audioDuration,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [viewMode, setViewMode] = useState('player');
  const audioRef = useRef(null);
  const rafRef = useRef(null);

  const effectiveDuration = audioDuration > 0 ? audioDuration : duration;

  // 音频事件监听
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // 播放时用 rAF 同步 currentTime，比 timeupdate 更流畅
  useEffect(() => {
    if (!isPlaying) return;

    const tick = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, audioUrl]);

  const handleSeek = useCallback((time) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleProgressClick = (e) => {
    if (!effectiveDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    handleSeek(percent * effectiveDuration);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={audioUrl} preload="metadata" key={audioUrl} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">音乐播放器</h3>
          {status === 'completed' && audioUrl && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">生成完成</span>
            </div>
          )}
          {status === 'failed' && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-xs">生成失败</span>
            </div>
          )}
        </div>

        {audioUrl && lyrics && (
          <div className="flex items-center gap-1 bg-[var(--border)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('player')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all',
                viewMode === 'player'
                  ? 'bg-[var(--surface)] shadow-sm text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <div className="flex items-center gap-1.5">
                <Play className="h-3 w-3" />
                播放器
              </div>
            </button>
            <button
              onClick={() => setViewMode('lyrics')}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all',
                viewMode === 'lyrics'
                  ? 'bg-[var(--surface)] shadow-sm text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <div className="flex items-center gap-1.5">
                <ListMusic className="h-3 w-3" />
                歌词
              </div>
            </button>
          </div>
        )}
      </div>

      {viewMode === 'lyrics' && lyrics && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <LyricsSyncViewer
            lyrics={lyrics}
            lrc={lrcProp}
            currentTime={currentTime}
            duration={effectiveDuration}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            className="max-h-[400px]"
          />
        </div>
      )}

      {status === 'generating' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">生成中...</span>
            <span className="text-[var(--primary)]">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {audioUrl && viewMode === 'player' && (
        <>
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
              )}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>

            <div className="flex-1">
              <div
                className="h-2 rounded-full bg-[var(--border)] cursor-pointer"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all"
                  style={{ width: effectiveDuration ? `${(currentTime / effectiveDuration) * 100}%` : '0%' }}
                />
              </div>
              <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(effectiveDuration)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="flex-1"
            >
              <Download className="h-4 w-4" />
              下载
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
            >
              <RefreshCw className="h-4 w-4" />
              重新生成
            </Button>
          </div>
        </>
      )}

      {!audioUrl && status !== 'generating' && (
        <div className="text-center py-8">
          <p className="text-[var(--text-secondary)] text-sm mb-4">
            等待音乐生成完成...
          </p>
        </div>
      )}
    </div>
  );
}
