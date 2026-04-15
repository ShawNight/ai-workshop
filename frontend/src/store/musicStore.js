import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_VERSIONS = 20;

const generateId = () => Math.random().toString(36).substring(2, 11);

// 简单文本差异计算
const computeSimpleDiff = (oldText, newText) => {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = { added: [], removed: [], unchanged: [] };

  const oldMap = new Map(oldLines.map((line, i) => [line.trim(), i]));
  const newMap = new Map(newLines.map((line, i) => [line.trim(), i]));

  oldLines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed && !newMap.has(trimmed)) {
      diff.removed.push({ line: trimmed, index: i });
    } else if (trimmed) {
      diff.unchanged.push({ line: trimmed, oldIndex: i, newIndex: newMap.get(trimmed) });
    }
  });

  newLines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed && !oldMap.has(trimmed)) {
      diff.added.push({ line: trimmed, index: i });
    }
  });

  return diff;
};

export const useMusicStore = create(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      lyrics: '',
      approvedLyrics: null,
      conversation: [],
      generationStatus: 'idle',
      generationProgress: 0,
      audioUrl: null,
      jobId: null,
      theme: '',
      mood: '',
      genre: '',

      // ============ 版本管理 ============
      lyricsVersions: [],
      currentVersionIndex: -1,

      setTheme: (theme) => set({ theme }),
      setMood: (mood) => set({ mood }),
      setGenre: (genre) => set({ genre }),

      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      setLyrics: (lyrics) => set({ lyrics }),
      setApprovedLyrics: (lyrics) => set({ approvedLyrics: lyrics }),

      addConversationMessage: (role, content) => set((state) => ({
        conversation: [...state.conversation, { role, content, timestamp: new Date().toISOString() }]
      })),

      clearConversation: () => set({ conversation: [] }),

      setGenerationStatus: (status) => set({ generationStatus: status }),
      setGenerationProgress: (progress) => set({ generationProgress: progress }),
      setAudioUrl: (url) => set({ audioUrl: url }),
      setJobId: (id) => set({ jobId: id }),

      addProject: (project) => set((state) => ({
        projects: [...state.projects, project]
      })),

      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter(p => p.id !== id)
      })),

      resetGeneration: () => set({
        generationStatus: 'idle',
        generationProgress: 0,
        audioUrl: null,
        jobId: null
      }),

      clearProject: () => set({
        currentProjectId: null,
        lyrics: '',
        approvedLyrics: null,
        conversation: [],
        generationStatus: 'idle',
        generationProgress: 0,
        audioUrl: null,
        jobId: null,
        theme: '',
        mood: '',
        genre: '',
        lyricsVersions: [],
        currentVersionIndex: -1
      }),

      // ============ 歌词版本管理方法 ============

      /**
       * 添加新版本
       * @param {string} content - 歌词内容
       * @param {string} description - 版本描述
       * @param {boolean} isApproved - 是否已确认
       */
      addLyricsVersion: (content, description = '', isApproved = false) => set((state) => {
        const versions = [...state.lyricsVersions];

        // 如果内容没变，不添加新版本
        if (versions.length > 0 && versions[versions.length - 1]?.content === content) {
          return state;
        }

        // 构建新版本
        const newVersion = {
          id: generateId(),
          content,
          timestamp: new Date().toISOString(),
          description: description || `版本 ${versions.length + 1}`,
          isApproved
        };

        versions.push(newVersion);

        // 限制版本数量：移除最旧的非 approved 版本
        while (versions.length > MAX_VERSIONS) {
          const oldestNonApproved = versions.findIndex((v, i) => i > 0 && !v.isApproved);
          if (oldestNonApproved > 0) {
            versions.splice(oldestNonApproved, 1);
          } else {
            break;
          }
        }

        return {
          lyricsVersions: versions,
          currentVersionIndex: versions.length - 1,
          lyrics: content
        };
      }),

      /**
       * 回滚到指定版本
       */
      restoreVersion: (index) => set((state) => {
        if (index < 0 || index >= state.lyricsVersions.length) {
          return state;
        }
        const version = state.lyricsVersions[index];
        return {
          lyrics: version.content,
          currentVersionIndex: index
        };
      }),

      /**
       * 获取当前版本
       */
      getCurrentVersion: () => {
        const state = get();
        if (state.currentVersionIndex >= 0 && state.currentVersionIndex < state.lyricsVersions.length) {
          return state.lyricsVersions[state.currentVersionIndex];
        }
        return state.lyricsVersions[state.lyricsVersions.length - 1];
      },

      /**
       * 标记当前版本为已批准
       */
      approveCurrentVersion: () => set((state) => {
        const versions = [...state.lyricsVersions];
        if (state.currentVersionIndex >= 0 && state.currentVersionIndex < versions.length) {
          versions[state.currentVersionIndex] = {
            ...versions[state.currentVersionIndex],
            isApproved: true
          };
        }
        return { lyricsVersions: versions, approvedLyrics: versions[state.currentVersionIndex]?.content };
      }),

      /**
       * 获取两个版本的对比
       */
      getVersionDiff: (indexA, indexB) => {
        const state = get();
        if (indexA < 0 || indexA >= state.lyricsVersions.length ||
            indexB < 0 || indexB >= state.lyricsVersions.length) {
          return null;
        }
        const versionA = state.lyricsVersions[indexA];
        const versionB = state.lyricsVersions[indexB];
        return {
          versionA,
          versionB,
          diff: computeSimpleDiff(versionA.content, versionB.content)
        };
      },

      /**
       * 清除所有版本历史
       */
      clearVersions: () => set({
        lyricsVersions: [],
        currentVersionIndex: -1
      })
    }),
    {
      name: 'ai-workshop-music'
    }
  )
);