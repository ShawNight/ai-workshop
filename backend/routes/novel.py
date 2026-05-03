import json
import re
import uuid
import requests
from flask import Blueprint, request, jsonify

from database import (
    create_novel_project, get_novel_project, get_all_novel_projects,
    update_novel_project, delete_novel_project,
    create_writing_log, get_project_stats,
    save_chapter_draft, get_chapter_drafts, get_chapter_draft_content
)

novel_bp = Blueprint("novel", __name__)

from config import LLM_API_KEY, LLM_CHAT_URL, LLM_CHAT_MODEL, get_proxies

# ==================== LLM 调用 ====================

MOCK_OUTLINE = [
    {"title": "第一章：序幕拉开", "description": "主角在平凡的日常中第一次接触到改变命运的契机，埋下故事的核心冲突。"},
    {"title": "第二章：踏入未知", "description": "主角离开舒适区，进入全新的世界或环境，结识重要盟友，初步了解面临的挑战。"},
    {"title": "第三章：初次考验", "description": "主角遭遇第一次重大挫折或战斗，暴露出自身不足，但在困境中展现出潜力。"},
    {"title": "第四章：转折之路", "description": "故事迎来关键转折，主角获得重要信息或力量，但代价是失去或牺牲某些东西。"},
    {"title": "第五章：至暗时刻", "description": "矛盾全面爆发，主角面临最大的危机和内心挣扎，似乎一切都在走向毁灭。"},
    {"title": "第六章：绝地反击", "description": "在最黑暗的时刻，主角找到突破口，联合盟友发起关键反击，扭转局势。"},
    {"title": "第七章：真相大白", "description": "隐藏的真相浮出水面，主角发现一切并非表面所见，最终敌人露出真面目。"},
    {"title": "第八章：破晓新生", "description": "主角突破自我极限，解决核心冲突，故事走向结局，但同时为可能的续篇留下空间。"},
]

MOCK_CHAPTER = """夜色如墨，星辰稀疏地挂在天空。

{chapter_title}

风从远处吹来，带着一丝凉意。他站在窗前，目光穿过黑暗，望向远方模糊的轮廓。

"你真的决定了吗？"身后传来一个低沉的声音。

他没有回头，只是微微点了点头。"已经没有回头路了。"

身后的脚步声渐近，一只手搭上了他的肩膀。"那好，我陪你去。"

他转过身，看着眼前这个陪伴了自己多年的朋友，嘴角终于露出一丝笑意。"谢谢你。"

夜色更深了，但两颗心却比任何时候都要明亮。他们知道，前方的路不会平坦，但至少不是一个人走。

月光透过云层洒下来，照亮了他们面前那条蜿蜒的小径。远处传来隐约的雷声，预示着一场暴风雨即将来临。

但他们不再畏惧。"""


def generate_with_llm(prompt, system_prompt="", messages=None):
    """调用 LLM API 生成内容。成功返回文本，失败或无 API key 返回 None。
    当传入 messages 时，直接使用该消息列表（用于多轮对话场景）。"""
    if not LLM_API_KEY:
        return None

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
                "max_tokens": 4096,
                "temperature": 0.7
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=120,
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


# ==================== AI 生成端点 ====================

