import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useMusicStore = create(
  persist(
    (set, get) => ({
      // 用户输入的简单描述
      userDescription: '',
      // AI生成的完整提示词
      prompt: '',
      // 生成的歌词
      lyrics: '',
      // 歌曲名称（歌词生成后显示）
      songTitle: '',

      // 生成状态
      generationStatus: 'idle',
      generationProgress: 0,
      audioUrl: null,
      audioDuration: 0,
      audioLrc: '',
      jobId: null,

      // 歌词时间戳校准
      globalLrcOffset: 0,
      lrcOffsets: {},

      // 已完成的音乐历史记录
      musicHistory: [],

      // ============ 基础设置方法 ============
      setUserDescription: (desc) => set({ userDescription: desc }),
      setPrompt: (prompt) => set({ prompt }),
      setLyrics: (lyrics) => set({ lyrics }),
      setSongTitle: (title) => set({ songTitle: title }),

      setGenerationStatus: (status) => set({ generationStatus: status }),
      setGenerationProgress: (progress) => set({ generationProgress: progress }),
      setAudioUrl: (url) => set({ audioUrl: url }),
      setAudioDuration: (d) => set({ audioDuration: d }),
      setAudioLrc: (l) => set({ audioLrc: l }),
      setJobId: (id) => set({ jobId: id }),

      // ============ 歌词校准管理 ============
      setGlobalLrcOffset: (offset) => set({ globalLrcOffset: offset }),
      setLrcOffset: (lineIndex, offset) => set((state) => ({
        lrcOffsets: { ...state.lrcOffsets, [lineIndex]: offset }
      })),
      resetLrcOffsets: () => set({ globalLrcOffset: 0, lrcOffsets: {} }),

      // ============ 音乐历史记录管理 ============

      addMusicToHistory: (music) => set((state) => ({
        musicHistory: [{
          ...music,
          globalLrcOffset: state.globalLrcOffset,
          lrcOffsets: state.lrcOffsets
        }, ...state.musicHistory].slice(0, 50)
      })),

      /**
       * 从历史记录加载音乐项目
       */
      loadFromHistory: (id) => {
        const state = get();
        const music = state.musicHistory.find(m => m.id === id);
        if (music) {
          set({
            lyrics: music.lyrics,
            songTitle: music.title,
            userDescription: music.userDescription || '',
            prompt: music.prompt || '',
            audioUrl: music.audioUrl,
            audioDuration: (music.durationMs || 0) / 1000,
            audioLrc: music.lrc || '',
            globalLrcOffset: music.globalLrcOffset || 0,
            lrcOffsets: music.lrcOffsets || {},
            generationStatus: 'completed'
          });
        }
      },

      /**
       * 删除历史记录中的音乐
       */
      deleteFromHistory: (id) => set((state) => ({
        musicHistory: state.musicHistory.filter(m => m.id !== id)
      })),

      /**
       * 清空当前创作
       */
      clearCurrent: () => set({
        userDescription: '',
        prompt: '',
        lyrics: '',
        songTitle: '',
        generationStatus: 'idle',
        generationProgress: 0,
        audioUrl: null,
        audioDuration: 0,
        audioLrc: '',
        jobId: null,
        globalLrcOffset: 0,
        lrcOffsets: {}
      }),

      /**
       * 重置生成状态
       */
      resetGeneration: () => set({
        generationStatus: 'idle',
        generationProgress: 0,
        audioUrl: null,
        audioDuration: 0,
        audioLrc: '',
        jobId: null
      })
    }),
    {
      name: 'ai-workshop-music',
      partialize: (state) => ({
        // 只持久化历史记录，不持久化当前创作状态
        musicHistory: state.musicHistory
      })
    }
  )
);