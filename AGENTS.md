# AI Workshop - Agent 指南

## 项目结构

```
ai-workshop/
├── frontend/          # React 19 + Vite (port 5173)
├── backend/
│   ├── agents/        # 多 Agent 协作引擎（Planner/Writer/Critic/Editor）
│   ├── routes/        # API 路由（novel.py, provider.py, harness.py）
│   ├── prompts/       # Jinja2 提示词模板（design.j2, auto_chapter.j2, revise_block.j2, extract_summary.j2）
│   └── ...
├── README.md          # 项目说明与功能清单
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

## 架构说明

- **多 Agent 协作创作**: 4 个 AI Agent 角色按状态机流转协作完成小说创作
  - **策划师 (Planner)**: 从种子创意生成完整设计蓝图（大纲/角色/世界规则/伏笔）
  - **写手 (Writer)**: 根据设计文档逐章创作
  - **评论家 (Critic)**: 审查章节质量（一致性/剧情/节奏），通过则进入编辑，不通过则退回写手修改
  - **编辑 (Editor)**: 润色语言表达，完成后进入下一章
- **Agent 模型配置**: 每个 Agent 可独立指定使用的 LLM Provider 和模型
- **API 代理**: Vite 将 `/api/*` 请求代理到 `http://localhost:3001`
- **无 TypeScript**: 项目使用纯 JSX，无类型检查命令
- **状态管理**: Zustand store 在 `frontend/src/store/`
- **LLM 调用**: `call_llm()` 支持 temperature 和 max_tokens 参数，每个 Agent 可使用不同配置

## 后端 API 端点

| 路由 | 文件 | 功能 |
|------|------|------|
| `/api/novel/*` | `routes/novel.py` | 项目 CRUD、Harness 端点 |
| `/api/harness/*` | `routes/harness.py` | 多 Agent 协作控制（start/advance/state） |
| `/api/provider/*` | `routes/provider.py` | Provider 配置管理 |

## LLM API 配置

在 `backend/.env` 文件中设置：
```
LLM_API_KEY=your_api_key_here
PORT=3001
HOST=0.0.0.0
```

> 可通过前端设置页面配置多个 Provider，并为每个 Agent 分配不同的模型。

## 前端路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/novel` | NovelListPage | 项目列表，新建创作入口 |
| `/novel/:projectId` | HarnessPage | Agent 协作面板 |
| `/novel/:projectId/read` | ReaderPage | 小说阅读器 |
| `/settings` | SettingsPage | Provider 管理 + Agent 模型配置 |

## 编码规范

- **Git commit 信息**: 前缀用标准英文 Conventional Commits 格式，描述用中文
- **不添加注释**，除非用户明确要求
- **前端代码风格**: 纯 JSX，无 TypeScript，无 PropTypes
- **确认弹窗**: 使用 `ConfirmDialog` 组件替代 `window.confirm()`

## 数据库 Schema

### novel_projects 表
```
id, title, genre, premise, synopsis, target_word_count, current_word_count,
status, writing_style, cover_color, outline (JSON), chapters (JSON),
characters (JSON), locations (JSON), relationships (JSON), settings (JSON),
notes (JSON), created_at, updated_at
```

### providers 表
```
name, display_name, protocol, chat_url, chat_model, api_key,
enabled, thinking_enabled, reasoning_effort, thinking_budget,
created_at, updated_at
```

### agent_config 表
```
agent_name, provider_name, model_name
```
