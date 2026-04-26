# AI 个人工作坊

一个创意 AI 工作坊 Web 应用，支持音乐创作、小说写作和工作流编排。

## 功能特性

### AI 音乐创作
- 基于主题的歌词生成
- 多轮对话优化歌词
- 调用 MiniMax API 生成音乐
- 在线试听和下载
- LRC 歌词同步 — AI 生成时间戳，歌词逐行高亮

### AI 小说写作
- **项目管理** — 创建/编辑/删除项目，封面色块、字数进度条、状态追踪
- **AI 生成大纲** — 自动生成 6-8 章故事大纲（含章节标题和概要）
- **富文本编辑器** — TipTap 驱动的编辑器，支持加粗/斜体/标题/撤销重做
- **AI 生成章节** — 基于大纲、角色设定、关系图智能生成完整章节
- **AI 续写** — 从断点自然延续 500-1000 字，保持文风一致
- **AI 改写** — 选中文字后 AI 优化文笔，保持角色人设
- **角色管理** — 创建角色，AI 自动生成性格特征/外貌描述/背景故事
- **SVG 角色关系图** — 可视化角色关系网络，8 种关系类型（朋友/恋人/敌人/盟友/家人/师徒/对手）
- **世界观构建** — 地点管理，支持城市/村镇/荒野/异界/建筑等类型
- **写作统计** — 总字数/进度/每章分布/项目信息
- **版本历史** — 自动保存章节草稿，随时查看和恢复历史版本
- **头脑风暴** — AI 根据想法生成 3 个创作方向，一键采用
- **全屏写作** — 专注模式，无干扰写作体验
- **导出** — TXT/Markdown 双格式，可选包含目录/大纲/角色/地点
- **自动保存** — 2 秒防抖自动保存，防止内容丢失

### 工作流编排
- 拖拽式工作流构建器
- 连接不同的 AI 工具（音乐、小说、文本）
- 执行和管理工作流

## 技术栈

- **前端**: React 19 + Vite, TailwindCSS, Zustand, TipTap, react-router-dom v7
- **后端**: Python Flask + SQLite
- **API**: MiniMax Chat Completions API (M2.7 模型)

## 快速开始

### 环境要求
- Node.js 18+ (前端)
- Python 3.10+ (后端)

### 安装

1. 安装前端依赖：
```bash
cd frontend && npm install
```

2. 创建并激活 Python 虚拟环境，安装后端依赖：
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. 配置 API Key：
```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入你的 LLM_API_KEY
```

### 开发

```bash
./run.sh start     # 启动所有服务
./run.sh stop      # 停止所有服务
./run.sh status    # 查看服务状态
```

或手动启动（分两个终端）：

```bash
# 终端 1: 后端
cd backend && source .venv/bin/activate && python app.py
# → http://localhost:3001

# 终端 2: 前端
cd frontend && npm run dev
# → http://localhost:5173
```

### MiniMax API 配置

在 `backend/.env` 文件中配置：

```
LLM_API_KEY=your_api_key_here
LLM_CHAT_URL=https://api.minimaxi.com/v1/chat/completions
LLM_CHAT_MODEL=MiniMax-M2.7
```

> 未配置 API Key 时，小说模块会自动使用内置中文示例数据，不影响功能体验。

## 项目结构

```
ai-workshop/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── novel/           # 小说模块组件
│   │   │   │   ├── tabs/        # 大纲/角色/世界观/设定/导出 Tab
│   │   │   │   ├── ChapterEditor.jsx      # TipTap 富文本编辑器
│   │   │   │   ├── RelationshipGraph.jsx  # SVG 角色关系图
│   │   │   │   ├── RelationshipEditor.jsx # 关系编辑器
│   │   │   │   ├── VersionHistory.jsx     # 版本历史面板
│   │   │   │   ├── BrainstormModal.jsx    # 头脑风暴弹窗
│   │   │   │   ├── OutlineNode.jsx        # 递归大纲节点
│   │   │   │   ├── ProjectCard.jsx        # 项目卡片
│   │   │   │   ├── StatsPanel.jsx         # 写作统计面板
│   │   │   │   └── ...
│   │   │   ├── music/           # 音乐模块组件
│   │   │   ├── workflow/        # 工作流模块组件
│   │   │   └── ui/              # shadcn/ui 基础组件
│   │   ├── pages/               # 页面组件
│   │   ├── store/               # Zustand 状态管理
│   │   ├── api/                 # API 模块
│   │   └── lib/                 # 工具函数
│   └── ...
├── backend/
│   ├── app.py                   # Flask 主应用
│   ├── config.py                # 配置管理
│   ├── database.py              # SQLite 数据库层
│   ├── routes/
│   │   ├── novel.py             # 小说 API 路由 (16 个端点)
│   │   ├── music.py             # 音乐 API 路由
│   │   ├── workflow.py          # 工作流 API 路由
│   │   └── export.py            # 导出 API 路由
│   ├── data/                    # 数据库文件
│   └── uploads/                 # 音频文件
└── AGENTS.md                    # Agent 开发指南
```

## 许可证

MIT
