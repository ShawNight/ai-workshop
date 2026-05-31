"""Orchestrator — 多 Agent 协作小说创作的状态机引擎

Phase 3 改进：
- 策划阶段使用 DAG 工作流（角色设计和世界观设计并行）
- 写作阶段保持线性流程（章节间有依赖关系）
- 每步自动持久化状态
"""

import json
from .state import StoryState, AGENT_ROLES, AGENT_LABELS
from .state_store import StateStore
from .task_queue import TaskQueue
from .workflow import WorkflowEngine
from .planner import run_planner
from .writer import run_writer
from .critic import run_critic
from .editor import run_editor

# 内存缓存（按 project_id）— 作为SQLite的缓存层
_states: dict[str, StoryState] = {}

# 工作流引擎缓存
_workflows: dict[str, WorkflowEngine] = {}


def _get_state(project_id: str) -> StoryState | None:
    """获取状态：先查缓存，再查数据库"""
    if project_id in _states:
        return _states[project_id]

    # 从数据库恢复
    state = StateStore.load(project_id)
    if state:
        _states[project_id] = state
        return state

    return None


def _check_llm_available() -> bool:
    """快速检查默认 LLM Provider 是否可用（有 API Key）"""
    try:
        from providers import get_provider, get_current_text_provider
        provider_name = get_current_text_provider()
        provider = get_provider(provider_name)
        return bool(provider.api_key)
    except Exception:
        return False


def get_or_create_state(project_id: str, project_data: dict = None) -> StoryState:
    """获取或创建项目的 StoryState"""
    # 先尝试内存缓存
    if project_id in _states:
        return _states[project_id]

    # 再尝试数据库恢复
    state = StateStore.load(project_id)
    if state:
        _states[project_id] = state
        return state

    # 创建新状态
    state = StoryState(project_id=project_id)

    if project_data:
        state.genre = project_data.get("genre", "玄幻")
        state.style = project_data.get("writingStyle", "热血升级流")
        state.synopsis = project_data.get("synopsis", "")
        state.seed = project_data.get("premise", "")

        # 恢复已有 chapters
        chapters = project_data.get("chapters", [])
        if chapters:
            state.chapters = [{
                "index": i + 1,
                "id": c.get("id", f"ch-{i+1}"),
                "title": c.get("title", f"第{i+1}章"),
                "content": c.get("content", ""),
                "status": c.get("status", "pending"),
                "word_count": c.get("wordCount", 0),
                "agent_logs": c.get("agentLogs", []),
            } for i, c in enumerate(chapters)]
            state.total_chapters = len(chapters)
            state.completed_chapters = sum(1 for c in chapters if c.get("status") == "polished")

        # 恢复设计
        design_raw = project_data.get("settings", {})
        if isinstance(design_raw, dict) and "outline" in design_raw:
            state.design = design_raw
            state.phase = "writing"

    _states[project_id] = state
    # 持久化初始状态
    StateStore.save(state)
    return state


def start_harness(project_id: str, seed: str, genre: str, style: str,
                  synopsis: str = "", target_words: int = 500000) -> StoryState:
    """启动 Harness：创建状态（Planner 在 advance 时异步触发）"""
    if project_id in _states:
        del _states[project_id]

    state = StoryState(
        project_id=project_id,
        seed=seed,
        genre=genre,
        style=style,
        synopsis=synopsis,
        target_words=target_words,
    )
    _states[project_id] = state
    StateStore.save(state)
    return state


def _run_planning_dag(state: StoryState) -> StoryState:
    """使用 DAG 工作流执行策划阶段

    Phase 4: 策划完成后检查是否需要暂停等待用户审批
    """
    engine = WorkflowEngine(state)
    engine.build_planning_graph()

    # 同步执行 DAG
    engine.run_until_blocked()

    # 更新状态
    state = engine.state
    _workflows[state.project_id] = engine

    # 如果策划完成
    planning_done = engine.nodes.get("planning_done")
    if planning_done and planning_done.status == "done":
        if state.design and state.chapters:
            # Phase 4: 检查是否需要暂停
            if state.should_pause_at_checkpoint("planning"):
                state.set_checkpoint("planning")
            else:
                state.phase = "writing"
                state.log_activity("system", "planning_complete",
                                   f"策划阶段完成，进入写作阶段（{state.total_chapters}章）")

    return state


