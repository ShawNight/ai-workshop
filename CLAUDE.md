# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 个人工作坊 - 一个全栈 Web 应用，支持音乐创作（歌词优先）、小说写作和工作流编排。

**技术栈**: React 18 + Vite (前端) + Python Flask (后端) + SQLite (持久化) + MiniMax API

## 开发命令

### 一键启动（推荐）
```bash
./run.sh start     # 启动所有服务
./run.sh stop      # 停止所有服务
./run.sh status    # 查看服务状态
```

### 手动启动
```bash
# 后端 (先启动，端口 3001)
cd backend && pip install -r requirements.txt && python app.py

# 前端 (端口 5173)
cd frontend && npm install && npm run dev
```

### 其他命令
```bash
cd frontend && npm run build    # 生产构建
cd frontend && npm run lint     # ESLint 检查
```

## 端口与服务
- **前端**: http://localhost:5173 (Vite dev server)
- **后端**: http://localhost:3001 (Flask)
- **API 代理**: Vite 将 `/api/*` 请求代理到后端（见 `frontend/vite.config.js`）

## 架构要点

### 后端 API 路由
| Blueprint | URL Prefix | 文件 | 功能 |
|-----------|-----------|------|------|
| music_bp | `/api/music` | `routes/music.py` | 歌词生成、音乐生成、mmx CLI |
| novel_bp | `/api/novel` | `routes/novel.py` | 小说项目 CRUD |
| workflow_bp | `/api/workflows` | `routes/workflow.py` | 工作流 CRUD |
| export_bp | `/api/music/export` | `routes/export.py` | 网易云音乐导出 |

### 数据持久化
- `backend/database.py` 使用 SQLite 存储小说项目和工作流
- 数据库文件: `backend/data/ai_workshop.db`
- 音乐项目前端用 Zustand 状态管理，不持久化

### 前端状态管理
Store 文件位于 `frontend/src/store/`:
- `musicStore.js` - 音乐创作状态（歌词、对话、版本历史）
- `novelStore.js` - 小说项目状态
- `workflowStore.js` - 工作流画布状态
- `themeStore.js` - 深色/浅色主题

### 前端路由
```
/              → HomePage (仪表盘)
/music         → MusicPage (AI 音乐创作)
/novel         → NovelPage (AI 小说写作)
/workflows     → WorkflowsPage (工作流编排)
```

### API 客户端
`frontend/src/api/index.js` 导出三个 API 对象:
- `musicApi` - 音乐相关接口
- `novelApi` - 小说相关接口
- `workflowApi` - 工作流相关接口

## MiniMax 集成

需要在 `backend/.env` 配置:
```
MINIMAX_API_KEY=your_api_key_here
PORT=3001
HOST=0.0.0.0
```

- **歌词生成**: 直接调用 MiniMax Chat API (`api.minimaxi.chat/v1/text/chatcompletion_v2`)
- **音乐生成**: 通过 `mmx` CLI (`mmx music generate --lyrics ... --out ...`)
- 未配置 API key 时，歌词生成使用内置 mock 数据

## 重要文件

- `SPEC.md` - 完整规格说明（权威来源，包含数据模型、UI 规格）
- `AGENTS.md` - Agent 开发指南
- `backend/.env.example` - 环境变量示例
- `backend/uploads/` - 生成的音频文件存储目录

## 工作流功能

### 节点类型
| 类型 | 输入端口 | 输出端口 | 功能 |
|------|---------|---------|------|
| input | 无 | 1 | 用户输入文本 |
| llm | 1 | 1 | MiniMax Chat API 处理 |
| music | 1（歌词） | 1（音频） | MiniMax 音乐生成 |
| output | 1 | 无 | 显示最终结果 |

### 交互方式
- **添加节点**: 从节点库拖拽到画布
- **移动节点**: 在画布内拖拽节点
- **创建连接**: 从输出端口拖拽到另一节点的输入端口
- **删除连接**: 点击连线选中后删除
- **配置节点**: 点击节点后在右侧面板配置参数

### 执行引擎
后端使用拓扑排序确定执行顺序，按顺序调用各节点对应的 API：
- `llm` 节点调用 MiniMax Chat API
- `music` 节点调用 mmx CLI 生成音乐
- 支持循环连接检测，阻止无效连接