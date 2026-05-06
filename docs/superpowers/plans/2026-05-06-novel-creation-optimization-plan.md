# Novel Creation Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the novel creation feature for long-form fiction (5万字+) by improving auto-save, cross-chapter context continuity, incremental saving, writing UX, AI generation quality, and code maintainability.

**Architecture:** Incremental improvements on the existing Flask + React + Zustand architecture. Backend changes add new endpoints/utilities alongside existing ones. Frontend refactors extract shared hooks/utilities to reduce duplication. No database schema migration until Phase 4 (notes field only).

**Tech Stack:** Python/Flask backend, React 19/Vite frontend, Zustand state management, TipTap rich text editor, Jinja2 prompt templates

---

## Task 1: Extract shared utilities (formatAIContent + generateId)

**Files:**
- Create: `frontend/src/utils/formatContent.js`
- Create: `frontend/src/constants/novel.js`
- Modify: `frontend/src/pages/NovelEditorPage.jsx`
- Modify: `frontend/src/pages/ChapterWritePage.jsx`
- Modify: `frontend/src/components/novel/tabs/OutlineTab.jsx`

- [ ] **Step 1: Create `frontend/src/utils/formatContent.js`**

```js
export function formatAIContent(text) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      const withBreaks = trimmed.replace(/\n/g, '<br>');
      return `<p>${withBreaks}</p>`;
    })
    .join('');
}

export function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/\s/g, '');
}
```

- [ ] **Step 2: Create `frontend/src/constants/novel.js`**

```js
export const PROJECT_STATUS = {
  PLANNING: 'planning',
  WRITING: 'writing',
  COMPLETED: 'completed',
};

export const RELATIONSHIP_TYPES = [
  { value: 'friend', label: '朋友', icon: '🤝' },
  { value: 'love', label: '恋人', icon: '❤️' },
  { value: 'family', label: '家人', icon: '👨‍👩‍👧' },
  { value: 'rival', label: '对手', icon: '⚔️' },
  { value: 'mentor', label: '导师', icon: '🎓' },
  { value: 'enemy', label: '敌人', icon: '💢' },
  { value: 'ally', label: '盟友', icon: '🤝' },
  { value: 'subordinate', label: '下属', icon: '📋' },
];

export const LOCATION_TYPES = [
  { value: 'city', label: '城市', icon: '🏙️' },
  { value: 'village', label: '村庄', icon: '🏘️' },
  { value: 'wilderness', label: '荒野', icon: '🌲' },
  { value: 'realm', label: '领域', icon: '🏰' },
  { value: 'building', label: '建筑', icon: '🏢' },
  { value: 'other', label: '其他', icon: '📍' },
];

export const GENRE_LIST = [
  '玄幻', '仙侠', '都市', '科幻', '悬疑', '历史', '奇幻', '言情', '军事', '武侠', '通用',
];
```

- [ ] **Step 3: Update `frontend/src/pages/NovelEditorPage.jsx`**

Replace the inline `formatAIContent` function (lines 21-31) with an import:
```js
import { formatAIContent } from '../utils/formatContent';
```
Delete the entire `formatAIContent` function definition from this file.

- [ ] **Step 4: Update `frontend/src/pages/ChapterWritePage.jsx`**

Replace the inline `formatAIContent` function (lines 14-24) with an import:
```js
import { formatAIContent } from '../utils/formatContent';
```
Delete the entire `formatAIContent` function definition from this file.

- [ ] **Step 5: Update `frontend/src/components/novel/tabs/OutlineTab.jsx`**

Replace the inline `generateId` function (lines 10-12) with an import:
```js
import { generateId } from '../../../utils/formatContent';
```
Add `generateId` to `frontend/src/utils/formatContent.js`:
```js
export function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
```
Delete the `generateId` function from OutlineTab.jsx.

- [ ] **Step 6: Search for and update all other `generateId` usages**

Search for `crypto.randomUUID` across all frontend files. Replace each inline `generateId` function with an import from `../../../utils/formatContent` or `../../utils/formatContent` (depending on file depth).

- [ ] **Step 7: Verify all changes compile**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/utils/formatContent.js frontend/src/constants/novel.js frontend/src/pages/NovelEditorPage.jsx frontend/src/pages/ChapterWritePage.jsx frontend/src/components/novel/tabs/OutlineTab.jsx
git commit -m "refactor: extract shared utilities formatAIContent, stripHtml, generateId, and novel constants"
```

---

## Task 2: Create useAutoSave hook and wire it up

**Files:**
- Create: `frontend/src/hooks/useAutoSave.js`
- Modify: `frontend/src/pages/NovelEditorPage.jsx`
- Modify: `frontend/src/pages/ChapterWritePage.jsx`

- [ ] **Step 1: Create `frontend/src/hooks/useAutoSave.js`**

This hook replaces the manual `useSave` + `markUnsaved` + `performSave` pattern. It handles:
- Debounced auto-save (3 seconds after last change)
- Draft version creation on save
- `beforeunload` protection
- Manual `saveNow()` for immediate save

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { stripHtml } from '../utils/formatContent';

export function useAutoSave(projectId, chapterId = null) {
  const { currentProject, markSaving, markSaved, setSaveStatus, markUnsaved, isEditorDirty } = useNovelStore();
  const timerRef = useRef(null);
  const lastSavedContentRef = useRef(null);

  const saveDraft = useCallback(async (project, chId) => {
    if (!chId) return;
    const chapter = (project?.chapters || []).find((c) => c.id === chId);
    if (chapter?.content) {
      const wordCount = stripHtml(chapter.content).length;
      await novelApi.saveDraft(project.id, chId, {
        content: chapter.content,
        wordCount,
      }).catch(() => {});
    }
  }, []);

  const save = useCallback(async () => {
    const project = useNovelStore.getState().currentProject;
    if (!project?.id) return false;
    markSaving();
    try {
      await novelApi.updateProject(project.id, {
        title: project.title,
        genre: project.genre,
        premise: project.premise,
        synopsis: project.synopsis,
        writingStyle: project.writingStyle,
        coverColor: project.coverColor,
        status: project.status,
        targetWordCount: project.targetWordCount,
        currentWordCount: project.currentWordCount,
        outline: project.outline,
        chapters: project.chapters,
        characters: project.characters,
        locations: project.locations,
        relationships: project.relationships,
        settings: project.settings,
      });
      const savedProject = useNovelStore.getState().currentProject;
      await saveDraft(savedProject || project, chapterId);
      markSaved();
      return true;
    } catch {
      setSaveStatus('error');
      return false;
    }
  }, [chapterId, markSaving, markSaved, setSaveStatus, saveDraft]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save();
    }, 3000);
  }, [save]);

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isEditorDirty) {
      scheduleSave();
    }
    return () => cancelPending();
  }, [isEditorDirty, scheduleSave, cancelPending]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const state = useNovelStore.getState();
      if (state.isEditorDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return { save, scheduleSave, cancelPending };
}
```

- [ ] **Step 2: Update `frontend/src/pages/NovelEditorPage.jsx`**

Replace `useSave` import and `performSave` function:
1. Remove `import { useSave } from '../hooks/useSave';`
2. Add `import { useAutoSave } from '../hooks/useAutoSave';`
3. Replace `const { save } = useSave();` with `const { save } = useAutoSave(currentProject?.id, editingChapterId);`
4. Delete the entire `performSave` function definition (the useCallback that wraps `save()` + `saveDraft()`)
5. Replace all `performSave()` calls with `save()` directly
6. Remove the `markUnsaved()` call inside `handleChapterContentChange` — the `useAutoSave` hook watches `isEditorDirty` and auto-schedules. Keep `markUnsaved()` in every place that modifies project data (it triggers the auto-save timer via `isEditorDirty` change).

