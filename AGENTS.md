# AI Workshop - Agent 指南

## 项目结构

```
ai-workshop/
├── frontend/          # React 19 + Vite (port 5173)
├── backend/
│   ├── agents/        # 多 Agent 协作引擎（DAG 工作流）
│   │   ├── __init__.py           # Orchestrator + 调度 + SSE 事件
│   │   ├── workflow.py           # DAG 引擎（节点/边/调度）
│   │   ├── state.py              # StoryState
│   │   ├── planner.py / writer.py / critic.py / editor.py
│   │   ├── character_designer.py / world_builder.py
│   │   ├── blueprint_sync.py     # 章节后回写蓝图
│   │   ├── blackboard.py
│   │   └── llm.py                # call_agent_llm / 流式 / run 日志
│   ├── routes/        # API 路由
│   │   ├── novel.py              # 项目 CRUD + 章节人工编辑
│   │   ├── harness.py            # 多 Agent 控制 + SSE 流
│   │   └── provider.py           # Provider + 模板 + 协议
│   ├── providers/     # LLM Provider 抽象层
│   │   ├── protocols.py          # OpenAI / DeepSeek / MiniMax / Anthropic
│   │   ├── templates.py          # 8 个内置模板
│   │   ├── base.py / db.py
│   ├── prompts/       # Jinja2 提示词模板
│   ├── database.py   # SQLite 数据层
│   └── app.py        # Flask 入口
├── run.sh            # 一键启停
├── README.md
└── AGENTS.md
```

## 开发命令

```bash
# 后端
cd backend && source .venv/bin/activate
cd backend && pip install -r requirements.txt
cd backend && python app.py                    # 启动 Flask (port 3001)

# 前端
cd frontend && npm install
cd frontend && npm run dev                      # Vite (port 5173)
cd frontend && npm run build
cd frontend && npm run lint
```

## 架构说明

### 多 Agent DAG 协作
- **策划阶段 DAG**：`outline_planner` → 三路并行（`character_designer` / `world_builder` / `foreshadow_planner`）→ `planning_done`
- **写作阶段 DAG（每章）**：`writer` → `critic` → pass→`editor` / fail→`revise`→`re_review` → `done`
- **完成阶段**：可选的 `blueprint_sync` 回写
- 节点 ID ↔ agent_states 键名通过 `WorkflowEngine._node_to_agent_key()` 映射

### Agent 角色清单
- **Meta** — 协商项目初始设定
- **策划**：Outline Planner / Character Designer / World Builder / Foreshadow Planner
- **写作**：Writer / Critic / Editor / Revise
- **辅助**：Blueprint Sync（自动）/ Memory Keeper（摘要）

### 关键技术点
- **DAG 引擎**：`backend/agents/workflow.py` —— 节点状态机 + 边依赖 + 并行调度
- **SSE 流式推送**：`/api/harness/stream/<projectId>` —— 节点变化、阶段切换、蓝图更新实时下发
- **Schema-driven 思考模式**：协议返回 `thinkingSchema`，前端 `ThinkingSection` 动态渲染 UI
- **蓝图自动同步**：每章完成后 `BlueprintSync` Agent 提取新元素并去重写回 design
- **人工干预**：编辑过的章节标记 `manuallyEdited`，工作流自动跳过
- **API 代理**：Vite 将 `/api/*` 代理到 `http://localhost:3001`
- **无 TypeScript**：纯 JSX，无类型检查
- **状态管理**：Zustand store 在 `frontend/src/store/`
- **LLM 调用**：`call_agent_llm()` / `call_agent_llm_stream()` 支持 temperature 和 max_tokens，每 Agent 独立配置

## 前端路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/novel` | NovelListPage | 项目列表 |
| `/novel/:projectId` | ProjectOverviewPage | 项目首页（阶段/进度/统计） |
| `/novel/:projectId/workflow` | WorkflowPage | DAG 工作流主面板 |
| `/novel/:projectId/blueprint` | BlueprintPage | 蓝图查看与编辑 |
| `/novel/:projectId/read` | ReaderPage | 小说阅读器 |
| `/novel/:projectId/read/:chapterIdx` | ChapterEditorPage | 人工编辑章节 |
| `/settings` | SettingsPage | Provider + Agent 模型配置 |

> `HarnessPage` 已废弃，6 行重定向壳指向 `/workflow`。

## 后端 API 端点

| 路由 | 文件 | 功能 |
|------|------|------|
| `/api/novel/*` | `routes/novel.py` | 项目 CRUD、章节人工编辑、保存草稿 |
| `/api/harness/*` | `routes/harness.py` | 多 Agent 协作（start/advance/pause/resume/checkpoint/run-single/retry） |
| `/api/harness/stream/<id>` | `routes/harness.py` | **SSE 实时事件流** |
| `/api/provider/*` | `routes/provider.py` | Provider 配置、模板、协议 schema、模型增删改查 |

## SSE 事件类型
- `init` — 连接建立后发送完整 state + workflow
- `task_started` / `task_completed` / `task_failed`
- `workflow_node` — 节点状态变化（含完整 workflow 快照）
- `agent_step_done` — 单步完成
- `auto_progress` — 自动推进进度
- `paused` / `checkpoint_approved`
- `blueprint_updated` — 蓝图增量更新通知

## LLM API 配置

在 `backend/.env`：
```
LLM_API_KEY=your_api_key_here
PORT=3001
HOST=0.0.0.0
```

> 推荐在前端「设置」页面从模板快速添加 Provider，并为每个 Agent 分配模型。

## 编码规范

- **Git commit 信息**: 前缀用标准英文 Conventional Commits 格式，描述用中文
- **不添加注释**，除非用户明确要求
- **前端代码风格**: 纯 JSX，无 TypeScript，无 PropTypes
- **确认弹窗**: 使用 `ConfirmDialog` 组件替代 `window.confirm()`

## 数据库 Schema

### novel_projects
```
id, title, genre, premise, synopsis, target_word_count, current_word_count,
status, writing_style, cover_color, outline (JSON), chapters (JSON),
characters (JSON), locations (JSON), relationships (JSON), settings (JSON),
creation_mode, notes, foreshadows (JSON), created_at, updated_at
```

### providers
```
name, display_name, protocol, chat_url, chat_model, api_key,
enabled, thinking_enabled, reasoning_effort, thinking_budget, thinking_config (JSON),
created_at, updated_at
```

### provider_models (新增)
```
id, provider_name, model_name, created_at
```

### provider_settings (新增，全局 KV)
```
key, value
```

### agent_config (新增)
```
agent_name, provider_name, model_name
```

### workflows
```
id, project_id, phase, graph (JSON), status, created_at, updated_at
```

### agent_runs (新增)
```
id, project_id, agent_name, phase, chapter_index,
input_messages (JSON), output, output_parsed (JSON),
status, error, duration_ms, created_at
```

### blueprint_changes (新增)
```
id, project_id, change_type, change_data (JSON),
source (user_edit | auto_sync), chapter_index, created_at
```

### writing_log / chapter_drafts（已存在）
