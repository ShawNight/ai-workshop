"""CharacterDesigner Agent — 并行设计角色（Phase 3）

在 DAG 工作流中，与 WorldBuilder 并行执行。
基于大纲中的章节规划，设计更详细的角色档案。
"""

import json
from .state import StoryState
from .llm import call_agent_llm
from routes.novel import parse_json_from_response
from config import LLM_MAX_TOKENS_MEDIUM


def run_character_designer(state: StoryState) -> StoryState:
    """角色设计师：根据大纲设计详细角色档案

    如果 planner 已经生成了完整角色，则细化补充；
    如果只有大纲没有角色，则从头设计。
    """
    if not state.design:
        state.set_agent_state("character_designer", "error", error="缺少设计蓝图")
        return state

    state.set_agent_state("character_designer", "running")
    state.log_activity("character_designer", "started", "开始设计角色档案")

    outline = state.design.get("outline", [])
    existing_chars = state.design.get("characters", [])

    # 构建大纲概要
    outline_text = _format_outline(outline)

    # 如果已有角色，基于大纲细化
    if existing_chars:
        existing_text = json.dumps(existing_chars, ensure_ascii=False, indent=2)
        prompt = f"""你是一位资深小说角色设计师。以下是一个小说项目的现有大纲和角色设定。
请根据大纲的发展需要，**细化和补充**角色档案。

【小说类型】{state.genre}
【写作风格】{state.style}

【大纲概要】
{outline_text}

【现有角色】
{existing_text}

请返回完善后的角色列表（JSON数组），格式如下：
[
  {{
    "name": "角色名",
    "role": "主角/反派/配角",
    "traits": ["性格特征1", "性格特征2", "性格特征3"],
    "appearance": "详细外貌描述（50字以内）",
    "backstory": "背景故事（100字以内）",
    "arc": {{
      "want": "外在目标",
      "need": "内在需求",
      "truth": "需要领悟的真相",
      "flaw": "核心缺陷"
    }},
    "speech_style": "说话风格/口头禅",
    "first_appear": "首次出场的章节（如'第1章'）"
  }}
]

要求：
- 细化现有角色的性格和成长弧线，使其更立体
- 如果大纲需要但角色列表缺少，补充新角色
- 角色总数控制在3-8个
- 每个角色的arc必须完整（want/need/truth/flaw）
- 角色之间的关系隐含在arcs中

只返回JSON数组。"""
    else:
        prompt = f"""你是一位资深小说角色设计师。以下是一个小说项目的大纲，请设计合适的角色。

【小说类型】{state.genre}
【写作风格】{state.style}
【故事创意】{state.seed[:200]}

【大纲概要】
{outline_text}

请返回角色列表（JSON数组），格式如下：
[
  {{
    "name": "角色名",
    "role": "主角/反派/配角",
    "traits": ["性格特征1", "性格特征2", "性格特征3"],
    "appearance": "详细外貌描述（50字以内）",
    "backstory": "背景故事（100字以内）",
    "arc": {{
      "want": "外在目标",
      "need": "内在需求",
      "truth": "需要领悟的真相",
      "flaw": "核心缺陷"
    }},
    "speech_style": "说话风格/口头禅",
    "first_appear": "首次出场的章节（如'第1章'）"
  }}
]

要求：
- 设计3-8个角色
- 主角必须有完整的成长弧线（want→need→truth）
- 反派要有合理的动机
- 配角各有特色，不雷同
- 角色关系要产生冲突和张力

只返回JSON数组。"""

    resp = call_agent_llm("planner",
                          [{"role": "user", "content": prompt}],
                          temperature=0.7, max_tokens=LLM_MAX_TOKENS_MEDIUM, timeout=120)

    if not resp.success:
        error_msg = f"角色设计调用失败: {resp.error}"
        state.set_agent_state("character_designer", "error", error=error_msg)
        state.log_activity("character_designer", "error", error_msg)
        raise RuntimeError(error_msg)

    characters = parse_json_from_response(resp.content, r'\[.*\]')

    if characters and isinstance(characters, list):
        state.design["characters"] = characters
        state.set_agent_state("character_designer", "done",
                              output=f"设计了{len(characters)}个角色")
        state.log_activity("character_designer", "completed",
                           f"角色设计完成 — {len(characters)}个角色")
    else:
        # 解析失败，保留现有角色
        error_msg = "角色设计结果解析失败"
        state.set_agent_state("character_designer", "error", error=error_msg)
        state.log_activity("character_designer", "error", error_msg)
        raise RuntimeError(error_msg)

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
