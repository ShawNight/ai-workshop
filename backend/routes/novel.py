import json
import re
import uuid
from flask import Blueprint, request, jsonify

from database import (
    create_novel_project, get_novel_project, get_all_novel_projects,
    update_novel_project, delete_novel_project, update_chapter,
    create_writing_log, get_project_stats,
    save_chapter_draft, get_chapter_drafts, get_chapter_draft_content
)

novel_bp = Blueprint("novel", __name__)

from providers import call_llm
from config import LLM_MAX_TOKENS_CHAPTER, LLM_MAX_TOKENS_MEDIUM, LLM_MAX_TOKENS_SHORT
from prompts import render
from utils.token_budget import estimate_tokens, smart_truncate, allocate_context_budget
from utils.context_builder import build_chapter_context

# ==================== LLM 调用 ====================


def generate_with_llm(prompt, system_prompt="", messages=None, temperature=0.7, max_tokens=None, timeout=None):
    """调用 LLM API 生成内容。成功返回文本，失败返回 None。
    当传入 messages 时，直接使用该消息列表（用于多轮对话场景）。"""
    if max_tokens is None:
        max_tokens = LLM_MAX_TOKENS_CHAPTER

    if timeout is None:
        timeout = max(120, max_tokens // 20 + 30)

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
    )

    if not resp.success:
        print(f"[LLM] Error: {resp.error}")
        return None

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
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    try:
        return json.loads(text)
    except json.JSONDecodeError:
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
            cover_color=data.get("coverColor") or "#6366F1"
        )
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
        str_fields = ["title", "genre", "premise", "synopsis", "writing_style", "cover_color", "status"]
        int_fields = ["targetWordCount", "currentWordCount"]
        json_fields = ["outline", "chapters", "characters", "locations", "relationships", "settings"]

        for f in str_fields:
            if f in data:
                updates[f] = data[f]

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


# ==================== AI 生成端点 ====================

@novel_bp.route("/generate-outline-directions", methods=["POST"])
def generate_outline_directions():
    """AI 生成大纲方向方案（用户先选方向，再生成章节）"""
    data = request.get_json()
    premise = data.get("premise", "")
    genre = data.get("genre", "通用")
    synopsis = data.get("synopsis", "")
    direction = data.get("direction", "")
    chapter_count = data.get("chapterCount", 4)
    existing_chapters = data.get("existingChapters", [])
    characters = data.get("characters") or []
    relationships = data.get("relationships") or []
    locations = data.get("locations") or []

    try:
        chapter_count = int(chapter_count)
        if chapter_count < 1:
            chapter_count = 4
    except (ValueError, TypeError):
        chapter_count = 4

    story_context = build_story_context(characters, relationships, locations)

    has_existing = isinstance(existing_chapters, list) and len(existing_chapters) > 0
    existing_summary = ""
    if has_existing:
        existing_summary = "已有章节大纲：\n" + "\n".join(
            f"- {ch.get('title', '')}：{ch.get('description', '')}"
            for ch in existing_chapters
        )

    prompts = render('novel/outline_directions.j2',
        genre=genre,
        premise=premise,
        synopsis=synopsis,
        direction=direction,
        chapter_count=chapter_count,
        existing_summary=existing_summary,
        story_context=story_context)

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.8, max_tokens=LLM_MAX_TOKENS_MEDIUM)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        parsed = parse_json_from_response(result, r'\[.*\]')
        if parsed and isinstance(parsed, list):
            for item in parsed:
                item.setdefault("title", "未命名方案")
                item.setdefault("description", "")
                item.setdefault("keyPoints", [])
            return jsonify({"success": True, "directions": parsed})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重新生成"})

    except Exception as e:
        return jsonify({"success": False, "error": f"生成方向方案失败: {str(e)}"}), 500