- [ ] **Step 3: Update `frontend/src/pages/ChapterWritePage.jsx`**

Same pattern:
1. Remove `import { useSave } from '../hooks/useSave';`
2. Add `import { useAutoSave } from '../hooks/useAutoSave';`
3. Replace `const { save } = useSave();` with `const { save } = useAutoSave(projectId, chapterId);`
4. Delete the entire `performSave` callback
5. Replace all `performSave()` calls with `save()`
6. Keep all `markUnsaved()` calls (they trigger auto-save via the hook)

- [ ] **Step 4: Verify all changes compile**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useAutoSave.js frontend/src/pages/NovelEditorPage.jsx frontend/src/pages/ChapterWritePage.jsx
git commit -m "feat: add useAutoSave hook with 3s debounce and beforeunload protection"
```

---

## Task 3: Create useChapterActions shared hook

**Files:**
- Create: `frontend/src/hooks/useChapterActions.js`
- Modify: `frontend/src/pages/NovelEditorPage.jsx`
- Modify: `frontend/src/pages/ChapterWritePage.jsx`

- [ ] **Step 1: Create `frontend/src/hooks/useChapterActions.js`**

This hook extracts the duplicated AI generation handlers from both pages.

```js
import { useCallback } from 'react';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { formatAIContent } from '../utils/formatContent';

