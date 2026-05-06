# 小说创作功能优化设计文档

> 日期: 2026-05-06
> 策略: 渐进式打磨
> 目标场景: 长篇连载（5万字+）

## 背景

当前项目小说创作功能存在以下核心问题：
1. 无自动保存，数据丢失风险高
2. AI 续写仅发送500字上下文，长篇写作连贯性差
3. 全项目全量保存，长篇每次保存传输量大
4. 章节无法排序
5. 6处前端重复代码
6. LLM参数硬编码，不同场景无法调优

## Phase 1: 写作安全 + 上下文连贯

### 1.1 自动保存 + 防抖

**当前问题**: `ChapterWritePage` 中 `autoSaveTimer` ref 已声明但未使用。内容变更标记 `unsaved` 但需手动点击保存。

**改进方案**:
- 新建 `frontend/src/hooks/useAutoSave.js`
- 整合现有 `useSave` + `markUnsaved` 逻辑
- 内容变更后 **3秒防抖**自动触发保存
- 保存时同时调用 `novelApi.saveDraft()` 创建版本
- 页面 `beforeunload` 事件：若 `isEditorDirty` 则弹出确认
- 工具栏实时显示保存状态（`saved | saving | unsaved | error`）

**实现要点**:
- `useAutoSave(projectId, chapterId, currentProject, { debounceMs: 3000 })` 
- 返回 `{ saveStatus, lastSavedAt, saveNow }`
- 内部使用 `useRef` 存储防抖计时器
- 在 `NovelEditorPage` 和 `ChapterWritePage` 中替换现有 `useSave` 调用

### 1.2 跨章节上下文连贯

**当前问题**: 
- `generate_chapter` 仅接收 `previousContent`（上一章内容）
- `continue_chapter` 仅发送最后500字
- 长篇写到第10章时，AI 完全不知道第1-8章发生了什么

**改进方案: 三级上下文策略**

| 层级 | 内容 | 作用 |
|------|------|------|
| 摘要层 | 最近5章的标题+描述+大纲要点（~500字） | 提供故事脉络和剧情走向 |
| 前文层 | 上一章最后1500字 | 保持行文风格和细节衔接 |
| 设定层 | 角色摘要+关系+地点摘要 | 确保人设和世界观一致 |

**具体实现**:

后端新增 `build_chapter_context(project_data, current_chapter_index)` 函数：
- 提取当前章节前的所有章节信息
- 当章节数 ≤ 3 时，发送全部前文
- > 3 时：近3章发内容摘要，更早章节仅发标题+描述
- 角色筛选：仅传入出现在当前及最近3章中提到的角色
- 关系筛选：仅传入涉及筛选角色的关系
- 地点筛选：仅传入最近5章提及的地点

修改 `generate_chapter` 和 `continue_chapter` 端点：
- 参数从 `previousContent: string` 变为结构化上下文
- 在 prompt 模板中使用新的上下文结构

### 1.3 Token 预算管理

**新增工具函数**: `backend/utils/token_budget.py`

```python
def estimate_tokens(text):
    """估算中文文本的token数，约1.5字/token"""
    return int(len(text) / 1.5)

def allocate_context_budget(total_budget=6000, summary_ratio=0.25, prev_ratio=0.50, setting_ratio=0.25):
    """按比例分配token预算"""
    return {
        'summary': int(total_budget * summary_ratio),
        'previous': int(total_budget * prev_ratio),
        'setting': int(total_budget * setting_ratio)
    }
```

- 预留 ~2000 tokens 给输出
- 剩余 ~6000 tokens 按比例分配给三级上下文
- 超出预算时优先保留近3章上下文，裁剪更早章节摘要

### 1.4 增量章节保存

**当前问题**: 每次保存发送整个项目（含所有章节内容），长篇5万+字时传输量大。

**改进方案**:

后端新增端点：
```
PUT /api/novel/projects/<id>/chapters/<chapterId>
Body: { content, title, wordCount }
```
- 仅更新指定章节，其他数据不变
- 自动更新 `updated_at` 和 `current_word_count`

前端修改：
- `useAutoSave` 保存时判断变更范围
- 若仅章节内容变更，调用增量端点
- 若关键词段（标题、设定等）变更，仍用全量更新

### 1.5 提示词模板更新

**`continue.j2`**: 上下文从500字扩展为结构化三级上下文

**修改前**:
```
当前内容：{{ current_content[-500:] }}
```

**修改后** (伪代码):
```
{% if recent_summaries %}
前文概要：
{% for s in recent_summaries %}
第{{ s.index }}章 {{ s.title }}：{{ s.description }}
{% endfor %}
{% endif %}

最近前文：
{{ previous_content }}

故事设定：
{% for c in characters %}{{ c.name }}({{ c.role }})：{{ c.traits }}{% endfor %}
```

**`chapter.j2`**: 新增 `recent_chapters_summary` 和 `current_outline` 变量

## Phase 2: 写作体验增强

### 2.1 章节排序

- 大纲 Tab 每行增加 ▲▼ 上下移动按钮
- 移动后重排 `outline` 数组序号（`order` 字段）
- 章节在 `chapters` 数组中同步重排
- `markUnsaved()` 触发自动保存

### 2.2 灵感笔记面板

**数据模型**: 在 `novel_projects` 表新增 `notes TEXT DEFAULT '[]'` 字段