@novel_bp.route("/generate-outline", methods=["POST"])
def generate_outline():
    data = request.get_json()
    premise = data.get("premise", "")
    genre = data.get("genre", "通用")
    synopsis = data.get("synopsis", "")
    chapter_count = data.get("chapterCount", 8)
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

    if has_existing:
        existing_summary = "\n".join(
            f"- {ch.get('title', '')}：{ch.get('description', '')}"
            for ch in existing_chapters
        )
        system_prompt = f"""你是一位资深的小说大纲设计师，专精于{genre}类型小说的结构设计。
你的任务是基于已有的故事大纲，续写追加新的章节。保持与已有章节的叙事连贯和因果递进。
{"如果提供了角色和世界观设定，请在大纲中合理利用这些设定，让情节自然地涉及这些角色和地点。" if story_context else ""}
输出必须是严格的 JSON 数组格式，只包含新增的章节。"""
        user_prompt = f"""类型：{genre}
故事前提：{premise}
{synopsis and f'故事简介：{synopsis}' or ''}

已有章节大纲：
{existing_summary}

{story_context}

请继续这个故事，追加{chapter_count}个新章节，每章包含：
- title: 章节标题（含章节序号，从第{len(existing_chapters) + 1}章开始）
- description: 章节概要（50-100字，包含核心情节和冲突）

只返回 JSON 数组，格式如：
[{{"title": "第{len(existing_chapters) + 1}章：xxxx", "description": "..."}}, ...]"""
    else:
        system_prompt = f"""你是一位资深的小说大纲设计师，专精于{genre}类型小说的结构设计。
你的任务是生成一个逻辑严密、节奏紧凑的故事大纲，包含 {chapter_count} 个章节。
每个章节需要有明确的核心冲突和情感弧线，章节之间需要有因果递进关系。
{"如果提供了角色和世界观设定，请在大纲中合理利用这些设定，让情节自然地涉及这些角色和地点。" if story_context else ""}
输出必须是严格的 JSON 数组格式。"""
        user_prompt = f"""类型：{genre}
故事前提：{premise}
{synopsis and f'故事简介：{synopsis}' or ''}

{story_context}

请生成一个包含{chapter_count}章的故事大纲，每章包含：
- title: 章节标题（含章节序号，如"第一章：xxxx"）
- description: 章节概要（50-100字，包含核心情节和冲突）

只返回 JSON 数组，格式如：
[{{"title": "第一章：xxxx", "description": "..."}}, ...]"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        mock_data = MOCK_OUTLINE if not has_existing else [
            {"title": f"第{len(existing_chapters) + i + 1}章：新篇章", "description": f"第{len(existing_chapters) + i + 1}章的精彩内容，故事继续展开。"}
            for i in range(chapter_count)
        ]

        if result is None:
            return jsonify({"success": True, "outline": mock_data[:chapter_count] if not has_existing else mock_data,
                           "mock": True, "message": "未配置 API Key，返回示例大纲"})

        outline = parse_json_from_response(result, r'\[.*\]')
        if outline and isinstance(outline, list):
            return jsonify({"success": True, "outline": outline})
        else:
            return jsonify({"success": True, "outline": mock_data[:chapter_count] if not has_existing else mock_data,
                           "mock": True, "message": "AI 返回格式异常，使用示例大纲"})

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

    story_context = build_story_context(characters, relationships, locations, outline)

    system_prompt = f"""你是一位专业的小说作家，专精于{genre}类型小说的创作。
根据提供的章节信息、故事背景、角色设定和前文内容，创作一个生动、引人入胜的章节。
{writing_style and f'请使用以下写作风格：{writing_style}' or ''}
确保与前文衔接自然，同时本章节有独立的情节完整性。
严格遵守已设定的角色性格、关系和背景，不要引入与已有设定矛盾的内容。
注重场景描写、人物对话和心理刻画，保持叙事节奏感。
如果提供了角色关系信息，请在情节中合理利用这些关系推动故事发展。"""

    user_prompt = f"""章节标题：{chapter_title}
{chapter_description and f'章节概要：{chapter_description}' or ''}
故事类型：{genre}
故事背景：{premise or '一个充满悬念和惊喜的故事'}
前文摘要：{previous_content or '（故事开篇）'}

{story_context}