export function useChapterActions(chapterIdField = 'editingChapterId') {
  const { currentProject, updateProject, setIsGeneratingChapter, markUnsaved } = useNovelStore();

  const getProject = useCallback(() => {
    return useNovelStore.getState().currentProject;
  }, []);

  const getChapterId = useCallback(() => {
    const state = useNovelStore.getState();
    return state[chapterIdField];
  }, [chapterIdField]);

  const getChapter = useCallback(() => {
    const proj = getProject();
    const chId = getChapterId();
    return (proj?.chapters || []).find((c) => c.id === chId);
  }, [getProject, getChapterId]);

  const getPreviousChapterContent = useCallback(() => {
    const proj = getProject();
    const chId = getChapterId();
    const chapters = proj?.chapters || [];
    const idx = chapters.findIndex((c) => c.id === chId);
    if (idx > 0) {
      return chapters[idx - 1].content?.replace(/<[^>]+>/g, '') || '';
    }
    return '';
  }, [getProject, getChapterId]);

  const generateChapter = useCallback(async () => {
    const proj = getProject();
    const chId = getChapterId();
    const chapter = (proj?.chapters || []).find((c) => c.id === chId);
    if (!proj || !chapter) return;

    setIsGeneratingChapter(true);
    try {
      const previousContent = getPreviousChapterContent();
      const res = await novelApi.generateChapter({
        chapterTitle: chapter.title,
        premise: proj.premise || '',
        genre: proj.genre || '通用',
        previousContent,
        writingStyle: proj.writingStyle || '',
        chapterDescription: chapter.description || '',
        characters: proj.characters || [],
        relationships: proj.relationships || [],
        locations: proj.locations || [],
        outline: (proj.outline || []).slice(0, 20),
      });

      if (res.data.success) {
        const formatted = formatAIContent(res.data.content);
        const chapters = (proj.chapters || []).map((c) =>
          c.id === chId ? { ...c, content: formatted } : c
        );
        updateProject(proj.id, { chapters });
        markUnsaved();
      }
    } catch {
      // error toast handled by caller or silently
    } finally {
      setIsGeneratingChapter(false);
    }
  }, [getProject, getChapterId, getPreviousChapterContent, updateProject, setIsGeneratingChapter, markUnsaved]);

  const continueChapter = useCallback(async ({ html, selection }) => {
    const proj = getProject();
    const chId = getChapterId();
    const chapter = (proj?.chapters || []).find((c) => c.id === chId);
    if (!proj || !chapter) return;

    if (selection?.text) {
      try {
        const res = await novelApi.rewriteText({
          selectedText: selection.text,
          instruction: '改写选中的文本，使其更加生动、流畅',
          genre: proj.genre || '通用',
          context: html.replace(/<[^>]+>/g, '').slice(0, 500),
          characters: proj.characters || [],
          relationships: proj.relationships || [],
        });

        if (res.data.success) {
          const formatted = formatAIContent(res.data.content);
          const before = chapter.content.slice(0, selection.from);
          const after = chapter.content.slice(selection.to);
          const newContent = before + formatted + after;
          const chapters = (proj.chapters || []).map((c) =>
            c.id === chId ? { ...c, content: newContent } : c
          );
          updateProject(proj.id, { chapters });
          markUnsaved();
        }
      } catch {
        // silently handled
      }
    } else {
      const currentText = chapter.content?.replace(/<[^>]+>/g, '') || '';
      try {
        const res = await novelApi.continueChapter({
          currentContent: currentText,
          chapterTitle: chapter.title,
          premise: proj.premise || '',
          genre: proj.genre || '通用',
          writingStyle: proj.writingStyle || '',
          characters: proj.characters || [],
          relationships: proj.relationships || [],
          locations: proj.locations || [],
          outline: (proj.outline || []).slice(0, 20),
        });

        if (res.data.success) {
          const formatted = formatAIContent(res.data.content);
          const newContent = chapter.content + formatted;
          const chapters = (proj.chapters || []).map((c) =>
            c.id === chId ? { ...c, content: newContent } : c
          );
          updateProject(proj.id, { chapters });
          markUnsaved();
        }
      } catch {
        // silently handled
      }
    }
  }, [getProject, getChapterId, updateProject, markUnsaved]);

  return { generateChapter, continueChapter, getChapter, getChapterId, getProject };
}
```

- [ ] **Step 2: Refactor `frontend/src/pages/NovelEditorPage.jsx`**

1. Add import: `import { useChapterActions } from '../hooks/useChapterActions';`
2. Add hook call: `const { generateChapter, continueChapter } = useChapterActions('editingChapterId');`
3. Delete the `handleGenerateChapter` function (lines ~110-150) — replace all references with `generateChapter`
4. Delete the `handleContinueChapter` function (lines ~152-201) — replace all references with `continueChapter`
5. Update AI action buttons in JSX to use the new hook functions
6. Keep `handleApplyBrainstormIdea` (different across pages) and the brainstorm state

- [ ] **Step 3: Refactor `frontend/src/pages/ChapterWritePage.jsx`**

1. Add import: `import { useChapterActions } from '../hooks/useChapterActions';`
2. Add hook call: `const { generateChapter, continueChapter } = useChapterActions('chapterId');`
   Note: ChapterWritePage uses `chapterId` from `useParams`, not `editingChapterId` from the store. The hook MUST use a direct chapterId lookup. For this page, pass `chapterId` directly.
   
   Modify the hook to also accept a direct chapter ID:
   ```js
   // In ChapterWritePage.jsx:
   const chapterIdFromParams = chapterId; // from useParams
   const { generateChapter, continueChapter } = useChapterActions(null, chapterIdFromParams);
   ```
   
   Update `useChapterActions.js` to accept an optional direct `chapterId` override:
   ```js
   export function useChapterActions(chapterIdField = 'editingChapterId', directChapterId = null) {
   ```
   And update `getChapterId`:
   ```js
   const getChapterId = useCallback(() => {
     if (directChapterId) return directChapterId;
     const state = useNovelStore.getState();
     return state[chapterIdField];
   }, [chapterIdField, directChapterId]);
   ```

3. Delete `handleGenerate` function — replace with `generateChapter`
4. Delete `handleContinue` function — replace with `continueChapter`
5. Keep `handleApplyBrainstormIdea` (page-specific)
6. Update all JSX references

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useChapterActions.js frontend/src/pages/NovelEditorPage.jsx frontend/src/pages/ChapterWritePage.jsx
git commit -m "refactor: extract useChapterActions hook to eliminate duplicated AI generation logic"
```

---

## Task 4: Backend — Add incremental chapter save endpoint and token budget utilities

**Files:**
- Create: `backend/utils/__init__.py`
- Create: `backend/utils/token_budget.py`
- Modify: `backend/database.py` (add `update_chapter` function)
- Modify: `backend/routes/novel.py` (add `PUT /projects/<id>/chapters/<chapterId>` route, parameterize `generate_with_llm`)

- [ ] **Step 1: Create `backend/utils/__init__.py`**

Empty file to make it a package.

```python
# utils package
```

- [ ] **Step 2: Create `backend/utils/token_budget.py`**

```python
import re

CHINESE_CHARS_PER_TOKEN = 1.5

def estimate_tokens(text):
    if not text:
        return 0
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    other_chars = len(text) - chinese_chars
    return int(chinese_chars / CHINESE_CHARS_PER_TOKEN + other_chars / 4)

def allocate_context_budget(total_budget=6000, summary_ratio=0.25, prev_ratio=0.50, setting_ratio=0.25):
    return {
        'summary': int(total_budget * summary_ratio),
        'previous': int(total_budget * prev_ratio),
        'setting': int(total_budget * setting_ratio),
    }

def smart_truncate(text, max_tokens, preserve_first=True, preserve_last=True):
    if estimate_tokens(text) <= max_tokens:
        return text
    paragraphs = text.split('\n')
    if len(paragraphs) <= 3:
        half = len(text) // 2
        return text[:half] + '\n...(已截断)...\n'
    target_chars = int(max_tokens * CHINESE_CHARS_PER_TOKEN)
    if preserve_first and preserve_last:
        first_para = paragraphs[0]
        last_para = paragraphs[-1]
        budget = target_chars - len(first_para) - len(last_para) - 20
        if budget < 100:
            return first_para + '\n...(已截断)...\n' + last_para
        middle = '\n'.join(paragraphs[1:-1])[:budget]
        return first_para + '\n...(前文摘要)...\n' + middle + '\n...(已截断)...\n' + last_para
    if preserve_first:
        return text[:target_chars] + '\n...(已截断)'
    if preserve_last:
        return '...(前文截断)...\n' + text[-target_chars:]
    return text[:target_chars] + '\n...(已截断)'
```

- [ ] **Step 3: Add `update_chapter` function to `backend/database.py`**

Add this function before `create_writing_log` (around line 307):

```python
def update_chapter(project_id: str, chapter_id: str, content: str = None, title: str = None, word_count: int = None) -> bool:
    with get_connection() as conn:
        project = get_novel_project(project_id)
        if not project:
            return False
        chapters = project.get('chapters', [])
        found = False
        for i, ch in enumerate(chapters):
            if ch.get('id') == chapter_id:
                if content is not None:
                    chapters[i]['content'] = content
                if title is not None:
                    chapters[i]['title'] = title
                if word_count is not None:
                    chapters[i]['wordCount'] = word_count
                found = True
                break
        if not found:
            return False
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE novel_projects SET chapters = ?, updated_at = ?, current_word_count = (SELECT SUM(word_count) FROM chapter_drafts WHERE project_id = ?) WHERE id = ?',
            (json.dumps(chapters, ensure_ascii=False), datetime.now().isoformat(), current_word_count_recalculate(project_id, chapters), project_id)
        )
        conn.commit()
        return cursor.rowcount > 0
```

Wait, `current_word_count` should be recalculated from chapters, not from `chapter_drafts`. Let me fix:

```python
def update_chapter(project_id: str, chapter_id: str, content: str = None, title: str = None) -> bool:
    with get_connection() as conn:
        project = get_novel_project(project_id)
        if not project:
            return False
        chapters = project.get('chapters', [])
        found = False
        for i, ch in enumerate(chapters):
            if ch.get('id') == chapter_id:
                if content is not None:
                    chapters[i]['content'] = content
                if title is not None:
                    chapters[i]['title'] = title
                found = True
                break
        if not found:
            return False
        total_words = sum(
            len(c.get('content', '').replace('<', '<').replace('>', '>').replace('<[^>]+>', '').replace('\s', ''))
            for c in chapters
        )
        import re
        total_words = sum(
            len(re.sub(r'<[^>]+>', '', c.get('content', '')).replace(' ', ''))
            for c in chapters
        )
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE novel_projects SET chapters = ?, current_word_count = ?, updated_at = ? WHERE id = ?',
            (json.dumps(chapters, ensure_ascii=False), total_words, datetime.now().isoformat(), project_id)
        )
        conn.commit()
        return cursor.rowcount > 0
```

Actually let me simplify — the word count calculation uses the same pattern as the frontend (strip HTML, count chars). Let me add a helper:

```python
def _count_words(html_content):
    text = re.sub(r'<[^>]+>', '', html_content or '')
    return len(text.replace(' ', ''))

def update_chapter(project_id: str, chapter_id: str, content: str = None, title: str = None) -> bool:
    with get_connection() as conn:
        project = get_novel_project(project_id)
        if not project:
            return False
        chapters = project.get('chapters', [])
        found = False
        for i, ch in enumerate(chapters):
            if ch.get('id') == chapter_id:
                if content is not None:
                    chapters[i]['content'] = content
                if title is not None:
                    chapters[i]['title'] = title
                found = True
                break
        if not found:
            return False
        total_words = sum(_count_words(c.get('content', '')) for c in chapters)
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE novel_projects SET chapters = ?, current_word_count = ?, updated_at = ? WHERE id = ?',
            (json.dumps(chapters, ensure_ascii=False), total_words, datetime.now().isoformat(), project_id)
        )
        conn.commit()
        return True
```

- [ ] **Step 4: Add `update_chapter` route to `backend/routes/novel.py`**

Add the import at the top:
```python
from database import (
    ..., update_chapter
)
from utils.token_budget import estimate_tokens, smart_truncate, allocate_context_budget
```

Add the route after `delete_project` (around line 265):

```python
@novel_bp.route('/projects/<project_id>/chapters/<chapter_id>', methods=['PUT'])
def update_chapter_route(project_id, chapter_id):
    data = request.get_json() or {}
    content = data.get('content')
    title = data.get('title')
    
    if content is None and title is None:
        return jsonify({'success': False, 'error': '至少需要提供 content 或 title'}), 400
    
    success = update_chapter(project_id, chapter_id, content=content, title=title)
    if success:
        project = get_novel_project(project_id)
        chapter = next((c for c in project.get('chapters', []) if c.get('id') == chapter_id), None)
        return jsonify({
            'success': True,
            'chapter': chapter,
            'totalWordCount': project.get('current_word_count', 0)
        })
    return jsonify({'success': False, 'error': '章节未找到'}), 404
```

- [ ] **Step 5: Parameterize `generate_with_llm` with temperature and max_tokens**

In `backend/routes/novel.py`, update the `generate_with_llm` function signature (around line 59):

```python
def generate_with_llm(prompt, system_prompt="", messages=None, temperature=0.7, max_tokens=4096):
```

Update the request body inside the function (around line 78-79):

```python
"temperature": temperature,
"max_tokens": max_tokens,
```

- [ ] **Step 6: Update API call sites to use appropriate temperature and max_tokens**

In each route that calls `generate_with_llm`, update with appropriate parameters:

- `brainstorm`: `generate_with_llm(prompt, system_prompt=..., temperature=0.9, max_tokens=2048)`
- `rewrite_text`: `generate_with_llm(prompt, system_prompt=..., temperature=0.5, max_tokens=2048)`
- `generate_outline` / `generate_outline_directions`: `temperature=0.7, max_tokens=2048`
- `generate_chapter` / `continue_chapter`: keep defaults (0.7, 4096)
- `create_character` / `generate_characters` / `generate_location` / `generate_locations`: `temperature=0.7, max_tokens=1024`
- `chat`: `temperature=0.7, max_tokens=2048`

- [ ] **Step 7: Add the novelApi method for incremental chapter save in `frontend/src/api/index.js`**

Add after the `saveDraft` method (around line 43):

```js
updateChapter: (projectId, chapterId, data) => api.put(`/novel/projects/${projectId}/chapters/${chapterId}`, data),
```

- [ ] **Step 8: Test backend endpoint manually**

Run: `cd backend && source .venv/bin/activate && python -c "from database import update_chapter, init_db; init_db(); print('DB function OK')"`
Run: `cd backend && source .venv/bin/activate && python -c "from utils.token_budget import estimate_tokens, smart_truncate; print(estimate_tokens('你好世界')); print('Token budget OK')"`

Expected: Both imports succeed, `estimate_tokens` returns a number.

- [ ] **Step 9: Commit**

```bash
git add backend/utils/__init__.py backend/utils/token_budget.py backend/database.py backend/routes/novel.py frontend/src/api/index.js
git commit -m "feat: add incremental chapter save endpoint, token budget utils, and parameterized LLM calls"
```

---

## Task 5: Backend — Build cross-chapter context and update prompt templates

**Files:**
- Create: `backend/utils/context_builder.py`
- Modify: `backend/routes/novel.py` (update `generate_chapter` and `continue_chapter` handlers)
- Modify: `backend/prompts/novel/chapter.j2`
- Modify: `backend/prompts/novel/continue.j2`
- Modify: `backend/prompts/novel/chat_relation.j2`
- Modify: `backend/prompts/novel/brainstorm.j2`

- [ ] **Step 1: Create `backend/utils/context_builder.py`**

```python
from utils.token_budget import estimate_tokens, smart_truncate, allocate_context_budget

def build_chapter_context(project_data, current_chapter_index):
    chapters = project_data.get('chapters', [])
    characters = project_data.get('characters', [])
    relationships = project_data.get('relationships', [])
    locations = project_data.get('locations', [])
    outline = project_data.get('outline', [])
    
    budget = allocate_context_budget()
    
    # 1. Summary layer: recent chapter titles + descriptions
    summary_parts = []
    summary_budget = budget['summary']
    current_summary_tokens = 0
    for i, ch in enumerate(chapters):
        if i >= current_chapter_index:
            break
        summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」：{ch.get('description', '')}"
        if current_summary_tokens + estimate_tokens(summary_line) > summary_budget:
            summary_parts.insert(0, f"...(省略了前{i}章中更早的章节)")
            break
        summary_parts.append(summary_line)
        current_summary_tokens += estimate_tokens(summary_line)
    summary_text = '\n'.join(summary_parts) if summary_parts else ''
    
    # 2. Previous content layer: last chapter's ending content
    prev_budget = budget['previous']
    prev_content = ''
    if current_chapter_index > 0 and current_chapter_index <= len(chapters):
        raw_prev = chapters[current_chapter_index - 1].get('content', '')
        if raw_prev:
            plain_prev = raw_prev.replace('<br>', '\n').replace('</p>', '\n')
            import re
            plain_prev = re.sub(r'<[^>]+>', '', plain_prev)
            prev_content = smart_truncate(plain_prev, prev_budget, preserve_first=False, preserve_last=True)
    
    # 3. Settings layer: characters, relationships, locations
    setting_budget = budget['setting']
    setting_parts = []
    current_setting_tokens = 0
    
    relevant_char_ids = set()
    for ch in chapters[max(0, current_chapter_index - 3):current_chapter_index]:
        content = ch.get('content', '')
        for char in characters:
            if char.get('name') and char['name'] in content:
                relevant_char_ids.add(char.get('id'))
    for char in characters[:10]:
        relevant_char_ids.add(char.get('id'))
    
    for char in characters:
        if char.get('id') in relevant_char_ids:
            line = f"- {char.get('name', '')}({char.get('role', '角色')})：{char.get('description', '')}"
            if char.get('traits'):
                line += f" 性格：{', '.join(char.get('traits', []))}"
            if current_setting_tokens + estimate_tokens(line) > setting_budget * 0.5:
                break
            setting_parts.append(line)
            current_setting_tokens += estimate_tokens(line)
    
    relevant_rel_ids = set()
    for rel in relationships:
        if rel.get('fromId') in relevant_char_ids or rel.get('toId') in relevant_char_ids:
            relevant_rel_ids.add(rel.get('id'))
    for rel in relationships:
        if rel.get('id') in relevant_rel_ids:
            from_name = next((c.get('name', '?') for c in characters if c.get('id') == rel.get('fromId')), '?')
            to_name = next((c.get('name', '?') for c in characters if c.get('id') == rel.get('toId')), '?')
            line = f"- {from_name} ←{rel.get('type', '关系')}→ {to_name}：{rel.get('description', '')}"
            if current_setting_tokens + estimate_tokens(line) > setting_budget * 0.75:
                break
            setting_parts.append(line)
            current_setting_tokens += estimate_tokens(line)
    
    for loc in locations[:5]:
        line = f"- 📍{loc.get('name', '')}({loc.get('type', '')})：{loc.get('description', '')}"
        if current_setting_tokens + estimate_tokens(line) > setting_budget:
            break
        setting_parts.append(line)
        current_setting_tokens += estimate_tokens(line)
    
    setting_text = '\n'.join(setting_parts) if setting_parts else ''
    
    # Current chapter outline
    current_outline = ''
    if current_chapter_index < len(outline):
        current_outline = outline[current_chapter_index].get('description', '') if isinstance(outline[current_chapter_index], dict) else ''
    
    return {
        'summary': summary_text,
        'previous_content': prev_content,
        'settings': setting_text,
        'current_outline': current_outline,
        'total_chapters': len(chapters),
        'current_chapter_index': current_chapter_index,
    }
```

- [ ] **Step 2: Update `backend/routes/novel.py` — import context_builder**

Add at the top:
```python
from utils.context_builder import build_chapter_context
```

- [ ] **Step 3: Update `generate_chapter` handler to use context_builder**

Replace the current `generate_chapter` route handler (around lines 425-463) with:

```python
@novel_bp.route('/generate-chapter', methods=['POST'])
def generate_chapter():
    data = request.get_json() or {}
    chapter_title = data.get('chapterTitle', '未命名章节')
    premise = data.get('premise', '一个充满悬念和惊喜的故事')
    genre = data.get('genre', '通用')
    previous_content = data.get('previousContent', '')
    writing_style = data.get('writingStyle', '')
    chapter_description = data.get('chapterDescription', '')
    characters = data.get('characters', [])
    relationships = data.get('relationships', [])
    locations = data.get('locations', [])
    outline = data.get('outline', [])
    project_id = data.get('projectId', '')
    chapter_index = data.get('chapterIndex', -1)

    if not LLM_API_KEY:
        return jsonify({'success': True, 'content': MOCK_CHAPTER.format(chapter_title=chapter_title), 'mock': True, 'message': '未配置 API Key'})

    story_context = build_story_context(characters=characters, relationships=relationships, locations=locations, outline=outline)

    if project_id and chapter_index >= 0:
        project = get_novel_project(project_id)
        if project:
            ctx = build_chapter_context(project, chapter_index)
            prompts = render('novel/chapter.j2',
                chapter_title=chapter_title,
                genre=genre,
                premise=premise,
                writing_style=writing_style,
                chapter_description=chapter_description,
                previous_content=ctx['previous_content'] or previous_content,
                recent_summary=ctx['summary'],
                settings_context=ctx['settings'],
                current_outline=ctx['current_outline'],
                story_context=story_context
            )
        else:
            prompts = render('novel/chapter.j2',
                chapter_title=chapter_title, genre=genre, premise=premise,
                writing_style=writing_style, chapter_description=chapter_description,
                previous_content=previous_content, story_context=story_context,
                recent_summary='', settings_context='', current_outline=''
            )
    else:
        prompts = render('novel/chapter.j2',
            chapter_title=chapter_title, genre=genre, premise=premise,
            writing_style=writing_style, chapter_description=chapter_description,
            previous_content=previous_content, story_context=story_context,
            recent_summary='', settings_context='', current_outline=''
        )

    if isinstance(prompts, dict):
        content = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.7, max_tokens=4096)
    else:
        content = generate_with_llm(prompts, temperature=0.7, max_tokens=4096)

    if content is None:
        return jsonify({'success': True, 'content': MOCK_CHAPTER.format(chapter_title=chapter_title), 'mock': True, 'message': 'AI 服务暂时不可用'})

    return jsonify({'success': True, 'content': content})
```

- [ ] **Step 4: Update `continue_chapter` handler similarly**

Replace the `continue_chapter` route handler (around lines 466-506) with context-aware version:

```python
@novel_bp.route('/continue-chapter', methods=['POST'])
def continue_chapter():
    data = request.get_json() or {}
    current_content = data.get('currentContent', '')
    chapter_title = data.get('chapterTitle', '未命名章节')
    premise = data.get('premise', '')
    genre = data.get('genre', '通用')
    writing_style = data.get('writingStyle', '')
    characters = data.get('characters', [])
    relationships = data.get('relationships', [])
    locations = data.get('locations', [])
    outline = data.get('outline', [])
    project_id = data.get('projectId', '')
    chapter_index = data.get('chapterIndex', -1)

    if not current_content:
        return jsonify({'success': False, 'error': '请提供当前章节内容'}), 400

    if not LLM_API_KEY:
        mock_content = current_content + '\n\n<p>（续写内容 - AI 服务未配置）</p>'
        return jsonify({'success': True, 'content': mock_content, 'mock': True, 'message': '未配置 API Key'})

    story_context = build_story_context(characters=characters, relationships=relationships, locations=locations, outline=outline)

    if project_id and chapter_index >= 0:
        project = get_novel_project(project_id)
        if project:
            ctx = build_chapter_context(project, chapter_index)
            prompts = render('novel/continue.j2',
                chapter_title=chapter_title, genre=genre, premise=premise,
                writing_style=writing_style,
                current_content=smart_truncate(current_content, 2000, preserve_first=False, preserve_last=True),
                recent_summary=ctx['summary'],
                settings_context=ctx['settings'],
                story_context=story_context
            )
        else:
            prompts = render('novel/continue.j2',
                chapter_title=chapter_title, genre=genre, premise=premise,
                writing_style=writing_style,
                current_content=current_content[-500:],
                story_context=story_context,
                recent_summary='', settings_context=''
            )
    else:
        prompts = render('novel/continue.j2',
            chapter_title=chapter_title, genre=genre, premise=premise,
            writing_style=writing_style,
            current_content=current_content[-500:],
            story_context=story_context,
            recent_summary='', settings_context=''
        )

    if isinstance(prompts, dict):
        content = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.7, max_tokens=4096)
    else:
        content = generate_with_llm(prompts, temperature=0.7, max_tokens=4096)

    if content is None:
        mock_content = current_content + '\n\n<p>（续写内容 - AI 服务暂时不可用）</p>'
        return jsonify({'success': True, 'content': mock_content, 'mock': True, 'message': 'AI 服务暂时不可用'})

    return jsonify({'success': True, 'content': content})
```

- [ ] **Step 5: Update `chapter.j2` prompt template**

Replace the entire content of `backend/prompts/novel/chapter.j2`:

```
---SYSTEM---
你是一位专业的小说作家，专精于{{ genre }}类型小说的创作。
根据提供的章节信息、故事背景、角色设定和前文内容，创作一个生动、引人入胜的章节。
{% if writing_style %}请使用以下写作风格：{{ writing_style }}{% endif %}
确保与前文衔接自然，同时本章节有独立的情节完整性。
严格遵守已设定的角色性格、关系和背景，不要引入与已有设定矛盾的内容。
注重场景描写、人物对话和心理刻画，保持叙事节奏感。
如果提供了角色关系信息，请在情节中合理利用这些关系推动故事发展。
---USER---
章节标题：{{ chapter_title }}
{% if chapter_description %}章节概要：{{ chapter_description }}{% endif %}
故事类型：{{ genre }}
故事背景：{{ premise or '一个充满悬念和惊喜的故事' }}

{% if recent_summary %}
【前文脉络】
{{ recent_summary }}
{% endif %}

前文摘要：{{ previous_content or '（故事开篇）' }}

{{ story_context }}

{% if settings_context %}
【角色与设定】
{{ settings_context }}
{% endif %}

{% if current_outline %}
本章大纲要点：{{ current_outline }}
{% endif %}

请创作本章节内容，要求：
1. 字数在 1000-2000 字之间
2. 包含清晰的开头、发展和结尾
3. 适当的人物对话、心理描写和环境描写，对话要符合角色性格
4. 与前文自然衔接
5. 如果提供了角色列表，至少让其中 1-2 个角色在本章出场或产生情节推动
6. 注意与前文脉络中描述的情节和角色发展保持一致
```

- [ ] **Step 6: Update `continue.j2` prompt template**

Replace the entire content of `backend/prompts/novel/continue.j2`:

```
---SYSTEM---
你是一位专业的{{ genre }}小说续写作家。
你的任务是接着已有的内容自然地继续写下去，保持一致的文风、语气和叙事节奏。
不要重复已有内容，从断点处自然延续。
严格遵守已设定的角色性格和关系，确保角色言行一致。
{% if writing_style %}写作风格：{{ writing_style }}{% endif %}
---USER---
章节：{{ chapter_title }}
类型：{{ genre }}
故事背景：{{ premise or '' }}

{% if recent_summary %}
【前文脉络】
{{ recent_summary }}
{% endif %}

{{ story_context }}

{% if settings_context %}
【角色与设定】
{{ settings_context }}
{% endif %}

已有内容（结尾部分）：
{{ current_content }}

请从以上内容断点处自然续写，字数在 800-1500 字。确保文风一致，情节合理推进，角色行为符合其设定。
{% if recent_summary %}注意与前文脉络中描述的情节发展保持连贯。{% endif %}
```

- [ ] **Step 7: Update `chat_relation.j2` — add genre and premise**

Replace the entire content of `backend/prompts/novel/chat_relation.j2`:

```
你是一位专业的小说关系分析师，专精于{{ genre }}类型作品。

你的任务是与用户探讨角色之间的关系张力、动态变化和发展可能性。

【你的能力】
- 分析角色间关系的深层逻辑
- 设计关系的转折点和冲突
- 发现关系的潜在发展空间
- 建议关系的发展方向

【故事背景】
{{ premise or '未指定' }}

【建议格式】
```suggestions
[
  {"type": "update_relationship", "targetId": "关系ID", "field": "字段名", "value": "新值", "label": "更新关系"},
  {"type": "create_relationship", "value": {"fromId": "A的ID", "toId": "B的ID", "type": "关系类型", "description": "关系描述"}},
  {"type": "ask_question", "value": "如果他们之间发生了...会怎样？", "label": "追问"}
]
```

{{ story_context }}

【当前关系】
{{ rel_context }}

请与用户深入探讨角色间的关系。
```

- [ ] **Step 8: Update `brainstorm.j2` — add keyPoints field**

Replace the entire content of `backend/prompts/novel/brainstorm.j2`:

```
---SYSTEM---
你是一位创意小说策划，专精于{{ genre }}类型。
针对用户的想法，结合已有的角色、关系和世界观设定，生成 3 个不同的创作方向建议。
每个建议必须包含标题、简要描述和关键转折点。
如果提供了角色关系或世界观信息，请让生成的方向尽量利用这些设定，但同时保持创意的发散性。
输出 JSON 数组格式。
---USER---
类型：{{ genre }}
故事背景：{{ premise or '未指定' }}
{{ story_context }}
用户想法：{{ idea }}

请生成 3 个创作方向建议，返回 JSON：
[
  {"title": "方向标题", "description": "情节发展思路（50-100字）", "keyPoints": ["关键转折点1", "关键转折点2"]},
  ...
]
```

- [ ] **Step 9: Update `build_chat_system_prompt` in `novel.py`**

In the `build_chat_system_prompt` function (around line 600), when calling `render()` for the `character_relation` mode, pass `genre` and `premise`:

Find the section that renders `novel/chat_relation.j2` and update it to include genre/premise from context:
```python
elif mode == "character_relation":
    # ... existing rel_context building code ...
    template = render('novel/chat_relation.j2',
        story_context=story_context,
        rel_context=rel_context,
        genre=context.get('genre', '通用'),
        premise=context.get('premise', '')
    )
```

- [ ] **Step 10: Update frontend to pass `projectId` and `chapterIndex` in API calls**

In `frontend/src/hooks/useChapterActions.js`, update the `generateChapter` function to also send `projectId` and `chapterIndex`:

```js
const res = await novelApi.generateChapter({
    chapterTitle: chapter.title,
    premise: proj.premise || '',
    genre: proj.genre || '通用',
    previousContent,
    writingStyle: proj.writingStyle || '',
    chapterDescription: chapter.description || '',
    characters: proj.characters || [],
    relationships: proj.relationships || [],
    locations: proj.locations || [],
    outline: (proj.outline || []).slice(0, 20),
    projectId: proj.id,
    chapterIndex: (proj.chapters || []).findIndex((c) => c.id === chId),
});
```

Same for `continueChapter`:
```js
const res = await novelApi.continueChapter({
    currentContent: currentText,
    chapterTitle: chapter.title,
    premise: proj.premise || '',
    genre: proj.genre || '通用',
    writingStyle: proj.writingStyle || '',
    characters: proj.characters || [],
    relationships: proj.relationships || [],
    locations: proj.locations || [],
    outline: (proj.outline || []).slice(0, 20),
    projectId: proj.id,
    chapterIndex: (proj.chapters || []).findIndex((c) => c.id === chId),
});
```

- [ ] **Step 11: Verify backend starts**

Run: `cd backend && source .venv/bin/activate && python -c "from routes.novel import novel_bp; from utils.context_builder import build_chapter_context; print('All imports OK')"`

Expected: Both imports succeed.

- [ ] **Step 12: Commit**

```bash
git add backend/utils/context_builder.py backend/routes/novel.py backend/prompts/novel/chapter.j2 backend/prompts/novel/continue.j2 backend/prompts/novel/chat_relation.j2 backend/prompts/novel/brainstorm.j2 frontend/src/hooks/useChapterActions.js
git commit -m "feat: build cross-chapter context system with 3-layer strategy, update prompt templates"
```

---

## Task 6: Frontend — Add chapter reorder buttons and ConfirmDialog component

**Files:**
- Modify: `frontend/src/components/novel/tabs/OutlineTab.jsx`
- Create: `frontend/src/components/ui/ConfirmDialog.jsx`

- [ ] **Step 1: Create `frontend/src/components/ui/ConfirmDialog.jsx`**

This replaces all `window.confirm()` calls with a styled dialog:

```jsx
import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = '确认', variant = 'danger' }) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm text-[var(--text-secondary)] mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>取消</Button>
        <Button variant={variant === 'danger' ? 'destructive' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Add chapter reorder functionality to `OutlineTab.jsx`**

Add move up/down handler functions inside the `OutlineTab` component:

```jsx
const handleMoveChapter = useCallback((chapterId, direction) => {
  const chapters = [...(currentProject.chapters || [])];
  const idx = chapters.findIndex((c) => c.id === chapterId);
  if (idx < 0) return;
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= chapters.length) return;
  [chapters[idx], chapters[newIdx]] = [chapters[newIdx], chapters[idx]];
  chapters.forEach((c, i) => { c.order = i; });
  updateProject(currentProject.id, { chapters });
  markUnsaved();
}, [currentProject, updateProject, markUnsaved]);
```

Add up/down buttons to each chapter row in the JSX (inside the `<div className="flex items-center gap-0.5 flex-shrink-0">` section, before the delete button):

```jsx
<button
  onClick={(e) => { e.stopPropagation(); handleMoveChapter(chapter.id, 'up'); }}
  className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-secondary)]"
  disabled={idx === 0}
  title="上移"