def advance_harness(project_id: str) -> StoryState:
    """推进 Harness 到下一个 Agent/阶段（同步，内部使用）

    Phase 4: 支持 checkpoint 暂停阶段。
    """
    state = _get_state(project_id)
    if not state:
        raise ValueError(f"项目 {project_id} 未初始化 Harness")

    # 快速检查 LLM 是否可用
    phase = state.phase
    if phase in ("idle", "planning") and not _check_llm_available():
        state.log_activity("system", "error", "LLM 服务不可用，请检查 API Key 配置")
        StateStore.save_with_event(state, {"type": "llm_unavailable"})
        return state

    phase = state.phase

    if phase == "idle":
        # 首次推进：使用 DAG 执行策划阶段
        state = _run_planning_dag(state)

    elif phase == "planning":
        # 策划进行中（可能上次未完成），继续执行 DAG
        if project_id in _workflows:
            engine = _workflows[project_id]
            engine.run_until_blocked()
            state = engine.state
            planning_done = engine.nodes.get("planning_done")
            if planning_done and planning_done.status == "done":
                if state.design and state.chapters:
                    if state.should_pause_at_checkpoint("planning"):
                        state.set_checkpoint("planning")
                    else:
                        state.phase = "writing"
                        state.log_activity("system", "planning_complete",
                                           f"策划阶段完成，进入写作阶段（{state.total_chapters}章）")
        else:
            # 没有 workflow 实例，重新构建
            state = _run_planning_dag(state)

    elif phase == "checkpoint":
        # 检查点阶段：不自动推进，需要用户 approve
        pass

    elif phase == "writing":
        state = run_writer(state)
    elif phase == "reviewing":
        state = run_critic(state)
        # Phase 4: 评论家低分暂停
        if state.phase == "revising":
            current = state.chapters[state.current_chapter_index]
            critic_log = None
            for log in reversed(current.get("agent_logs", [])):
                if log.get("agent") == "critic":
                    critic_log = log
                    break
            if critic_log and critic_log.get("score") and critic_log["score"] < 4.0:
                if state.should_pause_at_checkpoint("chapter", {"critic_score": critic_log["score"]}):
                    state.set_checkpoint(f"chapter_{state.current_chapter_index + 1}_low_score")
    elif phase == "revising":
        state = run_writer(state)
    elif phase == "polishing":
        state = run_editor(state)
    elif phase == "complete":
        pass
    else:
        raise ValueError(f"未知的阶段: {phase}")

    _states[project_id] = state

    # 获取工作流状态用于SSE推送
    workflow_dict = None
    if project_id in _workflows:
        workflow_dict = _workflows[project_id].to_dict()

    # 每步完成后自动持久化
    StateStore.save_with_event(state, {
        "type": "agent_step_done",
        "phase": state.phase,
        "currentAgent": state.current_agent,
        "completedChapters": state.completed_chapters,
        "totalChapters": state.total_chapters,
        "workflow": workflow_dict,
    })

    return state


def advance_harness_async(project_id: str) -> str:
    """异步推进 Harness — 提交到 TaskQueue 执行"""
    tq = TaskQueue.get_instance()

    def _do_advance():
        return advance_harness(project_id)

    return tq.submit(project_id, _do_advance)


def auto_advance_async(project_id: str, max_steps: int = 200) -> str:
    """异步自动推进直到完成 — 提交到 TaskQueue 执行"""
    tq = TaskQueue.get_instance()

    def _do_auto():
        """在后台线程中循环推进"""
        state = _get_state(project_id)
        if not state:
            raise ValueError(f"项目 {project_id} 未初始化 Harness")

        batch_target = state.batch_size  # 记录目标章节数
        chapters_at_start = state.completed_chapters

        for step in range(max_steps):
            state = _get_state(project_id)
            if not state:
                break
            if state.phase == "complete":
                break
            if state.waiting_for_user:
                break  # 等待用户审批
            if state.paused:
                # 章节级暂停：检查是否在章节边界（phase=writing 或 complete）
                if state.phase in ("writing",):
                    break
            # 批量控制：检查是否达到目标章节数
            if batch_target > 0:
                chapters_done = state.completed_chapters - chapters_at_start
                if chapters_done >= batch_target:
                    state.paused = True
                    StateStore.save(state)
                    break

            state = advance_harness(project_id)

            # 推送进度事件
            workflow_dict = None
            if project_id in _workflows:
                workflow_dict = _workflows[project_id].to_dict()

            tq.notify_sse(project_id, {
                "type": "auto_progress",
                "step": step + 1,
                "phase": state.phase,
                "currentChapter": state.current_chapter_index + 1,
                "totalChapters": state.total_chapters,
                "completedChapters": state.completed_chapters,
                "progressPercent": state.progress_percent(),
                "workflow": workflow_dict,
            })

        return state

    return tq.submit(project_id, _do_auto)


