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
| `POST` | `/generate-outline` | AI 生成层级大纲（支持 characters/relationships/locations 上下文） |
| `POST` | `/generate-chapter` | AI 生成章节（支持 characters/relationships/locations/outline 上下文） |
| `POST` | `/continue-chapter` | AI 续写章节（从断点自然延续，支持角色和世界上下文） |
| `POST` | `/rewrite` | AI 改写选中文本（支持角色上下文保持人设一致） |
| `POST` | `/brainstorm` | AI 头脑风暴（支持 characters/relationships/locations/outline 上下文，策略性截断） |
| `POST` | `/character` | AI 创建单个角色（生成 traits/appearance/backstory） |
| `POST` | `/generate-characters` | AI 批量生成角色（1-8个，支持已有角色避重名） |
| `POST` | `/generate-locations` | AI 批量生成地点（1-6个，支持角色关联） |
| `POST` | `/generate-location` | AI 生成单个地点详情（根据名称+类型生成描述和剧情意义） |
| `POST` | `/chat` | AI 多轮对话（character/world/character_relation 模式） |
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
- `frontend/src/components/novel/tabs/*` - 大纲 Tab、角色 Tab（含批量生成+审阅+内联编辑）、世界观 Tab（含批量生成+审阅+内联编辑+AI生成描述）、设定 Tab、导出 Tab
- `frontend/src/components/novel/chat/*` - AI 对话面板（character/world/relation 模式）、建议卡片
- `frontend/src/components/workflow/*` - 画布、节点面板、节点编辑器
- `frontend/src/components/ui/*` - shadcn/ui 基础组件 (Button/Card/Input/Modal/Select/Toast/Progress)

## 前端路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/novel` | NovelListPage | 项目列表，卡片网格 + 新建弹窗 |
| `/novel/:projectId` | NovelEditorPage | 项目编辑器（大纲/角色/世界观/统计/设定/导出 6 个 Tab） |
| `/novel/:projectId/write/:chapterId` | ChapterWritePage | 全屏专注写作模式 |

## 小说创作功能设计

### 角色 Tab 功能
- **手动添加角色**: 填写名称+定位+描述，点击"AI 生成性格特征"自动补全 traits/appearance/backstory
- **AI 批量生成**: 根据故事设定一键生成 1-8 个角色，进入审阅区逐个采纳/编辑/丢弃或全部操作
- **内联编辑**: 展开角色卡片后可编辑所有字段（名称/定位/描述/外貌/背景/性格特征标签增删改）
- **AI 深入探讨**: 每个角色可打开 ChatPanel，AI 可返回 update_character/add_trait/create_relationship 等建议
- **删除确认**: 删除角色时弹出确认框，显示关联关系数量

### 世界观 Tab 功能
- **手动添加地点**: 填写名称+类型+描述+剧情意义
- **AI 批量生成**: 根据故事设定一键生成 1-6 个地点（传入已有角色以建立自然关联），进入审阅区
- **AI 生成描述**: 创建地点时填入名称后，可点击"AI 生成描述"自动补全描述和剧情意义
- **内联编辑**: 展开地点卡片后可编辑所有字段（名称/类型/描述/剧情意义）
- **AI 深入探讨**: 每个地点可打开 ChatPanel，AI 可返回 update_location/add_location_detail/create_location 等建议
- **删除确认**: 删除地点时弹出确认框

### 大纲生成
- 生成大纲时自动传入当前项目的 characters/relationships/locations 作为上下文
- AI 在设计大纲时会参照已有的角色和世界观设定

### 头脑风暴
- 传入 characters/relationships/locations(最多5个)/outline(最多10条) 作为上下文
- 策略性截断避免过度锚定，保持创意发散性

### EditorSidebar 引导
- 当项目无角色、无地点、无章节时，侧边栏底部显示"创作建议"提示卡片
- Tab 标签旁显示角色和地点数量

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