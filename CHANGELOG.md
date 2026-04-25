# 变更记录

本文件记录项目所有功能的新增、修改和删除。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### 新增
- **LRC 歌词同步功能** — 新增后端 `/music/lrc` 接口，调用 MiniMax M2.7 模型根据歌词和音频时长生成 LRC 格式时间戳歌词 (`backend/routes/music.py`)
- **LRC 解析与双模式播放** — `LyricsSyncViewer` 组件支持 LRC 格式解析（`parseLRC`），优先使用 LRC 精确时间戳同步，无 LRC 时自动回退到估算模式 (`frontend/src/components/music/LyricsSyncViewer.jsx`)
- **LRC 自动获取** — `MusicPlayer` 在获取到音频时长后自动请求 LRC 生成，无需手动触发 (`frontend/src/components/music/MusicPlayer.jsx`)
- **前端 API 方法** — `musicApi.generateLrc()` 新增 (`frontend/src/api/index.js`)

### 优化
- **歌词提示词生成改进** — 为 MiniMax Chat API 增加 system 角色消息，明确要求直接输出 JSON、禁止输出思考过程；`max_tokens` 从 300 提升到 1024 (`backend/routes/music.py`)
- **歌词同步显示标识** — LRC 模式下播放状态显示"同步播放"而非"正在播放" (`frontend/src/components/music/LyricsSyncViewer.jsx`)
- **.gitignore 完善** — 重新组织分类，新增前端构建输出、IDE 配置、OS 文件、Claude Code 本地设置等忽略规则

### 删除
- **移除 `SPEC.md`** — 完整规格说明文档已删除
- **移除 `CLAUDE.md`** — Claude Code 配置文档已删除
- **移除 PID 文件** — `backend.pid` 和 `frontend.pid` 不再纳入版本控制，已加入 .gitignore

---

## [1.0.0] - 2025-06-XX

### 新增
- AI 音乐创作（歌词优先）：基于主题的歌词生成、多轮对话优化、MiniMax API 音乐生成、在线试听和下载
- AI 小说写作：故事大纲生成、章节内容逐章创作、角色设定工具
- 工作流编排：拖拽式工作流构建器、AI 工具连接、工作流执行和管理
- 前端 React 18+ + Vite 技术栈，TailwindCSS 样式，Zustand 状态管理
- 后端 Python Flask，MiniMax API 集成
- 项目管理脚本 `run.sh`
