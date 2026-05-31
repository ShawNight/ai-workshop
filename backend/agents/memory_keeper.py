"""MemoryKeeper Agent — 章节完成后提取结构化知识

每章完成后运行，提取并更新 Blackboard 的动态知识：
1. 章节摘要（100-200字）
2. 角色状态变化
3. 剧情事件
4. 伏笔状态更新
"""

import json
from .state import StoryState
from .llm import call_agent_llm
from routes.novel import parse_json_from_response


def run_memory_keeper(state: StoryState, chapter_index: int) -> dict:
    """从已完成章节提取知识

    Args:
        state: 当前创作状态
        chapter_index: 章节索引（0-based）

    Returns:
        提取的知识 dict，用于更新 Blackboard
    """
    if chapter_index >= len(state.chapters):
        return {}

    chapter = state.chapters[chapter_index]
    content = chapter.get("content", "")

    if not content or len(content) < 100:
        return {}

    state.set_agent_state("memory_keeper", "running")
    state.log_activity("memory_keeper", "started",
                       f"提取第{chapter_index + 1}章知识")

    # 构建角色信息
    characters = (state.design or {}).get("characters", [])
    char_names = [c.get("name", "") for c in characters if c.get("name")]
    char_list = ", ".join(char_names) if char_names else "未知"

    # 构建已有剧情线信息
    existing_threads = []
    from agents.blackboard import Blackboard
    bb = Blackboard.load(state.project_id)
    if bb:
        for pt in bb.plot_threads:
            if pt.status == "open":
                existing_threads.append(pt.description)

    prompt = f"""你是一位小说分析专家。请分析以下章节内容，提取结构化知识。

【章节信息】
第{chapter_index + 1}章《{chapter.get('title', '')}》

【已知角色】
{char_list}

【已有剧情线】
{'; '.join(existing_threads) if existing_threads else '无'}

【章节内容】
{content[:6000]}

请以JSON格式返回提取的知识：
{{
  "chapter_summary": "本章100-200字精炼摘要（包含核心事件和转折）",
  "character_updates": [
    {{
      "name": "角色名",
      "emotional_state": "当前情绪/心理状态",
      "power_level": "能力/战力变化（如有）",
      "location": "当前位置",
      "key_event": "本章经历的1个关键事件"
    }}
  ],
  "plot_threads": [
    {{
      "description": "新出现或变化的剧情线",
      "status": "open 或 closed"
    }}
  ],
  "timeline_events": [
    {{
      "event": "重要事件简述",
      "location": "事件地点",
      "characters_involved": ["涉及角色"]
    }}
  ]
}}

要求：
- character_updates 只包含本章实际出场的角色
- plot_threads 包含本章新开启或终结的剧情线
- timeline_events 只记录真正重要的事件（不超过3个）
- chapter_summary 要精炼，保留关键转折

只返回JSON。"""

    resp = call_agent_llm("memory_keeper",
                          [{"role": "user", "content": prompt}],
                          temperature=0.2, max_tokens=1500, timeout=60)

    if not resp.success:
        state.set_agent_state("memory_keeper", "error", error="知识提取失败")
        state.log_activity("memory_keeper", "error", "MemoryKeeper 调用失败")
        return {}

    result = parse_json_from_response(resp.content, r'\{.*\}')
    if result and isinstance(result, dict):
        state.set_agent_state("memory_keeper", "done",
                              output=json.dumps(result, ensure_ascii=False)[:200])
        state.log_activity("memory_keeper", "completed",
                           f"第{chapter_index + 1}章知识提取完成")
        return result
    else:
        state.set_agent_state("memory_keeper", "error", error="解析失败")
        state.log_activity("memory_keeper", "error", "知识提取结果格式异常")
        return {}
