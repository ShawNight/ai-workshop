"""Editor Agent — 润色章节语言表达

Phase 2 改进：
- 润色完成后运行 MemoryKeeper 更新 Blackboard
- 每步完成后持久化状态
"""

from .state import StoryState
from .llm import call_agent_llm
from .state_store import StateStore


def run_editor(state: StoryState) -> StoryState:
    """编辑：润色当前章节，优化语言表达"""
    current = state.chapters[state.current_chapter_index] if state.chapters else None
    if not current or not current.get("content"):
        state.set_agent_state("editor", "error", error="无章节内容可编辑")
        return state

    state.phase = "polishing"
    state.set_agent_state("editor", "running")
    state.log_activity("editor", "started",
                       f"开始润色第{current['index']}章《{current['title']}》")

    prompt = f"""你是一位资深文学编辑，擅长精炼文字、优化表达。

请对以下小说章节进行润色。要求：
- 保持原意和情节不变
- 修正语法错误和不通顺的句子
- 优化重复用词和啰嗦表达
- 增强文学性和画面感
- 保持作者风格（{state.style}）
- 不增删情节，不改变角色对话的核心意思
- 字数变化不超过±10%

【章节标题】{current['title']}
【写作风格】{state.style}

【原文】
{current['content']}

请直接输出润色后的完整章节正文，不要添加任何标记或说明。"""

    resp = call_agent_llm("editor", [{"role": "user", "content": prompt}], temperature=0.4, timeout=90)
    result = resp.content if resp.success else None

    if result is None:
        state.set_agent_state("editor", "error", error="AI 服务暂时不可用")
        state.log_activity("editor", "error", "编辑调用失败")
        # 即使编辑失败，也标记为完成（用原文）
        current["status"] = "polished"
        state.set_agent_state("editor", "done")
        state.log_activity("editor", "fallback", "编辑跳过，使用原文")
        return _advance_chapter(state)

    # 清理输出
    content = result.strip()
    if content.startswith("```"):
        content = "\n".join(content.split("\n")[1:])
    if content.endswith("```"):
        content = "\n".join(content.split("\n")[:-1])

    current["content"] = content.strip()
    current["status"] = "polished"
    current["word_count"] = len(content)
    current["agent_logs"].append({
        "agent": "editor",
        "timestamp": "",
        "action": "polished",
    })

    state.set_agent_state("editor", "done",
                          output=content[:500] + "..." if len(content) > 500 else content)
    state.log_activity("editor", "completed",
                       f"第{current['index']}章《{current['title']}》润色完成 ({len(content)}字)")

    return _advance_chapter(state)


def _advance_chapter(state: StoryState) -> StoryState:
    """推进到下一章

    Phase 2: 润色完成后运行 MemoryKeeper 更新 Blackboard
    Phase 6: 润色完成后运行 BlueprintSync 提取新角色/新伏笔并回写 design
    """
    chapter_index = state.current_chapter_index

    # 运行 MemoryKeeper 更新 Blackboard（异步，不阻塞主流程）
    try:
        from .writer import update_blackboard_after_chapter
        update_blackboard_after_chapter(state, chapter_index)
    except Exception as e:
        print(f"[Editor] MemoryKeeper 更新失败（不影响主流程）: {e}")

    # 运行 BlueprintSync 同步设计蓝图
    try:
        from .blueprint_sync import run_blueprint_sync
        run_blueprint_sync(state, chapter_index)
    except Exception as e:
        print(f"[Editor] BlueprintSync 失败（不影响主流程）: {e}")

    state.completed_chapters += 1
    state.revision_count = 0

    # 持久化当前状态
    StateStore.save(state)

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
