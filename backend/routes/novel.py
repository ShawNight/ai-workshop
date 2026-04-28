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
    {"title": "第六章：破晓新生", "description": "主角突破自我极限，解决核心冲突，故事走向结局，但同时为可能的续篇留下空间。"},
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


def generate_with_llm(prompt, system_prompt=""):
    """调用 LLM API 生成内容。成功返回文本，失败或无 API key 返回 None"""
    if not LLM_API_KEY:
        return None

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

    if not premise:
        return jsonify({"success": False, "error": "请提供故事前提/背景"}), 400

    system_prompt = f"""你是一位资深的小说大纲设计师，专精于{genre}类型小说的结构设计。
你的任务是生成一个逻辑严密、节奏紧凑的故事大纲，包含 6-8 个章节。
每个章节需要有明确的核心冲突和情感弧线，章节之间需要有因果递进关系。
输出必须是严格的 JSON 数组格式。"""

    user_prompt = f"""类型：{genre}
故事前提：{premise}
{synopsis and f'故事简介：{synopsis}' or ''}

请生成一个包含6-8章的故事大纲，每章包含：
- title: 章节标题（含章节序号，如"第一章：xxxx"）
- description: 章节概要（50-100字，包含核心情节和冲突）

只返回 JSON 数组，格式如：
[{{"title": "第一章：xxxx", "description": "..."}}, ...]"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)

        if result is None:
            return jsonify({"success": True, "outline": MOCK_OUTLINE,
                           "mock": True, "message": "未配置 API Key，返回示例大纲"})

        outline = parse_json_from_response(result, r'\[.*\]')
        if outline and isinstance(outline, list):
            return jsonify({"success": True, "outline": outline})
        else:
            return jsonify({"success": True, "outline": MOCK_OUTLINE,
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

    if not idea:
        return jsonify({"success": False, "error": "请输入你的想法"}), 400

    story_context = build_story_context(characters, relationships)

    system_prompt = f"""你是一位创意小说策划，专精于{genre}类型。
针对用户的想法，结合已有的角色和关系设定，生成 3 个不同的创作方向建议，每个建议包含：
- 一个吸引人的方向标题
- 简要的情节发展思路（50-100字）
如果提供了角色关系信息，请让生成的方向尽量利用这些角色和关系。
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
