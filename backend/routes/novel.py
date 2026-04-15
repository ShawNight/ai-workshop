import uuid
from flask import Blueprint, request, jsonify

novel_bp = Blueprint("novel", __name__)

projects = {}


@novel_bp.route("/projects", methods=["GET"])
def get_projects():
    project_list = list(projects.values())
    return jsonify({"success": True, "projects": project_list})


@novel_bp.route("/projects", methods=["POST"])
def create_project():
    data = request.get_json()
    project_id = str(uuid.uuid4())
    from datetime import datetime

    project = {
        "id": project_id,
        "title": data.get("title") or "未命名小说",
        "genre": data.get("genre") or "通用",
        "premise": data.get("premise") or "",
        "outline": [],
        "chapters": [],
        "characters": [],
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
    }
    projects[project_id] = project
    return jsonify({"success": True, "project": project})


@novel_bp.route("/projects/<project_id>", methods=["GET"])
def get_project(project_id):
    project = projects.get(project_id)
    if not project:
        return jsonify({"success": False, "error": "项目不存在"}), 404
    return jsonify({"success": True, "project": project})


@novel_bp.route("/projects/<project_id>", methods=["PUT"])
def update_project(project_id):
    project = projects.get(project_id)
    if not project:
        return jsonify({"success": False, "error": "项目不存在"}), 404

    data = request.get_json()
    from datetime import datetime

    updated = {
        **project,
        **data,
        "id": project["id"],
        "updatedAt": datetime.now().isoformat(),
    }
    projects[project_id] = updated
    return jsonify({"success": True, "project": updated})


@novel_bp.route("/projects/<project_id>", methods=["DELETE"])
def delete_project(project_id):
    if project_id not in projects:
        return jsonify({"success": False, "error": "项目不存在"}), 404
    del projects[project_id]
    return jsonify({"success": True, "message": "项目已删除"})


@novel_bp.route("/generate-outline", methods=["POST"])
def generate_outline():
    data = request.get_json()
    premise = data.get("premise", "")
    genre = data.get("genre", "")

    outline = [
        {
            "title": "第一章：缘起",
            "description": "主人公生活的世界遭遇变故，被迫踏上旅程",
        },
        {
            "title": "第二章：觉醒",
            "description": "在困境中发现自己的特殊能力，开始训练",
        },
        {"title": "第三章：考验", "description": "面对强大对手，经历第一次真正的战斗"},
        {"title": "第四章：盟友", "description": "结识志同道合的伙伴，组建团队"},
        {
            "title": "第五章：阴谋",
            "description": "发现背后更大的危机，揭露敌人真实目的",
        },
        {"title": "第六章：决战", "description": "最终对决，为守护而战"},
    ]

    return jsonify({"success": True, "outline": outline})


@novel_bp.route("/generate-chapter", methods=["POST"])
def generate_chapter():
    data = request.get_json()
    chapter_title = data.get("chapterTitle", "新章节")
    premise = data.get("premise", "")

    content = f"""【{chapter_title}】

阳光透过窗帘的缝隙洒进房间，主人公慢慢睁开眼睛。

"又是新的一天，"主人公喃喃自语，站起身来走向窗边。

窗外是一片宁静的景象，但主人公知道，这份宁静随时可能被打破。

回想起昨天发生的事情，主人公握紧了拳头。那些画面在脑海中挥之不去...

就在这时，手机突然响了起来。是一条神秘的消息。

"如果你想知道真相，今晚来见我。"

主人公盯着屏幕，心中涌起一股不安的预感。这会是陷阱吗？还是...

无论如何，答案似乎就在眼前了。"""

    return jsonify({"success": True, "content": content})


@novel_bp.route("/character", methods=["POST"])
def create_character():
    data = request.get_json()
    name = data.get("name", "新角色")
    description = data.get("description", "一个神秘的角色")

    traits = ["勇敢", "聪明", "善良"]
    character = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": description,
        "traits": traits,
    }

    return jsonify({"success": True, "character": character})
