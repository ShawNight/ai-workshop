# AI 个人工作坊

一个创意 AI 工作坊 Web 应用，支持音乐创作、小说写作和工作流编排。

## 功能特性

### AI 音乐创作（歌词优先）
- 基于主题的歌词生成
- 多轮对话优化歌词
- 调用 MiniMax API 生成音乐
- 在线试听和下载
- **LRC 歌词同步** — 基于 AI 生成 LRC 时间戳，实现歌词逐行高亮同步播放；无 LRC 时自动回退到估算模式
- 歌词提示词生成优化 — 增加 system 角色约束，确保 AI 返回纯 JSON 格式

### AI 小说写作
- 故事大纲生成
- 章节内容逐章创作
- 角色设定工具

### 工作流编排
- 拖拽式工作流构建器
- 连接不同的 AI 工具（音乐、小说、文本）
- 执行和管理工作流

## 技术栈

- **前端**: React 18+ + Vite, TailwindCSS, Zustand, @dnd-kit
- **后端**: Python Flask
- **API**: MiniMax 音乐生成 API（M2.7 模型）

## 快速开始

### 环境要求
- Node.js 18+ (前端)
- Python 3.10+ (后端)
- npm 或 yarn

### 安装

1. 安装前端依赖：
```bash
cd frontend
npm install
```

2. 安装后端依赖：
```bash
cd backend
pip install -r requirements.txt
```

### 开发

使用项目管理脚本 `run.sh` 方便启动/停止服务：

```bash
./run.sh start     # 启动所有服务（后端 + 前端）
./run.sh stop      # 停止所有服务
./run.sh restart   # 重启所有服务
./run.sh status    # 查看服务状态
```

或手动启动（分两个终端）：

1. 启动后端服务：
```bash
cd backend
python app.py
```
后端运行在 http://localhost:3001

2. 启动前端开发服务器：
```bash
cd frontend
npm run dev
```
前端运行在 http://localhost:5173

### MiniMax API 配置

应用使用 MiniMax API（M2.7 模型）生成音乐和歌词时间戳。
请在 `backend/.env` 文件中配置 MiniMax API key：

```
MINIMAX_API_KEY=your_api_key_here
```

## 项目结构

```
ai-workshop/
├── CHANGELOG.md         # 变更记录
├── frontend/
│   ├── src/
│   │   ├── components/   # React 组件
│   │   │   └── music/    # 音乐模块组件
│   │   │       ├── MusicPlayer.jsx         # 播放器（含 LRC 自动获取）
│   │   │       └── LyricsSyncViewer.jsx    # 歌词同步显示（LRC + 估算双模式）
│   │   ├── pages/       # 页面组件
│   │   ├── store/       # Zustand 状态管理
│   │   ├── api/         # API 模块
│   │   └── lib/         # 工具函数
│   └── ...
└── backend/
    ├── app.py           # Flask 主应用
    ├── routes/          # API 路由 (Python)
    │   └── music.py     # 音乐路由（含 /lrc 生成接口）
    ├── services/        # 业务逻辑
    ├── requirements.txt # Python 依赖
    └── uploads/         # 音频文件存储
```

## 许可证

MIT
