"""WorkflowEngine — DAG 工作流引擎

将线性 Pipeline 升级为有向无环图（DAG），支持：
- 并行执行（角色设计和世界观设计可同时进行）
- 条件分支（评论家通过→编辑，失败→写手修改）
- 动态节点（每章生成 writer_chN, critic_chN 等节点）
- 每步持久化 + SSE 推送
"""

import json
from dataclasses import dataclass, field
from typing import Callable, Optional
from datetime import datetime

from .state import StoryState
from .state_store import StateStore
from .task_queue import TaskQueue


@dataclass
class WorkflowNode:
    """DAG 中的一个节点"""
    id: str                           # 唯一标识，如 "planner", "writer_ch3"
    label: str = ""                   # 显示名，如 "策划师", "写手"
    agent_fn: Optional[Callable] = None  # 执行函数 (state) -> state
    depends_on: list[str] = field(default_factory=list)  # 依赖的节点ID
    condition: Optional[str] = None   # 激活条件（如 "critic_pass"）
    status: str = "pending"           # pending | ready | running | done | failed | skipped
    position: dict = field(default_factory=dict)  # 前端可视化位置 {x, y}
    error: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "dependsOn": self.depends_on,
            "condition": self.condition,
            "status": self.status,
            "position": self.position,
            "error": self.error,
        }


@dataclass
class WorkflowEdge:
    """DAG 中的一条边"""
    from_node: str      # 源节点ID
    to_node: str        # 目标节点ID
    condition: str = "" # 边的条件标签（如 "pass", "fail", "quality_skip"）

    def to_dict(self) -> dict:
        return {
            "from": self.from_node,
            "to": self.to_node,
            "condition": self.condition,
        }