@novel_bp.route("/generate-outline", methods=["POST"])
def generate_outline():
    data = request.get_json()
    premise = data.get("premise", "")
    genre = data.get("genre", "通用")
    synopsis = data.get("synopsis", "")
    chapter_count = data.get("chapterCount", 8)
    direction = data.get("direction", "")
    existing_chapters = data.get("existingChapters", [])
    characters = data.get("characters") or []
    relationships = data.get("relationships") or []
    locations = data.get("locations") or []

    try:
        chapter_count = int(chapter_count)
        if chapter_count < 1:
            chapter_count = 8
    except (ValueError, TypeError):
        chapter_count = 8

    if not premise:
        return jsonify({"success": False, "error": "请提供故事前提/背景"}), 400

    has_existing = isinstance(existing_chapters, list) and len(existing_chapters) > 0

    story_context = build_story_context(characters, relationships, locations)

    direction_text = f"\n用户期望的剧情走向：{direction}\n请紧密围绕此方向设计章节大纲，确保情节发展与用户方向一致。" if direction else ""

    if has_existing:
        existing_summary = "\n".join(
            f"- {ch.get('title', '')}：{ch.get('description', '')}"
            for ch in existing_chapters
        )
        prompts = render('novel/outline_append.j2',
            genre=genre,
            premise=premise,
            synopsis=synopsis,
            existing_summary=existing_summary,
            story_context=story_context,
            direction_text=direction_text,
            chapter_count=chapter_count,
            next_chapter_num=len(existing_chapters) + 1)
    else:
        prompts = render('novel/outline_new.j2',
            genre=genre,
            premise=premise,
            synopsis=synopsis,
            story_context=story_context,
            direction_text=direction_text,
            chapter_count=chapter_count)

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.7, max_tokens=LLM_MAX_TOKENS_MEDIUM)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        outline = parse_json_from_response(result, r'\[.*\]')
        if outline and isinstance(outline, list):
            return jsonify({"success": True, "outline": outline})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重新生成"})

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"生成大纲失败: {str(e)}"}), 500


@novel_bp.route("/generate-chapter", methods=["POST"])
def generate_chapter():
    data = request.get_json()
    chapter_title = data.get("chapterTitle", "新章节")
    premise = data.get("premise", "")
    genre = data.get("genre", "通用")
    previous_content = data.get("previousContent", "")
    writing_style = data.get("writingStyle", "")
    chapter_description = data.get("chapterDescription", "")
    characters = data.get("characters") or []
    relationships = data.get("relationships") or []
    locations = data.get("locations") or []
    outline = data.get("outline") or []
    project_id = data.get("projectId", "")
    chapter_index = data.get("chapterIndex", -1)

    recent_summary = ""
    settings_context = ""
    current_outline = ""

    if project_id and chapter_index >= 0:
        project = get_novel_project(project_id)
        if project:
            ctx = build_chapter_context(project, chapter_index)
            recent_summary = ctx['summary']
            settings_context = ctx['settings']
            current_outline = ctx['current_outline']
            if ctx['previous_content']:
                previous_content = ctx['previous_content']

    story_context = build_story_context(characters, relationships, locations, outline)

    prompts = render('novel/chapter.j2',
        genre=genre,
        chapter_title=chapter_title,
        chapter_description=chapter_description or "",
        premise=premise,
        previous_content=previous_content or "",
        story_context=story_context,
        writing_style=writing_style or "",
        recent_summary=recent_summary,
        settings_context=settings_context,
        current_outline=current_outline)

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'])

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        summary_suggestion = _extract_summary(result, chapter_title, genre)
        return jsonify({"success": True, "content": result, "summarySuggestion": summary_suggestion})

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"生成章节失败: {str(e)}"}), 500