请创作本章节内容，要求：
1. 字数在 1000-2000 字之间
2. 包含清晰的开头、发展和结尾
3. 适当的人物对话、心理描写和环境描写，对话要符合角色性格
4. 与前文自然衔接
5. 如果提供了角色列表，至少让其中 1-2 个角色在本章出场或产生情节推动"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            mock = MOCK_CHAPTER.replace("{chapter_title}", chapter_title)
            return jsonify({"success": True, "content": mock,
                           "mock": True, "message": "未配置 API Key，返回示例内容"})

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

    if not current_content:
        return jsonify({"success": False, "error": "请提供当前章节内容"}), 400

    story_context = build_story_context(characters, relationships, locations, outline)

    system_prompt = f"""你是一位专业的{genre}小说续写作家。
你的任务是接着已有的内容自然地继续写下去，保持一致的文风、语气和叙事节奏。
不要重复已有内容，从断点处自然延续。
严格遵守已设定的角色性格和关系，确保角色言行一致。
{writing_style and f'写作风格：{writing_style}' or ''}"""

    user_prompt = f"""章节：{chapter_title}
类型：{genre}
故事背景：{premise or ''}

{story_context}

已有内容（结尾部分）：
{current_content[-500:]}

请从以上内容断点处自然续写，字数在 500-1000 字。确保文风一致，情节合理推进，角色行为符合其设定。直接输出小说正文内容，不要添加任何标题、标记或前缀说明。"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            mock = f"夜风渐起，吹动了他的衣角。他凝视着远方，心中涌起难以名状的情绪。\n\n这一刻，他终于明白了那些年长者口中的话——有些路，注定要一个人走完。但他并不孤单，因为那些曾经帮助过他的人，他们的意志已经融入了他的每一步。\n\n他深吸一口气，迈出了坚定的一步。"
            return jsonify({"success": True, "content": mock,
                           "mock": True, "message": "未配置 API Key，返回示例内容"})

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

    system_prompt = f"""你是一位专业的{genre}小说编辑。
根据用户的改写要求，对指定文本进行改写。保持原意但优化表达。
尊重已设定的角色性格和关系，保持人物言行一致。
{context and f'上下文参考：{context}' or ''}"""

    user_prompt = f"""原文：
{selected_text}

{story_context}

改写要求：{instruction or '优化文笔，使表达更生动流畅，保持角色性格特征'}

请直接返回改写后的文本，不要加解释和标记。"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            return jsonify({"success": True, "content": selected_text,
                           "mock": True, "message": "未配置 API Key，返回原文"})

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

    system_prompt = f"""你是一位创意小说策划，专精于{genre}类型。
针对用户的想法，结合已有的角色、关系和世界观设定，生成 3 个不同的创作方向建议，每个建议包含：
- 一个吸引人的方向标题
- 简要的情节发展思路（50-100字）
如果提供了角色关系或世界观信息，请让生成的方向尽量利用这些设定，但同时保持创意的发散性。
输出 JSON 数组格式。"""

    user_prompt = f"""类型：{genre}
故事背景：{premise or '未指定'}
{story_context}
用户想法：{idea}

请生成 3 个创作方向建议，返回 JSON：
[
  {{"title": "方向标题", "description": "情节发展思路"}},
  ...
]"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            mock = [
                {"title": "方向一：冲突升级", "description": "将当前矛盾放大，引入第三方势力使局势更加复杂，主角被迫在夹缝中做出抉择。"},
                {"title": "方向二：内心成长", "description": "聚焦主角的内心世界，通过一段独处或旅程揭示其过往秘密，完成性格蜕变。"},
                {"title": "方向三：意外转折", "description": "引入一个意想不到的反转，颠覆读者对某个人物或事件的认知，重新定义故事走向。"},
            ]
            return jsonify({"success": True, "ideas": mock,
                           "mock": True, "message": "未配置 API Key，返回示例"})

        ideas = parse_json_from_response(result, r'\[.*\]')
        if ideas and isinstance(ideas, list):
            return jsonify({"success": True, "ideas": ideas})
        else:
            return jsonify({"success": False, "error": "AI 返回格式异常"}), 500

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

        return f"""你是一位专业的小说角色分析师，专精于{genre}类型小说。

你的任务是与用户深入探讨角色设定，帮助用户挖掘角色的深度、复杂性和内在逻辑。

【你的能力】
- 分析角色的核心动机、最深层渴望和恐惧
- 发现角色性格中的矛盾和张力
- 推断角色的成长弧线和变化轨迹
- 设计角色与其他角色之间的动态关系
- 补充和完善角色设定的细节

【工作方式】
1. 先理解用户的问题或话题
2. 结合已有的角色设定进行深入分析
3. 给出有洞察力的回答，适当引用角色设定中的具体内容作为依据
4. 主动提供可操作的建议（见下方）

【建议格式】
在回复末尾，请以如下格式提供可采纳的建议（如有）：

