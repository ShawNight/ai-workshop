# 章节概要自动适配 & 实体提取 设计规格

## 问题分析

### 问题 1：大纲与正文脱节

- 大纲生成后，章节内容独立创作，大纲标题/概要从不随正文改变
- 后续章节大纲可能提到前面章节已覆盖的情节，造成剧情重复
- `context_builder` 只传前一章尾文和章节概要标题清单，没有传达「后续大纲中哪些情节已被覆盖」

### 问题 2：新实体无法沉淀

- AI 生成章节时会自然引入新角色/新地点，但仅存在于正文文本中
- 续写下一章时，`settings_context` 只扫描 `characters`/`locations` 列表，无法识别正文提及但未入库的新实体
- 目前没有「从正文提取实体」的能力

## 方案概述

采用「自动提炼 + 手动确认」模式：

1. 生成/续写章节时，AI 自动附带**概要建议**（title + description），用户审阅后一键采纳同步回大纲
2. 章节写完后，用户可触发**实体提取**，从正文中识别新角色和新地点，以审阅卡片形式供编辑/采纳/丢弃
3. 上下文构建增加去重能力，将已写章节的实际概要传递给后续章节生成，避免情节重复

## 后端设计

### 新增端点：`POST /extract-entities`

从正文提取新角色和地点，对比已有列表避免重复。

**请求**：
```json
{
  "content": "章节正文（纯文本）",
  "existingCharacters": [{ "name": "林昊", "role": "主角" }],
  "existingLocations": [{ "name": "凌霄城", "type": "city" }],
  "genre": "玄幻",
  "premise": "故事前提"
}
```

**响应**：
```json
{
  "success": true,
  "characters": [
    {
      "name": "赵霜寒",
      "role": "反派",
      "description": "冷酷的暗卫首领",
      "traits": ["冷酷", "聪明"],
      "appearance": "面容冷峻，黑袍加身",
      "backstory": "曾是天才少年，因遭遇不公而走向黑暗"
    }
  ],
  "locations": [
    {
      "name": "幽冥谷",
      "type": "wilderness",
      "description": "终年雾气弥漫的深谷",
      "significance": "主角觉醒力量的地方"
    }
  ]
}
```

### 修改端点：`/generate-chapter` 和 `/continue-chapter`

响应中追加 `summarySuggestion` 字段：

```json
{
  "success": true,
  "content": "正文内容...",
  "summarySuggestion": {
    "title": "第三章：暗流涌动",
    "description": "林昊在凌霄城发现密室，赵霜寒暗中观察..."
  }
}
```

实现方式：正文生成后，追加一次低温度（temperature=0.3）的 LLM 调用提取概要。如果提取失败，`summarySuggestion` 为 `null`，不影响主流程。

### 改进：`context_builder.py` 去重增强

当前 `summary_parts` 只用大纲 title+description。改为：

- 优先使用章节自身的 `description`（已被用户确认更新的、反映实际内容的概要）
- 如果章节有正文内容，在摘要中标记 `[已写]`，让 AI 知道这些情节已覆盖
- 对后续未写章节的大纲概要也传入，但标记为 `[未写]`，让 AI 知道哪些情节还未展开

改进后的摘要格式：
```
第1章「序幕拉开」[已写]：林昊在凌霄城发现密室，赵霜寒暗中观察...
第2章「踏入未知」[已写]：主角离开凌霄城进入荒原...
第3章「初次考验」[未写]：主角遭遇第一次重大挫折...
```

### 新增提示词模板

#### `extract_summary.j2`

```
---SYSTEM---
你是一位小说编辑，擅长从正文中提炼精准的章节概要。
---USER---
故事类型：{{ genre }}
章节原标题：{{ chapter_title }}

以下是本章正文内容：

{{ content }}

请提炼本章的概要信息，返回 JSON：
{
  "title": "精炼的章节标题（含章节序号）",
  "description": "50-80字的章节概要，包含核心情节、转折和关键角色"
}

只返回 JSON，不要其他内容。
```

#### `extract_entities.j2`

```
---SYSTEM---
你是一位小说数据分析专家，擅长从正文中识别人物和地点。
---USER---
故事类型：{{ genre }}
故事前提：{{ premise }}

已有角色（不要重复）：{{ existing_character_names }}
已有地点（不要重复）：{{ existing_location_names }}

以下是本章正文内容：

{{ content }}

请从中提取新出现的有意义的角色和地点，返回 JSON：
{
  "characters": [
    {
      "name": "角色名",
      "role": "主角/配角/反派/导师/盟友",
      "description": "20-50字描述",
      "traits": ["性格特征1", "特征2"],
      "appearance": "外貌描述",
      "backstory": "背景故事（如有线索）"
    }
  ],
  "locations": [
    {
      "name": "地点名",
      "type": "city/wilderness/building/other",
      "description": "20-50字描述",
      "significance": "剧情意义"
    }
  ]
}

注意：
- 只提取在正文中实际出场或有明确描写的角色和地点
- 不要重复已有角色和地点
- 一笔带过的路人不需要提取
- 只返回 JSON
```

