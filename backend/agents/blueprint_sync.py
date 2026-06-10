"""BlueprintSync Agent — 章节完成后回写设计蓝图

从已完成的章节内容中提取新角色、新伏笔、角色弧光变化，
追加到 state.design 中，并通过 SSE 通知前端 BlueprintPage 高亮更新。

设计原则：
- 仅追加，不删除（保守策略）
- 通过 LLM 校验去重，避免把已有角色再次加入
- 失败时回退到不修改 design，仅记录日志
"""

import json
import re
import uuid

from .state import StoryState
from .llm import call_agent_llm
from routes.novel import parse_json_from_response


def _safe_name(name: str) -> str:
    return (name or "").strip()


def run_blueprint_sync(state: StoryState, chapter_index: int) -> dict:
    """分析已完成的章节，提取新角色 / 新伏笔，回写 design

    Args:
        state: 当前 StoryState
        chapter_index: 已完成章节的索引（0-based）

    Returns:
        {
            "new_characters": [...],
            "new_foreshadows": [...],
            "updated_characters": [...],
            "skipped": bool
        }
    """
    if not state.design or chapter_index >= len(state.chapters):
        return {"new_characters": [], "new_foreshadows": [], "updated_characters": [], "skipped": True}

    chapter = state.chapters[chapter_index]
    content = chapter.get("content", "")
    if not content or len(content) < 200:
        return {"new_characters": [], "new_foreshadows": [], "updated_characters": [], "skipped": True}

    # 已存在的角色名/伏笔描述集合
    existing_chars = state.design.get("characters", []) or []
    existing_names = {_safe_name(c.get("name", "")) for c in existing_chars}
    existing_names.discard("")

    existing_foreshadows = state.design.get("foreshadows", []) or []
    existing_foreshadow_descs = {
        _safe_name(f.get("description", "")).lower()
        for f in existing_foreshadows
    }
    existing_foreshadow_descs.discard("")

    char_list = "\n".join(
        f"- {c.get('name','')} ({c.get('role','')})" for c in existing_chars
    ) or "（暂无）"

    foreshadow_list = "\n".join(
        f"- {f.get('description','')}" for f in existing_foreshadows
    ) or "（暂无）"

    prompt = f"""你是一位严谨的小说设定编辑。请阅读以下章节内容，分析是否引入了**新角色**或**新伏笔**（不与已有设定重复）。

【第{chapter_index + 1}章标题】{chapter.get('title', '')}
【小说类型】{state.genre}
【写作风格】{state.style}

【已有角色】（请勿重复）
{char_list}

【已有伏笔】（请勿重复）
{foreshadow_list}

【本章内容】（前6000字）
{content[:6000]}

请只返回 JSON 格式：
{{
  "new_characters": [
    {{
      "name": "新角色名",
      "role": "配角/反派",
      "traits": ["性格1", "性格2"],
      "appearance": "外貌简述（30字内）",
      "backstory": "背景简述（80字内）",
      "first_appear": "第{chapter_index + 1}章"
    }}
  ],
  "new_foreshadows": [
    {{
      "description": "伏笔描述（30字内）",
      "plant_stage": "本章",
      "reveal_stage": "待揭示章节（可空）",
      "importance": "主要/次要"
    }}
  ],
  "updated_characters": [
    {{
      "name": "已有角色名",
      "arc_change": "本章对其成长弧线的推进说明"
    }}
  ]
}}

要求：
- 如果没有新角色，new_characters 留空数组 []
- 如果没有新伏笔，new_foreshadows 留空数组 []
- updated_characters 只记录本章**真正推进了弧光**的已有角色
- 严格去重：name 与已有角色完全相同则不加入
- 严格去重：description 含义已包含在已有伏笔中则不加入
- 最多识别 3 个新角色 + 3 个新伏笔
- 只返回 JSON，不要任何额外文字。"""

    try:
        resp = call_agent_llm("blueprint_sync", [{"role": "user", "content": prompt}],
                              temperature=0.3, max_tokens=2000, timeout=60)
    except Exception as e:
        state.log_activity("blueprint_sync", "error", f"调用失败: {e}")
        return {"new_characters": [], "new_foreshadows": [], "updated_characters": [], "skipped": True}

    if not resp.success:
        state.log_activity("blueprint_sync", "error", f"LLM 错误: {resp.error}")
        return {"new_characters": [], "new_foreshadows": [], "updated_characters": [], "skipped": True}

    parsed = parse_json_from_response(resp.content, r'\{.*\}')
    if not isinstance(parsed, dict):
        state.log_activity("blueprint_sync", "error", "返回 JSON 解析失败")
        return {"new_characters": [], "new_foreshadows": [], "updated_characters": [], "skipped": True}

    new_chars_raw = parsed.get("new_characters", []) or []
    new_foreshadows_raw = parsed.get("new_foreshadows", []) or []
    updated_chars_raw = parsed.get("updated_characters", []) or []

    added_chars = []
    for nc in new_chars_raw[:3]:
        if not isinstance(nc, dict):
            continue
        name = _safe_name(nc.get("name", ""))
        if not name or name in existing_names:
            continue
        added_chars.append({
            "name": name,
            "role": _safe_name(nc.get("role", "配角")) or "配角",
            "traits": nc.get("traits", []) or [],
            "appearance": _safe_name(nc.get("appearance", "")),
            "backstory": _safe_name(nc.get("backstory", "")),
            "first_appear": _safe_name(nc.get("first_appear", f"第{chapter_index + 1}章")),
        })
        existing_names.add(name)

    added_foreshadows = []
    for nf in new_foreshadows_raw[:3]:
        if not isinstance(nf, dict):
            continue
        desc = _safe_name(nf.get("description", ""))
        if not desc:
            continue
        if desc.lower() in existing_foreshadow_descs:
            continue
        added_foreshadows.append({
            "description": desc,
            "plant_stage": _safe_name(nf.get("plant_stage", f"第{chapter_index + 1}章")),
            "reveal_stage": _safe_name(nf.get("reveal_stage", "")),
            "importance": _safe_name(nf.get("importance", "次要")) or "次要",
        })
        existing_foreshadow_descs.add(desc.lower())

    accepted_updates = []
    for uc in updated_chars_raw:
        if not isinstance(uc, dict):
            continue
        name = _safe_name(uc.get("name", ""))
        if name and name in existing_names and uc.get("arc_change"):
            accepted_updates.append({
                "name": name,
                "arc_change": _safe_name(uc.get("arc_change", "")),
                "chapter": chapter_index + 1,
            })

    if added_chars:
        state.design.setdefault("characters", []).extend(added_chars)
    if added_foreshadows:
        state.design.setdefault("foreshadows", []).extend(added_foreshadows)

    if added_chars or added_foreshadows or accepted_updates:
        try:
            from agents.task_queue import TaskQueue
            from agents.state_store import StateStore
            from database import insert_blueprint_change

            change_id = f"bc-{uuid.uuid4().hex[:8]}"
            insert_blueprint_change(
                change_id=change_id,
                project_id=state.project_id,
                source="blueprint_sync",
                change_type="auto_sync",
                change_data={
                    "new_characters": added_chars,
                    "new_foreshadows": added_foreshadows,
                    "updated_characters": accepted_updates,
                },
                chapter_index=chapter_index,
            )
            StateStore.save(state)
            TaskQueue.get_instance().notify_sse(state.project_id, {
                "type": "blueprint_updated",
                "diff": {
                    "new_characters": added_chars,
                    "new_foreshadows": added_foreshadows,
                    "updated_characters": accepted_updates,
                    "chapter": chapter_index + 1,
                },
            })
            state.log_activity(
                "blueprint_sync", "completed",
                f"第{chapter_index + 1}章蓝图同步：+{len(added_chars)}角色 +{len(added_foreshadows)}伏笔"
            )
        except Exception as e:
            print(f"[BlueprintSync] 通知失败（不影响主流程）: {e}")
            state.log_activity("blueprint_sync", "warning", f"同步完成但通知失败: {e}")

    return {
        "new_characters": added_chars,
        "new_foreshadows": added_foreshadows,
        "updated_characters": accepted_updates,
        "skipped": False,
    }