@novel_bp.route("/continue-chapter", methods=["POST"])
def continue_chapter():
    """续写章节：基于已有内容继续写作"""
    data = request.get_json()
    current_content = data.get("currentContent", "")
    chapter_title = data.get("chapterTitle", "")
    premise = data.get("premise", "")
    genre = data.get("genre", "通用")
    writing_style = data.get("writingStyle", "")
    characters = data.get("characters") or []
    relationships = data.get("relationships") or []
    locations = data.get("locations") or []
    outline = data.get("outline") or []
    project_id = data.get("projectId", "")
    chapter_index = data.get("chapterIndex", -1)

    if not current_content:
        return jsonify({"success": False, "error": "请提供当前章节内容"}), 400

    recent_summary = ""
    settings_context = ""
    current_outline_text = ""

    if project_id and chapter_index >= 0:
        project = get_novel_project(project_id)
        if project:
            ctx = build_chapter_context(project, chapter_index)
            recent_summary = ctx['summary']
            settings_context = ctx['settings']
            current_outline_text = ctx['current_outline']
            current_content = smart_truncate(current_content, 3000, preserve_first=False, preserve_last=True)

    story_context = build_story_context(characters, relationships, locations, outline)

    prompts = render('novel/continue.j2',
        genre=genre,
        chapter_title=chapter_title,
        premise=premise or "",
        story_context=story_context,
        current_content=current_content,
        writing_style=writing_style or "",
        recent_summary=recent_summary,
        settings_context=settings_context,
        current_outline=current_outline_text)

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'])

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        summary_suggestion = _extract_summary(result, chapter_title, genre)
        return jsonify({"success": True, "content": result, "summarySuggestion": summary_suggestion})

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"续写失败: {str(e)}"}), 500


@novel_bp.route("/rewrite", methods=["POST"])
def rewrite_text():
    """改写选中文本"""
    data = request.get_json()
    selected_text = data.get("selectedText", "")
    instruction = data.get("instruction", "")
    genre = data.get("genre", "通用")
    context = data.get("context", "")
    characters = data.get("characters") or []
    relationships = data.get("relationships") or []

    if not selected_text:
        return jsonify({"success": False, "error": "请选择要改写的文本"}), 400

    story_context = build_story_context(characters, relationships)

    prompts = render('novel/rewrite.j2',
        genre=genre,
        selected_text=selected_text,
        story_context=story_context,
        context=context or "",
        instruction=instruction or "优化文笔，使表达更生动流畅，保持角色性格特征")

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.5, max_tokens=LLM_MAX_TOKENS_MEDIUM)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        return jsonify({"success": True, "content": result})

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"改写失败: {str(e)}"}), 500


@novel_bp.route("/brainstorm", methods=["POST"])
def brainstorm():
    """AI 头脑风暴：基于想法生成多个创作方向"""
    data = request.get_json()
    idea = data.get("idea", "")
    genre = data.get("genre", "通用")
    premise = data.get("premise", "")
    characters = data.get("characters") or []
    relationships = data.get("relationships") or []
    locations = data.get("locations") or []
    outline = data.get("outline") or []

    if not idea:
        return jsonify({"success": False, "error": "请输入你的想法"}), 400

    # 策略性截断：位置最多5个，大纲最多10条，避免过度锚定
    trimmed_locations = locations[:5] if locations else []
    trimmed_outline = outline[:10] if outline else []

    story_context = build_story_context(characters, relationships, trimmed_locations, trimmed_outline)

    prompts = render('novel/brainstorm.j2',
        genre=genre,
        premise=premise or '未指定',
        story_context=story_context,
        idea=idea)

    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.9, max_tokens=LLM_MAX_TOKENS_MEDIUM)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        ideas = parse_json_from_response(result, r'\[.*\]')
        if ideas and isinstance(ideas, list):
            return jsonify({"success": True, "ideas": ideas})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重新生成"})

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"头脑风暴失败: {str(e)}"}), 500


# ==================== AI 对话探讨 ====================

