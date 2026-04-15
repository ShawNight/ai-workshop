# AI 个人工作坊 - 规格说明书

## 1. 项目概述

### 项目名称
AI 个人工作坊 (AI Personal Workshop)

### 项目类型
全栈 Web 应用，采用现代 SPA 前端 + REST API 后端架构

### 核心功能
创意 AI 工作坊，帮助用户通过直观的拖拽界面创作 AI 生成的音乐（歌词优先方式）、小说，以及编排多步骤 AI 工作流。

### 目标用户
- 需要 AI 辅助作曲的音乐人和词作者
- 使用 AI 生成故事的小说作者
- 构建复杂 AI 流水线的内容创作者
- 探索 AI 增强工作流的创意专业人士

---

## 2. 技术栈

### 前端
- **框架**: React 18+ + Vite
- **UI 库**: TailwindCSS + shadcn/ui 组件
- **状态管理**: Zustand
- **路由**: React Router v6
- **拖拽**: @dnd-kit/core
- **HTTP 客户端**: Axios
- **音频播放**: Howler.js

### 后端
- **框架**: Python Flask
- **API 风格**: RESTful
- **文件处理**: 原生文件操作（用于音频上传）
- **跨域**: flask-cors

### 基础设施
- **MiniMax API**: 通过 mmx CLI 或直接 API 调用
- **端口**: 前端: 5173，后端: 3001

---

## 3. 功能规格

### 3.1 AI 音乐创作

#### 歌词优先工作流
1. **主题输入**: 用户提供主题/情绪/风格
2. **初始歌词生成**: LLM 建议歌词结构（主歌、副歌、过渡段）
3. **多轮优化**:
   - 在编辑器中显示当前歌词
   - 用户可手动编辑或请求 AI 优化
   - "改进"按钮触发 LLM 优化
   - 维护对话历史以保持上下文
4. **确认**: 用户满意后点击"确认歌词"
5. **音乐生成**: 使用确认的歌词生成音乐
6. **预览下载**: 播放生成的音频，下载为 MP3

#### 组件
- `ThemeInput`: 主题、情绪、风格选择表单
- `LyricsEditor`: 支持逐行编辑的富文本编辑器
- `ConversationPanel`: 显示优化历史的聊天界面
- `MusicPlayer`: 带波形可视化的音频播放器
- `GenerationProgress`: 音乐生成进度指示器

#### API 端点
- `POST /api/music/lyrics` - 生成/优化歌词
- `POST /api/music/generate` - 从歌词生成音乐
- `GET /api/music/status/:jobId` - 查询生成状态
- `GET /api/music/download/:filename` - 下载音频文件

### 3.2 AI 小说写作

#### 功能
- **故事生成**: 生成故事大纲和情节
- **章节管理**: 创建、编辑、删除章节
- **角色开发**: 带特征的角色卡片
- **情节流程设计**: 故事事件的可视化时间线

#### 组件
- `StoryOutlineBuilder`: 故事前提和类型表单
- `ChapterEditor`: 章节内容富文本编辑器
- `CharacterCards`: 角色资料卡片网格
- `PlotTimeline`: 可视化情节推进工具

#### API 端点
- `POST /api/novel/generate-outline` - 生成故事大纲
- `POST /api/novel/generate-chapter` - 生成章节内容
- `POST /api/novel/character` - 创建/描述角色
- `GET /api/novel/projects` - 列出用户项目
- `POST /api/novel/projects` - 创建新项目
- `GET/PUT/DELETE /api/novel/projects/:id` - CRUD 操作

### 3.3 工作流编排

#### 功能
- 拖拽式工作流构建器
- 预置节点类型：音乐、小说、图像、文本
- 节点间的连接线
- 带进度跟踪的工作流执行
- 保存/加载工作流模板

#### 节点类型
- **输入节点**: 用户输入入口
- **LLM 节点**: AI 文本处理
- **音乐节点**: 音乐生成
- **输出节点**: 最终输出/显示

#### 组件
- `WorkflowCanvas`: 带平移/缩放的主画布
- `NodePalette`: 可拖拽节点库
- `NodeEditor`: 选中节点配置面板
- `ConnectionLine`: 节点间 SVG 贝塞尔曲线
- `WorkflowToolbar`: 保存、加载、运行控制

#### API 端点
- `GET /api/workflows` - 列出保存的工作流
- `POST /api/workflows` - 保存新工作流
- `GET /api/workflows/:id` - 获取工作流详情
- `PUT /api/workflows/:id` - 更新工作流
- `DELETE /api/workflows/:id` - 删除工作流
- `POST /api/workflows/:id/execute` - 执行工作流

---

## 4. UI/UX 规格

### 布局结构
- **侧边栏导航**: 固定左侧（移动端可折叠）
- **主内容区**: 基于路由的动态内容
- **顶部栏**: 主题切换和用户菜单

