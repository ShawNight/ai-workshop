import json
import re
import uuid
import hashlib
from flask import Blueprint, request, jsonify

from database import (
    create_novel_project, get_novel_project, get_all_novel_projects,
    update_novel_project, delete_novel_project, update_chapter,
    get_connection, _count_words
)

novel_bp = Blueprint("novel", __name__)

from providers import call_llm
from config import LLM_MAX_TOKENS_CHAPTER, LLM_MAX_TOKENS_MEDIUM, LLM_MAX_TOKENS_SHORT, LLM_CACHE_ENABLED, LLM_CACHE_SEED, LLM_CACHE_MAX_SIZE
from prompts import render

# ==================== LLM 响应缓存 ====================

_LLM_CACHE = {}

def _make_cache_key(prompt, system_prompt, temperature, max_tokens):
    payload = (system_prompt or "") + (prompt or "") + str(temperature) + str(max_tokens)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()

def _cache_get(prompt, system_prompt, temperature, max_tokens):
    if not LLM_CACHE_ENABLED:
        return None
    key = _make_cache_key(prompt, system_prompt, temperature, max_tokens)
    return _LLM_CACHE.get(key)

def _cache_set(prompt, system_prompt, temperature, max_tokens, content):
    if not LLM_CACHE_ENABLED:
        return
    key = _make_cache_key(prompt, system_prompt, temperature, max_tokens)
    if len(_LLM_CACHE) >= LLM_CACHE_MAX_SIZE:
        _LLM_CACHE.pop(next(iter(_LLM_CACHE)))
    _LLM_CACHE[key] = content

# ==================== LLM 调用 ====================