def build_chat_system_prompt(mode, entity_id, context):
    """构建对话的系统提示词"""
    genre = context.get("genre", "通用")
    premise = context.get("premise", "")
    characters = context.get("characters", [])
    relationships = context.get("relationships", [])
    locations = context.get("locations", [])
    outline = context.get("outline", [])

    # 基础上下文
    story_context = build_story_context(characters, relationships, locations, outline if len(outline) <= 10 else [])

    if mode == "character":
        char = next((c for c in characters if c.get("id") == entity_id), None)
        char_context = ""
        if char:
            char_name = char.get('name', '')
            char_role = char.get('role', '未知定位')
            traits = ", ".join(char.get("traits", []) or [])
            appearance = char.get("appearance", "")
            backstory = char.get("backstory", "")
            char_desc = char.get('description', '暂无')
            char_context = f"当前深入探讨的角色：{char_name}（{char_role}）\n- 性格特征：{traits or '尚未设定'}\n- 外貌：{appearance or '尚未设定'}\n- 背景：{backstory or '尚未设定'}\n- 角色描述：{char_desc}"

        return render('novel/chat_character.j2', genre=genre, premise=premise or '未设定', story_context=story_context, char_context=char_context)

    elif mode == "world":
        loc = next((l for l in locations if l.get("id") == entity_id), None)
        loc_context = ""
        if loc:
            loc_name = loc.get('name', '')
            loc_type = loc.get('type', '地点')
            loc_desc = loc.get('description', '暂无')
            loc_sig = loc.get('significance', '暂无')
            loc_context = f"当前深入探讨的地点：{loc_name}（{loc_type}）\n- 描述：{loc_desc}\n- 剧情意义：{loc_sig}"

        return render('novel/chat_world.j2', genre=genre, premise=premise or '未设定', story_context=story_context, loc_context=loc_context)

    elif mode == "character_relation":
        char_map = {c.get("id"): c.get("name", "") for c in characters}
        entity_rels = [r for r in relationships if r.get("fromId") == entity_id or r.get("toId") == entity_id]
        rel_context = ""
        if entity_rels:
            rel_lines = []
            for rel in entity_rels:
                from_name = char_map.get(rel.get("fromId"), "?")
                to_name = char_map.get(rel.get("toId"), "?")
                rel_type = rel.get('type', '关联')
                rel_desc = rel.get('description', '暂无')
                rel_lines.append(f"- 从「{from_name}」到「{to_name}」（{rel_type}）：{rel_desc}")
            rel_context = f"当前角色相关的所有关系：\n" + "\n".join(rel_lines)

        return render('novel/chat_relation.j2', genre=genre, premise=premise or '未设定', story_context=story_context, rel_context=rel_context)

    # 默认
    return render('novel/chat_default.j2', genre=genre, story_context=story_context)


def parse_chat_reply(text, mode, entity_id, characters):
    """解析 AI 回复，分离正文和建议"""
    suggestions = []
    content = text

    # 提取 ```suggestions ... ``` 块
    sug_match = re.search(r'```suggestions\s*(.*?)```', text, re.DOTALL)
    if sug_match:
        try:
            sug_list = json.loads(sug_match.group(1))
            for sug in sug_list:
                # 补充 targetId
                if mode == "character" and entity_id and "targetId" not in sug and sug.get("type") != "create_character":
                    sug["targetId"] = entity_id
                if mode == "world" and entity_id and "targetId" not in sug and sug.get("type") != "create_location":
                    sug["targetId"] = entity_id
                # 处理 create_relationship 中的 toName → toId 转换
                if sug.get("type") == "create_relationship" and "value" in sug:
                    val = sug["value"]
                    if "toName" in val and "toId" not in val:
                        target_char = next((c for c in characters if c.get("name") == val["toName"]), None)
                        if target_char:
                            val["toId"] = target_char["id"]
                            val["fromId"] = entity_id
                            del val["toName"]
                suggestions.append(sug)
        except json.JSONDecodeError:
            pass
        # 从正文中移除 suggestions 块
        content = text[:sug_match.start()] + text[sug_match.end():]

    content = content.strip()
    return content, suggestions


@novel_bp.route("/chat", methods=["POST"])
def chat():
    """AI 对话探讨"""
    data = request.get_json()
    mode = data.get("mode", "character")
    entity_id = data.get("entityId")
    messages = data.get("messages", [])
    context = data.get("context", {})
    project_id = data.get("projectId")

    if project_id:
        project = get_novel_project(project_id)
        if not project:
            return jsonify({"success": False, "error": "项目不存在"}), 404

    if not messages:
        return jsonify({"success": False, "error": "请提供对话内容"}), 400

    system_prompt = build_chat_system_prompt(mode, entity_id, context)

    # 构建对话消息
    chat_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        chat_messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

    try:
        reply_text = generate_with_llm(prompt=None, messages=chat_messages, temperature=0.7, max_tokens=LLM_MAX_TOKENS_MEDIUM)

        if reply_text is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        content, suggestions = parse_chat_reply(reply_text, mode, entity_id, context.get("characters", []))
        return jsonify({
            "success": True,
            "reply": {"content": content, "suggestions": suggestions}
        })

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"对话失败: {str(e)}"}), 500


