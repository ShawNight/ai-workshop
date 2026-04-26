# AI Workshop - Agent 指南

## 项目结构

```
ai-workshop/
├── frontend/          # React 19 + Vite (port 5173)
├── backend/           # Python Flask (port 3001)
├── README.md          # 安装说明
└── AGENTS.md          # 本文档
```

## 开发命令

```bash
# 后端 (Python)
cd backend && source .venv/bin/activate  # 激活虚拟环境
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
| `/api/novel/*` | `routes/novel.py` | 小说项目 CRUD、大纲/章节/角色生成、续写、改写、头脑风暴、版本草稿 |
| `/api/workflows/*` | `routes/workflow.py` | 工作流 CRUD 和执行 |
| `/api/music/export/*` | `routes/export.py` | 网易云音乐导出 |

### 小说 API 端点详情

| 方法 | 路由 | 功能 |
|------|------|------|
| `GET` | `/projects` | 获取所有项目 |
| `POST` | `/projects` | 创建项目（支持 synopsis/targetWordCount/writingStyle/coverColor） |
| `GET` | `/projects/<id>` | 获取单个项目 |
| `PUT` | `/projects/<id>` | 更新项目（支持所有字段部分更新） |
| `DELETE` | `/projects/<id>` | 删除项目（级联删除关联数据） |
| `POST` | `/generate-outline` | AI 生成层级大纲（输入 premise/genre/synopsis） |
| `POST` | `/generate-chapter` | AI 生成章节（支持 characters/relationships/locations/outline 上下文） |
| `POST` | `/continue-chapter` | AI 续写章节（从断点自然延续，支持角色上下文） |
| `POST` | `/rewrite` | AI 改写选中文本（支持角色上下文保持人设一致） |
| `POST` | `/brainstorm` | AI 头脑风暴（基于角色关系生成创作方向） |
| `POST` | `/character` | AI 创建角色（生成 traits/appearance/backstory） |
| `GET` | `/projects/<id>/stats` | 获取写作统计 |
| `POST` | `/projects/<id>/drafts/<chapterId>` | 保存章节草稿版本 |
| `GET` | `/projects/<id>/drafts/<chapterId>` | 获取章节版本历史 |
| `GET` | `/drafts/<draftId>` | 获取特定草稿内容 |
| `POST` | `/projects/<id>/stats/log` | 记录写作日志 |

## LLM API 集成

- **小说/角色**: 使用 `LLM_CHAT_URL` (Chat Completions API) + `LLM_CHAT_MODEL` (MiniMax-M2.7)
- **歌词**: 使用 `LLM_LYRICS_URL` + `LLM_LYRICS_MODEL`
- **音乐**: 使用 `LLM_MUSIC_URL` + `LLM_MUSIC_MODEL`

**降级策略**: 如果未设置 API key 或 API 调用失败，所有小说端点会返回内置的中文示例数据（mock），不会报 500 错误。

## LLM API 配置

在 `backend/.env` 文件中设置：
```
LLM_API_KEY=your_api_key_here
LLM_CHAT_URL=https://api.minimaxi.com/v1/chat/completions
LLM_CHAT_MODEL=MiniMax-M2.7
PORT=3001
HOST=0.0.0.0
```

## 前端组件归属

- `frontend/src/components/music/*` - 歌词编辑器、音乐播放器、歌词同步显示
- `frontend/src/components/novel/*` - 项目卡片、创建弹窗、富文本编辑器、角色关系图、版本历史、头脑风暴
- `frontend/src/components/novel/tabs/*` - 大纲 Tab、角色 Tab、世界观 Tab、设定 Tab、导出 Tab
- `frontend/src/components/workflow/*` - 画布、节点面板、节点编辑器
- `frontend/src/components/ui/*` - shadcn/ui 基础组件 (Button/Card/Input/Modal/Select/Toast/Progress)

## 前端路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/novel` | NovelListPage | 项目列表，卡片网格 + 新建弹窗 |
| `/novel/:projectId` | NovelEditorPage | 项目编辑器（大纲/角色/世界观/统计/设定/导出 6 个 Tab） |
| `/novel/:projectId/write/:chapterId` | ChapterWritePage | 全屏专注写作模式 |

## 数据库 Schema

### novel_projects 表
```
id, title, genre, premise, synopsis, target_word_count, current_word_count,
status, writing_style, cover_color, outline (JSON), chapters (JSON),
characters (JSON), locations (JSON), relationships (JSON), settings (JSON),
created_at, updated_at
```

### writing_log 表
```
id, project_id, chapter_id, word_count, created_at
```

### chapter_drafts 表
```
id, project_id, chapter_id, content, word_count, version, created_at
```
