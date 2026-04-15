import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Label } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Progress } from '../components/ui/Progress';
import { musicApi } from '../api';
import { toast } from '../components/ui/Toast';
import { useMusicStore } from '../store/musicStore';
import { cn } from '../lib/utils';
import { Music, Sparkles, RefreshCw, Check, Play, Pause, Download, MessageSquare, Cloud, History, Eye, RotateCcw } from 'lucide-react';
import { VersionTimeline } from '../components/music/VersionTimeline';
import { VersionDiffModal } from '../components/music/VersionDiffModal';
import { MusicPlayer } from '../components/music/MusicPlayer';

const moods = ['欢快', '抒情', '悲伤', '激昂', '浪漫', '神秘', '怀旧', '励志'];
const genres = ['流行', '摇滚', '民谣', '电子', '嘻哈', '古典', '爵士', 'R&B'];

export function MusicPage() {
  const {
    lyrics,
    conversation,
    generationStatus,
    generationProgress,
    audioUrl,
    setLyrics,
    addConversationMessage,
    setGenerationStatus,
    setGenerationProgress,
    setAudioUrl,
    setJobId,
    resetGeneration,
    // 版本管理
    lyricsVersions,
    currentVersionIndex,
    addLyricsVersion,
    restoreVersion,
    getCurrentVersion,
    approveCurrentVersion,
    getVersionDiff,
    clearVersions
  } = useMusicStore();

  const [theme, setTheme] = useState('');
  const [mood, setMood] = useState('欢快');
  const [genre, setGenre] = useState('流行');
  const [style, setStyle] = useState('');
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // 版本管理状态
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffVersions, setDiffVersions] = useState(null);
  const [isApproved, setIsApproved] = useState(false);

  // 自动保存防抖计时器
  const autoSaveTimerRef = useRef(null);
  const lastSavedLyricsRef = useRef('');

  // 歌词变化时自动保存版本（防抖3秒）
  useEffect(() => {
    if (!lyrics || lyrics === lastSavedLyricsRef.current) return;

    // 清除之前的计时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 设置新的计时器
    autoSaveTimerRef.current = setTimeout(() => {
      if (lyrics && lyrics.trim()) {
        addLyricsVersion(lyrics, '手动保存');
        lastSavedLyricsRef.current = lyrics;
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [lyrics, addLyricsVersion]);

  // 组件卸载时清除计时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handleGenerateLyrics = async () => {
    if (!theme.trim()) {
      toast.error('请输入歌曲主题');
      return;
    }

    setIsGeneratingLyrics(true);
    try {
      const response = await musicApi.generateLyrics({
        theme,
        mood,
        genre,
        currentLyrics: lyrics
      });

      if (response.data.success) {
        const newLyrics = response.data.lyrics.content;
        setLyrics(newLyrics);

        // 保存为新版本
        addLyricsVersion(newLyrics, 'AI生成');

        toast.success(response.data.message);
      }
    } catch (error) {
      toast.error('歌词生成失败');
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const handleImproveLyrics = async () => {
    if (!userMessage.trim() && !lyrics) {
      toast.error('请先输入修改意见或已有歌词');
      return;
    }

    setIsGeneratingLyrics(true);
    try {
      const response = await musicApi.generateLyrics({
        theme,
        mood,
        genre,
        currentLyrics: lyrics,
        userRequest: userMessage
      });

      if (response.data.success) {
        const newLyrics = response.data.lyrics.content;
        setLyrics(newLyrics);
        addConversationMessage('user', userMessage);
        setUserMessage('');

        // 保存为新版本
        addLyricsVersion(newLyrics, `AI优化 v${lyricsVersions.length + 1}`);

        toast.success('歌词已改进');
      }
    } catch (error) {
      toast.error('歌词改进失败');
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  // 确认歌词
  const handleApproveLyrics = () => {
    if (!lyrics) {
      toast.error('请先生成歌词');
      return;
    }
    addLyricsVersion(lyrics, '确认版本', true);
    approveCurrentVersion();
    setIsApproved(true);
    toast.success('歌词已确认，可以生成音乐了');
  };

  // 版本相关处理函数
  const handleVersionSelect = (index) => {
    const version = lyricsVersions[index];
    if (version) {
      setLyrics(version.content);
      toast.info(`已切换到: ${version.description}`);
    }
  };

  const handleVersionRestore = (index) => {
    restoreVersion(index);
    toast.success('已回滚到指定版本');
  };

  const handleVersionCompare = (indexA, indexB) => {
    const diff = getVersionDiff(indexA, indexB);
    if (diff) {
      setDiffVersions(diff);
      setShowDiffModal(true);
    }
  };

  const handleRestoreFromDiff = (index) => {
    restoreVersion(index);
    setShowDiffModal(false);
    toast.success('已回滚到指定版本');
  };

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
        style: style || `${mood} ${genre}`
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
    const interval = setInterval(async () => {
      try {
        const response = await musicApi.getStatus(jobId);
        const { status, progress, outputFile } = response.data;

        setGenerationProgress(progress);

        if (status === 'completed') {
          clearInterval(interval);
          setGenerationStatus('completed');
          setAudioUrl(`/api/music/download/${jobId}.mp3`);
          setIsGeneratingMusic(false);
          toast.success('音乐生成完成！');
        } else if (status === 'failed') {
          clearInterval(interval);
          setGenerationStatus('failed');
          setIsGeneratingMusic(false);
          toast.error('音乐生成失败');
        }
      } catch (error) {
        clearInterval(interval);
        setGenerationStatus('failed');
        setIsGeneratingMusic(false);
      }
    }, 2000);
  };

  const handleDownload = () => {
    if (audioUrl) {
      window.open(audioUrl, '_blank');
    }
  };

  const handleExportForNetEase = async () => {
    if (!lyrics) {
      toast.error('请先生成歌词');
      return;
    }

    try {
      const musicFilePath = audioUrl ? audioUrl.split('/').pop() : null;
      const response = await musicApi.exportForNetEase({
        musicFilePath,
        lyrics,
        title: theme || 'AI创作歌曲',
        artist: 'AI Artist'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${(theme || 'AI创作歌曲').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_网易云.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('导出成功！');
    } catch (error) {
      toast.error('导出失败');
    }
  };

  const handleNewProject = () => {
    resetGeneration();
    setTheme('');
    setLyrics('');
    setUserMessage('');
    setIsApproved(false);
    setShowVersionHistory(false);
    clearVersions();
    lastSavedLyricsRef.current = '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Music className="h-6 w-6 text-[var(--primary)]" />
            AI 音乐创作
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">歌词优先的智能音乐创作流程</p>
        </div>
        <div className="flex items-center gap-2">
          {lyrics && (
            <Button
              variant="outline"
              onClick={() => setShowVersionHistory(!showVersionHistory)}
            >
              <History className="h-4 w-4" />
              版本历史
              {lyricsVersions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-[var(--primary)]/10 text-[var(--primary)] rounded">
                  {lyricsVersions.length}
                </span>
              )}
            </Button>
          )}
          {lyrics && (
            <Button variant="outline" onClick={handleNewProject}>
              新建项目
            </Button>
          )}
        </div>
      </div>

      {/* 版本历史侧边栏 */}
      {showVersionHistory && lyricsVersions.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* 主要内容区域 */}
            {/* ... */}
          </div>
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <VersionTimeline
                versions={lyricsVersions}
                currentIndex={currentVersionIndex}
                onSelect={handleVersionSelect}
                onRestore={handleVersionRestore}
                onCompare={handleVersionCompare}
              />
            </div>
          </div>
        </div>
      )}

      <div className={cn("grid lg:grid-cols-2 gap-6", showVersionHistory && lyricsVersions.length > 0 && "lg:grid-cols-2")}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--primary)]" />
              创作设定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>歌曲主题</Label>
              <Input
                placeholder="描述你想要创作的音乐主题..."
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>情绪</Label>
                <Select value={mood} onChange={(e) => setMood(e.target.value)} className="mt-1">
                  {moods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>风格</Label>
                <Select value={genre} onChange={(e) => setGenre(e.target.value)} className="mt-1">
                  {genres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>音乐风格描述（可选）</Label>
              <Input
                placeholder="例如：钢琴伴奏，慢节奏..."
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleGenerateLyrics}
              disabled={isGeneratingLyrics || !theme.trim()}
              loading={isGeneratingLyrics}
              className="w-full"
            >
              {lyrics ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {lyrics ? '重新生成歌词' : '生成歌词'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[var(--secondary)]" />
              对话改进
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="输入你对歌词的修改意见..."
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              className="min-h-[100px]"
            />
            <Button
              onClick={handleImproveLyrics}
              disabled={isGeneratingLyrics || !lyrics}
              loading={isGeneratingLyrics}
              variant="secondary"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4" />
              改进歌词
            </Button>

            {conversation.length > 0 && (
              <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
                {conversation.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      msg.role === 'user'
                        ? 'bg-[var(--primary)]/10 ml-8'
                        : 'bg-[var(--secondary)]/10 mr-8'
                    }`}
                  >
                    <p className="font-medium text-xs mb-1 opacity-70">
                      {msg.role === 'user' ? '你' : 'AI'}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {lyrics && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              歌词编辑
              {isApproved && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                  <Check className="h-3 w-3" />
                  已确认
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                generationStatus === 'completed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              }`}>
                {generationStatus === 'completed' ? '已生成' : '待生成'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="歌词内容..."
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleApproveLyrics}
                disabled={isApproved}
                variant={isApproved ? 'outline' : 'primary'}
              >
                <Check className="h-4 w-4" />
                {isApproved ? '已确认' : '确认歌词'}
              </Button>
              <Button
                onClick={handleGenerateMusic}
                disabled={isGeneratingMusic || generationStatus === 'generating' || !isApproved}
                loading={isGeneratingMusic}
              >
                <Music className="h-4 w-4" />
                生成音乐
              </Button>
              {generationStatus === 'generating' && (
                <div className="flex-1 min-w-[200px]">
                  <Progress value={generationProgress} />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    生成中... {generationProgress}%
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {generationStatus === 'completed' && audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle>音乐播放</CardTitle>
          </CardHeader>
          <CardContent>
            <MusicPlayer
              audioUrl={audioUrl}
              lyrics={lyrics}
              status={generationStatus}
              progress={generationProgress}
              onGenerate={handleGenerateMusic}
              onDownload={handleDownload}
              onRegenerate={() => {
                if (isApproved) handleGenerateMusic();
              }}
              isApproved={isApproved}
            />
            <div className="flex gap-2 mt-4">
              <Button onClick={handleExportForNetEase} variant="outline">
                <Cloud className="h-4 w-4" />
                导出 for 网易云
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 版本对比模态框 */}
      {diffVersions && (
        <VersionDiffModal
          isOpen={showDiffModal}
          onClose={() => setShowDiffModal(false)}
          versionA={diffVersions.versionA}
          versionB={diffVersions.versionB}
          diff={diffVersions.diff}
          onRestoreA={() => handleRestoreFromDiff(lyricsVersions.indexOf(diffVersions.versionA))}
          onRestoreB={() => handleRestoreFromDiff(lyricsVersions.indexOf(diffVersions.versionB))}
        />
      )}
    </div>
  );
}