```suggestions
[
  {{"type": "update_character", "targetId": "角色ID", "field": "字段名", "value": "新值", "label": "更新description为..."}},
  {{"type": "add_trait", "targetId": "角色ID", "value": "新特征", "label": "添加性格特征"}},
  {{"type": "create_relationship", "value": {{"fromId": "A的ID", "toId": "B的ID", "type": "关系类型", "description": "关系描述"}}}},
  {{"type": "create_character", "value": {{"name": "角色名", "role": "定位", "description": "描述", "traits": ["特征1", "特征2"]}}}},
  {{"type": "ask_question", "value": "你觉得他会在面对...时怎么做？", "label": "追问"}}
]
```

【当前项目信息】
类型：{genre}
前提：{premise or '未设定'}

{story_context}

【当前探讨角色】
{char_context}

请基于以上信息，与用户深入探讨角色设定。回答要有深度，适当引用角色已有设定，避免泛泛而谈。"""

    elif mode == "world":
        loc = next((l for l in locations if l.get("id") == entity_id), None)
        loc_context = ""
        if loc:
            loc_name = loc.get('name', '')
            loc_type = loc.get('type', '地点')
            loc_desc = loc.get('description', '暂无')
            loc_sig = loc.get('significance', '暂无')
            loc_context = f"当前深入探讨的地点：{loc_name}（{loc_type}）\n- 描述：{loc_desc}\n- 剧情意义：{loc_sig}"

        return f"""你是一位专业的小说世界观构建师，专精于{genre}类型。

你的任务是与用户深入探讨世界观设定，帮助完善故事发生的世界。

【你的能力】
- 设计和丰富地点的历史、文化、社会结构
- 发现世界观的逻辑漏洞或不一致
- 建立各地点之间的地理、政治、文化关联
- 补充世界规则的细节
- 为地点设计独特的风土人情

【工作方式】
1. 理解用户想探讨的具体话题
2. 结合已有的世界观设定进行延伸
3. 给出有创意且合理的建议
4. 主动提供可操作的建议

【建议格式】
在回复末尾，请以如下格式提供可采纳的建议（如有）：

```suggestions
[
  {{"type": "update_location", "targetId": "地点ID", "field": "字段名", "value": "新值", "label": "更新description为..."}},
  {{"type": "add_location_detail", "targetId": "地点ID", "field": "description", "value": "，补充描述...", "label": "补充细节"}},
  {{"type": "create_location", "value": {{"name": "地点名", "type": "类型", "description": "描述", "significance": "剧情意义"}}}},
  {{"type": "ask_question", "value": "这个地方的政权结构是怎样的？", "label": "追问"}}
]
```

【当前项目信息】
类型：{genre}
前提：{premise or '未设定'}

{story_context}

【当前探讨地点】
{loc_context}

请基于以上信息，与用户深入探讨世界观设定。"""

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

        return f"""你是一位专业的小说关系分析师。

你的任务是与用户探讨角色之间的关系张力、动态变化和发展可能性。

【你的能力】
- 分析角色间关系的深层逻辑
- 设计关系的转折点和冲突
- 发现关系的潜在发展空间
- 建议关系的发展方向

【建议格式】
```suggestions
[
  {{"type": "update_relationship", "targetId": "关系ID", "field": "字段名", "value": "新值", "label": "更新关系"}},
  {{"type": "create_relationship", "value": {{"fromId": "A的ID", "toId": "B的ID", "type": "关系类型", "description": "关系描述"}}}},
  {{"type": "ask_question", "value": "如果他们之间发生了...会怎样？", "label": "追问"}}
]
```

{story_context}

【当前关系】
{rel_context}

请与用户深入探讨角色间的关系。"""

    # 默认
    return f"""你是一位专业的小说创作顾问，专精于{genre}类型。

【建议格式】
```suggestions
[
  {{"type": "ask_question", "value": "...", "label": "追问"}}
]
```

{story_context}

请回答用户的问题，并在回复末尾提供可采纳的建议（如有）。"""


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
        reply_text = generate_with_llm(prompt=None, messages=chat_messages)

        if reply_text is None:
            mock_reply = "（未配置 API Key，无法进行 AI 对话）你可以尝试手动完善这个角色的设定。"
            return jsonify({
                "success": True,
                "reply": {"content": mock_reply, "suggestions": []},
                "mock": True
            })

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

    system_prompt = f"""你是一位专业的{genre}类型小说角色设计师。
