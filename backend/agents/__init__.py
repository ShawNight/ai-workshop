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
from .llm import set_current_project, clear_current_project
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
    Phase 6: 立即把新创建的 engine 写入 _workflows 缓存，覆盖上一轮的旧数据，
             否则前端会在新一轮 LLM 调用期间看到过期的"已完成"节点
    """
    engine = WorkflowEngine(state)
    engine.build_planning_graph()

    # 立即覆盖缓存：让前端看到新一轮的初始 pending/ready 节点
    # 而非上一轮已完成的 DAG
    _workflows[state.project_id] = engine

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
                state.current_agent = ""
                state.phase = "writing"
                state.log_activity("system", "planning_complete",
                                   f"策划阶段完成，进入写作阶段（{state.total_chapters}章）")

    return state


def advance_harness(project_id: str) -> StoryState:
    """推进 Harness 到下一个 Agent/阶段（同步，内部使用）

    Phase 4: 支持 checkpoint 暂停阶段。
    Phase 6: 包装 set_current_project 以便 LLM 调用日志关联 project。
    """
    state = _get_state(project_id)
    if not state:
        raise ValueError(f"项目 {project_id} 未初始化 Harness")

    set_current_project(project_id)
    try:
        return _advance_harness_inner(project_id, state)
    finally:
        clear_current_project()


def _advance_harness_inner(project_id: str, state: StoryState) -> StoryState:
    # 快速检查 LLM 是否可用
    phase = state.phase
    if phase in ("idle", "planning") and not _check_llm_available():
        state.log_activity("system", "error", "LLM 服务不可用，请检查 API Key 配置")
        StateStore.save_with_event(state, {"type": "llm_unavailable"})
        return state

    phase = state.phase

    if phase == "idle":
        state = _run_planning_dag(state)

    elif phase == "planning":
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
                        state.current_agent = ""
                        state.phase = "writing"
                        state.log_activity("system", "planning_complete",
                                           f"策划阶段完成，进入写作阶段（{state.total_chapters}章）")
        else:
            state = _run_planning_dag(state)

    elif phase == "checkpoint":
        pass

    elif phase == "writing":
        if _is_current_chapter_manually_edited(state):
            state = _skip_manually_edited_chapter(state)
        else:
            state = run_writer(state)
    elif phase == "reviewing":
        state = run_critic(state)
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

    # 确保 workflow DAG 存在，让前端始终能拿到节点数据
    _ensure_workflow(project_id, state)
    workflow_dict = _workflows[project_id].to_dict() if project_id in _workflows else None
    workflows_dict = _build_all_workflows(state)

    StateStore.save_with_event(state, {
        "type": "agent_step_done",
        "phase": state.phase,
        "currentAgent": state.current_agent,
        "completedChapters": state.completed_chapters,
        "totalChapters": state.total_chapters,
        "workflow": workflow_dict,
        "workflows": workflows_dict,
    })

    return state


def _is_current_chapter_manually_edited(state: StoryState) -> bool:
    """检查当前章节是否被用户人工编辑过（且还未被作者写入 polished 状态）"""
    if not state.chapters or state.current_chapter_index >= len(state.chapters):
        return False
    current = state.chapters[state.current_chapter_index]
    return bool(current.get("manually_edited")) and current.get("status") != "polished"


def _skip_manually_edited_chapter(state: StoryState) -> StoryState:
    """跳过人工编辑过的章节：标记为 polished 并前进到下一章"""
    current = state.chapters[state.current_chapter_index]
    current["status"] = "polished"
    state.completed_chapters += 1
    state.revision_count = 0
    state.log_activity("system", "chapter_skipped_manual",
                       f"第{current['index']}章已人工编辑，自动跳过 (保留 {len(current.get('content',''))} 字)")

    if state.current_chapter_index + 1 < len(state.chapters):
        state.current_chapter_index += 1
        state.phase = "writing"
        state.log_activity("system", "next_chapter",
                           f"进入第{state.chapters[state.current_chapter_index]['index']}章")
    else:
        state.phase = "complete"
        state.log_activity("system", "complete",
                           f"全部{state.total_chapters}章创作完成！")
    return state


def advance_harness_async(project_id: str) -> str:
    """异步推进 Harness — 提交到 TaskQueue 执行"""
    tq = TaskQueue.get_instance()

    def _do_advance():
        return advance_harness(project_id)

    return tq.submit(project_id, _do_advance)


def run_single_agent(project_id: str, agent_name: str) -> StoryState:
    """单独运行指定 Agent

    与 retry-agent 不同，不限失败状态，任意 idle/done/error 状态的 agent 都可执行。
    执行完成后通过 SSE 推送状态更新。
    """
    state = _get_state(project_id)
    if not state:
        raise ValueError(f"项目 {project_id} 未初始化 Harness")

    set_current_project(project_id)
    try:
        state.set_agent_state(agent_name, "running")
        if agent_name in state.agent_states:
            state.agent_states[agent_name].pop("error", None)

        # 按 agent 类型路由
        if agent_name in ("planner", "outline_planner"):
            state.phase = "planning"
            state = _run_planning_dag(state)
        elif agent_name == "character_designer":
            from .character_designer import run_character_designer
            state = run_character_designer(state)
        elif agent_name == "world_builder":
            from .world_builder import run_world_builder
            state = run_world_builder(state)
        elif agent_name == "foreshadow_planner":
            from .planner import run_planner
            state = run_planner(state)
        elif agent_name == "writer":
            state = run_writer(state)
        elif agent_name == "critic":
            state = run_critic(state)
        elif agent_name == "editor":
            state = run_editor(state)
        elif agent_name == "memory_keeper":
            from .memory_keeper import run_memory_keeper
            state = run_memory_keeper(state, state.current_chapter_index)
        elif agent_name == "blueprint_sync":
            from .blueprint_sync import run_blueprint_sync
            state = run_blueprint_sync(state, state.current_chapter_index)
        else:
            raise ValueError(f"未知 agent: {agent_name}")

        state.log_activity(agent_name, "single_run", f"单独执行 {agent_name}")
    except Exception:
        state.set_agent_state(agent_name, "error", error="单独执行失败")
        # 持久化错误状态，避免前端看不到失败信息
        _states[project_id] = state
        workflow_dict = None
        if project_id in _workflows:
            workflow_dict = _workflows[project_id].to_dict()
        workflows_dict = _build_all_workflows(state)
        StateStore.save_with_event(state, {
            "type": "agent_step_done",
            "phase": state.phase,
            "currentAgent": agent_name,
            "completedChapters": state.completed_chapters,
            "totalChapters": state.total_chapters,
            "workflow": workflow_dict,
            "workflows": workflows_dict,
        })
        raise
    finally:
        clear_current_project()

    _states[project_id] = state

    workflow_dict = None
    if project_id in _workflows:
        workflow_dict = _workflows[project_id].to_dict()
    workflows_dict = _build_all_workflows(state)

    StateStore.save_with_event(state, {
        "type": "agent_step_done",
        "phase": state.phase,
        "currentAgent": state.current_agent,
        "completedChapters": state.completed_chapters,
        "totalChapters": state.total_chapters,
        "workflow": workflow_dict,
        "workflows": workflows_dict,
    })

    return state


def run_single_agent_async(project_id: str, agent_name: str) -> str:
    """异步单独运行指定 Agent — 提交到 TaskQueue"""
    tq = TaskQueue.get_instance()

    def _do_run():
        return run_single_agent(project_id, agent_name)

    return tq.submit(project_id, _do_run)


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
            workflows_dict = _build_all_workflows(state)

            tq.notify_sse(project_id, {
                "type": "auto_progress",
                "step": step + 1,
                "phase": state.phase,
                "currentChapter": state.current_chapter_index + 1,
                "totalChapters": state.total_chapters,
                "completedChapters": state.completed_chapters,
                "progressPercent": state.progress_percent(),
                "workflow": workflow_dict,
                "workflows": workflows_dict,
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


def _ensure_workflow(project_id: str, state: StoryState) -> WorkflowEngine:
    """确保 _workflows 中有对应阶段的 DAG（避免前端无 workflow 数据）

    当 workflow 已存在时，同步 agent_states 到节点状态，让前端看到实时状态。
    """
    if project_id in _workflows:
        engine = _workflows[project_id]
        # 同步 agent_states 到 DAG 节点状态
        for node in engine.nodes.values():
            agent_key = WorkflowEngine._node_to_agent_key(node.id)
            if agent_key and agent_key in state.agent_states:
                agent_st = state.agent_states[agent_key].get("status", "idle")
                # 只更新非 sync 节点（有 agent_fn 的）且状态比当前更新
                if node.agent_fn and agent_st in ("running", "error"):
                    if node.status not in ("running",):
                        node.status = agent_st
                        if agent_st == "error":
                            node.error = state.agent_states[agent_key].get("error", "")
        return engine

    engine = WorkflowEngine(state)
    phase = state.phase

    if phase in ("idle", "planning", "checkpoint"):
        engine.build_planning_graph()
    elif phase in ("writing", "reviewing", "revising", "polishing", "complete"):
        engine.build_chapter_graph(state.current_chapter_index)

    _workflows[project_id] = engine
    return engine


def _sync_planning_status(engine: WorkflowEngine, state: StoryState) -> None:
    """根据 state.design 回填策划阶段 DAG 节点状态

    用于 Tab 切换：让非当前阶段的 DAG 也能正确反映历史完成情况。
    """
    design = state.design or {}
    if not isinstance(design, dict):
        design = {}

    if design.get("outline"):
        engine.nodes["outline_planner"].status = "done"

    if design.get("characters"):
        node = engine.nodes.get("character_designer")
        if node:
            node.status = "done"

    if design.get("world_rules"):
        node = engine.nodes.get("world_builder")
        if node:
            node.status = "done"

    if design.get("foreshadows"):
        node = engine.nodes.get("foreshadow_planner")
        if node:
            node.status = "done"

    # 正在运行的策划 agent 标记为 running
    running_agent = state.current_agent
    if state.phase in ("idle", "planning") and running_agent:
        node = engine.nodes.get(running_agent)
        if node and node.status in ("pending", "ready"):
            node.status = "running"

    # 评估 planning_done
    engine._evaluate_sync_nodes()


def _sync_writing_status(engine: WorkflowEngine, state: StoryState) -> None:
    """根据当前章节的 status / revision_count 回填写作阶段 DAG 节点状态

    用于 Tab 切换：让非当前阶段的 DAG 也能正确反映历史完成情况。
    """
    if not state.chapters:
        return
    if state.current_chapter_index < 0 or state.current_chapter_index >= len(state.chapters):
        return

    chapter = state.chapters[state.current_chapter_index]
    ch_status = chapter.get("status", "pending")
    ch_prefix = f"ch{state.current_chapter_index + 1}"

    # 节点状态映射
    writer_node = engine.nodes.get(f"{ch_prefix}_writer")
    critic_node = engine.nodes.get(f"{ch_prefix}_critic")
    editor_node = engine.nodes.get(f"{ch_prefix}_editor")
    revise_node = engine.nodes.get(f"{ch_prefix}_revise")
    re_review_node = engine.nodes.get(f"{ch_prefix}_re_review")

    # 写作：写完草稿后 -> done
    if ch_status in ("draft", "reviewed", "revising", "polished") and writer_node:
        writer_node.status = "done"
    # 审查
    if ch_status in ("reviewed", "revising", "polished") and critic_node:
        critic_node.status = "done"
    # 修改（有修订记录）
    if state.revision_count and state.revision_count > 0 and revise_node:
        revise_node.status = "done"
    # 复审（最终 polished 且有修订）
    if ch_status == "polished" and state.revision_count and state.revision_count > 0 and re_review_node:
        re_review_node.status = "done"
    # 编辑润色
    if ch_status == "polished" and editor_node:
        editor_node.status = "done"

    # 当前正在运行的节点
    running_agent = state.current_agent
    if state.phase in ("writing", "reviewing", "revising", "polishing") and running_agent:
        agent_node_id_map = {
            "writer": f"{ch_prefix}_writer",
            "critic": f"{ch_prefix}_critic",
            "editor": f"{ch_prefix}_editor",
        }
        nid = agent_node_id_map.get(running_agent)
        if nid:
            node = engine.nodes.get(nid)
            if node and node.status in ("pending", "ready"):
                node.status = "running"

    # 评估 chN_done
    engine._evaluate_sync_nodes()


def _build_all_workflows(state: StoryState) -> dict:
    """为所有阶段构建工作流快照（用于前端 Tab 切换）

    返回 dict: {planning: {...}, writing: {...}, complete: {...}}
    任何阶段不存在时省略对应键。
    """
    workflows = {}

    # (1) 策划阶段 DAG — 始终构建
    p_engine = WorkflowEngine(state)
    p_engine.build_planning_graph()
    _sync_planning_status(p_engine, state)
    workflows["planning"] = p_engine.to_dict()

    # (2) 写作阶段 DAG — 基于当前章节
    if state.chapters and 0 <= state.current_chapter_index < len(state.chapters):
        w_engine = WorkflowEngine(state)
        w_engine.build_chapter_graph(state.current_chapter_index)
        _sync_writing_status(w_engine, state)
        workflows["writing"] = w_engine.to_dict()

    # (3) 完成阶段 DAG — 仅在 phase=complete 时构建
    if state.phase == "complete" and state.chapters:
        c_engine = WorkflowEngine(state)
        c_engine.build_chapter_graph(state.current_chapter_index)
        for node in c_engine.nodes.values():
            node.status = "done"
        workflows["complete"] = c_engine.to_dict()

    return workflows


def get_harness_state(project_id: str) -> dict:
    """获取 Harness 当前状态（包含工作流可视化数据）"""
    state = _get_state(project_id)
    if not state:
        return {"error": "项目未初始化 Harness"}

    result = state.to_dict()

    # 附加工作流状态（用于前端 DAG 可视化）
    engine = _ensure_workflow(project_id, state)
    engine._evaluate_sync_nodes()
    result["workflow"] = engine.to_dict()

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