## 前端设计

### API 层

`frontend/src/api/index.js` 新增：

```js
extractEntities: (data) => api.post('/novel/extract-entities', data),
```

### 新组件：`SummarySuggestion.jsx`

概要建议卡片，在生成章节后显示：

```
┌────────────────────────────────────┐
│ 📝 AI 建议更新章节概要              │
│                                    │
│ 标题：第三章：暗流涌动              │
│ 概要：林昊在凌霄城发现密室...       │
│                                    │
│ [编辑] [采纳更新] [忽略]            │
└────────────────────────────────────┘
```

功能：
- 显示 AI 建议的 title + description
- 「编辑」→ 内联编辑 title/description
- 「采纳更新」→ 更新 `chapters[idx].title`、`chapters[idx].description` 和 `outline[idx]`
- 「忽略」→ 关闭卡片

内联编辑时 title 和 description 为可编辑的 input/textarea，确认后更新。

### 新组件：`EntityExtractor.jsx`

实体提取与审阅面板：

```
┌────────────────────────────────────┐
│ 👥 发现 2 个新角色 · 📍 发现 1 个新地点 │
│                                    │
│ □ 赵霜寒 — 冷酷的暗卫首领          │
│   [编辑] [查看详情]                │
│ □ 老陈 — 神秘的老者               │
│                                    │
│ □ 幽冥谷 — 终年雾气弥漫的深谷      │
│                                    │
│ [全部采纳] [忽略]                   │
└────────────────────────────────────┘
```

功能：
- 勾选要采纳的角色/地点
- 「编辑」→ 内联编辑各字段
- 「查看详情」→ 展开完整信息（traits, appearance, backstory 等）
- 「全部采纳」→ 将勾选项追加到 `project.characters` / `project.locations`
- 「忽略」→ 关闭面板

### 写作页面集成

**ChapterWritePage.jsx** 和 **NovelEditorPage.jsx**：

1. 生成/续写章节后，如果响应包含 `summarySuggestion`，显示 `SummarySuggestion` 卡片
2. 生成/续写章节后，显示「提取角色/地点」按钮
3. 点击按钮 → 调用 `/extract-entities` → 显示 `EntityExtractor` 面板
4. 采纳概要 → 调用 `updateProject` 更新 chapters 和 outline
5. 采纳实体 → 调用 `updateProject` 追加 characters / locations

### 数据流

```
/generate-chapter 或 /continue-chapter
  → 返回 { content, summarySuggestion }

/extract-entities
  → 返回 { characters: [...], locations: [...] }

前端:
  生成章节 → 展示概要建议卡片 → 用户采纳 → 更新 outline + chapters
  生成章节 → 展示「提取实体」按钮 → 用户点击 → 调用 /extract-entities → 展示审阅卡片 → 采纳 → 更新 characters/locations
```

## 实现范围

| 改动 | 文件 |
|------|------|
| 新提示词模板 | `backend/prompts/novel/extract_summary.j2` |
| 新提示词模板 | `backend/prompts/novel/extract_entities.j2` |
| 新增端点 | `backend/routes/novel.py` — `/extract-entities` |
| 修改端点 | `backend/routes/novel.py` — `/generate-chapter`、`/continue-chapter` 追加 `summarySuggestion` |
| 改进上下文 | `backend/utils/context_builder.py` — 已写/未写标记 |
| 前端 API | `frontend/src/api/index.js` — 新增 `extractEntities` |
| 概要建议卡片 | `frontend/src/components/novel/SummarySuggestion.jsx`（新） |
| 实体审阅面板 | `frontend/src/components/novel/EntityExtractor.jsx`（新） |
| 写作页面集成 | `ChapterWritePage.jsx`、`NovelEditorPage.jsx` |
| 数据库 | 无需改动（实体存入 JSON 字段） |

## AGENTS.md 更新要点

- 新增 `/extract-entities` 端点说明
- `generate-chapter` / `continue-chapter` 响应新增 `summarySuggestion` 字段
- 上下文构建增加已写/未写标记
- 前端组件归属新增 `SummarySuggestion`、`EntityExtractor`