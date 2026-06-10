"""Writer Agent — 根据设计文档创作章节

Phase 2 改进：
- 使用 Blackboard 智能上下文替代简陋的"最近5章摘要"
- 上下文包含：所有前文摘要、角色当前状态、活跃伏笔、剧情线
- 支持流式输出（通过 SSE 推送章节内容片段）
"""

from .state import StoryState
from .llm import call_agent_llm
from .blackboard import Blackboard
from .memory_keeper import run_memory_keeper


def _get_or_create_blackboard(state: StoryState) -> Blackboard:
    """获取或创建 Blackboard"""
    bb = Blackboard.load(state.project_id)
    if not bb:
        bb = Blackboard()
        if state.design:
            bb.load_from_design(state.design)
            bb.persist(state.project_id)
    return bb


def run_writer(state: StoryState) -> StoryState:
    """写手：根据设计文档创作当前章节"""
    if not state.design or not state.chapters:
        state.set_agent_state("writer", "error", error="缺少设计蓝图或章节列表")
        return state

    current = state.chapters[state.current_chapter_index]
    if not current:
        state.set_agent_state("writer", "error", error="章节索引越界")
        return state

    state.phase = "writing"
    state.set_agent_state("writer", "running")
    state.log_activity("writer", "started",
                       f"开始创作第{current['index']}章《{current['title']}》")

    # 使用 Blackboard 获取智能上下文
    bb = _get_or_create_blackboard(state)
    context = bb.get_relevant_context(
        chapter_index=current['index'],
        token_budget=6000,
    )

    # 修改建议（如果是修改轮次）
    revision_note = ""
    if state.revision_count > 0 and state.agent_states.get("critic", {}).get("last_output"):
        revision_note = f"\n\n【修改建议（第{state.revision_count}轮）】\n{state.agent_states['critic']['last_output']}\n请根据以上建议修改本章。"

    prompt = f"""你是一位专业小说家，擅长{state.genre}类型，写作风格为{state.style}。

{context}

【当前任务】
创作第{current['index']}章《{current['title']}》
章节引导: {current.get('guidance', '自由发挥')}

要求：
- 2000-5000字
- 保持角色人设一致
- 遵守世界规则
- 推进剧情发展
- 自然融入或铺垫伏笔
- 本章应有完整的情节弧线（开端-发展-小高潮）
- 结尾留下悬念或自然衔接下一章
{revision_note}

请直接输出小说正文，不要添加任何标记或说明。"""

    resp = call_agent_llm("writer", [{"role": "user", "content": prompt}], temperature=0.7, timeout=300)
    result = resp.content if resp.success else None

    if result is None:
        error_msg = "AI 服务暂时不可用"
        state.set_agent_state("writer", "error", error=error_msg)
        state.log_activity("writer", "error", f"写手调用失败: {state.agent_states.get('writer', {}).get('error', '')}")
        raise RuntimeError(error_msg)

    # 清理输出
    content = result.strip()
    # 移除可能的 markdown 代码块标记
    if content.startswith("```"):
        content = "\n".join(content.split("\n")[1:])
    if content.endswith("```"):
        content = "\n".join(content.split("\n")[:-1])

    current["content"] = content.strip()
    current["status"] = "draft"
    current["word_count"] = len(content)
    current["agent_logs"].append({
        "agent": "writer",
        "timestamp": "",
        "action": "drafted",
    })

    state.set_agent_state("writer", "done",
                          output=content[:500] + "..." if len(content) > 500 else content)
    state.phase = "reviewing"
    state.log_activity("writer", "completed",
                       f"第{current['index']}章《{current['title']}》草稿完成 ({len(content)}字)")

    return state


def update_blackboard_after_chapter(state: StoryState, chapter_index: int) -> Blackboard:
    """章节完成后更新 Blackboard

    1. 运行 MemoryKeeper 提取知识
    2. 更新 Blackboard 动态知识
    3. 持久化 Blackboard
    """
    bb = _get_or_create_blackboard(state)

    # 提取知识
    memory_data = run_memory_keeper(state, chapter_index)

    if memory_data:
        bb.update_from_memory(chapter_index + 1, memory_data)  # chapter_index是0-based，存为1-based
        bb.persist(state.project_id)

    return bb