>
  <ChevronUp className="h-3.5 w-3.5" />
</button>
<button
  onClick={(e) => { e.stopPropagation(); handleMoveChapter(chapter.id, 'down'); }}
  className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-secondary)]"
  disabled={idx === chapters.length - 1}
  title="下移"
>
  <ChevronDown className="h-3.5 w-3.5" />
</button>
```

Add `ChevronUp` to the import from `lucide-react`.

Add `ConfirmDialog` for chapter deletion (replace `window.confirm`):

```jsx
import { ConfirmDialog } from '../../ui/ConfirmDialog';

const [deleteTarget, setDeleteTarget] = useState(null);

const handleConfirmDelete = () => {
  if (deleteTarget) {
    handleDeleteChapter(deleteTarget);
    setDeleteTarget(null);
  }
};
```

Replace the delete button's `onClick` handler:
```jsx
<button
  onClick={(e) => { e.stopPropagation(); setDeleteTarget(chapter.id); }}
  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
  title="删除"
>
  <Trash2 className="h-3.5 w-3.5" />
</button>
```

Add the dialog at the end of the component:
```jsx
<ConfirmDialog
  isOpen={!!deleteTarget}
  onClose={() => setDeleteTarget(null)}
  onConfirm={handleConfirmDelete}
  title="删除章节"
  message="确定要删除这个章节吗？此操作不可撤销。"
