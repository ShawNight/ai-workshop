# AI Workshop - Agent 指南

## 项目结构

```
ai-workshop/
├── frontend/          # React 18 + Vite (port 5173)
├── backend/           # Python Flask (port 3001)
├── SPEC.md            # 完整规格说明 (权威来源)
└── README.md          # 安装说明
```

## 开发命令

```bash
# 后端 (Python)
cd backend && pip install -r requirements.txt  # 安装依赖
cd backend && python app.py                    # 启动 Flask 服务 (port 3001)

# 前端
cd frontend && npm install                    # 安装依赖
cd frontend && npm run dev                    # Vite 开发服务器 (port 5173)
cd frontend && npm run build                  # 生产构建
cd frontend && npm run lint                    # ESLint 检查
```

**启动顺序**: 在不同终端中先启动后端，再启动前端。

## 架构说明

- **API 代理**: Vite 将 `/api/*` 请求代理到 `http://localhost:3001` (见 `frontend/vite.config.js`)
- **无 TypeScript**: 项目使用纯 JSX，无类型检查命令
- **状态管理**: Zustand store 在 `frontend/src/store/`
- **API 层**: `frontend/src/api/index.js` - axios 实例，包含 musicApi、novelApi、workflowApi

## 后端 API 端点

| 路由 | 文件 | 功能 |
|------|------|------|
| `/api/music/*` | `routes/music.py` | 歌词生成、MiniMax 音乐生成 API |
| `/api/novel/*` | `routes/novel.py` | 小说项目 CRUD、大纲/章节生成 |
| `/api/workflows/*` | `routes/workflow.py` | 工作流 CRUD 和执行 |
| `/api/music/export/*` | `routes/export.py` | 网易云音乐导出 |

## LLM API 集成

- **歌词**: 调用 `LLM_TEXT_URL`，使用 `LLM_API_KEY`
- **音乐**: 使用 `LLM_MUSIC_URL` 生成音乐 (HTTP)
- 两者都需要有效的 API key 才能在生产环境工作

**注意**: 如果未设置 API key，会使用内置的 mock 数据。

## LLM API 配置

在 `backend/.env` 文件中设置：
```
LLM_API_KEY=your_api_key_here
PORT=3001
HOST=0.0.0.0
```

## 前端组件归属

- `frontend/src/components/music/*` - 歌词编辑器、音乐播放器、对话面板
- `frontend/src/components/novel/*` - 故事构建器、章节编辑器、角色卡片
- `frontend/src/components/workflow/*` - 画布、节点面板、节点编辑器
- `frontend/src/components/ui/*` - shadcn/ui 基础组件