根据用户提供的角色信息，生成详细的角色设定，包括：
- traits: 3-5个性格特征标签
- appearance: 外貌描述（30-50字）
- backstory: 背景故事简述（50-100字）
输出 JSON 格式。"""

    user_prompt = f"""角色名称：{name}
{role and f'角色定位：{role}' or ''}
角色描述：{description}
故事类型：{genre}

返回 JSON：
{{
  "traits": ["特征1", "特征2", "特征3"],
  "appearance": "外貌描述",
  "backstory": "背景故事"
}}"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            char_data = {
                "traits": ["勇敢", "聪明", "善良"],
                "appearance": "中等身材，目光坚定，常穿简朴的深色衣物。",
                "backstory": "出身平凡的Ta，因为一次意外事件卷入了命运的漩涡，从此踏上了一条不平凡的道路。"
            }
        else:
            parsed = parse_json_from_response(result, r'\{.*\}')
            if parsed:
                char_data = parsed
            else:
                char_data = {"traits": ["勇敢", "聪明", "善良"],
                            "appearance": "", "backstory": ""}

        character = {
            "id": str(uuid.uuid4()),
            "name": name,
            "role": role,
            "description": description,
            "traits": char_data.get("traits", ["勇敢", "聪明", "善良"]),
            "appearance": char_data.get("appearance", ""),
            "backstory": char_data.get("backstory", ""),
        }

        return jsonify({"success": True, "character": character,
                       "mock": result is None})

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"创建角色失败: {str(e)}"}), 500


# ==================== 批量生成 ====================

MOCK_BATCH_CHARACTERS = [
    {"name": "林昊", "role": "主角", "description": "性格坚毅的年轻人，命运多舛但从未放弃", "traits": ["坚毅", "善良", "执着"], "appearance": "身材挺拔，目光如炬，常穿青色长衫", "backstory": "出身寒门，幼年丧父，凭借毅力一路成长。"},
    {"name": "赵霜寒", "role": "反派", "description": "阴沉冷酷，但对往事有一丝执念", "traits": ["冷酷", "聪明", "偏执"], "appearance": "面容冷峻，眉间有疤，黑袍加身", "backstory": "曾是天才少年，因遭遇不公而走向黑暗。"},
    {"name": "老陈", "role": "导师", "description": "看似邋遢的老者，实则深藏不露", "traits": ["睿智", "随和", "神秘"], "appearance": "白发苍苍，衣衫褴褛，眼中时有精光", "backstory": "来历不明，似乎洞知一切，总在关键时刻出现。"},
    {"name": "苏灵儿", "role": "盟友", "description": "活泼灵动，擅长情报收集", "traits": ["机敏", "乐观", "忠诚"], "appearance": "面容清秀，行动如风，常带笑意", "backstory": "世家之后，因家族变故独自闯荡。"},
]


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

    system_prompt = f"""你是一位专业的{genre}类型小说角色设计师。
根据提供的故事信息，设计 {count} 个角色，要求：
- 角色之间有自然的关系和互动潜力
- 每个角色都有独特的性格、外貌和背景
- 角色的设定要服务于故事的整体叙事
- 不要给角色分配id字段

输出严格的 JSON 数组格式：
[{{"name": "角色名", "role": "主角/配角/反派/导师/盟友/恋人/路人", "description": "角色描述（20-50字）", "traits": ["特征1", "特征2", "特征3"], "appearance": "外貌描述（20-40字）", "backstory": "背景故事简述（30-60字）"}}]"""

    user_prompt = f"""类型：{genre}
故事前提：{premise or '一个充满冒险和成长的故事'}
{synopsis and f'故事简介：{synopsis}' or ''}
请设计 {count} 个角色。{existing_context}

只返回 JSON 数组，不要添加其他解释。"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            return jsonify({
                "success": True,
                "characters": MOCK_BATCH_CHARACTERS[:count],
                "mock": True,
                "message": "未配置 API Key，返回示例角色"
            })

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
            return jsonify({
                "success": True,
                "characters": MOCK_BATCH_CHARACTERS[:count],
                "mock": True,
                "message": "AI 返回格式异常，使用示例角色"
            })

    except Exception as e:
        return jsonify({"success": False, "error": f"生成角色失败: {str(e)}"}), 500


MOCK_BATCH_LOCATIONS = [
    {"name": "凌霄城", "type": "city", "description": "雄伟的古城，矗立于云海之上。城墙由千年寒铁铸就，城中灵气充沛，是修炼者的圣地。", "significance": "故事的主要舞台，各方势力交汇之处"},
    {"name": "幽冥谷", "type": "wilderness", "description": "终年雾气弥漫的深谷，传闻中通往冥界的入口。谷中瘴气弥漫，寻常人难以涉足。", "significance": "主角觉醒力量的地方，也是重要秘密的藏匿之处"},
    {"name": "天机阁", "type": "building", "description": "建于悬崖之上的古老楼阁，藏有天下奇书无数。阁主神秘莫测，似与各势力都有联系。", "significance": "情报网的中心，主角多次获得关键信息的地方"},
]


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

    system_prompt = f"""你是一位专业的{genre}类型小说世界观设计师。
