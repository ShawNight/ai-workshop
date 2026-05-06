# 章节概要自动适配 & 实体提取 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 章节生成后自动提炼概要建议、手动确认同步大纲；从正文中提取新角色/地点，审阅后入库；改进上下文构建避免情节重复。

**Architecture:** 后端新增 `/extract-entities` 端点和 `/generate-chapter`、`/continue-chapter` 追加 `summarySuggestion` 字段；前端新增 `SummarySuggestion` 和 `EntityExtractor` 组件，集成到写作页面；`context_builder.py` 增加已写/未写标记。

**Tech Stack:** Python/Flask (后端), React 19/Zustand/TipTap (前端), Jinja2 (提示词模板)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `backend/prompts/novel/extract_summary.j2` | 概要提取提示词 |
| Create | `backend/prompts/novel/extract_entities.j2` | 实体提取提示词 |
| Modify | `backend/routes/novel.py` | 新增 `/extract-entities`，修改 `/generate-chapter`、`/continue-chapter` |
| Modify | `backend/utils/context_builder.py` | 增加已写/未写标记，使用章节 description |
| Modify | `frontend/src/api/index.js` | 新增 `extractEntities` API 方法 |
| Create | `frontend/src/components/novel/SummarySuggestion.jsx` | 概要建议卡片组件 |
| Create | `frontend/src/components/novel/EntityExtractor.jsx` | 实体审阅面板组件 |
| Modify | `frontend/src/pages/ChapterWritePage.jsx` | 集成概要建议和实体提取 |
| Modify | `frontend/src/pages/NovelEditorPage.jsx` | 集成概要建议和实体提取 |
| Modify | `frontend/src/hooks/useChapterActions.js` | 处理 `summarySuggestion` 新字段 |
| Modify | `AGENTS.md` | 更新端点文档和组件归属 |

---

### Task 1: 提示词模板 — extract_summary.j2 和 extract_entities.j2

**Files:**
- Create: `backend/prompts/novel/extract_summary.j2`
- Create: `backend/prompts/novel/extract_entities.j2`

- [ ] **Step 1: 创建 extract_summary.j2**

```jinja2
---SYSTEM---
你是一位小说编辑，擅长从正文中提炼精准的章节概要。
---USER---
故事类型：{{ genre }}
章节原标题：{{ chapter_title }}

以下是本章正文内容：

{{ content }}

请提炼本章的概要信息，返回 JSON：
{
  "title": "精炼的章节标题（保留章节序号，如"第三章：暗流涌动"）",
  "description": "50-80字的章节概要，包含核心情节、转折和关键角色"
}

只返回 JSON，不要其他内容。
```

- [ ] **Step 2: 创建 extract_entities.j2**

```jinja2
---SYSTEM---
你是一位小说数据分析专家，擅长从正文中识别人物和地点。
---USER---
故事类型：{{ genre }}
故事前提：{{ premise }}

已有角色（不要重复提取）：{{ existing_character_names }}
已有地点（不要重复提取）：{{ existing_location_names }}

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

- [ ] **Step 3: 验证模板加载**

```bash
cd /home/xy666/projects/ai-workshop/backend && source .venv/bin/activate && python -c "from prompts import render; print(render('novel/extract_summary.j2', genre='玄幻', chapter_title='第一章', content='测试内容'))"
```

预期：输出包含 SYSTEM 和 USER 两个键的字典

- [ ] **Step 4: 提交**

```bash
git add backend/prompts/novel/extract_summary.j2 backend/prompts/novel/extract_entities.j2 && git commit -m "功能: 新增概要提取和实体提取提示词模板"
```

---

### Task 2: 后端 — 新增 /extract-entities 端点

**Files:**
- Modify: `backend/routes/novel.py`

- [ ] **Step 1: 在 novel.py 底部（统计和草稿之前）新增端点**

在 `# ==================== 统计和草稿 ====================` 之前插入：

