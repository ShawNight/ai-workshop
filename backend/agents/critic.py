"""Critic Agent — 审查章节质量与一致性（Phase 3 评分制）

Phase 3 改进：
- 从二元 pass/fail 改为 1-10 评分制
- 按分数决定工作流分支：
  ≥ 8.5 → 跳过编辑（quality_skip）
  ≥ 6.0 → 通过，进入编辑
  ≥ 4.0 → 条件通过，附带修改建议
  < 4.0 → 失败，返回 Writer 修改
- 修改轮次上限从3提升到5
"""

import json
from .state import StoryState
from .llm import call_agent_llm
from routes.novel import parse_json_from_response


def run_critic(state: StoryState) -> StoryState:
    """评论家：审查当前章节的质量和一致性（评分制）"""
    current = state.chapters[state.current_chapter_index] if state.chapters else None
    if not current or not current.get("content"):
        state.set_agent_state("critic", "error", error="无章节内容可审查")
        return state

    state.phase = "reviewing"
    state.set_agent_state("critic", "running")
    state.log_activity("critic", "started",
                       f"开始审查第{current['index']}章《{current['title']}》")

    # 构建审查上下文
    rules = state.design.get("world_rules", []) if state.design else []
    rules_text = "\n".join(
        f"- [{r.get('type', 'soft')}] {r['rule']}: {r.get('detail', '')}"
        for r in rules
    ) if rules else "无"

    characters = state.design.get("characters", []) if state.design else []
    chars_text = "\n".join(
        f"- {c['name']}({c.get('role', '')}): 性格={', '.join(c.get('traits', []))}; 背景={c.get('backstory', '')}"
        for c in characters
    ) if characters else "无"

    # 前文摘要（从 Blackboard 获取更好的摘要，降级为简单截取）
    prev_summary = _get_prev_summary(state)

    prompt = f"""你是一位资深文学评论家。请审查以下小说章节的质量，给出评分。

【章节信息】
第{current['index']}章《{current['title']}》
字数: {len(current.get('content', ''))}

【章节内容】
{current.get('content', '')[:4000]}

【角色设定】
{chars_text}

【世界规则】
{rules_text}

【前文摘要】
{prev_summary}

请从以下5个维度评分（1-10分），返回JSON：
{{
  "checks": [
    {{"dimension": "角色一致性", "score": 8, "pass": true, "detail": "角色行为是否符合设定"}},
    {{"dimension": "世界规则", "score": 7, "pass": true, "detail": "是否违反世界观设定"}},
    {{"dimension": "剧情连贯", "score": 9, "pass": true, "detail": "与前文的衔接是否自然"}},
    {{"dimension": "节奏控制", "score": 8, "pass": true, "detail": "本章节奏是否得当"}},
    {{"dimension": "文笔质量", "score": 7, "pass": true, "detail": "语言表达是否有明显问题"}}
  ],
  "overall_score": 7.8,
  "overall_pass": true,
  "summary": "一句话总评",
  "suggestions": []
}}

评分规则：
- 9-10: 出色，无需任何修改
- 7-8: 良好，小瑕疵可接受
- 5-6: 及格，有改进空间但不影响阅读
- 3-4: 较差，有明显问题需要修改
- 1-2: 很差，需要大幅重写

overall_score = 加权平均: 角色(0.25) + 世界(0.20) + 剧情(0.25) + 节奏(0.15) + 文笔(0.15)
overall_pass: overall_score >= 6.0 为 true
suggestions: 如果 any dimension score < 6，给出具体可执行的修改建议

只返回JSON。"""

    resp = call_agent_llm("critic", [{"role": "user", "content": prompt}], temperature=0.3)
    result = resp.content if resp.success else None

    if result is None:
        state.set_agent_state("critic", "error", error="AI 服务暂时不可用")
        state.log_activity("critic", "error", "评论家调用失败")
        return state

    review = parse_json_from_response(result, r'\{.*\}')
    if review and isinstance(review, dict):
        score = review.get("overall_score", 0)
        passed = review.get("overall_pass", score >= 6.0)
        suggestions = review.get("suggestions", [])
        summary = review.get("summary", "")

        state.set_agent_state("critic", "done",
                              output=json.dumps(review, ensure_ascii=False))
        current["agent_logs"].append({
            "agent": "critic",
            "timestamp": "",
            "action": "reviewed",
            "score": score,
            "summary": summary,
        })

        # 根据评分决定分支
        if score >= 8.5:
            # 高质量：直接通过，跳过编辑
            state.phase = "polishing"
            state.revision_count = 0
            state.log_activity("critic", "quality_skip",
                               f"第{current['index']}章评分 {score}/10 — 高质量，跳过编辑 ✓")

        elif passed:
            # 通过：进入编辑
            state.phase = "polishing"
            state.revision_count = 0
            state.log_activity("critic", "approved",
                               f"第{current['index']}章审查通过 ({score}/10) — {summary}")

        else:
            # 未通过：需要修改
            state.phase = "revising"
            state.revision_count += 1
            suggestions_text = "; ".join(suggestions[:3]) if suggestions else "需要修改"

            if state.revision_count >= state.max_revisions:
                # 达到最大修改次数，强制通过
                state.phase = "polishing"
                state.log_activity("critic", "max_revisions",
                                   f"第{current['index']}章已达最大修改次数({state.max_revisions})，强制通过 ({score}/10)")
            else:
                # 存储修改建议给 Writer
                state.agent_states.setdefault("critic", {})["last_output"] = json.dumps({
                    "score": score,
                    "summary": summary,
                    "suggestions": suggestions,
                }, ensure_ascii=False)
                state.log_activity("critic", "revision",
                                   f"第{current['index']}章需要修改 (第{state.revision_count}轮, {score}/10) — {suggestions_text}")
    else:
        state.set_agent_state("critic", "error", error="AI 审查结果解析失败")
        state.log_activity("critic", "error", "审查结果格式异常")

    return state


def _get_prev_summary(state: StoryState) -> str:
    """获取前文摘要（优先从 Blackboard，降级为简单截取）"""
    try:
        from .blackboard import Blackboard
        bb = Blackboard.load(state.project_id)
        if bb and bb.chapter_summaries:
            summaries = []
            for idx in sorted(bb.chapter_summaries.keys()):
                if idx <= state.current_chapter_index:
                    summaries.append(f"第{idx}章: {bb.chapter_summaries[idx]}")
            if summaries:
                return "\n".join(summaries[-5:])
    except Exception:
        pass

    # 降级：简单截取
    prev_chapters = [c for c in state.chapters[:state.current_chapter_index] if c.get("content")]
    if prev_chapters:
        return "\n".join(
            f"第{c['index']}章《{c['title']}》: {c.get('content', '')[:300]}..."
            for c in prev_chapters[-3:]
        )

    return "无（本章为第1章）"