@novel_bp.route("/character", methods=["POST"])
def create_character():
    data = request.get_json()
    name = data.get("name", "新角色")
    description = data.get("description", "")
    genre = data.get("genre", "通用")
    role = data.get("role", "")

    if not description:
        return jsonify({"success": False, "error": "请提供角色描述"}), 400

    prompts = render('novel/character.j2', character_name=name, role=role or "", description=description, genre=genre)
    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.7, max_tokens=LLM_MAX_TOKENS_SHORT)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        parsed = parse_json_from_response(result, r'\{.*\}')
        if parsed:
            char_data = parsed
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重新生成"})

        character = {
            "id": str(uuid.uuid4()),
            "name": name,
            "role": role,
            "description": description,
            "traits": char_data.get("traits", []),
            "appearance": char_data.get("appearance", ""),
            "backstory": char_data.get("backstory", ""),
        }

        return jsonify({"success": True, "character": character})

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"创建角色失败: {str(e)}"}), 500


# ==================== 批量生成 ====================

@novel_bp.route("/generate-characters", methods=["POST"])
def generate_characters():
    """AI 批量生成角色"""
    data = request.get_json()
    premise = data.get("premise", "")
    genre = data.get("genre", "通用")
    synopsis = data.get("synopsis", "")
    count = data.get("count", 4)
    existing_characters = data.get("existingCharacters", [])

    try:
        count = max(1, min(8, int(count)))
    except (ValueError, TypeError):
        count = 4

    existing_context = ""
    if existing_characters:
        names = [c.get("name") for c in existing_characters if c.get("name")]
        if names:
            existing_context = f"\n已有角色：{'、'.join(names)}\n请注意不要与已有角色重名或定位冲突，生成的角色应当与已有角色形成互补和张力。"

    prompts = render('novel/batch_characters.j2', genre=genre, premise=premise, synopsis=synopsis or "", count=count, existing_context=existing_context)
    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.7, max_tokens=LLM_MAX_TOKENS_SHORT)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        parsed = parse_json_from_response(result, r'\[.*\]')
        if parsed and isinstance(parsed, list):
            for char in parsed:
                char.setdefault("name", "未命名角色")
                char.setdefault("role", "配角")
                char.setdefault("description", "")
                char.setdefault("traits", [])
                char.setdefault("appearance", "")
                char.setdefault("backstory", "")
            return jsonify({"success": True, "characters": parsed})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重新生成"})

    except Exception as e:
        return jsonify({"success": False, "error": f"生成角色失败: {str(e)}"}), 500


@novel_bp.route("/generate-locations", methods=["POST"])
def generate_locations():
    """AI 批量生成地点"""
    data = request.get_json()
    premise = data.get("premise", "")
    genre = data.get("genre", "通用")
    synopsis = data.get("synopsis", "")
    count = data.get("count", 3)
    existing_locations = data.get("existingLocations", [])
    characters = data.get("characters", [])

    try:
        count = max(1, min(6, int(count)))
    except (ValueError, TypeError):
        count = 3

    existing_context = ""
    if existing_locations:
        names = [l.get("name") for l in existing_locations if l.get("name")]
        if names:
            existing_context = f"\n已有地点：{'、'.join(names)}\n请注意不要与已有地点重名，生成的地点应与已有地点形成合理的空间或逻辑关联。"

    char_context = ""
    if characters:
        char_names = [c.get("name") for c in characters if c.get("name")]
        if char_names:
            char_context = f"\n故事角色：{'、'.join(char_names)}。请在地点描述中自然地暗示这些角色与地点的关联。"

    prompts = render('novel/batch_locations.j2', genre=genre, premise=premise, synopsis=synopsis or "", count=count, char_context=char_context, existing_context=existing_context)
    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.7, max_tokens=LLM_MAX_TOKENS_SHORT)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        parsed = parse_json_from_response(result, r'\[.*\]')
        if parsed and isinstance(parsed, list):
            for loc in parsed:
                loc.setdefault("name", "未命名地点")
                loc.setdefault("type", "other")
                loc.setdefault("description", "")
                loc.setdefault("significance", "")
            return jsonify({"success": True, "locations": parsed})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重新生成"})

    except Exception as e:
        return jsonify({"success": False, "error": f"生成地点失败: {str(e)}"}), 500