def generate_with_llm(prompt, system_prompt="", messages=None, temperature=0.7, max_tokens=None, timeout=None):
    """调用 LLM API 生成内容。成功返回文本，失败返回 None。
    当传入 messages 时，直接使用该消息列表（用于多轮对话场景）。
    支持 LRU 响应缓存，命中时直接返回缓存内容。"""
    if max_tokens is None:
        max_tokens = LLM_MAX_TOKENS_CHAPTER

    if timeout is None:
        timeout = max(120, max_tokens // 20 + 30)

    # 检查缓存（仅对单轮调用有效，多轮 chat 不缓存）
    if messages is None:
        cached = _cache_get(prompt, system_prompt, temperature, max_tokens)
        if cached is not None:
            return cached

    # 构建最终 messages
    if messages is None:
        final_messages = []
        if system_prompt:
            final_messages.append({"role": "system", "content": system_prompt})
        final_messages.append({"role": "user", "content": prompt})
    else:
        final_messages = messages

    resp = call_llm(
        messages=final_messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
        seed=LLM_CACHE_SEED if LLM_CACHE_ENABLED else None,
    )

    if not resp.success:
        print(f"[LLM] Error: {resp.error}")
        return None

    # 写入缓存
    if messages is None:
        _cache_set(prompt, system_prompt, temperature, max_tokens, resp.content)

    return resp.content


def build_story_context(characters=None, relationships=None, locations=None, outline=None):
    """根据角色、关系、地点、大纲构建给 LLM 的上下文文本"""
    parts = []

    if characters and len(characters) > 0:
        lines = ["【已知角色】"]
        for c in characters:
            meta = []
            if c.get("role"):
                meta.append(c["role"])
            if c.get("traits"):
                meta.append("性格：" + "、".join(c["traits"]))
            if c.get("appearance"):
                meta.append("外貌：" + c["appearance"])
            if c.get("backstory"):
                meta.append("背景：" + c["backstory"])
            desc = c.get("description", "")
            line = f"- {c['name']}"
            if meta:
                line += "（" + "，".join(meta) + "）"
            if desc:
                line += f"：{desc}"
            lines.append(line)
        parts.append("\n".join(lines))

    if relationships and len(relationships) > 0:
        char_map = {}
        if characters:
            for c in characters:
                char_map[c["id"]] = c["name"]
        lines = ["【角色关系】"]
        for r in relationships:
            from_name = char_map.get(r.get("fromId"), r.get("fromId", "?"))
            to_name = char_map.get(r.get("toId"), r.get("toId", "?"))
            rel_type = r.get("type", "关联")
            desc = r.get("description", "")
            line = f"- {from_name} → {rel_type} → {to_name}"
            if desc:
                line += f"（{desc}）"
            lines.append(line)
        parts.append("\n".join(lines))

    if locations and len(locations) > 0:
        lines = ["【已知地点】"]
        for loc in locations:
            desc = loc.get("description", "")
            sig = loc.get("significance", "")
            line = f"- {loc['name']}（{loc.get('type', '地点')}）"
            if desc:
                line += f"：{desc}"
            if sig:
                line += f" [剧情意义：{sig}]"
            lines.append(line)
        parts.append("\n".join(lines))

    if outline and len(outline) > 0:
        lines = ["【当前故事大纲】"]
        for item in outline:
            lines.append(f"- {item.get('title', '')}：{item.get('description', '')}")
        parts.append("\n".join(lines))

    return "\n\n".join(parts) if parts else ""


def parse_json_from_response(text, pattern=r'\[.*\]'):
    """从 LLM 响应中提取并解析 JSON"""
    if not text:
        return None

    # 1. 尝试从 markdown 代码块中提取 JSON
    code_block = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
    if code_block:
        try:
            return json.loads(code_block.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 2. 使用正则模式匹配
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # 3. 直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 4. 尝试修复常见的 JSON 问题：移除尾部逗号
    for ch_open, ch_close in [('{', '}'), ('[', ']')]:
        start = text.find(ch_open)
        if start >= 0:
            snippet = text[start:]
            cleaned = re.sub(r',\s*([}\]])', r'\1', snippet)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                continue

    print(f"[JSON] Failed to parse LLM response (first 500 chars): {text[:500]}")
    return None


# ==================== 项目 CRUD ====================

@novel_bp.route("/projects", methods=["GET"])
def get_projects():
    try:
        projects_list = get_all_novel_projects()
        return jsonify({"success": True, "projects": projects_list})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects", methods=["POST"])
def create_project():
    data = request.get_json()
    project_id = str(uuid.uuid4())

    try:
        project = create_novel_project(
            project_id=project_id,
            title=data.get("title") or "未命名小说",
            genre=data.get("genre") or "通用",
            premise=data.get("premise") or "",
            synopsis=data.get("synopsis") or "",
            target_word_count=data.get("targetWordCount") or 0,
            writing_style=data.get("writingStyle") or "",
            cover_color=data.get("coverColor") or "#6366F1",
            creation_mode=data.get("creationMode") or "harness"
        )

        json_fields = ["outline", "chapters", "characters", "locations", "relationships", "settings", "foreshadows"]
        extra_updates = {}
        for f in json_fields:
            if f in data:
                extra_updates[f] = data[f]
        if extra_updates:
            update_novel_project(project_id, extra_updates)
            project = get_novel_project(project_id)

        return jsonify({"success": True, "project": project})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>", methods=["GET"])
def get_project(project_id):
    try:
        project = get_novel_project(project_id)
        if not project:
            return jsonify({"success": False, "error": "项目不存在"}), 404
        return jsonify({"success": True, "project": project})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>", methods=["PUT"])
def update_project(project_id):
    data = request.get_json()

    try:
        existing = get_novel_project(project_id)
        if not existing:
            return jsonify({"success": False, "error": "项目不存在"}), 404

        updates = {}
        str_fields = ["title", "genre", "premise", "synopsis", "writing_style", "cover_color", "status", "creation_mode"]
        int_fields = ["targetWordCount", "currentWordCount"]
        json_fields = ["outline", "chapters", "characters", "locations", "relationships", "settings"]
        field_aliases = {"creationMode": "creation_mode"}

        for f in str_fields:
            if f in data:
                updates[f] = data[f]

        for alias, target in field_aliases.items():
            if alias in data and target not in updates:
                updates[target] = data[alias]

        for f in int_fields:
            if f in data:
                updates[f] = data[f]

        for f in json_fields:
            if f in data:
                updates[f] = data[f]

        update_novel_project(project_id, updates)
        updated = get_novel_project(project_id)
        return jsonify({"success": True, "project": updated})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    try:
        success = delete_novel_project(project_id)
        if not success:
            return jsonify({"success": False, "error": "项目不存在"}), 404
        return jsonify({"success": True, "message": "项目已删除"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>/chapters/<chapter_id>", methods=["PUT"])
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


@novel_bp.route("/projects/<project_id>/chapters/<chapter_id>/manual-edit", methods=["PUT"])
def manual_edit_chapter_route(project_id, chapter_id):
    """人工编辑章节：保存 title/content 并标记 manually_edited=true
    工作流遇到该标记会跳过自动重写（除非在 revising 阶段）。
    """
    import json as _json
    from database import get_novel_project
    from datetime import datetime

    data = request.get_json() or {}
    content = data.get('content')
    title = data.get('title')
    mark_manual = data.get('manuallyEdited', True)
    update_status = data.get('status')

    if content is None and title is None:
        return jsonify({'success': False, 'error': '至少需要提供 content 或 title'}), 400

    try:
        project = get_novel_project(project_id)
        if not project:
            return jsonify({'success': False, 'error': '项目不存在'}), 404

        chapters = project.get('chapters', [])
        found_idx = None
        for i, ch in enumerate(chapters):
            if ch.get('id') == chapter_id:
                found_idx = i
                if content is not None:
                    chapters[i]['content'] = content
                    chapters[i]['wordCount'] = len(content)
                if title is not None:
                    chapters[i]['title'] = title
                if mark_manual:
                    chapters[i]['manuallyEdited'] = True
                    chapters[i]['manualEditedAt'] = datetime.now().isoformat()
                if update_status:
                    chapters[i]['status'] = update_status
                break
        if found_idx is None:
            return jsonify({'success': False, 'error': '章节未找到'}), 404

        total_words = sum(_count_words(c.get('content', '')) for c in chapters)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE novel_projects SET chapters = ?, current_word_count = ?, updated_at = ? WHERE id = ?',
                (_json.dumps(chapters, ensure_ascii=False), total_words,
                 datetime.now().isoformat(), project_id)
            )
            conn.commit()

        try:
            from agents import _states
            state = _states.get(project_id)
            if state and 'chapters' in state.__dict__:
                for j, sc in enumerate(state.chapters):
                    if sc.get('id') == chapter_id or j == found_idx:
                        if content is not None:
                            sc['content'] = content
                            sc['word_count'] = len(content)
                        if title is not None:
                            sc['title'] = title
                        if mark_manual:
                            sc['manually_edited'] = True
                        if update_status:
                            sc['status'] = update_status
                        break
        except Exception:
            pass

        return jsonify({
            'success': True,
            'chapter': chapters[found_idx],
            'totalWordCount': total_words,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@novel_bp.route("/projects/<project_id>/chapters/<chapter_id>/reset-manual", methods=["DELETE"])
def reset_manual_chapter_route(project_id, chapter_id):
    """清除章节的 manually_edited 标记，允许工作流重写"""
    import json as _json
    from database import get_novel_project
    from datetime import datetime

    try:
        project = get_novel_project(project_id)
        if not project:
            return jsonify({'success': False, 'error': '项目不存在'}), 404

        chapters = project.get('chapters', [])
        found_idx = None
        for i, ch in enumerate(chapters):
            if ch.get('id') == chapter_id:
                chapters[i].pop('manuallyEdited', None)
                chapters[i].pop('manualEditedAt', None)
                chapters[i]['status'] = 'pending'
                found_idx = i
                break
        if found_idx is None:
            return jsonify({'success': False, 'error': '章节未找到'}), 404

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE novel_projects SET chapters = ?, updated_at = ? WHERE id = ?',
                (_json.dumps(chapters, ensure_ascii=False), datetime.now().isoformat(), project_id)
            )
            conn.commit()

        try:
            from agents import _states
            state = _states.get(project_id)
            if state and 'chapters' in state.__dict__:
                for j, sc in enumerate(state.chapters):
                    if j == found_idx:
                        sc.pop('manually_edited', None)
                        sc['status'] = 'pending'
                        sc['content'] = ''
                        sc['word_count'] = 0
                        break
        except Exception:
            pass

        return jsonify({'success': True, 'chapter': chapters[found_idx]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _extract_summary(content, chapter_title, genre):
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


# ==================== 全自动小说生成 Harness ====================


@novel_bp.route("/generate-design", methods=["POST"])
def generate_design():
    """从种子创意生成完整小说设计文档"""
    data = request.get_json()
    seed = data.get("seed", "")
    genre = data.get("genre", "玄幻")
    style = data.get("style", "热血升级流")
    target_words = data.get("targetWords", 1000000)
    synopsis = data.get("synopsis", "")
    existing_characters = data.get("existingCharacters") or []

    if not seed.strip():
        return jsonify({"success": False, "error": "请提供种子创意"}), 400

    try:
        target_words = int(target_words)
    except (ValueError, TypeError):
        target_words = 1000000

    existing_char_text = ""
    if existing_characters:
        lines = [f"- {c.get('name', '')}({c.get('role', '')}): {c.get('description', '')}" for c in existing_characters]
        existing_char_text = "\n".join(lines)

    prompts = render('novel/design.j2',
        seed=seed,
        genre=genre,
        style=style,
        target_words=target_words,
        synopsis=synopsis,
        existing_characters=existing_char_text)

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'],
                                   temperature=0.8, max_tokens=LLM_MAX_TOKENS_CHAPTER)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"}), 503

        design = parse_json_from_response(result, r'\{.*\}')
        if design and isinstance(design, dict) and "outline" in design:
            return jsonify({"success": True, "design": design})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重试"}), 502

    except Exception as e:
        return jsonify({"success": False, "error": f"生成设计失败: {str(e)}"}), 500


@novel_bp.route("/auto-chapter", methods=["POST"])
def auto_chapter():
    """在运行时约束下生成单个章节"""
    data = request.get_json()
    chapter_title = data.get("chapterTitle", "新章节")
    chapter_number = data.get("chapterNumber", 1)
    genre = data.get("genre", "玄幻")
    global_summary = data.get("globalSummary", "")
    volume_title = data.get("volumeTitle", "")
    volume_goal = data.get("volumeGoal", "")
    volume_summary = data.get("volumeSummary", "")
    recent_chapters = data.get("recentChapters", "")
    character_states = data.get("characterStates") or []
    rules = data.get("rules") or []
    pending_foreshadows = data.get("pendingForeshadows") or []
    chapter_guidance = data.get("chapterGuidance", "")

    prompts = render('novel/auto_chapter.j2',
        chapter_title=chapter_title,
        chapter_number=chapter_number,
        genre=genre,
        global_summary=global_summary,
        volume_title=volume_title,
        volume_goal=volume_goal,
        volume_summary=volume_summary,
        recent_chapters=recent_chapters,
        character_states=character_states,
        rules=rules,
        pending_foreshadows=pending_foreshadows,
        chapter_guidance=chapter_guidance)

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'],
                                   temperature=0.7, max_tokens=LLM_MAX_TOKENS_CHAPTER)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        summary = _extract_summary(result, chapter_title, genre)
        return jsonify({"success": True, "content": result, "summary": summary})

    except Exception as e:
        return jsonify({"success": False, "error": f"生成章节失败: {str(e)}"}), 500


@novel_bp.route("/quality-check", methods=["POST"])
def quality_check():
    """对新生成的章节做一致性检查"""
    data = request.get_json()
    chapter_content = data.get("content", "")
    chapter_number = data.get("chapterNumber", 1)
    genre = data.get("genre", "玄幻")
    rules = data.get("rules") or []
    character_states = data.get("characterStates") or []
    previous_summary = data.get("previousSummary", "")

    if not chapter_content.strip():
        return jsonify({"success": False, "error": "请提供章节内容"}), 400

    rules_text = "\n".join(f"- {r}" for r in rules) if rules else "无"
    chars_text = "\n".join(f"- {c}" for c in character_states) if character_states else "无"

    check_prompt = f"""请检查以下小说章节是否符合设定。聚焦5个维度，用JSON返回：

【章节内容】
{chapter_content[:3000]}

【世界硬规则】
{rules_text}

【角色当前状态】
{chars_text}

【前文摘要】
{previous_summary or "无"}

请返回JSON：
{{
  "checks": [
    {{"dimension": "角色一致性", "pass": true/false, "detail": "具体说明"}},
    {{"dimension": "世界规则", "pass": true/false, "detail": "具体说明"}},
    {{"dimension": "剧情连贯", "pass": true/false, "detail": "具体说明"}},
    {{"dimension": "节奏控制", "pass": true/false, "detail": "具体说明"}},
    {{"dimension": "字数质量", "pass": true/false, "detail": "本章约{len(chapter_content)}字"}}
  ],
  "overall_pass": true/false,
  "suggestions": ["改进建议1", "改进建议2"] or []
}}"""

    try:
        result = generate_with_llm(check_prompt, temperature=0.3, max_tokens=LLM_MAX_TOKENS_SHORT)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，质量检查失败"}), 503

        qa = parse_json_from_response(result, r'\{.*\}')
        if qa:
            return jsonify({"success": True, **qa})
        return jsonify({"success": False, "error": "AI 质量检查结果解析失败"}), 502

    except Exception as e:
        return jsonify({"success": False, "error": f"质量检查失败: {str(e)}"}), 500


# ==================== 块级蓝图修改 ====================

BLOCK_TYPE_LABELS = {
    "outline": "大纲·卷",
    "character": "角色",
    "rule": "世界规则",
    "foreshadow": "伏笔",
}

BLOCK_SCHEMAS = {
    "outline": {
        "required": ["title"],
        "defaults": {"volume": 0, "title": "", "goal": "", "chapters": 10, "description": ""},
    },
    "character": {
        "required": ["name"],
        "defaults": {"role": "", "traits": [], "aliases": [], "appearance": "", "backstory": ""},
        "nested": {
            "arc": {
                "hint": "角色成长弧线，新增角色时尽量填写",
                "fields": {"want": "外在目标", "need": "内在需求", "lie": "错误信念", "truth": "真相", "arc_plan": "成长轨迹概要"},
            }
        },
    },
    "rule": {
        "required": ["rule"],
        "defaults": {"type": "soft", "detail": ""},
    },
    "foreshadow": {
        "required": ["description"],
        "defaults": {"plant_stage": "", "reveal_stage": "", "importance": "次要"},
    },
}


def _validate_block(block_type, block):
    """验证并补全块数据，返回 (is_valid, block)"""
    if not isinstance(block, dict):
        return False, block
    schema = BLOCK_SCHEMAS.get(block_type, {})
    for key in schema.get("required", []):
        if not block.get(key):
            return False, block
    for key, default in schema.get("defaults", {}).items():
        block.setdefault(key, default)
    for nested_key in schema.get("nested", {}):
        block.setdefault(nested_key, {})
    return True, block


@novel_bp.route("/revise-block", methods=["POST"])
def revise_block():
    """块级修改蓝图：只发送单个块给 LLM，返回修改后的单个块"""
    data = request.get_json()
    block_type = data.get("block_type", "")
    operation = data.get("operation", "update")
    block = data.get("block", {})
    instruction = data.get("instruction", "")
    context = data.get("context", {})

    if block_type not in BLOCK_SCHEMAS:
        return jsonify({"success": False, "error": f"不支持的块类型: {block_type}"}), 400

    if not instruction.strip():
        return jsonify({"success": False, "error": "请提供修改指令"}), 400

    block_type_label = context.get("block_type_label") or BLOCK_TYPE_LABELS.get(block_type, block_type)
    block_json = json.dumps(block, ensure_ascii=False, indent=2) if block else "{}"
    chat_history = context.get("chat_history", [])

    schema = BLOCK_SCHEMAS.get(block_type, {})
    all_fields = list(schema.get("required", [])) + [k for k in schema.get("defaults", {}) if k not in schema.get("required", [])]
    nested = schema.get("nested", {})
    schema_hint = ""
    if all_fields:
        required = schema.get("required", [])
        lines = []
        for f in all_fields:
            req_mark = "（必填）" if f in required else "（可选）"
            default_val = schema.get("defaults", {}).get(f, "")
            lines.append(f"  \"{f}\": ...{req_mark}" + (f"，默认: {json.dumps(default_val, ensure_ascii=False)}" if default_val != "" else ""))
        for nested_key, nested_info in nested.items():
            hint = nested_info.get("hint", "")
            sub_fields = nested_info.get("fields", {})
            if hint:
                lines.append(f"  \"{nested_key}\": {{ /* {hint} */")
            else:
                lines.append(f"  \"{nested_key}\": {{")
            for sf, sf_desc in sub_fields.items():
                lines.append(f"    \"{sf}\": \"... /* {sf_desc} */\"")
            lines.append("  }")
        schema_hint = "{\n" + ",\n".join(lines) + "\n}"

    rendered = render(
        "novel/revise_block.j2",
        synopsis=context.get("synopsis", ""),
        genre=context.get("genre", ""),
        block_type_label=block_type_label,
        block_json=block_json,
        instruction=instruction,
        schema_hint=schema_hint,
        chat_history=chat_history,
        existing_outline=context.get("existing_outline", []),
        existing_characters=context.get("existing_characters", []),
        existing_rules=context.get("existing_rules", []),
        existing_foreshadows=context.get("existing_foreshadows", []),
    )

    try:
        result = generate_with_llm(
            prompt=rendered["user"],
            system_prompt=rendered["system"],
            temperature=0.3,
            max_tokens=LLM_MAX_TOKENS_SHORT,
        )

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用"})

        parsed = parse_json_from_response(result, r'\[.*\]')
        if isinstance(parsed, list) and len(parsed) > 0:
            validated = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                is_valid, item = _validate_block(block_type, item)
                if is_valid:
                    validated.append(item)
            if not validated:
                return jsonify({"success": False, "error": "AI 返回的块缺少必要字段，请重试"})
            return jsonify({"success": True, "blocks": validated})

        revised = parse_json_from_response(result, r'\{.*\}')
        if not revised or not isinstance(revised, dict):
            return jsonify({"success": False, "error": "AI 返回格式异常，请重试"})

        is_valid, revised = _validate_block(block_type, revised)
        if not is_valid:
            return jsonify({"success": False, "error": "AI 返回的块缺少必要字段，请重试"})

        return jsonify({"success": True, "block": revised})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/revise-design", methods=["POST"])
def revise_design():
    """对话式修改设计文档"""
    data = request.get_json()
    design = data.get("design", {})
    instruction = data.get("instruction", "")
    context = data.get("context", "")

    if not instruction.strip():
        return jsonify({"success": False, "error": "请提供修改指令"}), 400

    design_json = json.dumps(design, ensure_ascii=False, indent=2)[:6000]

    revise_prompt = f"""当前的完整小说设计文档如下，请根据用户的修改指令调整它。
只修改用户指定的部分，其他部分保持不变。返回修改后的完整JSON。

【当前设计文档】
{design_json}

【修改上下文】
{context}

【用户修改指令】
{instruction}

请返回修改后的完整设计文档JSON，保持原有结构不变。
如果用户的修改涉及删除角色，请检查伏笔表和关系是否也需要更新。
不要在JSON外输出任何文字。"""

    try:
        result = generate_with_llm(revise_prompt, temperature=0.5, max_tokens=LLM_MAX_TOKENS_MEDIUM)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用"})

        revised = parse_json_from_response(result, r'\{.*\}')
        if revised and isinstance(revised, dict) and "outline" in revised:
            return jsonify({"success": True, "design": revised})
        return jsonify({"success": False, "error": "AI 修改格式异常，请重试"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
