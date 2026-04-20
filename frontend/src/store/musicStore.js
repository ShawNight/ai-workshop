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
      jobId: null,

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
      setJobId: (id) => set({ jobId: id }),

      // ============ 音乐历史记录管理 ============

      /**
       * 添加已完成的音乐到历史记录
       * 只有真正成功生成的音乐才会被保存
       */
      addMusicToHistory: (music) => set((state) => ({
        musicHistory: [music, ...state.musicHistory].slice(0, 50) // 最多保留50条
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
        jobId: null
      }),

      /**
       * 重置生成状态
       */
      resetGeneration: () => set({
        generationStatus: 'idle',
        generationProgress: 0,
        audioUrl: null,
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