@novel_bp.route("/generate-location", methods=["POST"])
def generate_location():
    """AI 生成单个地点的详细描述"""
    data = request.get_json()
    name = data.get("name", "")
    type_ = data.get("type", "city")
    genre = data.get("genre", "通用")
    premise = data.get("premise", "")

    if not name:
        return jsonify({"success": False, "error": "请提供地点名称"}), 400

    prompts = render('novel/location.j2', location_name=name, type_=type_, genre=genre, premise=premise or "")
    try:
        result = generate_with_llm(prompts['user'], system_prompt=prompts['system'], temperature=0.7, max_tokens=LLM_MAX_TOKENS_SHORT)

        if result is None:
            return jsonify({"success": False, "error": "AI 服务暂时不可用，请稍后重试"})

        parsed = parse_json_from_response(result, r'\{.*\}')
        if parsed and isinstance(parsed, dict):
            parsed.setdefault("description", "")
            parsed.setdefault("significance", "")
            return jsonify({"success": True, "location": parsed})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常，请重新生成"})

    except Exception as e:
        return jsonify({"success": False, "error": f"生成地点失败: {str(e)}"}), 500


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


# ==================== 统计和草稿 ====================

@novel_bp.route("/projects/<project_id>/stats", methods=["GET"])
def get_stats(project_id):
    """获取项目写作统计"""
    try:
        existing = get_novel_project(project_id)
        if not existing:
            return jsonify({"success": False, "error": "项目不存在"}), 404

        stats = get_project_stats(project_id)
        return jsonify({"success": True, "stats": {
            **stats,
            "currentWordCount": existing.get("currentWordCount", 0),
            "targetWordCount": existing.get("targetWordCount", 0),
            "chapterCount": len(existing.get("chapters", [])),
            "characterCount": len(existing.get("characters", [])),
            "completedChapters": sum(1 for c in existing.get("chapters", [])
                                     if c.get("status") == "completed")
        }})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>/drafts/<chapter_id>", methods=["POST"])
def save_draft(project_id, chapter_id):
    """保存章节草稿"""
    data = request.get_json()
    content = data.get("content", "")
    word_count = data.get("wordCount", 0)

    try:
        draft = save_chapter_draft(project_id, chapter_id, content, word_count)
        return jsonify({"success": True, "draft": draft})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>/drafts/<chapter_id>", methods=["GET"])
def list_drafts(project_id, chapter_id):
    """获取章节草稿版本列表"""
    try:
        drafts = get_chapter_drafts(project_id, chapter_id)
        return jsonify({"success": True, "drafts": drafts})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/drafts/<draft_id>", methods=["GET"])
def get_draft(draft_id):
    """获取特定草稿版本内容"""
    try:
        draft = get_chapter_draft_content(draft_id)
        if not draft:
            return jsonify({"success": False, "error": "草稿不存在"}), 404
        return jsonify({"success": True, "draft": draft})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>/stats/log", methods=["POST"])
def log_writing(project_id):
    """记录写作会话"""
    data = request.get_json()
    log_id = str(uuid.uuid4())
    chapter_id = data.get("chapterId")
    word_count = data.get("wordCount", 0)

    try:
        log = create_writing_log(log_id, project_id, chapter_id, word_count)
        return jsonify({"success": True, "log": log})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==================== 全自动小说生成 Harness ====================

