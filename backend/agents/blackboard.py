"""Blackboard — 所有Agent共享的结构化知识库

替代 Writer 中简陋的"最近5章摘要"方案，提供智能上下文选择。

核心设计：
- 静态知识：来自策划师的大纲、角色、世界观、伏笔
- 动态知识：写作过程中累积的章节摘要、角色状态、剧情线
- get_relevant_context()：在token预算内智能选择最相关的上下文
"""

import json
from dataclasses import dataclass, field
from database import get_connection


@dataclass
class CharacterState:
    """角色当前状态追踪"""
    name: str = ""
    last_seen_chapter: int = 0      # 最近出场的章节
    emotional_state: str = ""       # 情绪状态
    power_level: str = ""           # 能力等级/战力
    location: str = ""              # 当前位置
    relationships_changed: str = "" # 关系变化
    key_events: list = field(default_factory=list)  # 经历的关键事件


@dataclass
class PlotThread:
    """剧情线"""
    description: str = ""           # 剧情线描述
    status: str = "open"            # open / closed
    opened_at_chapter: int = 0      # 开始章节
    closed_at_chapter: int = 0      # 结束章节
    key_events: list = field(default_factory=list)


class Blackboard:
    """共享知识库

    所有Agent读写同一个Blackboard实例，实现知识共享。
    通过 get_relevant_context() 为 Writer 等Agent提供智能上下文。
    """

    def __init__(self):
        # 静态知识（来自策划师）
        self.outline: dict = {}
        self.characters: dict[str, dict] = {}  # name -> profile dict
        self.world_rules: list[dict] = []
        self.foreshadows: list[dict] = []

        # 动态知识（写作过程中累积）
        self.chapter_summaries: dict[int, str] = {}        # chapter_index -> summary
        self.character_states: dict[str, CharacterState] = {}  # name -> state
        self.plot_threads: list[PlotThread] = []
        self.timeline_events: list[dict] = []

    # ==================== 静态知识初始化 ====================

    def load_from_design(self, design: dict):
        """从策划师的设计蓝图加载静态知识"""
        self.outline = design.get("outline", [])

        # 角色档案
        self.characters = {}
        for c in design.get("characters", []):
            name = c.get("name", "")
            if name:
                self.characters[name] = c
                # 初始化角色状态
                if name not in self.character_states:
                    self.character_states[name] = CharacterState(name=name)

        self.world_rules = design.get("world_rules", [])
        self.foreshadows = design.get("foreshadows", [])

    # ==================== 动态知识更新 ====================

    def update_from_memory(self, chapter_index: int, memory_data: dict):
        """从 MemoryKeeper 的提取结果更新动态知识"""
        # 更新章节摘要
        summary = memory_data.get("chapter_summary", "")
        if summary:
            self.chapter_summaries[chapter_index] = summary

        # 更新角色状态
        for char_update in memory_data.get("character_updates", []):
            name = char_update.get("name", "")
            if not name:
                continue
            if name not in self.character_states:
                self.character_states[name] = CharacterState(name=name)
            state = self.character_states[name]
            state.last_seen_chapter = chapter_index
            if char_update.get("emotional_state"):
                state.emotional_state = char_update["emotional_state"]
            if char_update.get("power_level"):
                state.power_level = char_update["power_level"]
            if char_update.get("location"):
                state.location = char_update["location"]
            if char_update.get("key_event"):
                state.key_events.append(char_update["key_event"])

        # 更新剧情线
        for thread_data in memory_data.get("plot_threads", []):
            desc = thread_data.get("description", "")
            # 检查是否已存在
            existing = None
            for pt in self.plot_threads:
                if pt.description == desc:
                    existing = pt
                    break
            if existing:
                if thread_data.get("status") == "closed":
                    existing.status = "closed"
                    existing.closed_at_chapter = chapter_index
            else:
                self.plot_threads.append(PlotThread(
                    description=desc,
                    status=thread_data.get("status", "open"),
                    opened_at_chapter=chapter_index,
                ))

        # 时间线事件
        for event in memory_data.get("timeline_events", []):
            event["chapter"] = chapter_index
            self.timeline_events.append(event)

    # ==================== 智能上下文选择 ====================

    def get_relevant_context(self, chapter_index: int, token_budget: int = 6000) -> str:
        """为 Writer 提供智能上下文

        在 token_budget 内（按中文字≈1.5token估算），优先选择最相关的内容：

        优先级：
        1. 当前章节涉及的角色档案 + 当前状态（必须包含）
        2. hard 类型世界规则（必须包含）
        3. 相关伏笔（必须包含）
        4. 当前卷的目标和章节列表
        5. 最近章节摘要（权重最高）
        6. 开放剧情线
        7. 更早的章节摘要
        """
        parts = []
        char_budget = token_budget  # 估算剩余可用字数

        # --- 1. 当前卷信息（最高优先）---
        current_vol = self._get_current_volume(chapter_index)
        if current_vol:
            vol_info = f"【当前卷】第{current_vol.get('volume', 1)}卷《{current_vol.get('title', '')}》\n"
            vol_info += f"本卷目标: {current_vol.get('goal', '推进主线剧情')}\n"
            ch_titles = [f"第{ch.get('index', i+1)}章《{ch.get('title', '')}》"
                         for i, ch in enumerate(current_vol.get('chapters_detail', []))]
            vol_info += f"本卷章节: {', '.join(ch_titles)}"
            parts.append(vol_info)
            char_budget -= len(vol_info)

        # --- 2. 角色档案 + 当前状态 ---
        char_profiles = self.characters.values()
        if char_profiles:
            char_lines = []
            for c in list(char_profiles)[:8]:  # 最多8个角色
                name = c.get("name", "")
                arc = c.get("arc", {})
                line = f"{name}({c.get('role', '')}): "
                line += f"性格={', '.join(c.get('traits', []))}; "
                line += f"外貌={c.get('appearance', '')}; "
                line += f"目标={arc.get('want', '')}"

                # 附加角色当前状态
                state = self.character_states.get(name)
                if state and state.last_seen_chapter > 0:
                    line += f"; 最新状态(第{state.last_seen_chapter}章): "
                    if state.emotional_state:
                        line += f"情绪={state.emotional_state}"
                    if state.location:
                        line += f", 位置={state.location}"
                    if state.power_level:
                        line += f", 实力={state.power_level}"

                char_lines.append(line)

            char_text = "【角色设定】\n" + "\n".join(char_lines)
            parts.append(char_text)
            char_budget -= len(char_text)

        # --- 3. 世界规则（hard 类型必须包含）---
        if self.world_rules:
            rule_lines = []
            for r in self.world_rules:
                marker = "强制" if r.get("type") == "hard" else "参考"
                rule_lines.append(f"- [{marker}] {r['rule']}: {r.get('detail', '')}")
            rules_text = "【世界规则】\n" + "\n".join(rule_lines)
            parts.append(rules_text)
            char_budget -= len(rules_text)

        # --- 4. 相关伏笔 ---
        relevant_fs = self._get_relevant_foreshadows(chapter_index)
        if relevant_fs:
            fs_lines = []
            for f in relevant_fs:
                status = "待种下" if chapter_index < self._parse_stage_number(f.get("plant_stage", "")) else "已种下"
                fs_lines.append(f"- [{f.get('importance', '')}] {f['description']} (种下: {f.get('plant_stage', '')}, 揭示: {f.get('reveal_stage', '')}, 状态: {status})")
            fs_text = "【相关伏笔】\n" + "\n".join(fs_lines)
            parts.append(fs_text)
            char_budget -= len(fs_text)

        # --- 5. 开放剧情线 ---
        open_threads = [pt for pt in self.plot_threads if pt.status == "open"]
        if open_threads:
            thread_lines = [f"- {pt.description} (始于第{pt.opened_at_chapter}章)" for pt in open_threads[:5]]
            thread_text = "【开放剧情线】\n" + "\n".join(thread_lines)
            if len(thread_text) < char_budget:
                parts.append(thread_text)
                char_budget -= len(thread_text)

        # --- 6. 章节摘要（从最近往回填充）---
        if self.chapter_summaries and char_budget > 200:
            summary_parts = []
            sorted_indices = sorted(self.chapter_summaries.keys(), key=int, reverse=True)
            for idx in sorted_indices:
                if int(idx) >= chapter_index:
                    continue  # 跳过当前及之后的章节
                summary = self.chapter_summaries[idx]
                line = f"第{idx}章摘要: {summary}"
                if len(line) > char_budget:
                    break
                summary_parts.insert(0, line)  # 按时间顺序
                char_budget -= len(line)

            if summary_parts:
                parts.append("【前文摘要】\n" + "\n".join(summary_parts))

        return "\n\n".join(parts)

    # ==================== 辅助方法 ====================

    def _get_current_volume(self, chapter_index: int) -> dict | None:
        """获取当前章节所在的卷信息"""
        for vol in self.outline:
            ch_details = vol.get("chapters_detail", [])
            for ch in ch_details:
                if ch.get("index") == chapter_index:
                    return vol
        return None

    def _get_relevant_foreshadows(self, chapter_index: int) -> list[dict]:
        """获取当前章节相关的伏笔"""
        total = max(chapter_index + 1, 10)  # 避免除零
        result = []
        for f in self.foreshadows:
            # 包含所有主要伏笔
            if f.get("importance") == "主要":
                result.append(f)
                continue
            # 包含需要种下的伏笔
            plant_num = self._parse_stage_number(f.get("plant_stage", ""))
            reveal_num = self._parse_stage_number(f.get("reveal_stage", ""))
            if plant_num > 0 and abs(chapter_index - plant_num) <= 2:
                result.append(f)
            elif reveal_num > 0 and abs(chapter_index - reveal_num) <= 3:
                result.append(f)
        return result

    def _parse_stage_number(self, stage: str) -> int:
        """从伏笔阶段描述中提取章节数字"""
        import re
        match = re.search(r'第(\d+)章', stage)
        if match:
            return int(match.group(1))
        return 0

    # ==================== 持久化 ====================

    def to_dict(self) -> dict:
        """序列化为字典"""
        return {
            "outline": self.outline,
            "characters": self.characters,
            "world_rules": self.world_rules,
            "foreshadows": self.foreshadows,
            "chapter_summaries": self.chapter_summaries,
            "character_states": {
                name: {
                    "name": s.name,
                    "last_seen_chapter": s.last_seen_chapter,
                    "emotional_state": s.emotional_state,
                    "power_level": s.power_level,
                    "location": s.location,
                    "key_events": s.key_events[-5:],  # 只保留最近5个事件
                }
                for name, s in self.character_states.items()
            },
            "plot_threads": [
                {
                    "description": pt.description,
                    "status": pt.status,
                    "opened_at_chapter": pt.opened_at_chapter,
                    "closed_at_chapter": pt.closed_at_chapter,
                }
                for pt in self.plot_threads
            ],
            "timeline_events": self.timeline_events[-50:],  # 只保留最近50个事件
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Blackboard":
        """从字典反序列化"""
        bb = cls()
        bb.outline = data.get("outline", {})
        bb.characters = data.get("characters", {})
        bb.world_rules = data.get("world_rules", [])
        bb.foreshadows = data.get("foreshadows", [])
        bb.chapter_summaries = data.get("chapter_summaries", {})

        # 反序列化角色状态
        for name, sd in data.get("character_states", {}).items():
            state = CharacterState(name=name)
            state.last_seen_chapter = sd.get("last_seen_chapter", 0)
            state.emotional_state = sd.get("emotional_state", "")
            state.power_level = sd.get("power_level", "")
            state.location = sd.get("location", "")
            state.key_events = sd.get("key_events", [])
            bb.character_states[name] = state

        # 反序列化剧情线
        for ptd in data.get("plot_threads", []):
            bb.plot_threads.append(PlotThread(
                description=ptd.get("description", ""),
                status=ptd.get("status", "open"),
                opened_at_chapter=ptd.get("opened_at_chapter", 0),
                closed_at_chapter=ptd.get("closed_at_chapter", 0),
            ))

        bb.timeline_events = data.get("timeline_events", [])
        return bb

    def persist(self, project_id: str):
        """持久化到数据库"""
        from datetime import datetime
        data = json.dumps(self.to_dict(), ensure_ascii=False)
        now = datetime.now().isoformat()

        with get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS blackboard (
                    project_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                INSERT OR REPLACE INTO blackboard (project_id, data, updated_at)
                VALUES (?, ?, ?)
            """, (project_id, data, now))
            conn.commit()

    @classmethod
    def load(cls, project_id: str) -> "Blackboard | None":
        """从数据库加载"""
        with get_connection() as conn:
            row = conn.execute(
                "SELECT data FROM blackboard WHERE project_id = ?",
                (project_id,)
            ).fetchone()

        if not row:
            return None

        try:
            return cls.from_dict(json.loads(row["data"]))
        except (json.JSONDecodeError, KeyError) as e:
            print(f"[Blackboard] 加载失败 ({project_id}): {e}")
            return None
