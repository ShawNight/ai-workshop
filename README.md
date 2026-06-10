# AI 小说工坊

一个基于 **DAG 工作流引擎 + 多 Agent 协作** 的 AI 小说创作 Web 应用。11 个 AI Agent 角色按 DAG 图节点流转协作，从一句种子创意到完稿全自动完成，并通过 **SSE 流式推送** 实时反馈状态。

## 功能特性

### 多 Agent 协作创作（DAG 工作流）

**策划阶段**（三路并行 DAG）
- **🧭 Meta** — 与用户协商项目初始设定（题材、风格、目标读者、尺度等）
- **🗺️ 大纲策划 (Outline Planner)** — 从种子创意生成卷/章级大纲
- **👥 角色设计师 (Character Designer)** — 设计主角/配角，含成长弧线
- **🌍 世界构建 (World Builder)** — 设定世界规则、力量体系、地理
- **🔮 伏笔策划 (Foreshadow Planner)** — 规划需要长期铺垫的伏笔
- **📘 蓝图同步 (Blueprint Sync)** — 章节完成后自动从正文回写新角色/新伏笔/弧光变化

**写作阶段**（每章 DAG：写手 → 评论家 → pass/fail 分支）
- **✍️ 写手 (Writer)** — 根据设计文档逐章创作
- **🔍 评论家 (Critic)** — 审查一致性/剧情/节奏/文笔
- **🔧 修订 (Revise)** — 评论不通过时退回数控修订
- **✨ 编辑 (Editor)** — 通过后润色语言表达
- **🧠 记忆守护 (Memory Keeper)** — 跨章摘要与状态维护

### 可视化与实时反馈
- **DAG 视图** — 节点状态、依赖关系实时展示（`DAGView`）
- **Agent 运行历史** — 每次 LLM 调用的 prompt / output / 耗时持久化可查
- **SSE 实时推送** — 节点状态变化、阶段切换、蓝图更新即时反映
- **检查点审批** — 策划完成/低分章节时暂停等待用户决定

### 蓝图系统
- **6 维蓝图** — 大纲 / 角色 / 世界规则 / 力量体系 / 地理 / 伏笔
- **增量同步** — `Blueprint Sync` Agent 自动从已写章节提取新元素
- **变更追溯** — 每次新增/修改都记录来源（`auto_sync` 或 `user_edit`）
- **差异徽章** — UI 上高亮标记新增项

### Provider 与模型
- **多 Provider 模板** — 内置 8 个快速添加模板（DeepSeek / MiniMax / OpenAI / Anthropic / Moonshot / Zhipu / Qwen / Custom）
- **Schema-driven 思考模式** — 不同协议的 `thinking` 字段统一抽象，前端动态渲染配置 UI
- **每 Agent 独立模型** — 11 个 Agent 可分别指定 Provider + Model
- **多模型管理** — 每个 Provider 维护一个可选模型列表

### 阅读与人工干预
- **精美阅读器** — 目录导航、章节切换、沉浸式阅读
- **人工编辑章节** — 3 秒自动保存，标记 `manuallyEdited` 后工作流自动跳过
- **项目管理** — 创建/删除/重命名、封面色块、阶段进度

## 技术栈

- **前端**: React 19 + Vite, TailwindCSS, Framer Motion, Zustand, react-router-dom v7
- **后端**: Python Flask + SQLite, DAG 工作流引擎, SSE 流式推送
- **LLM**: 多 Provider 协议层（OpenAI / DeepSeek / MiniMax / Anthropic），每 Agent 可独立配置

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.10+

### 安装

```bash
# 前端
cd frontend && npm install

# 后端
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 配置 API Key
- **推荐**：启动后在「设置」页面从模板快速添加 Provider 并填入 API Key
- **手动**：在 `backend/.env` 设置 `LLM_API_KEY=your_api_key_here`

### 开发

```bash
./run.sh start     # 启动所有服务（后端 :3001 / 前端 :5173）
./run.sh stop      # 停止所有服务
./run.sh restart   # 重启
./run.sh status    # 查看服务状态
```

## 项目结构

```
ai-workshop/
├── frontend/                         # React 19 + Vite (port 5173)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── NovelListPage         # 项目列表
│   │   │   ├── ProjectOverviewPage   # 项目首页（阶段进度/统计/入口）
│   │   │   ├── WorkflowPage          # DAG 工作流主面板
│   │   │   ├── BlueprintPage         # 蓝图查看与编辑
│   │   │   ├── ReaderPage            # 小说阅读器
│   │   │   ├── ChapterEditorPage     # 人工编辑章节
│   │   │   └── SettingsPage          # Provider + Agent 模型配置
│   │   ├── components/
│   │   │   ├── novel/                # DAGView / BlueprintPanel / AgentNodeDetailDrawer ...
│   │   │   ├── common/               # ProviderEditModal / ThinkingSection ...
│   │   │   └── ui/                   # 基础组件
│   │   ├── lib/useHarnessSSE.js      # SSE 共享连接 Hook
│   │   ├── store/                    # Zustand 状态管理
│   │   └── api/                      # API 模块
│   └── ...
├── backend/
│   ├── agents/                       # 多 Agent 协作引擎
│   │   ├── __init__.py               # Orchestrator + DAG 调度 + SSE 事件
│   │   ├── workflow.py               # DAG 引擎（节点/边/调度）
│   │   ├── state.py                  # StoryState 共享状态模型
│   │   ├── planner.py / writer.py / critic.py / editor.py
│   │   ├── character_designer.py / world_builder.py / blueprint_sync.py
│   │   ├── blackboard.py             # 共享黑板
│   │   └── llm.py                    # LLM 调用 + run 日志
│   ├── routes/
│   │   ├── novel.py                  # 项目 CRUD + 章节人工编辑
│   │   ├── harness.py                # 多 Agent 协作控制 + SSE 流
│   │   └── provider.py               # Provider 配置 + 模板 + 协议
│   ├── providers/                    # LLM Provider 抽象层
│   │   ├── protocols.py              # 协议注册表（OpenAI/DeepSeek/MiniMax/Anthropic）
│   │   ├── templates.py              # 8 个内置 Provider 模板
│   │   ├── base.py / db.py
│   ├── prompts/                      # Jinja2 提示词模板
│   ├── database.py                   # SQLite 数据层（10+ 表）
│   └── app.py                        # Flask 入口
├── run.sh                            # 一键启停脚本
├── README.md
└── AGENTS.md                         # Agent 开发指南
```

## 许可证

MIT