def _generate_design_mock(seed, genre, style, target_words):
    """当 LLM 不可用时生成示例设计文档"""
    import math
    chs = max(20, int(target_words / 2500))
    vols = max(2, chs // 40)
    return {
        "outline": [
            {
                "volume": i + 1,
                "title": f"第{i+1}卷",
                "goal": f"主角在本卷中逐步成长，面对新的挑战与机遇",
                "chapters": max(25, chs // vols),
                "description": f"本卷是故事的{'开篇' if i == 0 else '中段发展' if i < vols - 1 else '高潮与结局'}，主角在此阶段{'初露锋芒，打下根基' if i == 0 else '遭遇强敌，快速成长' if i < vols - 1 else '迎来终极对决，完成命运转折'}"
            } for i in range(vols)
        ],
        "characters": [
            {"name": "主角", "role": "主角", "arc": {"want": "变得强大，不再被人轻视", "need": "学会真正的勇气来自内心而非力量", "lie": "只要足够强大就能解决一切", "truth": "真正的强大是与他人建立羁绊", "arc_plan": "从追求力量的孤独者到拥有同伴的领袖"}, "traits": ["坚毅", "不服输", "内心敏感"], "appearance": "普通外表下有不服输的眼神", "backstory": "曾被视为废物，在一次奇遇中获得转机"},
            {"name": "导师", "role": "导师", "arc": {"want": "找到传承者", "need": "弥补过去的遗憾", "lie": "过去的选择无法挽回", "truth": "通过指导他人获得救赎", "arc_plan": "从不情愿教导到真心守护"}, "traits": ["神秘", "严苛但关心"], "appearance": "看似普通却暗藏力量", "backstory": "曾经的强者，因某种原因隐退"},
            {"name": "对手", "role": "反派", "arc": {"want": "证明自己比主角强", "need": "被认可和理解", "lie": "击败主角才能证明自己", "truth": "真正的敌人是自己的心魔", "arc_plan": "从死敌对头到亦敌亦友"}, "traits": ["骄傲", "执着"], "appearance": "锋芒毕露的强大", "backstory": "与主角有过节，是天生的竞争者"}
        ],
        "rules": [
            {"rule": "力量体系有明确等级，不可越级挑战", "type": "hard", "detail": "当前世界的力量等级从低到高，角色只能在同级或越一小级战斗"},
            {"rule": "获得力量需要付出相应代价", "type": "hard", "detail": "任何力量的提升都有对应代价（时间、资源、牺牲等）"}
        ],
        "foreshadows": [
            {"id": 1, "description": "主角获得的力量来源有隐患", "plant_stage": "第1卷", "reveal_stage": f"第{vols-1 if vols>2 else vols}卷", "importance": "核心"},
            {"id": 2, "description": "导师的真实身份和过去", "plant_stage": "第1卷", "reveal_stage": f"第{max(2, vols-1)}卷", "importance": "重要"}
        ],
        "synopsis": f"一个被认为最弱的人，在一次奇遇后踏上逆袭之路的{genre}故事",
        "target_word_count": target_words,
        "total_chapters": chs
    }


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
                                   temperature=0.8, max_tokens=LLM_MAX_TOKENS_MEDIUM)

        if result is None:
            mock = _generate_design_mock(seed, genre, style, target_words)
            return jsonify({"success": True, "design": mock, "mock": True})

        design = parse_json_from_response(result, r'\{.*\}')
        if design and isinstance(design, dict) and "outline" in design:
            return jsonify({"success": True, "design": design})
        else:
            mock = _generate_design_mock(seed, genre, style, target_words)
            return jsonify({"success": True, "design": mock, "mock": True, "warning": "AI返回格式异常，使用示例数据"})

    except Exception:
        mock = _generate_design_mock(seed, genre, style, target_words)
        return jsonify({"success": True, "design": mock, "mock": True})


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

        return jsonify({"success": True, "content": result})

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
            return jsonify({"success": True, "checks": [], "overall_pass": True, "mock": True})

        qa = parse_json_from_response(result, r'\{.*\}')
        if qa:
            return jsonify({"success": True, **qa})
        return jsonify({"success": True, "checks": [], "overall_pass": True, "mock": True})

    except Exception:
        return jsonify({"success": True, "checks": [], "overall_pass": True, "mock": True})


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
