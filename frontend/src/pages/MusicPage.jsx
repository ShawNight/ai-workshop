import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Label } from '../components/ui/Input';
import { Progress } from '../components/ui/Progress';
import { Modal } from '../components/ui/Modal';
import { musicApi } from '../api';
import { toast } from '../components/ui/Toast';
import { useMusicStore } from '../store/musicStore';
import { cn } from '../lib/utils';
import { Music, Sparkles, RefreshCw, Play, Pause, Download, History, Trash2, FileMusic, X, Volume2, Wand2, Edit3 } from 'lucide-react';
import { LyricsEditor } from '../components/music/LyricsEditor';

export function MusicPage() {
  const {
    userDescription,
    prompt,
    lyrics,
    songTitle,
    generationStatus,
    generationProgress,
    audioUrl,
    musicHistory,
    setUserDescription,
    setPrompt,
    setLyrics,
    setSongTitle,
    setGenerationStatus,
    setGenerationProgress,
    setAudioUrl,
    setJobId,
    addMusicToHistory,
    loadFromHistory,
    deleteFromHistory,
    clearCurrent,
  } = useMusicStore();

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);

  // 生成提示词
  const handleGeneratePrompt = async () => {
    if (!userDescription.trim()) {
      toast.error('请输入歌曲描述');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const response = await musicApi.generatePrompt({ description: userDescription });
      if (response.data.success) {
        const promptData = response.data.prompt;
        // 格式化提示词为用户可编辑的文本
        const formattedPrompt = `主题：${promptData.theme}\n情绪：${promptData.mood}\n风格：${promptData.genre}\n详细描述：${promptData.description}`;
        setPrompt(formattedPrompt);
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error('提示词生成失败');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // 生成歌词
  const handleGenerateLyrics = async () => {
    if (!prompt.trim()) {
      toast.error('请先生成或输入创作提示词');
      return;
    }

    setIsGeneratingLyrics(true);
    try {
      const response = await musicApi.generateLyrics({ prompt });
      if (response.data.success) {
        setLyrics(response.data.lyrics.content);
        setSongTitle(response.data.lyrics.title);
        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error('歌词生成失败');
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  // 生成音乐
  const handleGenerateMusic = async () => {
    if (!lyrics) {
      toast.error('请先生成歌词');
      return;
    }

    setIsGeneratingMusic(true);
    setGenerationStatus('generating');
    setGenerationProgress(0);

    try {
      const response = await musicApi.generateMusic({
        lyrics,
        style: prompt.split('\n').find(line => line.includes('风格：'))?.replace('风格：', '').trim() || '流行',
        title: songTitle || 'AI创作歌曲'
      });

      if (response.data.success) {
        setJobId(response.data.jobId);
        pollJobStatus(response.data.jobId);
      }
    } catch (error) {
      toast.error('音乐生成失败');
      setGenerationStatus('failed');
      setIsGeneratingMusic(false);
    }
  };

  const pollJobStatus = async (jobId) => {
    const MAX_POLL_TIME = 600000;
    const POLL_INTERVAL = 3000;
    const startTime = Date.now();

    const interval = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_TIME) {
        clearInterval(interval);
        setGenerationStatus('failed');
        setIsGeneratingMusic(false);
        toast.error('音乐生成超时');
        return;
      }

      try {
        const response = await musicApi.getStatus(jobId);
        const { status, progress, error, outputFile, title } = response.data;

        setGenerationProgress(progress);

        if (status === 'completed') {
          clearInterval(interval);
          setGenerationStatus('completed');
          const audioUrl = `/api/music/download/${outputFile}`;
          setAudioUrl(audioUrl);

          addMusicToHistory({
            id: jobId,
            title: title || songTitle,
            userDescription,
            prompt,
            lyrics,
            audioUrl,
            createdAt: new Date().toISOString()
          });

          setIsGeneratingMusic(false);
          setShowPlayer(true);
          toast.success('音乐生成完成！');
        } else if (status === 'failed') {
          clearInterval(interval);
          setGenerationStatus('failed');
          setIsGeneratingMusic(false);
          toast.error(error || '音乐生成失败');
        }
      } catch (error) {
        console.warn('轮询状态失败:', error);
      }
    }, POLL_INTERVAL);
  };

  const handleNewProject = () => {
    clearCurrent();
    setShowPlayer(false);
    setEditingPrompt(false);
  };

  const handleLoadFromHistory = (item) => {
    loadFromHistory(item.id);
    setShowHistory(false);
    setShowPlayer(true);
    toast.success(`已加载: ${item.title}`);
  };

  const handleDeleteHistory = (id) => {
    deleteFromHistory(id);
    toast.success('已删除');
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Music className="h-6 w-6 text-[var(--primary)]" />
            AI 音乐创作
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">输入描述 → AI生成提示词 → 创作歌词 → 生成音乐</p>
        </div>
        <div className="flex items-center gap-2">
          {generationStatus === 'completed' && audioUrl && (
            <Button variant="primary" onClick={() => setShowPlayer(true)}>
              <Play className="h-4 w-4" />
              播放音乐
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
            <History className="h-4 w-4" />
            历史记录
            {musicHistory.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--primary)]/10 text-[var(--primary)] rounded">
                {musicHistory.length}
              </span>
            )}
          </Button>
          {(lyrics || prompt || generationStatus !== 'idle') && (
            <Button variant="outline" onClick={handleNewProject}>
              新建项目
            </Button>
          )}
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧：创作流程 */}
        <Card className="w-80 flex-shrink-0 flex flex-col">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-[var(--primary)]" />
              创作流程
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4 overflow-y-auto">
            {/* 步骤1：用户描述 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">1</span>
                输入歌曲描述
              </Label>
              <Textarea
                placeholder="例如：写一首关于春天的歌，描述万物复苏的美好..."
                value={userDescription}
                onChange={(e) => setUserDescription(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <Button
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt || !userDescription.trim()}
                loading={isGeneratingPrompt}
                variant="primary"
                className="w-full"
              >
                <Sparkles className="h-4 w-4" />
                生成提示词
              </Button>
            </div>

            {/* 步骤2：提示词（AI生成后可编辑） */}
            {prompt && (
              <div className="space-y-2 border-t pt-4">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">2</span>
                  创作提示词
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingPrompt(!editingPrompt)}
                    className="ml-auto"
                  >
                    <Edit3 className="h-3 w-3" />
                    {editingPrompt ? '完成' : '编辑'}
                  </Button>
                </Label>
                {editingPrompt ? (
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                ) : (
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-sm space-y-1">
                    {prompt.split('\n').map((line, i) => (
                      <p key={i} className={line.includes('：') ? '' : 'text-[var(--text-secondary)]'}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
                <Button
                  onClick={handleGenerateLyrics}
                  disabled={isGeneratingLyrics || !prompt.trim()}
                  loading={isGeneratingLyrics}
                  className="w-full"
                >
                  {lyrics ? <RefreshCw className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                  {lyrics ? '重新生成歌词' : '生成歌词'}
                </Button>
              </div>
            )}

            {/* 歌名显示（歌词生成后） */}
            {songTitle && lyrics && (
              <div className="border-t pt-4">
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <Label className="text-xs text-[var(--text-secondary)]">歌曲名称</Label>
                  <p className="font-medium text-[var(--primary)]">{songTitle}</p>
                </div>
              </div>
            )}

            {/* 步骤3：生成音乐 */}
            {lyrics && (
              <div className="space-y-2 border-t pt-4">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center">3</span>
                  生成音乐
                </Label>
                <Button
                  onClick={handleGenerateMusic}
                  disabled={isGeneratingMusic || generationStatus === 'generating'}
                  loading={isGeneratingMusic}
                  variant="primary"
                  className="w-full"
                >
                  <Music className="h-4 w-4" />
                  开始生成音乐
                </Button>

                {/* 生成进度 */}
                {generationStatus === 'generating' && (
                  <div className="space-y-2">
                    <Progress value={generationProgress} />
                    <p className="text-xs text-[var(--text-secondary)] text-center">
                      音乐生成中... {generationProgress}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右侧：歌词编辑 */}
        <Card className="flex-1 min-w-0 flex flex-col">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              歌词内容
              {songTitle && lyrics && (
                <span className="text-sm text-[var(--primary)] font-normal">
                  · {songTitle}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-4">
            {lyrics ? (
              <LyricsEditor
                lyrics={lyrics}
                onChange={setLyrics}
                className="h-full"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">
                <div className="text-center">
                  <Music className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>请先完成左侧创作流程</p>
                  <p className="text-sm mt-2">输入描述 → 生成提示词 → 生成歌词</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 历史记录弹框 */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHistory(false)}>
          <Card className="w-full max-w-2xl max-h-[80vh] m-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileMusic className="h-5 w-5" />
                已完成的音乐 ({musicHistory.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {musicHistory.length === 0 ? (
                <p className="text-[var(--text-secondary)] text-center py-8">暂无历史记录</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {musicHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.title}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {item.userDescription?.slice(0, 30)}... · {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => handleLoadFromHistory(item)}>
                          加载
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHistory(item.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 音乐播放弹框 */}
      {showPlayer && audioUrl && (
        <MusicPlayerModal
          audioUrl={audioUrl}
          lyrics={lyrics}
          title={songTitle}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </div>
  );
}

// 音乐播放弹框组件
function MusicPlayerModal({ audioUrl, lyrics, title, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleProgressClick = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    handleSeek(percent * duration);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const lyricsLines = lyrics ? lyrics.split('\n').filter(line => line.trim()) : [];

  const getCurrentLineIndex = () => {
    if (!duration || !lyricsLines.length) return -1;
    const lineDuration = duration / lyricsLines.length;
    return Math.floor(currentTime / lineDuration);
  };

  const currentLineIndex = getCurrentLineIndex();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-[var(--surface)] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <h2 className="font-bold text-lg">{title}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{formatTime(currentTime)} / {formatTime(duration)}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 歌词区域 */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[200px]">
          <div className="space-y-2 text-center">
            {lyricsLines.map((line, index) => {
              const isActive = index === currentLineIndex;
              const isPast = index < currentLineIndex;

              return (
                <p
                  key={index}
                  className={cn(
                    'text-lg leading-relaxed transition-all duration-300 py-2',
                    isActive && 'text-[var(--primary)] font-bold scale-105',
                    isPast && 'text-[var(--text-secondary)] opacity-50',
                    !isPast && !isActive && 'text-[var(--text-primary)]'
                  )}
                >
                  {line.trim()}
                </p>
              );
            })}
          </div>
        </div>

        {/* 播放控制 */}
        <div className="p-4 border-t border-[var(--border)] space-y-4">
          <div
            className="h-2 rounded-full bg-[var(--border)] cursor-pointer"
            onClick={handleProgressClick}
          >
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={togglePlay}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
                'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
              )}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-1" />
              )}
            </button>

            <Button variant="outline" size="sm" onClick={() => window.open(audioUrl, '_blank')}>
              <Download className="h-4 w-4" />
              下载
            </Button>
          </div>
        </div>

        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      </div>
    </div>
  );
}