```python
@novel_bp.route("/extract-entities", methods=["POST"])
def extract_entities():
    """从正文中提取新角色和地点"""
    data = request.get_json()
    content = data.get("content", "")
    existing_characters = data.get("existingCharacters") or []
    existing_locations = data.get("existingLocations") or []
    genre = data.get("genre", "通用")
    premise = data.get("premise", "")

    if not content:
        return jsonify({"success": False, "error": "请提供章节内容"}), 400

    existing_char_names = "、".join(c.get("name", "") for c in existing_characters if c.get("name")) or "无"
    existing_loc_names = "、".join(l.get("name", "") for l in existing_locations if l.get("name")) or "无"

    prompts = render('novel/extract_entities.j2',
        genre=genre,
        premise=premise or "未指定",
        content=content[:3000],
        existing_character_names=existing_char_names,
        existing_location_names=existing_loc_names)

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.3, max_tokens=LLM_MAX_TOKENS_SHORT)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        parsed = parse_json_from_response(result, r'\{.*\}')
        if parsed and isinstance(parsed, dict):
            characters = parsed.get("characters", [])
            locations = parsed.get("locations", [])
            for char in characters:
                char.setdefault("name", "")
                char.setdefault("role", "配角")
                char.setdefault("description", "")
                char.setdefault("traits", [])
                char.setdefault("appearance", "")
                char.setdefault("backstory", "")
            for loc in locations:
                loc.setdefault("name", "")
                loc.setdefault("type", "other")
                loc.setdefault("description", "")
                loc.setdefault("significance", "")
            return jsonify({"success": True, "characters": characters, "locations": locations})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重新提取"})

    except Exception as e:
        return jsonify({"success": False, "error": f"提取实体失败: {str(e)}"}), 500
```

- [ ] **Step 2: 验证后端能正常启动**

```bash
cd /home/xy666/projects/ai-workshop/backend && source .venv/bin/activate && python -c "from routes.novel import novel_bp; print('OK')"
```

- [ ] **Step 3: 提交**

```bash
git add backend/routes/novel.py && git commit -m "功能: 新增 /extract-entities 端点"
```

---

### Task 3: 后端 — generate-chapter 和 continue-chapter 追加 summarySuggestion

**Files:**
- Modify: `backend/routes/novel.py`

- [ ] **Step 1: 新增概要提取辅助函数**

在 `generate_chapter` 端点之前新增：

```python
def _extract_summary(content, chapter_title, genre):
    """从正文中提取概要建议，失败时返回 None（不影响主流程）"""
    try:
        prompts = render('novel/extract_summary.j2',
            genre=genre,
            chapter_title=chapter_title,
            content=content[:2000])
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.3, max_tokens=LLM_MAX_TOKENS_SHORT)
        if result is None:
            return None
        parsed = parse_json_from_response(result, r'\{.*\}')
        if parsed and isinstance(parsed, dict):
            if 'title' in parsed and 'description' in parsed:
                return parsed
        return None
    except Exception:
        return None
```

- [ ] **Step 2: 修改 generate_chapter 端点 — 在 return 之前调用 _extract_summary**

找到 `generate_chapter` 函数中的成功返回行：

```python
return jsonify({"success": True, "content": result})
```

替换为：

```python
        summary_suggestion = _extract_summary(result, chapter_title, genre)
        return jsonify({"success": True, "content": result, "summarySuggestion": summary_suggestion})
```

- [ ] **Step 3: 修改 continue_chapter 端点 — 在 return 之前调用 _extract_summary**

找到 `continue_chapter` 函数中的成功返回行：

```python
        return jsonify({"success": True, "content": result})
```

替换为：

```python
        summary_suggestion = _extract_summary(result, chapter_title, genre)
        return jsonify({"success": True, "content": result, "summarySuggestion": summary_suggestion})
```

- [ ] **Step 4: 验证后端启动**

```bash
cd /home/xy666/projects/ai-workshop/backend && source .venv/bin/activate && python -c "from routes.novel import novel_bp; print('OK')"
```

- [ ] **Step 5: 提交**

```bash
git add backend/routes/novel.py && git commit -m "功能: generate-chapter 和 continue-chapter 追加 summarySuggestion 字段"
```