/>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/ConfirmDialog.jsx frontend/src/components/novel/tabs/OutlineTab.jsx
git commit -m "feat: add chapter reorder buttons and ConfirmDialog component"
```

---

## Task 7: Frontend — Add keyboard shortcuts hook

**Files:**
- Create: `frontend/src/hooks/useHotkeys.js`
- Modify: `frontend/src/pages/NovelEditorPage.jsx`
- Modify: `frontend/src/pages/ChapterWritePage.jsx`

- [ ] **Step 1: Create `frontend/src/hooks/useHotkeys.js`**

```js
import { useEffect, useCallback } from 'react';

export function useHotkeys(hotkeys, deps = []) {
  const handleKeyDown = useCallback((e) => {
    for (const [key, handler] of Object.entries(hotkeys)) {
      const parts = key.toLowerCase().split('+');
      const keyPart = parts[parts.length - 1];
      const needsCtrl = parts.includes('ctrl') || parts.includes('cmd');
      const needsShift = parts.includes('shift');

      if (e.key.toLowerCase() !== keyPart) continue;
      if (needsCtrl && !(e.ctrlKey || e.metaKey)) continue;
      if (needsShift && !e.shiftKey) continue;
      if (!needsCtrl && (e.ctrlKey || e.metaKey)) continue;
      if (!needsShift && e.shiftKey) continue;

      e.preventDefault();
      handler();
      break;
    }
  }, deps);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
```

- [ ] **Step 2: Wire hotkeys in `NovelEditorPage.jsx`**

Add import: `import { useHotkeys } from '../hooks/useHotkeys';`

Add after existing hooks:
```js
useHotkeys({
  'ctrl+s': () => save(),
  'ctrl+enter': () => generateChapter(),
  'ctrl+shift+b': () => setShowBrainstorm(true),
}, [save, generateChapter]);
```

- [ ] **Step 3: Wire hotkeys in `ChapterWritePage.jsx`**

Add import: `import { useHotkeys } from '../hooks/useHotkeys';`

Add after existing hooks:
```js
useHotkeys({
  'ctrl+s': () => save(),
  'ctrl+enter': () => continueChapter({}),
  'ctrl+shift+b': () => setShowBrainstorm(true),
}, [save, continueChapter]);
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useHotkeys.js frontend/src/pages/NovelEditorPage.jsx frontend/src/pages/ChapterWritePage.jsx
git commit -m "feat: add useHotkeys hook with Ctrl+S, Ctrl+Enter, Ctrl+Shift+B shortcuts"
```

---

## Task 8: Frontend — Notes panel and brainstorm improvement

**Files:**
- Modify: `frontend/src/pages/NovelEditorPage.jsx`
- Modify: `frontend/src/pages/ChapterWritePage.jsx`
- Modify: `frontend/src/components/novel/BrainstormModal.jsx`
- Create: `frontend/src/components/novel/NotesDrawer.jsx`

- [ ] **Step 1: Add `notes` field to backend `update_novel_project`**

In `backend/database.py`, update the `update_novel_project` function to handle the `notes` field. Add `'notes'` to the JSON fields list:

Find the JSON serialization section (around line 269) and add:
```python
'notes': (json.dumps(updates['notes'], ensure_ascii=False) if isinstance(updates.get('notes'), (list, dict)) else updates.get('notes', '[]')),
```

Also add `notes` column to the database schema in `init_db()`:
```sql
notes TEXT DEFAULT '[]',
```

Add migration after existing ALTER TABLE statements:
```python
try:
    cursor.execute('ALTER TABLE novel_projects ADD COLUMN notes TEXT DEFAULT \'[]\'')
    conn.commit()
except OperationalError:
    pass
```

- [ ] **Step 2: Update `get_novel_project` to parse `notes`**

In the project dict construction (around line 210), add:
```python
'notes': json.loads(row[14]) if row[14] else [],
```
Note: the exact column index depends on the current schema. Check the row index from the SELECT query.

- [ ] **Step 3: Create `frontend/src/components/novel/NotesDrawer.jsx`**

```jsx
import { useState } from 'react';
import { X, Plus, Trash2, StickyNote } from 'lucide-react';
import { Button } from '../ui/Button';
import { generateId } from '../../utils/formatContent';

export function NotesDrawer({ isOpen, onClose, notes = [], onNotesChange }) {
  const [newNote, setNewNote] = useState('');

  if (!isOpen) return null;

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const updated = [...notes, { id: generateId(), type: 'idea', content: newNote.trim(), createdAt: Date.now() }];
    onNotesChange(updated);
    setNewNote('');
  };

  const handleDeleteNote = (id) => {
    onNotesChange(notes.filter((n) => n.id !== id));
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-[var(--surface)] border-l border-[var(--border)] shadow-lg z-40 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          灵感笔记
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--background)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="p-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm group">
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1 whitespace-pre-wrap break-words">{note.content}</p>
              <button
                onClick={() => handleDeleteNote(note.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded flex-shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <span className="text-xs text-[var(--text-secondary)] mt-1 block">
              {new Date(note.createdAt).toLocaleDateString('zh-CN')} {note.type === 'brainstorm' ? '🧠' : '💡'}
            </span>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
            placeholder="记录灵感..."
            className="flex-1 text-sm px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:border-[var(--primary)]/50"
          />
          <Button size="sm" onClick={handleAddNote}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update BrainstormModal to save to notes instead of inline**

In `BrainstormModal.jsx`, add an `onSaveNote` prop:

```jsx
export function BrainstormModal({ isOpen, onClose, onApplyIdea, onSaveNote }) {
```

In the "采用" button handler, change:
```jsx
onClick={() => {
  onSaveNote?.({ id: generateId(), type: 'brainstorm', content: `${item.title}: ${item.description}`, keyPoints: item.keyPoints, createdAt: Date.now() });
  onClose();
}}
```

Also add a second button "保存到笔记" next to "采用":
```jsx
<Button
  size="sm"
  variant="ghost"
  onClick={() => {
    onSaveNote?.({ id: generateId(), type: 'brainstorm', content: `${item.title}: ${item.description}${item.keyPoints ? '\n关键: ' + item.keyPoints.join('、') : ''}`, createdAt: Date.now() });
    onClose();
  }}
  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
>
  存笔记
</Button>
```

Add import: `import { generateId } from '../../utils/formatContent';`

- [ ] **Step 5: Wire NotesDrawer in `NovelEditorPage.jsx`**

Add state: `const [showNotes, setShowNotes] = useState(false);`

Add `NotesDrawer` component at the end of JSX:
```jsx
<NotesDrawer
  isOpen={showNotes}
  onClose={() => setShowNotes(false)}
  notes={currentProject?.notes || []}
  onNotesChange={(notes) => { updateProject(currentProject.id, { notes }); markUnsaved(); }}
/>
```

Add a floating button in the editor area to toggle notes:
```jsx
<button
  onClick={() => setShowNotes(!showNotes)}
  className="fixed right-4 bottom-4 z-30 p-3 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors"
  title="灵感笔记"
>
  <StickyNote className="h-5 w-5" />
</button>
```

Update `BrainstormModal`'s `onApplyIdea` and add `onSaveNote`:
```jsx
<BrainstormModal
  isOpen={showBrainstorm}
  onClose={() => setShowBrainstorm(false)}
  onApplyIdea={(idea) => { /* existing apply logic */ }}
  onSaveNote={(note) => {
    const notes = [...(currentProject?.notes || []), note];
    updateProject(currentProject.id, { notes });
    markUnsaved();
  }}
/>
```

Add import for `StickyNote` from `lucide-react` and `NotesDrawer`.

- [ ] **Step 6: Same wiring in `ChapterWritePage.jsx`**

Mirror the same NotesDrawer integration in ChapterWritePage.

- [ ] **Step 7: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Verify backend schema migration**

Run: `cd backend && source .venv/bin/activate && python -c "from database import init_db; init_db(); print('Migration OK')"`

Expected: No errors, "Migration OK" printed.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/novel/NotesDrawer.jsx frontend/src/components/novel/BrainstormModal.jsx frontend/src/pages/NovelEditorPage.jsx frontend/src/pages/ChapterWritePage.jsx backend/database.py
git commit -m "feat: add notes panel for brainstorm results, update brainstorm to save-to-notes"
```

---

## Task 9: Frontend — Version diff comparison

**Files:**
- Install diff library
- Create: `frontend/src/components/novel/VersionDiff.jsx`
- Modify: `frontend/src/components/novel/VersionHistory.jsx`

- [ ] **Step 1: Install diff library**

Run: `cd frontend && npm install diff`

- [ ] **Step 2: Create `frontend/src/components/novel/VersionDiff.jsx`**

```jsx
import { useMemo } from 'react';
import * as Diff from 'diff';

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/<br\s*\/?>/gi, '\n');
}

export function VersionDiff({ oldContent, newContent }) {
  const hunks = useMemo(() => {
    const oldText = stripHtml(oldContent);
    const newText = stripHtml(newContent);
    return Diff.diffLines(oldText, newText);
  }, [oldContent, newContent]);

  return (
    <div className="font-mono text-xs whitespace-pre-wrap space-y-0.5 max-h-96 overflow-y-auto">
      {hunks.map((part, i) => {
        const lines = part.value.split('\n');
        return lines.map((line, j) => {
          if (!line && j === lines.length - 1) return null;
          if (part.added) {
            return <div key={`${i}-${j}`} className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2">{line}</div>;
          }
          if (part.removed) {
            return <div key={`${i}-${j}`} className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 line-through">{line}</div>;
          }
          return <div key={`${i}-${j}`} className="px-2">{line}</div>;
        });
      })}
    </div>
  );
}
```

- [ ] **Step 3: Update `frontend/src/components/novel/VersionHistory.jsx`**

Read the current VersionHistory.jsx to understand its structure, then add a "对比" mode:

1. Add a `compareMode` state: `const [compareMode, setCompareMode] = useState(null);` (null | 'selecting' | 'showing')
2. Add a `selectedForCompare` state: `const [selectedIds, setSelectedIds] = useState([]);`
3. When `compareMode === 'selecting'`, allow selecting 2 drafts. Add checkboxes next to each draft.
4. When 2 drafts are selected and user clicks "显示差异", fetch both draft contents and show `<VersionDiff>` component.
5. Add a "对比版本" button in the header area.

- [ ] **Step 4: Import and use `VersionDiff` in `VersionHistory.jsx`**

```jsx
import { VersionDiff } from './VersionDiff';
```

- [ ] **Step 5: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/novel/VersionDiff.jsx frontend/src/components/novel/VersionHistory.jsx
git commit -m "feat: add version diff comparison for draft history"
```

---

## Task 10: Update useAutoSave to use incremental chapter save

**Files:**
- Modify: `frontend/src/hooks/useAutoSave.js`

- [ ] **Step 1: Update `useAutoSave` to use incremental save when only chapter content changed**

Add import for `novelApi.updateChapter` and `stripHtml`:

```js
import { useCallback, useEffect, useRef } from 'react';
import { novelApi } from '../api';
import { useNovelStore } from '../store/novelStore';
import { stripHtml } from '../utils/formatContent';
```

Add a `lastSavedHash` ref to track what was last saved:

```js
const lastSavedHashRef = useRef(null);
```

Modify the `save` function: if `chapterId` is set and only the chapter content changed, use incremental save:

```js
const save = useCallback(async () => {
  const project = useNovelStore.getState().currentProject;
  if (!project?.id) return false;

  const currentHash = JSON.stringify(project.chapters);

  if (chapterId && currentHash === lastSavedHashRef.current) {
    return true; 
  }

  markSaving();
  try {
    if (chapterId) {
      const chapter = (project.chapters || []).find((c) => c.id === chapterId);
      if (chapter) {
        const wordCount = stripHtml(chapter.content || '').length;
        await novelApi.updateChapter(project.id, chapterId, {
          content: chapter.content,
          title: chapter.title,
        });
        await novelApi.saveDraft(project.id, chapterId, {
          content: chapter.content,
          wordCount,
        }).catch(() => {});
        lastSavedHashRef.current = currentHash;
        markSaved();
        return true;
      }
    }

    await novelApi.updateProject(project.id, {
      title: project.title,
      genre: project.genre,
      premise: project.premise,
      synopsis: project.synopsis,
      writingStyle: project.writingStyle,
      coverColor: project.coverColor,
      status: project.status,
      targetWordCount: project.targetWordCount,
      currentWordCount: project.currentWordCount,
      outline: project.outline,
      chapters: project.chapters,
      characters: project.characters,
      locations: project.locations,
      relationships: project.relationships,
      settings: project.settings,
      notes: project.notes,
    });
    const savedProject = useNovelStore.getState().currentProject;
    if (chapterId) {
      await saveDraft(savedProject || project, chapterId);
    }
    lastSavedHashRef.current = JSON.stringify(savedProject?.chapters || project.chapters);
    markSaved();
    return true;
  } catch {
    setSaveStatus('error');
    return false;
  }
}, [chapterId, markSaving, markSaved, setSaveStatus, saveDraft]);
```

Also add a `forceFullSave` function for when project metadata changes (not just chapter content):

```js
const forceFullSave = useCallback(async () => {
  const project = useNovelStore.getState().currentProject;
  if (!project?.id) return false;
  markSaving();
  try {
    await novelApi.updateProject(project.id, {
      title: project.title,
      genre: project.genre,
      premise: project.premise,
      synopsis: project.synopsis,
      writingStyle: project.writingStyle,
      coverColor: project.coverColor,
      status: project.status,
      targetWordCount: project.targetWordCount,
      currentWordCount: project.currentWordCount,
      outline: project.outline,
      chapters: project.chapters,
      characters: project.characters,
      locations: project.locations,
      relationships: project.relationships,
      settings: project.settings,
      notes: project.notes,
    });
    if (chapterId) {
      await saveDraft(useNovelStore.getState().currentProject || project, chapterId);
    }
    lastSavedHashRef.current = JSON.stringify(project.chapters);
    markSaved();
    return true;
  } catch {
    setSaveStatus('error');
    return false;
  }
}, [chapterId, markSaving, markSaved, setSaveStatus, saveDraft]);
```

Update the return value to include `forceFullSave`:

```js
return { save, forceFullSave, scheduleSave, cancelPending };
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useAutoSave.js
git commit -m "feat: use incremental chapter save in useAutoSave for reduced payload"
```

---

## Task 11: Replace all window.confirm with ConfirmDialog

**Files:**
- Modify: All files that use `window.confirm`

- [ ] **Step 1: Find all `window.confirm` usages**

Run: `cd frontend && grep -rn "window.confirm" src/`

Expected files to find:
- `NovelEditorPage.jsx` (if any)
- `ChapterWritePage.jsx` (reformat handler)
- `ChapterEditor.jsx` (reformat handler)
- `NovelListPage.jsx` (project deletion)
- Other components

- [ ] **Step 2: Replace each `window.confirm` with `ConfirmDialog`**

For each file found:
1. Add state: `const [confirmAction, setConfirmAction] = useState(null);`
2. Replace `if (window.confirm('...'))` patterns with `setConfirmAction({ message: '...', action: () => { ... } })`
3. Add `<ConfirmDialog>` component at the end of JSX

Pattern for each replacement:

```jsx
// Before:
if (window.confirm('确定要删除吗？')) { handleDelete(id); }

// After:
setConfirmAction({ message: '确定要删除吗？', onConfirm: () => handleDelete(id) });

// Add to JSX:
<ConfirmDialog
  isOpen={!!confirmAction}
  onClose={() => setConfirmAction(null)}
  onConfirm={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}
  title="确认操作"
  message={confirmAction?.message || ''}
/>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "refactor: replace all window.confirm calls with styled ConfirmDialog component"
```

---

## Task 12: Final verification and cleanup

- [ ] **Step 1: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: No errors.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify backend starts**

Run: `cd backend && source .venv/bin/activate && python -c "from app import app; print('Backend starts OK')" && python -c "from routes.novel import novel_bp; from utils.context_builder import build_chapter_context; from utils.token_budget import estimate_tokens; print('All imports OK')"`

Expected: All imports succeed.

- [ ] **Step 4: Manual smoke test**

Start both backend and frontend:
1. `cd backend && source .venv/bin/activate && python app.py`
2. `cd frontend && npm run dev`
3. Create a new novel project
4. Verify auto-save works (make a change, wait 3 seconds, check save status indicator)
5. Verify Ctrl+S shortcut saves immediately
6. Verify chapter reorder buttons appear in outline
7. Verify notes panel toggle button appears
8. Verify version diff comparison in version history

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final cleanup and verification fixes"
```