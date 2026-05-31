"""WorldBuilder Agent — 并行设计世界观（Phase 3）

在 DAG 工作流中，与 CharacterDesigner 并行执行。
基于大纲设计详细的世界规则、力量体系和地理设定。
"""

import json
from .state import StoryState
from .llm import call_agent_llm
from routes.novel import parse_json_from_response
from config import LLM_MAX_TOKENS_MEDIUM


def run_world_builder(state: StoryState) -> StoryState:
    """世界观设计师：根据大纲设计详细世界观"""
    if not state.design:
        state.set_agent_state("world_builder", "error", error="缺少设计蓝图")
        return state

    state.set_agent_state("world_builder", "running")
    state.log_activity("world_builder", "started", "开始设计世界观")

    outline = state.design.get("outline", [])
    existing_rules = state.design.get("world_rules", [])

    # 构建大纲概要
    outline_text = _format_outline(outline)
    seed_context = f"【故事创意】{state.seed[:200]}" if state.seed else ""

    # 现有规则
    rules_text = ""
    if existing_rules:
        rules_text = f"\n【现有世界规则】\n{json.dumps(existing_rules, ensure_ascii=False, indent=2)}"

    prompt = f"""你是一位资深小说世界观设计师。以下是一个小说项目的大纲，请设计完整的世界观设定。

【小说类型】{state.genre}
【写作风格】{state.style}
{seed_context}

【大纲概要】
{outline_text}
{rules_text}

请返回世界观设定（JSON），格式如下：
{{
  "world_rules": [
    {{
      "rule": "规则名称",
      "type": "hard",
      "detail": "详细说明（100字以内）",
      "constraints": ["具体限制1", "具体限制2"]
    }}
  ],
  "power_system": {{
    "name": "力量体系名称",
    "levels": ["等级1", "等级2", "等级3", "等级4", "等级5"],
    "source": "力量来源",
    "rules": ["核心规则1", "核心规则2"]
  }},
  "geography": [
    {{
      "name": "地名",
      "type": "城市/山脉/森林/海域",
      "description": "简要描述",
      "significance": "对剧情的重要性"
    }}
  ]
}}

要求：
- world_rules 包含2-6条规则，hard类型规则必须有明确约束
- power_system 根据小说类型设计（如仙侠→修炼体系，科幻→科技等级）
- geography 列出3-8个重要地点，与大纲中的事件对应
- 所有设定必须自洽，不能相互矛盾
- 如果是现实题材（都市/悬疑），power_system 可为空

只返回JSON。"""

    resp = call_agent_llm("planner",
                          [{"role": "user", "content": prompt}],
                          temperature=0.7, max_tokens=LLM_MAX_TOKENS_MEDIUM, timeout=180)

    if not resp.success:
        state.set_agent_state("world_builder", "error", error=f"世界观设计调用失败: {resp.error}")
        state.log_activity("world_builder", "error", f"AI 调用失败: {resp.error}")
        return state

    result = parse_json_from_response(resp.content, r'\{.*\}')

    if result and isinstance(result, dict):
        # 合并到 design
        if "world_rules" in result:
            state.design["world_rules"] = result["world_rules"]
        if "power_system" in result:
            state.design["power_system"] = result["power_system"]
        if "geography" in result:
            state.design["geography"] = result["geography"]

        rules_count = len(result.get("world_rules", []))
        locations = len(result.get("geography", []))
        state.set_agent_state("world_builder", "done",
                              output=f"{rules_count}条规则, {locations}个地点")
        state.log_activity("world_builder", "completed",
                           f"世界观设计完成 — {rules_count}条规则, {locations}个地点")
    else:
        content_preview = (resp.content or "")[:200]
        state.set_agent_state("world_builder", "error", error=f"世界观设计结果解析失败: {content_preview}")
        state.log_activity("world_builder", "error", f"世界观设计结果格式异常: {content_preview}")

    return state


def _format_outline(outline: list) -> str:
    """格式化大纲为文本"""
    parts = []
    for vol in outline:
        vol_text = f"第{vol.get('volume', 1)}卷《{vol.get('title', '')}》— 目标: {vol.get('goal', '')}"
        ch_parts = []
        for ch in vol.get("chapters_detail", []):
            ch_parts.append(f"  第{ch.get('index', '?')}章《{ch.get('title', '')}》: {ch.get('guidance', '')}")
        parts.append(vol_text + "\n" + "\n".join(ch_parts))
    return "\n\n".join(parts) if parts else "无大纲"
