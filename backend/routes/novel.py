import os
import uuid
import requests
from flask import Blueprint, request, jsonify
from datetime import datetime

# 导入数据库模块
from database import (
    create_novel_project, get_novel_project, get_all_novel_projects,
    update_novel_project, delete_novel_project
)

novel_bp = Blueprint("novel", __name__)

# LLM API 配置
from config import LLM_API_KEY, LLM_TEXT_URL
LLM_MODEL = "MiniMax-Text-01"

# 内存存储（仅用于缓存，已迁移到数据库）
projects = {}

# 数据库表初始化会创建，以下代码保留用于兼容某些场景
# 实际使用时应该直接调用数据库函数


def generate_with_llm(prompt, system_prompt=""):
    """调用 MiniMax LLM API 生成内容"""
    if not LLM_API_KEY:
        raise ValueError("未配置 LLM_API_KEY，请在 .env 文件中设置 LLM_API_KEY")
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    try:
        response = requests.post(
            LLM_TEXT_URL,
            json={
                "model": "MiniMax-Text-01",
                "messages": messages,
                "max_tokens": 4096,
                "temperature": 0.7
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=120,
        )
        
        data = response.json()
        if data.get("base_resp", {}).get("status_code") != 0:
            raise ValueError(f"LLM API error: {data.get('base_resp', {}).get('status_msg', 'Unknown error')}")
        
        content = data.get("choices", [{}])[0].get("messages", [{}])[0].get("text", "")
        if not content:
            raise ValueError("API 返回空内容")
        
        return content
    except requests.exceptions.Timeout:
        raise ValueError("API 请求超时，请稍后重试")
    except Exception as e:
        raise ValueError(f"API 调用失败: {str(e)}")


@novel_bp.route("/projects", methods=["GET"])
def get_projects():
    """获取所有小说项目"""
    try:
        projects_list = get_all_novel_projects()
        return jsonify({"success": True, "projects": projects_list})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects", methods=["POST"])
def create_project():
    """创建新小说项目"""
    data = request.get_json()
    project_id = str(uuid.uuid4())
    title = data.get("title") or "未命名小说"
    genre = data.get("genre") or "通用"
    premise = data.get("premise") or ""
    
    try:
        project = create_novel_project(project_id, title, genre, premise)
        return jsonify({"success": True, "project": project})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>", methods=["GET"])
def get_project(project_id):
    """获取单个小说项目"""
    try:
        project = get_novel_project(project_id)
        if not project:
            return jsonify({"success": False, "error": "项目不存在"}), 404
        return jsonify({"success": True, "project": project})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>", methods=["PUT"])
def update_project(project_id):
    """更新小说项目"""
    data = request.get_json()
    
    try:
        existing = get_novel_project(project_id)
        if not existing:
            return jsonify({"success": False, "error": "项目不存在"}), 404
        
        # 构建更新数据
        updates = {}
        if "title" in data:
            updates["title"] = data["title"]
        if "genre" in data:
            updates["genre"] = data["genre"]
        if "premise" in data:
            updates["premise"] = data["premise"]
        if "outline" in data:
            updates["outline"] = data["outline"]
        if "chapters" in data:
            updates["chapters"] = data["chapters"]
        if "characters" in data:
            updates["characters"] = data["characters"]
        
        update_novel_project(project_id, updates)
        updated = get_novel_project(project_id)
        return jsonify({"success": True, "project": updated})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    """删除小说项目"""
    try:
        success = delete_novel_project(project_id)
        if not success:
            return jsonify({"success": False, "error": "项目不存在"}), 404
        return jsonify({"success": True, "message": "项目已删除"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@novel_bp.route("/generate-outline", methods=["POST"])
def generate_outline():
    data = request.get_json()
    premise = data.get("premise", "")
    genre = data.get("genre", "通用")

    if not premise:
        return jsonify({"success": False, "error": "请提供故事前提/背景"}), 400

    system_prompt = """你是一位专业的小说大纲设计师。根据用户提供的故事前提和类型，生成一个完整的故事大纲。
请以 JSON 格式返回，包含 6 个章节，每个章节包含 title（标题）和 description（章节描述）。
确保章节之间有逻辑递进关系，情节发展合理。"""

    user_prompt = f"""类型：{genre}
故事前提/背景：{premise}

请生成一个包含6章的故事大纲，返回格式示例：
[
    {{"title": "第一章：缘起", "description": "..."}},
    {{"title": "第二章：觉醒", "description": "..."}},
    ...
]

只返回 JSON，不要包含其他文字。"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)
        
        # 尝试解析 JSON
        import json
        try:
            # 提取 JSON（可能包裹在 markdown 代码块中）
            import re
            json_match = re.search(r'\[.*\]', result, re.DOTALL)
            if json_match:
                outline = json.loads(json_match.group())
            else:
                outline = json.loads(result)
        except json.JSONDecodeError:
            # 如果解析失败，尝试逐行解析
            outline = []
            for line in result.strip().split('\n'):
                if ':' in line:
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        title = parts[0].strip().strip('"\'「」[]0123456789.、 ')
                        desc = parts[1].strip().strip('"\'「」,')
                        if title and desc:
                            outline.append({"title": title, "description": desc})
            if not outline:
                raise ValueError("无法解析 AI 返回的大纲格式")

        return jsonify({"success": True, "outline": outline})
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

    system_prompt = f"""你是一位专业的小说作家，擅长创作引人入胜的故事章节。
根据给定的章节标题、前情提要和类型，创作一个生动、情节丰富的章节内容。
写作风格应该符合{genre}类型的要求，描写细腻，情节紧凑。
确保与前文衔接自然，但要有自己的独立性。"""

    user_prompt = f"""章节标题：{chapter_title}
故事类型：{genre}
故事背景/前提：{premise or '一个充满悬念和惊喜的故事'}

前文摘要：{previous_content or '（无前文，这是故事的开篇）'}

请创作这一章节的内容，要求：
1. 字数在 1000-2000 字之间
2. 有清晰的开头、发展、结尾
3. 适当的人物对话和心理描写
4. 与前文自然衔接"""

    try:
        content = generate_with_llm(user_prompt, system_prompt)
        return jsonify({"success": True, "content": content})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"生成章节失败: {str(e)}"}), 500


@novel_bp.route("/character", methods=["POST"])
def create_character():
    data = request.get_json()
    name = data.get("name", "新角色")
    description = data.get("description", "")
    genre = data.get("genre", "通用")

    if not description:
        return jsonify({"success": False, "error": "请提供角色描述"}), 400

    system_prompt = """你是一位专业的小说角色设定专家。根据用户提供的角色描述和故事类型，为角色生成合适的性格特征（traits）。
请生成 3-5 个简短、有特色的人物性格标签，如"勇敢"、"机智"等。
请以 JSON 格式返回，包含 traits 数组。"""

    user_prompt = f"""角色名称：{name}
角色描述：{description}
故事类型：{genre}

请生成这个角色的性格特征标签，返回格式：
{{"traits": ["勇敢", "聪明", "善良"]}}

只返回 JSON。"""

    try:
        result = generate_with_llm(user_prompt, system_prompt)
        
        import json
        import re
        try:
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                char_data = json.loads(json_match.group())
            else:
                char_data = json.loads(result)
        except json.JSONDecodeError:
            # 默认性格
            char_data = {"traits": ["勇敢", "聪明", "善良"]}

        character = {
            "id": str(uuid.uuid4()),
            "name": name,
            "description": description,
            "traits": char_data.get("traits", ["勇敢", "聪明", "善良"]),
        }

        return jsonify({"success": True, "character": character})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"创建角色失败: {str(e)}"}), 500
