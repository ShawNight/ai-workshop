"""TaskQueue — 轻量级线程任务队列，支持异步Agent执行和SSE推送"""

import queue
import threading
import uuid
import json
from datetime import datetime
from typing import Callable, Optional


class TaskInfo:
    """任务信息"""
    __slots__ = ('task_id', 'project_id', 'status', 'fn', 'callback',
                 'error', 'started_at', 'completed_at')

    def __init__(self, task_id: str, project_id: str, fn: Callable,
                 callback: Optional[Callable] = None):
        self.task_id = task_id
        self.project_id = project_id
        self.status = "pending"
        self.fn = fn
        self.callback = callback
        self.error = None
        self.started_at = None
        self.completed_at = None

    def to_dict(self) -> dict:
        return {
            "taskId": self.task_id,
            "projectId": self.project_id,
            "status": self.status,
            "error": self.error,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
        }


class TaskQueue:
    """线程池任务队列

    - 在后台线程中执行Agent任务，不阻塞Flask请求
    - 支持SSE事件推送
    - 支持同一项目的任务排队（避免并发写冲突）
    """

    _instance = None

    def __init__(self, max_workers: int = 3):
        self._tasks: dict[str, TaskInfo] = {}
        self._project_running: dict[str, str] = {}  # project_id -> task_id
        self._project_queue: dict[str, list[str]] = {}  # project_id -> [task_id, ...]
        self._lock = threading.Lock()
        self._workers = []
        self._max_workers = max_workers
        self._work_signal = threading.Event()
        self._sse_listeners: dict[str, list[queue.Queue]] = {}
        self._running = False

    @classmethod
    def get_instance(cls) -> "TaskQueue":
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.start()
        return cls._instance

    def start(self):
        """启动工作线程"""
        if self._running:
            return
        self._running = True
        for i in range(self._max_workers):
            t = threading.Thread(target=self._worker_loop, name=f"task-worker-{i}", daemon=True)
            t.start()
            self._workers.append(t)
        print(f"[TaskQueue] 启动 {self._max_workers} 个工作线程")

    def stop(self):
        """停止工作线程"""
        self._running = False
        self._work_signal.set()

    def submit(self, project_id: str, fn: Callable,
               callback: Optional[Callable] = None) -> str:
        """提交任务，立即返回 task_id

        同一项目的任务会自动排队，避免并发写冲突。
        不同项目的任务可以并行执行。
        """
        task_id = f"task-{uuid.uuid4().hex[:8]}"
        info = TaskInfo(task_id, project_id, fn, callback)

        with self._lock:
            self._tasks[task_id] = info
            if project_id in self._project_running:
                # 项目有正在运行的任务，排队等待
                if project_id not in self._project_queue:
                    self._project_queue[project_id] = []
                self._project_queue[project_id].append(task_id)
                print(f"[TaskQueue] 任务 {task_id} 排队等待 (项目 {project_id})")
            else:
                # 项目空闲，标记为就绪
                self._project_running[project_id] = task_id
                info.status = "ready"
                self._work_signal.set()

        return task_id

    def get_status(self, task_id: str) -> Optional[dict]:
        """获取任务状态"""
        with self._lock:
            info = self._tasks.get(task_id)
            return info.to_dict() if info else None

    def is_running(self, project_id: str) -> bool:
        """检查项目是否有正在运行的任务"""
        with self._lock:
            return project_id in self._project_running

    def cancel(self, project_id: str):
        """取消项目所有排队中的任务"""
        with self._lock:
            if project_id in self._project_queue:
                for tid in self._project_queue.pop(project_id):
                    if tid in self._tasks:
                        self._tasks[tid].status = "cancelled"

    # ==================== SSE 监听器 ====================

    def add_sse_listener(self, project_id: str, q: queue.Queue):
        """注册SSE监听器"""
        with self._lock:
            if project_id not in self._sse_listeners:
                self._sse_listeners[project_id] = []
            self._sse_listeners[project_id].append(q)

    def remove_sse_listener(self, project_id: str, q: queue.Queue):
        """移除SSE监听器"""
        with self._lock:
            if project_id in self._sse_listeners:
                try:
                    self._sse_listeners[project_id].remove(q)
                except ValueError:
                    pass
                if not self._sse_listeners[project_id]:
                    del self._sse_listeners[project_id]

    def notify_sse(self, project_id: str, event: dict):
        """推送SSE事件给所有监听器"""
        with self._lock:
            listeners = list(self._sse_listeners.get(project_id, []))
        for q in listeners:
            try:
                q.put(event, timeout=1)
            except queue.Full:
                pass

    # ==================== 内部方法 ====================

    def _worker_loop(self):
        """工作线程主循环"""
        while self._running:
            self._work_signal.wait(timeout=2.0)
            self._work_signal.clear()

            task_id = self._pick_next_task()
            if not task_id:
                continue

            self._execute_task(task_id)

    def _pick_next_task(self) -> Optional[str]:
        """选择下一个可执行的任务"""
        with self._lock:
            for task_id, info in self._tasks.items():
                if info.status == "ready":
                    return task_id
        return None

    def _execute_task(self, task_id: str):
        """执行任务"""
        with self._lock:
            info = self._tasks.get(task_id)
            if not info or info.status != "ready":
                return
            info.status = "running"
            info.started_at = datetime.now().isoformat()

        project_id = info.project_id
        print(f"[TaskQueue] 开始执行任务 {task_id} (项目 {project_id})")

        # 推送开始事件
        self.notify_sse(project_id, {
            "type": "task_started",
            "taskId": task_id,
        })

        try:
            result = info.fn()
            with self._lock:
                info.status = "completed"
                info.completed_at = datetime.now().isoformat()

            print(f"[TaskQueue] 任务 {task_id} 完成")

            # 推送完成事件
            self.notify_sse(project_id, {
                "type": "task_completed",
                "taskId": task_id,
            })

            if info.callback:
                try:
                    info.callback(info)
                except Exception as e:
                    print(f"[TaskQueue] callback 异常: {e}")

        except Exception as e:
            with self._lock:
                info.status = "failed"
                info.error = str(e)
                info.completed_at = datetime.now().isoformat()

            print(f"[TaskQueue] 任务 {task_id} 失败: {e}")
            import traceback
            traceback.print_exc()

            self.notify_sse(project_id, {
                "type": "task_failed",
                "taskId": task_id,
                "error": str(e),
            })

        finally:
            # 处理排队中的下一个任务
            self._advance_project_queue(project_id)

    def _advance_project_queue(self, project_id: str):
        """处理项目队列中的下一个任务"""
        with self._lock:
            # 清除当前运行标记
            if self._project_running.get(project_id) is not None:
                del self._project_running[project_id]

            # 检查排队任务
            queued = self._project_queue.get(project_id, [])
            while queued:
                next_task_id = queued.pop(0)
                next_info = self._tasks.get(next_task_id)
                if next_info and next_info.status == "pending":
                    next_info.status = "ready"
                    self._project_running[project_id] = next_task_id
                    self._work_signal.set()
                    break

            if not queued:
                self._project_queue.pop(project_id, None)