---

### Task 4: 后端 — context_builder 去重增强（已写/未写标记）

**Files:**
- Modify: `backend/utils/context_builder.py`

- [ ] **Step 1: 修改 build_chapter_context 函数**

将 `summary_parts` 的构建逻辑从：

```python
summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」：{ch.get('description', '')}"
```

改为：

```python
is_written = bool(ch.get('content', '').strip())
status_tag = "[已写]" if is_written else "[未写]"
desc = ch.get('description', '')
if is_written and desc:
    summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」{status_tag}：{desc}"
elif is_written:
    summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」{status_tag}"
else:
    summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」{status_tag}：{ch.get('description', '')}"
```

找到原代码片段：

```python
        summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」：{ch.get('description', '')}"
```

替换为上面的 `is_written` 逻辑。

- [ ] **Step 2: 验证**

```bash
cd /home/xy666/projects/ai-workshop/backend && source .venv/bin/activate && python -c "from utils.context_builder import build_chapter_context; print('OK')"
```

- [ ] **Step 3: 提交**

```bash
git add backend/utils/context_builder.py && git commit -m "功能: 上下文构建增加已写/未写标记，避免剧情重复"
```

---

### Task 5: 前端 API — 新增 extractEntities 方法

**Files:**
- Modify: `frontend/src/api/index.js`

- [ ] **Step 1: 在 novelApi 对象中新增方法**

在 `novelApi` 对象的方法列表末尾（`saveDraft` 之后）新增：

```js
extractEntities: (data) => api.post('/novel/extract-entities', data),
```

- [ ] **Step 2: 验证构建**

```bash
cd /home/xy666/projects/ai-workshop/frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/api/index.js && git commit -m "功能: 前端 API 新增 extractEntities 方法"
```

---

### Task 6: 前端 — useChapterActions hook 处理 summarySuggestion

**Files:**
- Modify: `frontend/src/hooks/useChapterActions.js`

- [ ] **Step 1: 修改 hook 返回值结构，新增 suggestion 状态**

在 hook 顶部新增状态：

```js
const [suggestion, setSuggestion] = useState(null);
```

在 `import` 行更新：`import { useCallback, useState } from 'react';`

- [ ] **Step 2: 修改 generateChapter — 处理 summarySuggestion**

找到 `generateChapter` 中的成功处理块：

```js
if (res.data.success) {
    const formatted = formatAIContent(res.data.content);
    const updatedChapters = (project.chapters || []).map((c) =>
      c.id === chId ? { ...c, content: formatted } : c
    );
    updateProject(project.id, { chapters: updatedChapters });
    markUnsaved();
    toast.success('章节生成成功');
}
```

替换为：

```js
if (res.data.success) {
    const formatted = formatAIContent(res.data.content);
    const updatedChapters = (project.chapters || []).map((c) =>
      c.id === chId ? { ...c, content: formatted } : c
    );
    updateProject(project.id, { chapters: updatedChapters });
    markUnsaved();
    toast.success('章节生成成功');
    if (res.data.summarySuggestion) {
      setSuggestion({ ...res.data.summarySuggestion, chapterId: chId, source: 'generate' });
    }
}
```

- [ ] **Step 3: 修改 continueChapter 的续写模式 — 处理 summarySuggestion**

找到 `continueChapter` 续写成功处理块（非 rewrite 模式下的成功块）：

```js
if (res.data.success) {
    const formatted = formatAIContent(res.data.content);
    const newContent = html + formatted;
    const updatedChapters = (project.chapters || []).map((c) =>
      c.id === chId ? { ...c, content: newContent } : c
    );
    updateProject(project.id, { chapters: updatedChapters });
    markUnsaved();
    toast.success('续写完成');
}
```

替换为：