### 导航结构
```
/ (首页/仪表盘)
├── /music (AI 音乐创作)
│   ├── /music/new (新建歌词项目)
│   └── /music/:id (编辑现有项目)
/novel (AI 小说写作)
├── /novel/new (新建小说项目)
├── /novel/:id (编辑小说)
/workflows (工作流编排)
├── /workflows/new (新建工作流)
└── /workflows/:id (编辑工作流)
```

### 视觉设计

#### 配色方案
**浅色模式**
- 主色: #6366F1 (Indigo-500)
- 主色悬停: #4F46E5 (Indigo-600)
- 次要色: #8B5CF6 (Violet-500)
- 强调色: #EC4899 (Pink-500)
- 背景: #FAFAFA (Gray-50)
- 表面: #FFFFFF
- 主文本: #1F2937 (Gray-800)
- 次要文本: #6B7280 (Gray-500)
- 边框: #E5E7EB (Gray-200)

**深色模式**
- 主色: #818CF8 (Indigo-400)
- 主色悬停: #6366F1 (Indigo-500)
- 次要色: #A78BFA (Violet-400)
- 强调色: #F472B6 (Pink-400)
- 背景: #0F172A (Slate-900)
- 表面: #1E293B (Slate-800)
- 主文本: #F1F5F9 (Slate-100)
- 次要文本: #94A3B8 (Slate-400)
- 边框: #334155 (Slate-700)

#### 字体排版
- 字体: Inter, system-ui, sans-serif
- 标题 1: 2.25rem (36px), 字重 700
- 标题 2: 1.875rem (30px), 字重 600
- 标题 3: 1.5rem (24px), 字重 600
- 正文: 1rem (16px), 字重 400
- 小字: 0.875rem (14px), 字重 400

#### 间距系统
- 基础单位: 4px
- 外边距: 16px, 24px, 32px, 48px
- 内边距: 8px, 12px, 16px, 24px
- 圆角: 8px (卡片), 6px (按钮), 4px (输入框)

#### 视觉效果
- 卡片阴影 (浅色): 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
- 卡片阴影 (深色): 0 1px 3px rgba(0,0,0,0.3)
- 悬停过渡: 150ms ease-in-out
- 页面过渡: 淡入 200ms

### 响应式断点
- 移动端: < 640px (单列，汉堡菜单)
- 平板: 640px - 1024px (可折叠侧边栏)
- 桌面: > 1024px (完整侧边栏)

---

## 5. 组件规格

### 通用组件

#### 按钮
- 变体: primary, secondary, outline, ghost
- 尺寸: sm (32px), md (40px), lg (48px)
- 状态: default, hover, active, disabled, loading

#### 输入框/文本域
- 状态: default, focus, error, disabled
- 文本域显示字符计数
- 有内容时显示清除按钮

#### 卡片
- 内边距: 24px
- 圆角: 8px
- 交互卡片悬停时显示阴影

#### 模态框/对话框
- 居中叠加 + 背景模糊
- 右上角关闭按钮
- ESC 键关闭

#### Toast 通知
- 位置: 右下角
- 自动消失: 5 秒
- 类型: success, error, warning, info

### 功能特定组件

#### LyricsEditor
- 行号
- 歌曲结构标记语法高亮 [Verse], [Chorus] 等
- 拖拽排序
- 行内编辑

#### ConversationPanel
- 消息气泡 (用户: 右侧, AI: 左侧)
- 每条消息带时间戳
- AI 消息的"改进"快捷操作

#### MusicPlayer
- 播放/暂停按钮
- 可拖动进度条
- 音量控制
- 当前时间/总时长
- 波形可视化 (可选)
- **视图切换**：播放器视图 / 歌词同步视图

#### VersionTimeline
- 水平时间线展示版本历史
- 版本节点：当前版本高亮、已批准版本特殊标记
- 悬停预览首行歌词
- 点击切换版本 / 回滚按钮

#### VersionDiffModal
- 模态对话框左右对比两版本
- 差异行高亮：删除（红色）、新增（绿色）、修改（橙色）
- 一键回滚到任一版本

#### LyricsSyncViewer
- LRC 格式歌词解析（自动估算每行时间）
- 当前行高亮 + 自动滚动
- 点击行跳转播放位置
- 快捷跳转按钮（上/下一行）

#### WorkflowCanvas
- 无限画布 (鼠标拖拽平移)
- 缩放控制 (滚轮)
- 网格背景
- 右下角小地图

#### NodePalette
- 分类区域
- 拖拽预览
- 悬停提示

---

## 6. API 规格

### 基础 URL
- 开发环境: `http://localhost:3001/api`

### 认证
- 当前无认证 (未来: JWT)

### 请求/响应格式
- Content-Type: application/json
- 响应包含 success/error 结构