class WorkflowEngine:
    """DAG 工作流引擎

    管理节点和边的关系，决定下一步执行哪些节点。

    使用方式：
        engine = WorkflowEngine(state)
        engine.build_planning_graph()      # 构建策划阶段DAG
        engine.run_ready()                 # 执行所有就绪节点
        engine.build_chapter_graph(ch=1)   # 构建第1章的写作DAG
        engine.run_ready()
    """

    def __init__(self, state: StoryState):
        self.state = state
        self.nodes: dict[str, WorkflowNode] = {}
        self.edges: list[WorkflowEdge] = []
        self._edge_map: dict[str, list[WorkflowEdge]] = {}  # from_node -> edges

    # ==================== DAG 构建 ====================

    def add_node(self, node: WorkflowNode):
        """添加节点"""
        self.nodes[node.id] = node
        # 初始状态：如果无依赖，标记为 ready
        if not node.depends_on and node.status == "pending":
            node.status = "ready"

    def add_edge(self, edge: WorkflowEdge):
        """添加边"""
        self.edges.append(edge)
        if edge.from_node not in self._edge_map:
            self._edge_map[edge.from_node] = []
        self._edge_map[edge.from_node].append(edge)

    def build_planning_graph(self):
        """构建策划阶段 DAG（LR 布局：左→右，纵向分支）

        outline_planner (左) → {character_designer, world_builder, foreshadow_planner} (中列) → planning_done (右)
        """
        self.nodes.clear()
        self.edges.clear()
        self._edge_map.clear()

        # 列 0: 起点
        self.add_node(WorkflowNode(
            id="outline_planner",
            label="大纲策划",
            agent_fn=self._fn_outline_planner,
            status="ready",
            position={"x": 0, "y": 100},
        ))

        # 列 1: 三个并行节点（垂直排列）
        self.add_node(WorkflowNode(
            id="character_designer",
            label="角色设计",
            agent_fn=self._fn_character_designer,
            depends_on=["outline_planner"],
            position={"x": 260, "y": 0},
        ))

        self.add_node(WorkflowNode(
            id="world_builder",
            label="世界观设计",
            agent_fn=self._fn_world_builder,
            depends_on=["outline_planner"],
            position={"x": 260, "y": 100},
        ))

        self.add_node(WorkflowNode(
            id="foreshadow_planner",
            label="伏笔规划",
            agent_fn=self._fn_foreshadow_planner,
            depends_on=["outline_planner"],
            position={"x": 260, "y": 200},
        ))

        # 列 2: 汇合点
        self.add_node(WorkflowNode(
            id="planning_done",
            label="策划完成",
            depends_on=["character_designer", "world_builder", "foreshadow_planner"],
            position={"x": 520, "y": 100},
        ))

        self.add_edge(WorkflowEdge("outline_planner", "character_designer"))
        self.add_edge(WorkflowEdge("outline_planner", "world_builder"))
        self.add_edge(WorkflowEdge("outline_planner", "foreshadow_planner"))
        self.add_edge(WorkflowEdge("character_designer", "planning_done"))
        self.add_edge(WorkflowEdge("world_builder", "planning_done"))
        self.add_edge(WorkflowEdge("foreshadow_planner", "planning_done"))

    def build_chapter_graph(self, chapter_index: int):
        """构建单章写作 DAG（LR 布局：左→右，pass 走上方 / fail 走下方）

        writer → critic → {editor (pass) → done
                            revise (fail) → re_review → done}
        """
        ch = chapter_index + 1  # 1-based for display
        prefix = f"ch{ch}"

        self.nodes.clear()
        self.edges.clear()
        self._edge_map.clear()

        # 列 0: 起点
        self.add_node(WorkflowNode(
            id=f"{prefix}_writer",
            label=f"写手·第{ch}章",
            agent_fn=lambda s, ci=chapter_index: self._fn_writer(s),
            status="ready",
            position={"x": 0, "y": 100},
        ))

        # 列 1: 审查
        self.add_node(WorkflowNode(
            id=f"{prefix}_critic",
            label=f"评论家·第{ch}章",
            agent_fn=lambda s: self._fn_critic(s),
            depends_on=[f"{prefix}_writer"],
            position={"x": 260, "y": 100},
        ))

        # 列 2: pass (上) / fail (下) 分支
        self.add_node(WorkflowNode(
            id=f"{prefix}_editor",
            label=f"编辑·第{ch}章",
            agent_fn=lambda s: self._fn_editor(s),
            depends_on=[f"{prefix}_critic"],
            condition="pass",
            position={"x": 520, "y": 0},
        ))

        self.add_node(WorkflowNode(
            id=f"{prefix}_revise",
            label=f"修改·第{ch}章",
            agent_fn=lambda s: self._fn_writer(s),
            depends_on=[f"{prefix}_critic"],
            condition="fail",
            position={"x": 520, "y": 200},
        ))

        # 列 3: 复审（仅 fail 分支）
        self.add_node(WorkflowNode(
            id=f"{prefix}_re_review",
            label=f"复审·第{ch}章",
            agent_fn=lambda s: self._fn_critic(s),
            depends_on=[f"{prefix}_revise"],
            position={"x": 780, "y": 200},
        ))

        # 列 4: 汇合点（editor 与 re_review 合并）
        self.add_node(WorkflowNode(
            id=f"{prefix}_done",
            label=f"第{ch}章完成",
            depends_on=[f"{prefix}_editor", f"{prefix}_re_review"],
            position={"x": 1040, "y": 100},
        ))

        # 边
        self.add_edge(WorkflowEdge(f"{prefix}_writer", f"{prefix}_critic"))
        self.add_edge(WorkflowEdge(f"{prefix}_critic", f"{prefix}_editor", condition="pass"))
        self.add_edge(WorkflowEdge(f"{prefix}_critic", f"{prefix}_revise", condition="fail"))
        self.add_edge(WorkflowEdge(f"{prefix}_revise", f"{prefix}_re_review"))
        self.add_edge(WorkflowEdge(f"{prefix}_editor", f"{prefix}_done", condition="pass"))
        self.add_edge(WorkflowEdge(f"{prefix}_re_review", f"{prefix}_done", condition="pass"))

    # ==================== 执行 ====================

    def get_ready_nodes(self) -> list[WorkflowNode]:
        """获取所有就绪的节点（依赖已完成，条件满足）"""
        ready = []
        for node in self.nodes.values():
            # 只处理 pending 或 ready 状态
            if node.status not in ("pending", "ready"):
                continue

            # 检查所有依赖是否完成
            deps_met = True
            for dep_id in node.depends_on:
                dep = self.nodes.get(dep_id)
                if not dep or dep.status != "done":
                    deps_met = False
                    break

            if not deps_met:
                continue

            # 检查条件（如果有）
            if node.condition:
                if not self._check_condition(node):
                    continue

            ready.append(node)
        return ready

    def _check_condition(self, node: WorkflowNode) -> bool:
        """检查节点的激活条件"""
        # 找到指向此节点的边
        for edge in self.edges:
            if edge.to_node == node.id and edge.condition:
                # 检查源节点的输出是否满足条件
                source = self.nodes.get(edge.from_node)
                if source and source.status == "done":
                    # 从 state 中获取条件结果
                    condition_results = getattr(self.state, '_condition_results', {})
                    result = condition_results.get(edge.from_node, "")
                    if edge.condition == result:
                        return True
                return False
        return True  # 无条件的边

    def run_ready(self) -> list[str]:
        """执行所有就绪节点，返回执行了的节点ID列表"""
        ready = self.get_ready_nodes()
        executed = []

        for node in ready:
            node.status = "running"
            self._notify(node.id, "running")

            try:
                if node.agent_fn:
                    self.state = node.agent_fn(self.state)

                    # 关键修复：agent 内部 set_agent_state("error") 时不抛异常
                    # DAG 引擎需要检测到错误状态并把节点标记为 failed
                    agent_key = self._node_to_agent_key(node.id)
                    agent_state = self.state.agent_states.get(agent_key, {})
                    if agent_state.get("status") == "error":
                        node.status = "failed"
                        node.error = agent_state.get("error") or "agent 内部错误"
                        self._notify(node.id, "failed")
                    else:
                        node.status = "done"
                        node.error = ""
                        executed.append(node.id)
                        self._notify(node.id, "done")

                    StateStore.save(self.state)
                else:
                    # 无执行函数的节点（如 "planning_done"），直接标记完成
                    node.status = "done"
                    executed.append(node.id)

            except Exception as e:
                node.status = "failed"
                node.error = str(e)
                self._notify(node.id, "failed")
                StateStore.save(self.state)
                import traceback
                traceback.print_exc()

        return executed

    @staticmethod
    def _node_to_agent_key(node_id: str) -> str:
        """DAG 节点 ID → agent_states 中的键名映射"""
        import re
        # planning 节点
        if node_id == "outline_planner":
            return "planner"
        # chapter 节点：ch1_writer → writer（严格匹配 ch\d+_xxx 格式）
        m = re.match(r"^ch\d+_(\w+)$", node_id)
        if m:
            suffix = m.group(1)
            mapping = {"writer": "writer", "critic": "critic", "editor": "editor",
                       "revise": "writer", "re_review": "critic"}
            return mapping.get(suffix, suffix)
        # 其它节点（character_designer / world_builder / foreshadow_planner）id 本身就是 agent key
        return node_id

    def run_until_blocked(self, max_steps: int = 50) -> list[str]:
        """循环执行直到没有就绪节点"""
        all_executed = []
        for _ in range(max_steps):
            ready = self.get_ready_nodes()
            if not ready:
                break
            executed = self.run_ready()
            all_executed.extend(executed)

        # 最终评估所有 sync 节点（无 agent_fn 的汇合节点）
        # 确保 planning_done 不会因为上游 failed 而被误标为 done
        self._evaluate_sync_nodes()
        return all_executed

    def _evaluate_sync_nodes(self):
        """根据上游节点状态重新评估 sync 节点

        sync 节点（如 planning_done、chN_done）是无 agent_fn 的汇合点。
        默认 run_ready 在 else 分支把它们标为 done，但那只在所有上游都 done 时才正确。
        如果上游有 failed 节点，sync 应该被标为 skipped 而非 done。
        """
        for node in self.nodes.values():
            if node.agent_fn or not node.depends_on:
                continue
            if node.status == "done":
                continue  # 已经正确的 done 不动
            upstream = [self.nodes.get(d) for d in node.depends_on]
            upstream = [n for n in upstream if n is not None]
            if not upstream:
                continue
            statuses = [n.status for n in upstream]
            if any(s == "failed" for s in statuses):
                node.status = "skipped"
                self._notify(node.id, "skipped")
            elif all(s == "done" for s in statuses):
                node.status = "done"
                self._notify(node.id, "done")
            # else: 保持 pending（还有上游在跑）

    def is_complete(self) -> bool:
        """检查所有节点是否完成"""
        return all(n.status in ("done", "skipped") for n in self.nodes.values())

    def has_failed(self) -> bool:
        """检查是否有失败节点"""
        return any(n.status == "failed" for n in self.nodes.values())

    # ==================== 通知 ====================

    def _notify(self, node_id: str, status: str):
        """推送节点状态变化事件（包含完整 workflow 快照，减少前端回询）"""
        try:
            tq = TaskQueue.get_instance()
            tq.notify_sse(self.state.project_id, {
                "type": "workflow_node",
                "nodeId": node_id,
                "status": status,
                "phase": self.state.phase,
                "workflow": self.to_dict(),
            })
        except Exception:
            pass

    # ==================== Agent 包装函数 ====================

    def _fn_outline_planner(self, state: StoryState) -> StoryState:
        from .planner import run_planner
        return run_planner(state)

    def _fn_character_designer(self, state: StoryState) -> StoryState:
        from .character_designer import run_character_designer
        return run_character_designer(state)

    def _fn_world_builder(self, state: StoryState) -> StoryState:
        from .world_builder import run_world_builder
        return run_world_builder(state)

    def _fn_foreshadow_planner(self, state: StoryState) -> StoryState:
        """伏笔规划（使用现有planner输出的伏笔，或重新生成更详细的）"""
        # 如果策划师已经生成了伏笔，跳过
        if state.design and state.design.get("foreshadows"):
            state.log_activity("foreshadow_planner", "completed", "使用策划师生成的伏笔")
            return state
        # 否则调用伏笔规划
        from .planner import run_planner
        return run_planner(state)

    def _fn_writer(self, state: StoryState) -> StoryState:
        from .writer import run_writer
        return run_writer(state)

    def _fn_critic(self, state: StoryState) -> StoryState:
        from .critic import run_critic
        state = run_critic(state)
        # 设置条件结果，用于DAG分支
        if not hasattr(state, '_condition_results'):
            state._condition_results = {}
        current = state.chapters[state.current_chapter_index]
        if state.phase == "polishing":
            state._condition_results[f"ch{state.current_chapter_index + 1}_critic"] = "pass"
        elif state.phase == "revising":
            state._condition_results[f"ch{state.current_chapter_index + 1}_critic"] = "fail"
        return state

    def _fn_editor(self, state: StoryState) -> StoryState:
        from .editor import run_editor
        return run_editor(state)

    # ==================== 序列化 ====================

    def to_dict(self) -> dict:
        """序列化工作流状态（用于前端可视化和持久化）"""
        return {
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges],
        }

    @classmethod
    def from_dict(cls, data: dict, state: StoryState) -> "WorkflowEngine":
        """从字典反序列化"""
        engine = cls(state)
        for nd in data.get("nodes", []):
            node = WorkflowNode(
                id=nd["id"],
                label=nd.get("label", ""),
                depends_on=nd.get("dependsOn", []),
                condition=nd.get("condition"),
                status=nd.get("status", "pending"),
                position=nd.get("position", {}),
                error=nd.get("error", ""),
            )
            engine.nodes[node.id] = node
        for ed in data.get("edges", []):
            engine.edges.append(WorkflowEdge(
                from_node=ed["from"],
                to_node=ed["to"],
                condition=ed.get("condition", ""),
            ))
            if ed["from"] not in engine._edge_map:
                engine._edge_map[ed["from"]] = []
            engine._edge_map[ed["from"]].append(engine.edges[-1])
        return engine