根据提供的故事信息，设计 {count} 个故事关键地点，要求：
- 每个地点有独特的氛围和故事重要性
- 地点之间有合理的空间或逻辑联系
- 不要给地点分配id字段

输出严格的 JSON 数组格式：
[{{"name": "地点名", "type": "city/village/wilderness/realm/building/other", "description": "详细描述（50-100字，包含氛围和特征）", "significance": "剧情意义（20-40字）"}}]"""

    user_prompt = f"""类型：{genre}
故事前提：{premise or '一个充满冒险和成长的故事'}
{synopsis and f'故事简介：{synopsis}' or ''}{char_context}{existing_context}
请设计 {count} 个地点。

只返回 JSON 数组，不要添加其他解释。"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            return jsonify({
                "success": True,
                "locations": MOCK_BATCH_LOCATIONS[:count],
                "mock": True,
                "message": "未配置 API Key，返回示例地点"
            })

        parsed = parse_json_from_response(result, r'\[.*\]')
        if parsed and isinstance(parsed, list):
            for loc in parsed:
                loc.setdefault("name", "未命名地点")
                loc.setdefault("type", "other")
                loc.setdefault("description", "")
                loc.setdefault("significance", "")
            return jsonify({"success": True, "locations": parsed})
        else:
            return jsonify({
                "success": True,
                "locations": MOCK_BATCH_LOCATIONS[:count],
                "mock": True,
                "message": "AI 返回格式异常，使用示例地点"
            })

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

    system_prompt = f"""你是一位专业的{genre}类型小说世界观设计师。
根据用户提供的地点基本信息，生成详细的地点设定，包括：
- description: 详细描述（80-150字，包含地理特征、氛围、历史文化等）
- significance: 剧情意义（20-40字，说明这个地点在故事中的重要作用）
输出 JSON 格式。"""

    user_prompt = f"""地点名称：{name}
地点类型：{type_}
故事类型：{genre}
{premise and f'故事背景：{premise}' or ''}

返回 JSON：
{{"description": "...", "significance": "..."}}"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            mock_data = {
                "description": f"{name}是一处充满故事的地方。古老的建筑与自然景观交织，空气中弥漫着历史的气息。这里曾经发生过许多重要事件，每一条街道都藏着不为人知的秘密。",
                "significance": "故事发展的重要舞台，关键情节在此上演。"
            }
            return jsonify({"success": True, "location": mock_data, "mock": True, "message": "未配置 API Key，返回示例描述"})

        parsed = parse_json_from_response(result, r'\{.*\}')
        if parsed and isinstance(parsed, dict):
            parsed.setdefault("description", "")
            parsed.setdefault("significance", "")
            return jsonify({"success": True, "location": parsed})
        else:
            mock_data = {
                "description": f"{name}是一处充满故事的地方。",
                "significance": "故事中的重要地点。"
            }
            return jsonify({"success": True, "location": mock_data, "mock": True, "message": "AI 返回格式异常，使用示例描述"})

    except Exception as e:
        return jsonify({"success": False, "error": f"生成地点失败: {str(e)}"}), 500


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