### 端点汇总

#### 音乐 API
| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /music/lyrics | 生成或优化歌词 |
| POST | /music/generate | 从歌词生成音乐 |
| GET | /music/status/:jobId | 获取生成任务状态 |
| GET | /music/download/:filename | 下载音频文件 |

#### 小说 API
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /novel/projects | 列出所有小说项目 |
| POST | /novel/projects | 创建新项目 |
| GET | /novel/projects/:id | 获取项目详情 |
| PUT | /novel/projects/:id | 更新项目 |
| DELETE | /novel/projects/:id | 删除项目 |
| POST | /novel/generate-outline | 生成故事大纲 |
| POST | /novel/generate-chapter | 生成章节内容 |

#### 工作流 API
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | /workflows | 列出所有工作流 |
| POST | /workflows | 创建新工作流 |
| GET | /workflows/:id | 获取工作流详情 |
| PUT | /workflows/:id | 更新工作流 |
| DELETE | /workflows/:id | 删除工作流 |
| POST | /workflows/:id/execute | 执行工作流 |

---

## 7. 数据模型

### MusicProject
```typescript
{
  id: string;
  title: string;
  theme: string;
  mood: string;
  genre: string;
  lyrics: {
    content: string;          // 当前歌词内容
    version: number;           // 当前版本号
    updatedAt: Date;
  };
  // ============ 版本管理（前端扩展）===========
  lyricsVersions: Array<{
    id: string;               // 版本唯一ID
    content: string;           // 歌词内容
    timestamp: string;         // ISO 时间戳
    description: string;        // 版本描述
    isApproved: boolean;      // 是否已确认
  }>;
  currentVersionIndex: number; // 当前版本索引
  // ==========================================
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  status: 'lyrics' | 'generating' | 'completed' | 'failed';
  audioFile?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### NovelProject
```typescript
{
  id: string;
  title: string;
  genre: string;
  premise: string;
  outline: string[];
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
  }>;
  characters: Array<{
    id: string;
    name: string;
    description: string;
    traits: string[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Workflow
```typescript
{
  id: string;
  name: string;
  description: string;
  nodes: Array<{
    id: string;
    type: 'input' | 'llm' | 'music' | 'output';
    position: { x: number; y: number };
    config: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 8. MiniMax API 集成

### mmx CLI 用法
```bash
# 从歌词生成音乐
mmx music generate --lyrics "歌词内容" --prompt "风格描述" --out output.mp3

# 查看生成状态
mmx music status --job-id xxx
```

### 直接 API (备用)
```typescript
POST https://api.minimaxi.chat/v1/music_generation
Headers:
  Authorization: Bearer <API_KEY>
  Content-Type: application/json
Body:
{
  "model": "music-2.6",
  "lyrics": "...",
  "prompt": "...",
  "mode": "lyrics_optimizer"
}
```

---

## 9. 文件结构

```
/home/shawnight/项目工作/ai-workshop/
├── SPEC.md
├── README.md
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── components/
│       │   ├── ui/ (shadcn 组件)
│       │   ├── common/
│       │   ├── music/
│       │   ├── novel/
│       │   └── workflow/
│       ├── pages/
│       ├── store/ (Zustand stores)
│       ├── hooks/
│       ├── utils/
│       └── api/
└── backend/
    ├── app.py           # Flask 主应用
    ├── requirements.txt # Python 依赖
    ├── .env.example     # 环境变量示例
    ├── routes/          # API 路由 (Python)
    ├── services/        # 业务逻辑
    └── uploads/         # 音频文件存储
```

---

## 10. 验收标准

### 核心功能
- [x] 用户可输入主题并生成初始歌词
- [x] 用户可通过多轮对话优化歌词
- [x] 用户可确认歌词并触发音乐生成
- [x] 用户可预览和下载生成的音乐
- [x] 用户可创建和管理小说项目
- [x] 用户可构建拖拽式工作流
- [x] 工作流节点可连接和执行
- [x] **歌词版本管理**：自动保存版本历史，支持版本对比和回滚
- [x] **实时歌词同步**：播放时歌词逐行高亮同步，支持点击跳转

### UI/UX
- [ ] 深色/浅色模式切换正常
- [ ] 侧边栏在移动端可折叠
- [ ] 所有交互元素有悬停/聚焦状态
- [ ] 异步操作显示加载状态
- [ ] 成功/错误显示 Toast 通知

### 技术
- [ ] 前端构建无错误
- [ ] 后端启动无错误
- [ ] API 调用返回预期响应
- [ ] MiniMax 集成可用 (需有效 API key)
- [ ] 响应式设计在移动端正常

### 性能
- [ ] 首屏加载 < 3 秒
- [ ] 拖拽流畅 (60fps)
- [ ] 长时间使用无内存泄漏