def pause_harness(project_id: str) -> StoryState:
    """暂停工作流（章节级：当前章节完成后停止）"""
    state = _get_state(project_id)
    if not state:
        raise ValueError(f"项目 {project_id} 未初始化 Harness")

    state.paused = True
    state.log_activity("system", "paused", "用户请求暂停（当前章节完成后停止）")
    _states[project_id] = state
    StateStore.save_with_event(state, {"type": "paused"})
    return state


def resume_harness(project_id: str, batch_size: int = 0) -> str:
    """恢复工作流，返回 task_id

    Args:
        batch_size: 恢复后的批量章节数，0=不限制（使用state中的值）
    """
    state = _get_state(project_id)
    if not state:
        raise ValueError(f"项目 {project_id} 未初始化 Harness")

    state.paused = False
    if batch_size > 0:
        state.batch_size = batch_size
    state.log_activity("system", "resumed", "用户恢复工作流")
    _states[project_id] = state
    StateStore.save(state)

    # 重新提交自动推进
    return auto_advance_async(project_id)


def auto_advance(project_id: str, max_steps: int = 200) -> StoryState:
    """同步自动推进（保留兼容，但建议使用 auto_advance_async）"""
    state = _get_state(project_id)
    if not state:
        raise ValueError(f"项目 {project_id} 未初始化 Harness")

    for _ in range(max_steps):
        if state.phase == "complete":
            break
        state = advance_harness(project_id)

    return state


def get_harness_state(project_id: str) -> dict:
    """获取 Harness 当前状态（包含工作流可视化数据）"""
    state = _get_state(project_id)
    if not state:
        return {"error": "项目未初始化 Harness"}

    result = state.to_dict()

    # 附加工作流状态（用于前端 DAG 可视化）
    if project_id in _workflows:
        result["workflow"] = _workflows[project_id].to_dict()

    return result


def approve_checkpoint(project_id: str, updates: dict = None) -> StoryState:
    """用户审批检查点，允许工作流继续

    Args:
        project_id: 项目ID
        updates: 可选的更新数据（如修改后的 design）
    """
    state = _get_state(project_id)
    if not state:
        raise ValueError(f"项目 {project_id} 未初始化 Harness")

    if not state.waiting_for_user:
        raise ValueError("当前不在检查点等待状态")

    checkpoint = state.pending_checkpoint

    # 应用用户更新
    if updates:
        if "design" in updates and checkpoint.startswith("planning"):
            state.design = updates["design"]
            # 重新初始化 Blackboard
            try:
                from .blackboard import Blackboard
                bb = Blackboard()
                bb.load_from_design(state.design)
                bb.persist(project_id)
            except Exception:
                pass
            # 重建章节列表
            if state.design and "outline" in state.design:
                total = sum(vol.get("chapters", 0) for vol in state.design.get("outline", []))
                state.total_chapters = total
                chapters = []
                idx = 1
                for vol in state.design.get("outline", []):
                    for ch in vol.get("chapters_detail", []):
                        chapters.append({
                            "index": idx, "id": f"ch-{idx}",
                            "title": ch.get("title", f"第{idx}章"),
                            "guidance": ch.get("guidance", ""),
                            "volume": vol.get("volume", 1),
                            "volume_title": vol.get("title", ""),
                            "content": "", "status": "pending",
                            "word_count": 0, "agent_logs": [],
                        })
                        idx += 1
                state.chapters = chapters

        if "checkpointConfig" in updates:
            state.checkpoint_config = updates["checkpointConfig"]

    # 清除检查点状态
    state.clear_checkpoint()

    # 根据检查点类型恢复到正确的阶段
    if checkpoint.startswith("planning"):
        state.phase = "writing"
        state.log_activity("user", "approved", "用户审批了策划方案，开始写作")
    elif checkpoint.startswith("chapter"):
        # 章节低分暂停 → 继续 revising
        state.phase = "revising"
        state.log_activity("user", "approved",
                           f"用户审批了低分章节，继续修改（第{state.current_chapter_index + 1}章）")
    else:
        state.phase = "writing"

    _states[project_id] = state
    StateStore.save_with_event(state, {
        "type": "checkpoint_approved",
        "checkpoint": checkpoint,
        "phase": state.phase,
    })

    return state


def reset_harness(project_id: str):
    """重置 Harness 状态"""
    # 取消排队任务
    tq = TaskQueue.get_instance()
    tq.cancel(project_id)

    # 清除内存缓存
    if project_id in _states:
        del _states[project_id]
    if project_id in _workflows:
        del _workflows[project_id]

    # 清除持久化状态
    StateStore.delete(project_id)