```json
[
  {
    "id": "uuid",
    "type": "brainstorm" | "idea" | "research",
    "content": "...",
    "chapterId": "optional-link-to-chapter",
    "createdAt": "timestamp"
  }
]
```

**UI 组件**: 
- 编辑器右下角灵感浮动按钮（类似 FAB）
- 点击展开右侧抽屉面板
- 头脑风暴结果默认写入笔记而非插入正文
- 支持从笔记复制到正文
- 可关联到特定章节

### 2.3 版本 Diff 对比

- 安装 `diff-match-patch` 或使用轻量 `jsdiff` 库
- 版本历史增加「对比」模式
- 选中两个版本后，渲染 HTML → 纯文本 → diff → 彩色显示
- 新增内容绿色高亮，删除内容红色高亮

### 2.4 键盘快捷键

| 快捷键 | 功能 | 位置 |
|--------|------|------|
| `Ctrl+S` | 保存 | 编辑器页面 |
| `Ctrl+Enter` | AI 续写 | 编辑器页面 |
| `Ctrl+Shift+G` | AI 生成章节 | 大纲页面 |
| `Ctrl+Shift+B` | 打开头脑风暴 | 编辑器页面 |
| `Ctrl+Shift+H` | 切换侧边栏 | 编辑器页面 |

使用 `useHotkeys` hook 封装，新建 `frontend/src/hooks/useHotkeys.js`

## Phase 3: AI 生成质量

### 3.1 参数化 LLM 调用

**修改**: `generate_with_llm()` 增加 `temperature` 和 `max_tokens` 参数

```python
def generate_with_llm(system_prompt, user_prompt, temperature=0.7, max_tokens=4096):
```

各端点参数配置：

| 端点 | temperature | max_tokens |
|------|-------------|-------------|
| generate_chapter | 0.7 | 4096 |
| continue_chapter | 0.7 | 4096 |
| generate_outline | 0.7 | 2048 |
| generate_outline_directions | 0.8 | 2048 |
| brainstorm | 0.9 | 2048 |
| rewrite | 0.5 | 2048 |
| character/location | 0.7 | 1024 |
| chat | 0.7 | 2048 |

### 3.2 提示词修复

- `chat_relation.j2`: 补充 `{{ genre }}` 和 `{{ premise }}` 上下文
- `brainstorm.j2`: 增加 `keyPoints` 字段，与 `outline_directions.j2` 输出格式对齐
- `chapter.j2`: 增加语言适配指令（`请使用与{{ writing_style }}风格一致的中文输出`）
- `continue.j2`: 使用三级上下文替代 500 字截断
- 所有模板: 增加 `[语言]` 动态指令，根据项目 `genre` 或 `writing_style` 推断

### 3.3 智能内容截断

新增 `backend/utils/truncation.py`:

```python
def smart_truncate(text, max_tokens, preserve_first=True, preserve_last=True):
    """按段落边界截断内容，保留首尾段落"""
    paragraphs = text.split('\n')
    # ... 按优先级裁剪中间段落
```

- 优先保留首段 + 尾段
- 按段落边界截断，不拆段
- 中间段落按信息密度（角色对话/关键事件描述优先）筛选

## Phase 4: 代码质量

### 4.1 重复代码提取

| 当前重复 | 提取为 | 位置 |
|----------|--------|------|
| `formatAIContent` (2处) | `formatContent.js` | `frontend/src/utils/` |
| `handleGenerate/Continue/Rewrite` (2处) | `useChapterActions.js` | `frontend/src/hooks/` |
| `performSave + saveDraft` (2处) | `useAutoSave.js` | `frontend/src/hooks/` |
| UUID生成 (5+处) | `uuid.js` | `frontend/src/utils/` |
| mock提示逻辑 (8+处) | `handleMockResponse.js` | `frontend/src/utils/` |

### 4.2 常量统一

新建 `frontend/src/constants/novel.js`:

```javascript
export const PROJECT_STATUS = {
  PLANNING: 'planning',
  WRITING: 'writing',
  COMPLETED: 'completed'
}

export const RELATIONSHIP_TYPES = [
  { value: 'friend', label: '朋友', icon: '🤝' },
  { value: 'love', label: '恋人', icon: '❤️' },
  // ...
]

export const LOCATION_TYPES = [
  { value: 'city', label: '城市', icon: '🏙️' },
  // ...
]
```

### 4.3 确认弹窗组件

- 新建 `frontend/src/components/ui/ConfirmDialog.jsx`
- 复用已有 `Modal` 组件
- 替换所有 `window.confirm()` 调用（项目删除、角色删除、地点删除、章节删除）

## 实施顺序

| 阶段 | 工作量估算 | 依赖 |
|------|-----------|------|
| Phase 1.1 自动保存 | 1-2天 | 无 |
| Phase 1.2-1.5 上下文连贯 | 2-3天 | Phase 1.1 |
| Phase 2.1 章节排序 | 0.5天 | 无 |
| Phase 2.2 灵感笔记 | 1-2天 | Phase 1.1 |
| Phase 2.3 版本Diff | 1天 | 无 |
| Phase 2.4 快捷键 | 0.5天 | 无 |
| Phase 3.1-3.3 AI质量 | 1-2天 | Phase 1.2 |
| Phase 4.1-4.3 代码清理 | 1-2天 | Phase 1.1 |

各 Phase 可并行推进，建议按依赖关系排序开始。