```js
if (res.data.success) {
    const formatted = formatAIContent(res.data.content);
    const newContent = html + formatted;
    const updatedChapters = (project.chapters || []).map((c) =>
      c.id === chId ? { ...c, content: newContent } : c
    );
    updateProject(project.id, { chapters: updatedChapters });
    markUnsaved();
    toast.success('续写完成');
    if (res.data.summarySuggestion) {
      setSuggestion({ ...res.data.summarySuggestion, chapterId: chId, source: 'continue' });
    }
}
```

- [ ] **Step 4: 修改 hook 返回值**

将 `return { generateChapter, continueChapter };` 改为：

```js
return { generateChapter, continueChapter, suggestion, setSuggestion };
```

- [ ] **Step 5: 更新依赖数组**

在 `generateChapter` 和 `continueChapter` 的 `useCallback` 依赖数组中都加上 `setSuggestion`。

- [ ] **Step 6: 验证构建**

```bash
cd /home/xy666/projects/ai-workshop/frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 7: 提交**

```bash
git add frontend/src/hooks/useChapterActions.js && git commit -m "功能: useChapterActions 处理 summarySuggestion 字段"
```

---

### Task 7: 前端 — SummarySuggestion 组件

**Files:**
- Create: `frontend/src/components/novel/SummarySuggestion.jsx`

- [ ] **Step 1: 创建 SummarySuggestion.jsx**

```jsx
import { useState } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { Button } from '../ui/Button';

