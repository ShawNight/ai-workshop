"""Planner Agent — 从种子创意生成完整小说设计蓝图"""

import json
from .state import StoryState
from .llm import call_agent_llm
from routes.novel import parse_json_from_response


def run_planner(state: StoryState) -> StoryState:
    """策划师：从种子创意生成完整设计蓝图"""
    state.phase = "planning"
    state.set_agent_state("planner", "running")
    state.log_activity("planner", "started", f"开始策划《{state.seed[:30]}...》")

    prompt = f"""你是一位资深小说策划师。请根据以下种子创意，生成一部完整小说的设计蓝图。

【种子创意】
{state.seed}

【小说类型】{state.genre}
【写作风格】{state.style}
【目标字数】{state.target_words} 字
【补充概要】{state.synopsis or "无"}

请以JSON格式返回设计蓝图，结构如下：
{{
  "synopsis": "200字故事梗概",
  "outline": [
    {{
      "volume": 1,
      "title": "卷标题",
      "goal": "本卷核心目标",
      "chapters": 8,
      "chapters_detail": [
        {{"index": 1, "title": "章标题", "guidance": "本章剧情引导（50字内）"}}
      ]
    }}
  ],
  "characters": [
    {{
      "name": "角色名",
      "role": "主角/反派/配角",
      "traits": ["性格特征1", "性格特征2"],
      "appearance": "外貌描述",
      "backstory": "背景故事",
      "arc": {{"want": "外在目标", "need": "内在需求", "truth": "需要领悟的真相"}}
    }}
  ],
  "world_rules": [
    {{"rule": "世界观规则", "type": "hard/soft", "detail": "详细说明"}}
  ],
  "foreshadows": [
    {{"description": "伏笔描述", "plant_stage": "种下时机", "reveal_stage": "揭示时机", "importance": "主要/次要"}}
  ]
}}

要求：
- 大纲合理分卷，每卷4-12章，总章节数匹配目标字数（每章约3000-5000字）
- 角色3-8个，主角必须有完整的成长弧线
- 世界规则2-6条
- 伏笔3-8个
- 所有内容需自洽，角色名不得重复

只返回JSON，不要任何额外文字。"""

    resp = call_agent_llm("planner", [{"role": "user", "content": prompt}], temperature=0.8, timeout=180)

    if not resp.success:
        error_msg = resp.error or "未知错误"
        state.set_agent_state("planner", "error", error=error_msg)
        state.log_activity("planner", "error", f"策划师调用失败: {error_msg}")
        return state

    result = resp.content

    design = parse_json_from_response(result, r'\{.*\}')
    if design and isinstance(design, dict) and "outline" in design:
        state.design = design

        # 计算总章节数
        total = sum(vol.get("chapters", 0) for vol in design.get("outline", []))
        state.total_chapters = total

        # 构建章节骨架列表
        chapters = []
        idx = 1
        for vol in design.get("outline", []):
            for ch in vol.get("chapters_detail", []):
                chapters.append({
                    "index": idx,
                    "id": f"ch-{idx}",
                    "title": ch.get("title", f"第{idx}章"),
                    "guidance": ch.get("guidance", ""),
                    "volume": vol.get("volume", 1),
                    "volume_title": vol.get("title", ""),
                    "content": "",
                    "status": "pending",
                    "word_count": 0,
                    "agent_logs": [],
                })
                idx += 1

        state.chapters = chapters
        state.current_chapter_index = 0

        # Phase 2: 初始化 Blackboard 共享知识库
        try:
            from .blackboard import Blackboard
            bb = Blackboard()
            bb.load_from_design(design)
            bb.persist(state.project_id)
        except Exception as e:
            print(f"[Planner] Blackboard 初始化失败（不影响主流程）: {e}")

        char_count = len(design.get("characters", []))
        rule_count = len(design.get("world_rules", []))
        foreshadow_count = len(design.get("foreshadows", []))

        state.set_agent_state("planner", "done", output=json.dumps(design, ensure_ascii=False))
        state.phase = "writing"
        state.log_activity(
            "planner", "completed",
            f"完成故事蓝图 — {len(design.get('outline', []))}卷{total}章，"
            f"{char_count}个角色，{rule_count}条世界规则，{foreshadow_count}个伏笔"
        )
    else:
        state.set_agent_state("planner", "error", error="AI 返回格式异常")
        state.log_activity("planner", "error", "策划师输出格式异常，请重试")

    return state
