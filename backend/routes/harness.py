"""Harness API — 多 Agent 协作小说创作接口

Phase 1 改进：
- advance/auto 改为异步提交（返回 task_id，后台执行）
- 新增 SSE 端点实时推送状态
- 状态从 SQLite 读取（支持重启恢复）
"""

import json
import queue as queue_mod
from flask import Blueprint, request, jsonify, Response
from agents import (
    get_or_create_state, start_harness, advance_harness,
    advance_harness_async, auto_advance_async,
    get_harness_state, reset_harness,
)
from database import (
    get_novel_project, create_novel_project, update_novel_project,
    get_all_agent_configs, update_agent_config,
)
from agents.state import AGENT_ROLES, AGENT_LABELS, AGENT_ICONS, AGENT_DESCRIPTIONS

harness_bp = Blueprint("harness", __name__)

from providers import call_llm
from agents.llm import call_agent_llm
from agents.task_queue import TaskQueue


@harness_bp.route("/harness/start", methods=["POST"])
def start():
    """创建项目，立即返回（Planner 在 advance 时异步触发）"""
    data = request.get_json()
    seed = data.get("seed", "").strip()
    genre = data.get("genre", "玄幻")
    style = data.get("style", "热血升级流")
    synopsis = data.get("synopsis", "")
    target_words = data.get("targetWords", 500000)
    title = data.get("title") or "未命名小说"
    cover_color = data.get("coverColor") or "#6366F1"
    # 确保是合法的 hex 颜色
    if not isinstance(cover_color, str) or not cover_color.startswith("#"):
        cover_color = "#6366F1"

    if not seed:
        return jsonify({"success": False, "error": "请提供种子创意"}), 400

    try:
        import uuid
        project_id = str(uuid.uuid4())

        # 创建项目（存入 seed 到 premise 字段）
        project = create_novel_project(
            project_id=project_id,
            title=title,
            genre=genre,
            premise=seed,
            synopsis=synopsis,
            target_word_count=target_words,
            writing_style=style,
            cover_color=cover_color,
            creation_mode="harness",
        )

        # 初始化状态但不运行 Planner（响应要快）
        from agents import get_or_create_state
        state = get_or_create_state(project_id, project)
        state.seed = seed
        state.genre = genre
        state.style = style
        state.synopsis = synopsis
        state.target_words = target_words
        state.phase = "idle"

        return jsonify({
            "success": True,
            "project": project,
            "state": state.to_dict(),
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@harness_bp.route("/harness/state/<project_id>", methods=["GET"])
def state(project_id):
    """获取 Harness 当前状态（从内存缓存或SQLite读取）"""
    try:
        project = get_novel_project(project_id)
        if not project:
            return jsonify({"success": False, "error": "项目不存在"}), 404

        state = get_or_create_state(project_id, project)
        return jsonify({"success": True, "state": state.to_dict()})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@harness_bp.route("/harness/advance", methods=["POST"])
def advance():
    """推进到下一个 Agent 阶段（异步）

    立即返回 task_id，Agent在后台线程执行。
    前端通过 GET /harness/state 或 SSE 获取最新状态。
    """
    data = request.get_json()
    project_id = data.get("projectId", "")

    if not project_id:
        return jsonify({"success": False, "error": "缺少 projectId"}), 400

    try:
        project = get_novel_project(project_id)
        if not project:
            return jsonify({"success": False, "error": "项目不存在"}), 404

        # 确保状态已加载
        state = get_or_create_state(project_id, project)

        # 检查是否已在运行
        tq = TaskQueue.get_instance()
        if tq.is_running(project_id):
            return jsonify({
                "success": False,
                "error": "Agent 正在执行中，请等待完成",
                "state": state.to_dict(),
            }), 409

        # 异步提交任务
        task_id = advance_harness_async(project_id)

        # 立即返回当前状态 + task_id
        return jsonify({
            "success": True,
            "taskId": task_id,
            "state": state.to_dict(),
        })

    except ValueError as e:
        print(f"[Harness] advance ValueError: {e}")
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        print(f"[Harness] advance Exception: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@harness_bp.route("/harness/auto", methods=["POST"])
def auto():
    """自动推进直到完成或需要介入（异步）

    立即返回 task_id，Agent在后台线程循环执行。
    前端通过 SSE 或轮询获取实时进度。
    """
    data = request.get_json()
    project_id = data.get("projectId", "")
    max_steps = data.get("maxSteps", 200)

    if not project_id:
        return jsonify({"success": False, "error": "缺少 projectId"}), 400

    try:
        project = get_novel_project(project_id)
        if not project:
            return jsonify({"success": False, "error": "项目不存在"}), 404

        get_or_create_state(project_id, project)

        # 检查是否已在运行
        tq = TaskQueue.get_instance()
        if tq.is_running(project_id):
            return jsonify({
                "success": False,
                "error": "Agent 正在执行中，请等待完成",
            }), 409

        # 异步提交自动推进
        task_id = auto_advance_async(project_id, max_steps)

        return jsonify({
            "success": True,
            "taskId": task_id,
            "message": "自动创作已启动",
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==================== SSE 实时推送 ====================

@harness_bp.route("/harness/stream/<project_id>", methods=["GET"])
def stream(project_id):
    """SSE 端点：实时推送 Agent 状态变化

    前端通过 EventSource 连接此端点，实时接收Agent执行进度。
    """
    project = get_novel_project(project_id)
    if not project:
        return jsonify({"success": False, "error": "项目不存在"}), 404

    def generate():
        q = queue_mod.Queue(maxsize=100)
        tq = TaskQueue.get_instance()
        tq.add_sse_listener(project_id, q)

        try:
            # 发送初始状态
            state = get_or_create_state(project_id, project)
            yield f"data: {json.dumps({'type': 'init', 'state': state.to_dict()})}\n\n"

            while True:
                try:
                    event = q.get(timeout=30)
                    yield f"data: {json.dumps(event)}\n\n"
                except queue_mod.Empty:
                    # 心跳包，防止连接超时
                    yield f": heartbeat\n\n"
        except GeneratorExit:
            pass
        finally:
            tq.remove_sse_listener(project_id, q)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ==================== 暂停/继续控制 ====================

@harness_bp.route("/harness/pause", methods=["POST"])
def pause():
    """暂停工作流（章节级：当前章节完成后停止）"""
    data = request.get_json()
    project_id = data.get("projectId", "")
    if not project_id:
        return jsonify({"success": False, "error": "缺少 projectId"}), 400
    try:
        from agents import pause_harness
        state = pause_harness(project_id)
        return jsonify({"success": True, "state": state.to_dict()})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@harness_bp.route("/harness/resume", methods=["POST"])
def resume():
    """恢复工作流"""
    data = request.get_json()
    project_id = data.get("projectId", "")
    batch_size = data.get("batchSize", 0)
    if not project_id:
        return jsonify({"success": False, "error": "缺少 projectId"}), 400
    try:
        from agents import resume_harness
        task_id = resume_harness(project_id, batch_size=batch_size)
        return jsonify({"success": True, "taskId": task_id, "message": "已恢复"})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==================== 基础操作 ====================

@harness_bp.route("/harness/approve", methods=["POST"])
def approve():
    """用户审批检查点，允许工作流继续

    支持的 updates：
    - design: 修改后的设计蓝图（策划阶段检查点）
    - checkpointConfig: 更新检查点配置
    """
    data = request.get_json()
    project_id = data.get("projectId", "")
    updates = data.get("updates")

    if not project_id:
        return jsonify({"success": False, "error": "缺少 projectId"}), 400

    try:
        from agents import approve_checkpoint
        state = approve_checkpoint(project_id, updates)
        return jsonify({"success": True, "state": state.to_dict()})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@harness_bp.route("/harness/reset/<project_id>", methods=["POST"])
def reset(project_id):
    """重置 Harness 状态"""
    try:
        reset_harness(project_id)
        return jsonify({"success": True, "message": "已重置"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@harness_bp.route("/harness/intervene", methods=["POST"])
def intervene():
    """用户干预：修改设计或替换章节"""
    data = request.get_json()
    project_id = data.get("projectId", "")
    action = data.get("action", "")  # "update_design" | "rewrite_chapter" | "skip_chapter"

    try:
        from agents import _get_state
        state = _get_state(project_id)
        if not state:
            return jsonify({"success": False, "error": "项目未找到"}), 404

        if action == "update_design":
            design = data.get("design", {})
            if design:
                state.design = design
                update_novel_project(project_id, {"settings": design})
                state.log_activity("user", "design_updated", "用户更新了设计蓝图")

        elif action == "rewrite_chapter":
            chapter_index = data.get("chapterIndex")
            if chapter_index is not None and 0 <= chapter_index < len(state.chapters):
                state.chapters[chapter_index]["status"] = "pending"
                state.chapters[chapter_index]["content"] = ""
                state.current_chapter_index = chapter_index
                state.phase = "writing"
                state.revision_count = 0
                state.log_activity("user", "chapter_reset", f"用户请求重写第{chapter_index+1}章")

        elif action == "skip_chapter":
            if state.current_chapter_index + 1 < len(state.chapters):
                state.current_chapter_index += 1
                state.phase = "writing"
                state.log_activity("user", "chapter_skipped", f"用户跳过第{state.current_chapter}章")

        from agents.state_store import StateStore
        StateStore.save(state)
        return jsonify({"success": True, "state": state.to_dict()})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==================== Agent 模型配置 ====================

@harness_bp.route("/harness/agent-config", methods=["GET"])
def get_agent_config():
    """获取所有 Agent 的模型配置"""
    try:
        configs = get_all_agent_configs()
        agents_info = {
            role: {
                "label": AGENT_LABELS[role],
                "icon": AGENT_ICONS[role],
                "description": AGENT_DESCRIPTIONS[role],
            }
            for role in AGENT_ROLES
        }
        return jsonify({"success": True, "configs": configs, "agentsInfo": agents_info})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@harness_bp.route("/harness/agent-config", methods=["PUT"])
def update_agent_config_route():
    """更新单个 Agent 的模型配置"""
    data = request.get_json()
    agent_name = data.get("agentName", "")
    provider_name = data.get("providerName", "")
    model_name = data.get("modelName", "")

    if agent_name not in AGENT_ROLES:
        return jsonify({"success": False, "error": f"未知 Agent: {agent_name}"}), 400

    try:
        update_agent_config(agent_name, provider_name, model_name)
        return jsonify({"success": True, "message": "配置已更新"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def _sync_state_to_db(state):
    """将 StoryState 中的章节同步到数据库"""
    from database import update_novel_project
    from agents.state import StoryState

    if not state.project_id:
        return

    chapters_data = [
        {
            "id": c.get("id", f"ch-{i+1}"),
            "title": c.get("title", f"第{i+1}章"),
            "content": c.get("content", ""),
            "status": c.get("status", "pending"),
            "wordCount": c.get("word_count", 0),
            "agentLogs": c.get("agent_logs", []),
        }
        for i, c in enumerate(state.chapters)
    ]

    update_novel_project(state.project_id, {
        "chapters": chapters_data,
        "settings": state.design or {},
        "outline": (state.design or {}).get("outline", []),
        "characters": (state.design or {}).get("characters", []),
        "status": "completed" if state.phase == "complete" else "writing",
    })


# ==================== 项目设定协商 ====================

GENRES = ["玄幻", "都市", "仙侠", "科幻", "历史", "悬疑", "言情", "武侠"]
STYLES = ["热血升级流", "轻松日常流", "黑暗深刻流", "悬疑推理流", "浪漫唯美流", "史诗宏大流", "幽默搞笑流", "现实写实流"]
COLORS = [
    {"value": "#6366F1", "label": "靛蓝"},
    {"value": "#EC4899", "label": "玫红"},
    {"value": "#14B8A6", "label": "青绿"},
    {"value": "#F59E0B", "label": "琥珀"},
    {"value": "#8B5CF6", "label": "紫罗兰"},
    {"value": "#EF4444", "label": "赤红"},
    {"value": "#3B82F6", "label": "蔚蓝"},
    {"value": "#10B981", "label": "翠绿"},
]


@harness_bp.route("/harness/refine-meta", methods=["POST"])
def refine_meta():
    """多轮对话：根据用户描述和反馈，AI 建议/修订项目设定"""
    data = request.get_json()
    description = (data.get("description") or "").strip()
    current_meta = data.get("currentMeta") or {}
    history = data.get("history") or []

    if not description and not history:
        return jsonify({"success": False, "error": "请提供故事描述"}), 400

    genres_list = ", ".join(GENRES)
    styles_list = ", ".join(STYLES)
    colors_list = ", ".join(f"{c['label']}({c['value']})" for c in COLORS)

    # 构建消息
    messages = [
        {
            "role": "system",
            "content": f"""你是一位小说项目策划顾问。根据用户的故事描述，建议项目的基本设定。

你需要给出 JSON 格式的回复：
{{
  "reply": "一句友好的回复，解释你做了什么调整",
  "meta": {{
    "title": "建议的小说标题（10字以内）",
    "genre": "类型，从以下选择：{genres_list}",
    "style": "写作风格，从以下选择：{styles_list}",
    "targetWords": 建议的目标字数（整数，5万-500万），根据故事规模判断,
    "coverColor": "封面色 HEX 值，从以下选择：{colors_list}",
    "synopsis": "一句话故事概要（30字以内）"
  }}
}}

规则：
- 类型和风格必须从给定列表中精确选择
- 如果是首轮（无当前设定），根据故事描述独立推理所有字段
- 如果是修改轮（有 currentMeta），只修改用户指定的字段，其他保持不变
- 封面色根据故事氛围选择（如玄幻→紫罗兰，都市→靛蓝，悬疑→赤红）
- 回复中文，友好自然，像在跟作者沟通"""
        }
    ]

    # 添加历史对话
    for h in history:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

    # 构建当前轮消息
    if current_meta and current_meta.get("title"):
        user_msg = f"【当前设定】\n{json.dumps(current_meta, ensure_ascii=False)}\n\n【用户要求】\n{description or '请帮我优化设定'}"
    else:
        user_msg = f"【故事描述】\n{description}\n\n请根据以上故事描述，给出项目设定建议。"

    messages.append({"role": "user", "content": user_msg})

    try:
        result = call_agent_llm("meta", messages=messages, temperature=0.7, max_tokens=1024)

        if not result.success:
            return jsonify({"success": False, "error": result.error or "AI 服务不可用"}), 503

        # 解析 JSON
        content = result.content.strip()
        # 去除可能的 markdown 代码块
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
        if content.endswith("```"):
            content = content.rsplit("\n", 1)[0]

        parsed = json.loads(content)
        meta = parsed.get("meta", {})
        reply = parsed.get("reply", "已更新设定")

        # 校验并填充默认值
        meta.setdefault("title", current_meta.get("title", "未命名小说"))
        meta.setdefault("genre", current_meta.get("genre", "玄幻"))
        meta.setdefault("style", current_meta.get("style", "热血升级流"))
        meta.setdefault("targetWords", current_meta.get("targetWords", 500000))
        meta.setdefault("coverColor", current_meta.get("coverColor", "#6366F1"))
        meta.setdefault("synopsis", current_meta.get("synopsis", ""))

        return jsonify({"success": True, "reply": reply, "meta": meta})

    except json.JSONDecodeError:
        return jsonify({"success": False, "error": "AI 返回格式异常，请重试"}), 502
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