export function SummarySuggestion({ suggestion, onAccept, onDismiss }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(suggestion.title || '');
  const [editDesc, setEditDesc] = useState(suggestion.description || '');

  if (!suggestion) return null;

  const handleAccept = () => {
    onAccept({
      title: isEditing ? editTitle : suggestion.title,
      description: isEditing ? editDesc : suggestion.description,
    });
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-blue-800 dark:text-blue-300 text-sm">
          📝 AI 建议更新章节概要
        </h4>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={16} />
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-2 mb-3">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 dark:border-gray-600"
            placeholder="章节标题"
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 dark:border-gray-600 resize-none"
            rows={2}
            placeholder="章节概要"
          />
        </div>
      ) : (
        <div className="mb-3 space-y-1">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {suggestion.title}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {suggestion.description}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={handleAccept}>
          <Check size={14} className="mr-1" /> 采纳更新
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)}>
          <Pencil size={14} className="mr-1" /> {isEditing ? '取消编辑' : '编辑'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/novel/SummarySuggestion.jsx && git commit -m "功能: 新增 SummarySuggestion 概要建议卡片组件"
```

---

### Task 8: 前端 — EntityExtractor 组件

**Files:**
- Create: `frontend/src/components/novel/EntityExtractor.jsx`

- [ ] **Step 1: 创建 EntityExtractor.jsx**

```jsx
import { useState } from 'react';
import { UserPlus, MapPin, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { generateId } from '../../utils/formatContent';

export function EntityExtractor({ entities, onAccept, onDismiss }) {
  const [selectedChars, setSelectedChars] = useState(
    (entities.characters || []).map((c) => ({ ...c, _id: generateId(), checked: true }))
  );
  const [selectedLocs, setSelectedLocs] = useState(
    (entities.locations || []).map((l) => ({ ...l, _id: generateId(), checked: true }))
  );
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  if (!entities || ((!entities.characters || entities.characters.length === 0) && (!entities.locations || entities.locations.length === 0))) {
    return null;
  }

  const toggleChar = (id) => {
    setSelectedChars((prev) =>
      prev.map((c) => (c._id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const toggleLoc = (id) => {
    setSelectedLocs((prev) =>
      prev.map((l) => (l._id === id ? { ...l, checked: !l.checked } : l))
    );
  };

  const updateChar = (id, field, value) => {
    setSelectedChars((prev) =>
      prev.map((c) => (c._id === id ? { ...c, [field]: value } : c))
    );
  };

  const updateLoc = (id, field, value) => {
    setSelectedLocs((prev) =>
      prev.map((l) => (l._id === id ? { ...l, [field]: value } : l))
    );
  };

  const handleAcceptAll = () => {
    const chars = selectedChars.filter((c) => c.checked).map(({ _id, checked, ...rest }) => ({ id: generateId(), ...rest }));
    const locs = selectedLocs.filter((l) => l.checked).map(({ _id, checked, ...rest }) => ({ id: generateId(), ...rest }));
    onAccept({ characters: chars, locations: locs });
  };

  const charCount = (entities.characters || []).length;
  const locCount = (entities.locations || []).length;

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-green-800 dark:text-green-300 text-sm">
          {charCount > 0 && <><UserPlus size={14} className="inline mr-1" />发现 {charCount} 个新角色</>}
          {charCount > 0 && locCount > 0 && ' · '}
          {locCount > 0 && <><MapPin size={14} className="inline mr-1" />发现 {locCount} 个新地点</>}
        </h4>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={16} />
        </button>
      </div>

      {selectedChars.length > 0 && (
        <div className="space-y-2 mb-3">
          {selectedChars.map((char) => (
            <div key={char._id} className="bg-white dark:bg-gray-800 rounded border p-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={char.checked}
                  onChange={() => toggleChar(char._id)}
                  className="rounded"
                />
                <span className="text-sm font-medium">{char.name}</span>
                <span className="text-xs text-gray-500">({char.role})</span>
                <span className="text-xs text-gray-400 ml-1">— {char.description}</span>
                <button
                  onClick={() => { setExpandedId(expandedId === char._id ? null : char._id); setEditingId(null); }}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  {expandedId === char._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
              {expandedId === char._id && (
                <div className="mt-2 space-y-1 pl-6 text-xs text-gray-600 dark:text-gray-400">
                  {editingId === char._id ? (
                    <>
                      <div><label className="text-gray-500">定位：</label><input value={char.role} onChange={(e) => updateChar(char._id, 'role', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700" /></div>
                      <div><label className="text-gray-500">描述：</label><input value={char.description} onChange={(e) => updateChar(char._id, 'description', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700" /></div>
                      <div><label className="text-gray-500">外貌：</label><input value={char.appearance || ''} onChange={(e) => updateChar(char._id, 'appearance', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700" /></div>
                      <div><label className="text-gray-500">背景：</label><input value={char.backstory || ''} onChange={(e) => updateChar(char._id, 'backstory', e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700" /></div>
                      <div><label className="text-gray-500">性格：</label><input value={(char.traits || []).join('、')} onChange={(e) => updateChar(char._id, 'traits', e.target.value.split(/[、,]/).map(s => s.trim()).filter(Boolean))} className="w-full px-1 py-0.5 border rounded text-xs bg-white dark:bg-gray-700" /></div>
                    </>
                  ) : (
                    <>
                      {char.appearance && <div>外貌：{char.appearance}</div>}
                      {char.backstory && <div>背景：{char.backstory}</div>}
                      {char.traits && char.traits.length > 0 && <div>性格：{char.traits.join('、')}</div>}
                      <button onClick={() => setEditingId(char._id)} className="text-blue-500 hover:underline mt-1">编辑</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedLocs.length > 0 && (
        <div className="space-y-2 mb-3">
          {selectedLocs.map((loc) => (
            <div key={loc._id} className="bg-white dark:bg-gray-800 rounded border p-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={loc.checked}
                  onChange={() => toggleLoc(loc._id)}
                  className="rounded"
                />
                <span className="text-sm font-medium">{loc.name}</span>
                <span className="text-xs text-gray-500">({loc.type})</span>
                <span className="text-xs text-gray-400 ml-1">— {loc.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={handleAcceptAll}>
          <Check size={14} className="mr-1" /> 全部采纳
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          忽略
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/novel/EntityExtractor.jsx && git commit -m "功能: 新增 EntityExtractor 实体审阅面板组件"
```

---

### Task 9: 前端 — ChapterWritePage 集成概要建议和实体提取

**Files:**
- Modify: `frontend/src/pages/ChapterWritePage.jsx`

- [ ] **Step 1: 导入新组件**

在现有 import 块中新增：

```js
import { SummarySuggestion } from '../components/novel/SummarySuggestion';
import { EntityExtractor } from '../components/novel/EntityExtractor';
```

- [ ] **Step 2: 新增状态**

在组件内的现有 `useState` 声明之后新增：

```js
const [extractedEntities, setExtractedEntities] = useState(null);
```

- [ ] **Step 3: 修改 useChapterActions 解构**

将：

```js
const { generateChapter, continueChapter } = useChapterActions(chapterId);
```

改为：

```js
const { generateChapter, continueChapter, suggestion, setSuggestion } = useChapterActions(chapterId);
```

- [ ] **Step 4: 新增产要采纳和实体采纳处理函数**

在组件内新增：

```js
const handleAcceptSuggestion = ({ title, description }) => {
    if (!currentProject || !suggestion) return;
    const chapterId = suggestion.chapterId;
    const chapters = (currentProject.chapters || []).map((c) => {
      if (c.id !== chapterId) return c;
      return { ...c, title: title || c.title, description: description || c.description };
    });
    const outline = (currentProject.outline || []).map((item, idx) => {
      const chapterIdx = chapters.findIndex((c) => c.id === chapterId);
      if (chapterIdx < 0 || idx !== chapterIdx) return item;
      return { ...item, title: title || item.title, description: description || item.description };
    });
    updateProject(currentProject.id, { chapters, outline });
    markUnsaved();
    setSuggestion(null);
    toast.success('章节概要已更新');
  };

  const handleExtractEntities = async () => {
    if (!currentProject || !chapter) return;
    const plainContent = (chapter.content || '').replace(/<[^>]+>/g, '');
    if (!plainContent.trim()) {
      toast.error('章节内容为空，无法提取');
      return;
    }
    try {
      const res = await novelApi.extractEntities({
        content: plainContent,
        existingCharacters: (currentProject.characters || []).map((c) => ({ name: c.name, role: c.role })),
        existingLocations: (currentProject.locations || []).map((l) => ({ name: l.name, type: l.type })),
        genre: currentProject.genre || '通用',
        premise: currentProject.premise || '',
      });
      if (res.data.success) {
        const chars = res.data.characters || [];
        const locs = res.data.locations || [];
        if (chars.length === 0 && locs.length === 0) {
          toast.info('未发现新的角色或地点');
        } else {
          setExtractedEntities({ characters: chars, locations: locs });
        }
      } else {
        toast.error(res.data.error || '提取失败');
      }
    } catch {
      toast.error('提取实体失败');
    }
  };

  const handleAcceptEntities = ({ characters, locations }) => {
    if (!currentProject) return;
    const updates = {};
    if (characters.length > 0) {
      updates.characters = [...(currentProject.characters || []), ...characters];
    }
    if (locations.length > 0) {
      updates.locations = [...(currentProject.locations || []), ...locations];
    }
    if (Object.keys(updates).length > 0) {
      updateProject(currentProject.id, updates);
      markUnsaved();
      toast.success(`已添加 ${characters.length} 个角色和 ${locations.length} 个地点`);
    }
    setExtractedEntities(null);
  };
```

- [ ] **Step 5: 在编辑器区域内渲染新组件**

在 `<ChapterEditor>` 组件之前（或在编辑器上方的合适位置）插入：

```jsx
{suggestion && (
  <SummarySuggestion
    suggestion={suggestion}
    onAccept={handleAcceptSuggestion}
    onDismiss={() => setSuggestion(null)}
  />
)}
{extractedEntities && (
  <EntityExtractor
    entities={extractedEntities}
    onAccept={handleAcceptEntities}
    onDismiss={() => setExtractedEntities(null)}
  />
)}
```

- [ ] **Step 6: 在工具栏区域新增「提取角色/地点」按钮**

在章节编辑器的工具栏按钮区域（与续写、改写等按钮并列），新增：

```jsx
<button
  onClick={handleExtractEntities}
  className="..."
  title="从正文中提取新角色和地点"
>
  <UserPlus size={16} />
  <span>提取角色</span>
</button>
```

样式与现有工具栏按钮一致（需查看 ChapterEditor 或 ChapterWritePage 中现有按钮的 className）。

- [ ] **Step 7: 确保 novelApi 导入**

已通过 `useChapterActions` 间接使用。直接使用需确认：

```js
import { novelApi } from '../api';
```

- [ ] **Step 8: 验证构建**

```bash
cd /home/xy666/projects/ai-workshop/frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 9: 提交**

```bash
git add frontend/src/pages/ChapterWritePage.jsx && git commit -m "功能: ChapterWritePage 集成概要建议和实体提取"
```

---

### Task 10: 前端 — NovelEditorPage 集成概要建议和实体提取

**Files:**
- Modify: `frontend/src/pages/NovelEditorPage.jsx`

- [ ] **Step 1: 导入新组件**

在现有 import 块中新增：

```js
import { SummarySuggestion } from '../components/novel/SummarySuggestion';
import { EntityExtractor } from '../components/novel/EntityExtractor';
```

- [ ] **Step 2: 新增状态和修改 useChapterActions 解构**

同 Task 9 的 Step 2-3，在 NovelEditorPage 组件内：

```js
const [extractedEntities, setExtractedEntities] = useState(null);
const { generateChapter, continueChapter, suggestion, setSuggestion } = useChapterActions();
```

- [ ] **Step 3: 新增处理函数**

与 Task 9 的 Step 4 相同的 `handleAcceptSuggestion`、`handleExtractEntities`、`handleAcceptEntities`，但使用 `editingChapterId` 而非 `chapterId`。

- [ ] **Step 4: 在编辑器上方渲染新组件**

在 inline chapter editor 区域上方插入 `SummarySuggestion` 和 `EntityExtractor`。

- [ ] **Step 5: 在侧边栏底部或编辑器工具栏新增「提取角色」按钮**

根据 NovelEditorPage 的布局，在合适位置添加提取按钮。

- [ ] **Step 6: 验证构建**

```bash
cd /home/xy666/projects/ai-workshop/frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 7: 提交**

```bash
git add frontend/src/pages/NovelEditorPage.jsx && git commit -m "功能: NovelEditorPage 集成概要建议和实体提取"
```

---

### Task 11: 更新 AGENTS.md 文档

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新 API 端点表**

在小说 API 端点详情表中新增行：

```markdown
| `POST` | `/extract-entities` | 从正文中提取新角色和地点（对比已有列表避免重复） |
```

在 `generate-chapter` 和 `continue-chapter` 行的描述中追加说明：

```markdown
| `POST` | `/generate-chapter` | AI 生成章节（...），响应追加 `summarySuggestion` 字段 |
| `POST` | `/continue-chapter` | AI 续写章节（...），响应追加 `summarySuggestion` 字段 |
```

- [ ] **Step 2: 更新前端组件归属**

在组件归属列表中新增：

```markdown
- `frontend/src/components/novel/SummarySuggestion.jsx` - 概要建议卡片（AI 自动提炼章节标题和概要）
- `frontend/src/components/novel/EntityExtractor.jsx` - 实体审阅面板（从正文提取新角色/地点，编辑后采纳入库）
```

- [ ] **Step 3: 提交**

```bash
git add AGENTS.md && git commit -m "文档: 更新 AGENTS.md，新增概要适配和实体提取说明"
```

---

### Task 12: 最终验证

- [ ] **Step 1: 后端验证**

```bash
cd /home/xy666/projects/ai-workshop/backend && source .venv/bin/activate && python -c "
from routes.novel import novel_bp
from utils.context_builder import build_chapter_context
from prompts import render
print('Backend imports OK')
"
```

- [ ] **Step 2: 前端构建验证**

```bash
cd /home/xy666/projects/ai-workshop/frontend && npm run build 2>&1 | tail -3
```

- [ ] **Step 3: Lint 检查**

```bash
cd /home/xy666/projects/ai-workshop/frontend && npm run lint 2>&1 | tail -5
```

- [ ] **Step 4: 确认所有文件变更已提交**

```bash
cd /home/xy666/projects/ai-workshop && git status
```

预期：工作区干净，无未提交文件