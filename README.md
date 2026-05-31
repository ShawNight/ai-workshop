# AI 小说工坊

一个 AI 多 Agent 协作小说创作 Web 应用。4 个 AI Agent 角色（策划师/写手/评论家/编辑）按状态机流转协作，从创意到完稿全自动完成。

## 功能特性

### 多 Agent 协作创作
- **🧠 策划师 (Planner)** — 从种子创意生成完整设计蓝图：分卷大纲、角色设定（含成长弧线）、世界规则、伏笔表
- **✍️ 写手 (Writer)** — 根据设计文档逐章创作，保持文风一致，自然融入伏笔
- **🔍 评论家 (Critic)** — 审查章节质量：角色一致性、世界规则遵守、剧情连贯度、节奏控制、文笔质量
- **✨ 编辑 (Editor)** — 润色语言表达，修正语法问题，优化文学性和流畅度
- **Agent Board 可视化** — 实时查看每个 Agent 的工作状态和流转
- **活动日志** — 完整的 Agent 协作记录

### 特色功能
- **Agent 模型配置** — 每个 Agent 可独立指定 LLM Provider 和模型
- **设计蓝图预览** — 4 个 Tab 查看大纲、角色、世界规则、伏笔
- **精美阅读界面** — 目录导航、章节切换、沉浸式阅读体验
- **项目管理** — 创建/删除/重命名项目，封面色块
- **单步/自动运行** — 支持手动单步推进或全自动完成

## 技术栈

- **前端**: React 19 + Vite, TailwindCSS, Framer Motion, Zustand, react-router-dom v7
- **后端**: Python Flask + SQLite, 多 Agent 状态机引擎
- **LLM**: 多 Provider 支持，每个 Agent 可独立配置模型

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

3. 配置 API Key（至少一个 Provider）：
   - 启动应用后，在前端「设置」页面添加 Provider 并配置 API Key
   - 或在 `backend/.env` 设置 `LLM_API_KEY`

### 开发

```bash
./run.sh start     # 启动所有服务
./run.sh stop      # 停止所有服务
./run.sh status    # 查看服务状态
```

## 项目结构

```
ai-workshop/
├── frontend/                     # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── novel/            # Agent Board / ActivityLog / 预览面板
│   │   │   ├── common/           # Layout / ProviderEditModal
│   │   │   └── ui/               # 基础组件 (Button/Card/Input/Modal/Select/Toast)
│   │   ├── pages/
│   │   │   ├── NovelListPage     # 项目列表
│   │   │   ├── HarnessPage       # Agent 协作面板
│   │   │   ├── ReaderPage        # 小说阅读器
│   │   │   └── SettingsPage      # Provider + Agent 模型配置
│   │   ├── store/                # Zustand 状态管理
│   │   └── api/                  # API 模块 (novelApi, harnessApi, providerApi)
│   └── ...
├── backend/
│   ├── agents/                   # 多 Agent 协作引擎
│   │   ├── __init__.py           # Orchestrator 状态机
│   │   ├── state.py              # StoryState 共享状态模型
│   │   ├── planner.py            # 策划师 Agent
│   │   ├── writer.py             # 写手 Agent
│   │   ├── critic.py             # 评论家 Agent
│   │   └── editor.py             # 编辑 Agent
│   ├── routes/
│   │   ├── novel.py              # 项目 CRUD + Harness 端点
│   │   ├── harness.py            # 多 Agent 协作控制 API
│   │   └── provider.py           # Provider 配置管理
│   ├── providers/                # LLM Provider 抽象层
│   ├── prompts/novel/            # Agent 提示词模板
│   ├── database.py               # SQLite 数据层
│   └── app.py                    # Flask 入口
└── AGENTS.md                     # Agent 开发指南
```

## 许可证

MIT
