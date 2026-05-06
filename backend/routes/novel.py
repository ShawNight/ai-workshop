import json
import re
import uuid
import requests
from flask import Blueprint, request, jsonify

from database import (
    create_novel_project, get_novel_project, get_all_novel_projects,
    update_novel_project, delete_novel_project, update_chapter,
    create_writing_log, get_project_stats,
    save_chapter_draft, get_chapter_drafts, get_chapter_draft_content
)

novel_bp = Blueprint("novel", __name__)

from config import LLM_API_KEY, LLM_CHAT_URL, LLM_CHAT_MODEL, get_proxies, LLM_MAX_TOKENS_CHAPTER, LLM_MAX_TOKENS_MEDIUM, LLM_MAX_TOKENS_SHORT
from prompts import render
from utils.token_budget import estimate_tokens, smart_truncate, allocate_context_budget
from utils.context_builder import build_chapter_context

# ==================== LLM 调用 ====================


def generate_with_llm(prompt, system_prompt="", messages=None, temperature=0.7, max_tokens=None, timeout=None):
    """调用 LLM API 生成内容。成功返回文本，失败或无 API key 返回 None。
    当传入 messages 时，直接使用该消息列表（用于多轮对话场景）。"""
    if not LLM_API_KEY:
        return None

    if max_tokens is None:
        max_tokens = LLM_MAX_TOKENS_CHAPTER

    if timeout is None:
        timeout = max(120, max_tokens // 20 + 30)

    if messages is None:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

    try:
        response = requests.post(
            LLM_CHAT_URL,
            json={
                "model": LLM_CHAT_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=timeout,
        )

        data = response.json()
        if data.get("base_resp", {}).get("status_code") != 0:
            print(f"[LLM] API error: {data.get('base_resp', {}).get('status_msg', 'Unknown')}")
            return None

        # Chat Completions API: choices[0].message.content
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            print("[LLM] API returned empty content")
            return None

        # Strip <think>...</think> reasoning blocks
        content = re.sub(r'<think>.*?</think>\s*', '', content, flags=re.DOTALL).strip()

        return content
    except requests.exceptions.Timeout:
        print("[LLM] Request timeout")
        return None
    except Exception as e:
        print(f"[LLM] Call failed: {e}")
        return None


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

        return jsonify({"success": True, "content": result})

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

        return jsonify({"success": True, "content": result})

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

    prompts = render('novel/character.j2', name=name, role=role or "", description=description, genre=genre)
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

    prompts = render('novel/location.j2', name=name, type_=type_, genre=genre, premise=premise or "")
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
