"""StateStore — Harness 状态持久化到 SQLite

每步Agent完成后自动持久化，支持服务器重启后恢复。
"""

import json
from datetime import datetime
from database import get_connection


class StateStore:
    """Harness 状态持久化存储"""

    @staticmethod
    def ensure_table():
        """确保 harness_state 表存在"""
        with get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS harness_state (
                    project_id TEXT PRIMARY KEY,
                    state_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.commit()

    @staticmethod
    def save(state) -> bool:
        """保存 StoryState 到数据库

        Args:
            state: StoryState 实例
        Returns:
            是否保存成功
        """
        if not state.project_id:
            return False

        now = datetime.now().isoformat()
        state_json = json.dumps(state.to_dict(), ensure_ascii=False)

        with get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO harness_state (project_id, state_json, updated_at)
                VALUES (?, ?, ?)
            """, (state.project_id, state_json, now))
            conn.commit()

        return True

    @staticmethod
    def load(project_id: str) -> object:
        """从数据库加载 StoryState

        Args:
            project_id: 项目ID
        Returns:
            StoryState 实例，如果不存在返回 None
        """
        from agents.state import StoryState

        with get_connection() as conn:
            row = conn.execute(
                "SELECT state_json FROM harness_state WHERE project_id = ?",
                (project_id,)
            ).fetchone()

        if not row:
            return None

        try:
            data = json.loads(row["state_json"])
            return StoryState.from_dict(data)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"[StateStore] 加载状态失败 ({project_id}): {e}")
            return None

    @staticmethod
    def delete(project_id: str) -> bool:
        """删除项目的持久化状态"""
        with get_connection() as conn:
            conn.execute(
                "DELETE FROM harness_state WHERE project_id = ?",
                (project_id,)
            )
            conn.commit()
        return True

    @staticmethod
    def save_with_event(state, event: dict = None) -> bool:
        """保存状态并推送SSE事件

        Args:
            state: StoryState 实例
            event: 可选的SSE事件数据
        """
        success = StateStore.save(state)

        if success and event:
            from agents.task_queue import TaskQueue
            TaskQueue.get_instance().notify_sse(state.project_id, event)

        return success


# 模块加载时确保表存在
StateStore.ensure_table()
