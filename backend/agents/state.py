"""StoryState — 多 Agent 协作小说创作共享状态模型

Phase 4 新增：
- 检查点配置（checkpoints_enabled, checkpoint_config）
- 等待用户审批状态（waiting_for_user, pending_checkpoint）
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

AGENT_ROLES = ["meta", "planner", "writer", "critic", "editor", "memory_keeper",
               "outline_planner", "character_designer", "world_builder", "foreshadow_planner"]
AGENT_LABELS = {
    "meta": "项目顾问",
    "planner": "策划师",
    "writer": "写手",
    "critic": "评论家",
    "editor": "编辑",
    "memory_keeper": "记忆管家",
    "outline_planner": "大纲策划",
    "character_designer": "角色设计",
    "world_builder": "世界观设计",
    "foreshadow_planner": "伏笔规划",
}
AGENT_ICONS = {
    "meta": "💡",
    "planner": "🧠",
    "writer": "✍️",
    "critic": "🔍",
    "editor": "✨",
    "memory_keeper": "📚",
    "outline_planner": "📋",
    "character_designer": "👤",
    "world_builder": "🌍",
    "foreshadow_planner": "🔮",
}
AGENT_DESCRIPTIONS = {
    "meta": "与用户对话，根据故事描述推荐作品名称、类型、风格等初始设定",
    "planner": "从种子创意生成完整故事蓝图：分卷大纲、角色设定、世界规则、伏笔表",
    "writer": "根据设计文档逐章创作，保持文风一致，推进剧情发展",
    "critic": "审查章节质量：角色一致性、世界规则遵守、剧情连贯度、节奏控制",
    "editor": "润色语言表达，修正语法问题，优化流畅度，保持作者风格",
    "memory_keeper": "每章完成后提取知识摘要，维护角色状态和剧情线，为后续章节提供智能上下文",
    "outline_planner": "规划故事大纲骨架：分卷结构、章节分配",
    "character_designer": "设计角色档案：性格、外貌、背景、成长弧线",
    "world_builder": "构建世界观：力量体系、地理设定、核心规则",
    "foreshadow_planner": "规划伏笔时间线：种下时机、揭示时机",
}
AGENT_TRANSITIONS = {
    "planner": "writer",
    "writer": "critic",
    "critic": "editor",      # 通过则进入编辑
    "critic_revise": "writer",  # 不通过则返回写手修改
    "editor": "writer",      # 编辑完成后下一章
}
PHASES = [
    ("planning", "策划阶段"),
    ("writing", "写作阶段"),
    ("reviewing", "审查阶段"),
    ("revising", "修改阶段"),
    ("polishing", "润色阶段"),
    ("checkpoint", "等待审批"),
    ("complete", "已完成"),
]


@dataclass
class StoryState:
    """小说创作多 Agent 协作的共享状态"""
    project_id: str = ""
    phase: str = "idle"  # idle → planning → writing → reviewing → revising/polishing → complete
    seed: str = ""
    genre: str = "玄幻"
    style: str = "热血升级流"
    synopsis: str = ""
    target_words: int = 500000

    # 设计蓝图（Planner 产出）
    design: Optional[dict] = None

    # 章节列表
    chapters: list = field(default_factory=list)
    current_chapter_index: int = 0
    revision_count: int = 0
    max_revisions: int = 5

    # 各 Agent 状态
    agent_states: dict = field(default_factory=lambda: {
        role: {"status": "idle", "last_output": None, "error": None}
        for role in AGENT_ROLES
    })
    current_agent: str = ""

    # 活动日志
    activity_log: list = field(default_factory=list)

    # 小说完成标志
    total_chapters: int = 0
    completed_chapters: int = 0

    # ===== Phase 4: 检查点 =====
    checkpoints_enabled: bool = True
    checkpoint_config: dict = field(default_factory=lambda: {
        "after_planning": True,       # 策划完成后暂停
        "after_chapter": False,       # 默认不每章暂停
        "low_score_threshold": 4.0,   # 评论家评分低于此值暂停
    })
    waiting_for_user: bool = False
    pending_checkpoint: str = ""  # "planning" | "chapter_N" | ""

    # ===== 工作流控制 =====
    paused: bool = False              # 暂停标志（章节级：当前章节完成后暂停）
    batch_size: int = 5               # 每批生成章节数，0=不限制

    def log_activity(self, agent: str, action: str, summary: str = ""):
        """记录活动日志"""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "agent": agent,
            "agent_label": AGENT_LABELS.get(agent, agent),
            "agent_icon": AGENT_ICONS.get(agent, ""),
            "action": action,
            "summary": summary,
        }
        self.activity_log.append(entry)
        return entry

    def set_agent_state(self, agent: str, status: str, output: str = None, error: str = None):
        """更新 Agent 状态"""
        if agent not in self.agent_states:
            self.agent_states[agent] = {"status": "idle", "last_output": None, "error": None}
        self.agent_states[agent]["status"] = status
        if output is not None:
            self.agent_states[agent]["last_output"] = output
        if error is not None:
            self.agent_states[agent]["error"] = error
        self.current_agent = agent if status == "running" else self.current_agent

    def should_pause_at_checkpoint(self, checkpoint_type: str, extra_data: dict = None) -> bool:
        """判断是否应该在某个检查点暂停

        Args:
            checkpoint_type: "planning" | "chapter"
            extra_data: 额外数据（如 critic_score）
        """
        if not self.checkpoints_enabled:
            return False

        if checkpoint_type == "planning":
            return self.checkpoint_config.get("after_planning", True)

        if checkpoint_type == "chapter":
            # 检查是否开启每章暂停
            if self.checkpoint_config.get("after_chapter", False):
                return True
            # 检查低分暂停
            if extra_data and extra_data.get("critic_score"):
                if extra_data["critic_score"] < self.checkpoint_config.get("low_score_threshold", 4.0):
                    return True

        return False

    def set_checkpoint(self, checkpoint_type: str):
        """设置检查点等待状态"""
        self.waiting_for_user = True
        self.pending_checkpoint = checkpoint_type
        self.phase = "checkpoint"
        self.log_activity("system", "checkpoint",
                          f"已暂停等待审批 — {checkpoint_type}")

    def clear_checkpoint(self):
        """清除检查点等待状态"""
        self.waiting_for_user = False
        self.pending_checkpoint = ""

    def progress_percent(self) -> int:
        """计算完成百分比"""
        if self.total_chapters == 0:
            return 0
        polished = sum(1 for c in self.chapters if c.get("status") == "polished")
        return min(100, int(polished / self.total_chapters * 100))

    def to_dict(self) -> dict:
        """序列化为前端可用的字典"""
        return {
            "projectId": self.project_id,
            "phase": self.phase,
            "seed": self.seed,
            "genre": self.genre,
            "style": self.style,
            "synopsis": self.synopsis,
            "targetWords": self.target_words,
            "design": self.design,
            "chapters": self.chapters,
            "currentChapterIndex": self.current_chapter_index,
            "revisionCount": self.revision_count,
            "maxRevisions": self.max_revisions,
            "agentStates": self.agent_states,
            "currentAgent": self.current_agent,
            "activityLog": self.activity_log,
            "totalChapters": self.total_chapters,
            "completedChapters": self.completed_chapters,
            "progressPercent": self.progress_percent(),
            # Phase 4: 检查点
            "checkpointsEnabled": self.checkpoints_enabled,
            "checkpointConfig": self.checkpoint_config,
            "waitingForUser": self.waiting_for_user,
            "pendingCheckpoint": self.pending_checkpoint,
            # 工作流控制
            "paused": self.paused,
            "batchSize": self.batch_size,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "StoryState":
        """从字典反序列化"""
        state = cls()
        state.project_id = d.get("projectId", "")
        state.phase = d.get("phase", "idle")
        state.seed = d.get("seed", "")
        state.genre = d.get("genre", "玄幻")
        state.style = d.get("style", "热血升级流")
        state.synopsis = d.get("synopsis", "")
        state.target_words = d.get("targetWords", 500000)
        state.design = d.get("design")
        state.chapters = d.get("chapters", [])
        state.current_chapter_index = d.get("currentChapterIndex", 0)
        state.revision_count = d.get("revisionCount", 0)
        state.max_revisions = d.get("maxRevisions", 5)
        state.agent_states = d.get("agentStates", {
            role: {"status": "idle", "last_output": None, "error": None}
            for role in AGENT_ROLES
        })
        state.current_agent = d.get("currentAgent", "")
        state.activity_log = d.get("activityLog", [])
        state.total_chapters = d.get("totalChapters", 0)
        state.completed_chapters = d.get("completedChapters", 0)
        # Phase 4: 检查点
        state.checkpoints_enabled = d.get("checkpointsEnabled", True)
        state.checkpoint_config = d.get("checkpointConfig", {
            "after_planning": True,
            "after_chapter": False,
            "low_score_threshold": 4.0,
        })
        state.waiting_for_user = d.get("waitingForUser", False)
        state.pending_checkpoint = d.get("pendingCheckpoint", "")
        # 工作流控制
        state.paused = d.get("paused", False)
        state.batch_size = d.get("batchSize", 5)
        return state
