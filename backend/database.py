"""
数据库模块 - SQLite 持久化存储

用于存储小说项目和工作流数据，支持服务器重启后数据不丢失。
"""
import os
import sqlite3
import json
import threading
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

# 数据库文件路径
DB_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(DB_DIR, "ai_workshop.db")

# 确保数据库目录存在
os.makedirs(DB_DIR, exist_ok=True)

# 线程锁用于数据库连接
_db_lock = threading.Lock()

# 数据库连接缓存（每个线程独立连接）
_local = threading.local()


def get_db_path():
    """获取数据库路径"""
    return DB_PATH


@contextmanager
def get_connection():
    """获取数据库连接的上下文管理器（线程安全）"""
    # 每个线程使用独立的连接
    if not hasattr(_local, 'connection') or _local.connection is None:
        _local.connection = sqlite3.connect(DB_PATH, check_same_thread=False)
        _local.connection.row_factory = sqlite3.Row
        # 启用外键约束
        _local.connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield _local.connection
    except Exception as e:
        _local.connection.rollback()
        raise e


def init_db():
    """初始化数据库表结构"""
    with get_connection() as conn:
        cursor = conn.cursor()

        # 删除旧的 music_projects 表（如果存在）
        cursor.execute("DROP TABLE IF EXISTS music_projects")
        
        # 小说项目表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS novel_projects (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                genre TEXT DEFAULT '通用',
                premise TEXT DEFAULT '',
                outline TEXT DEFAULT '[]',
                chapters TEXT DEFAULT '[]',
                characters TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # 音乐历史记录表（只保存已完成的音乐）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS music_history (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                user_description TEXT DEFAULT '',
                prompt TEXT DEFAULT '',
                lyrics TEXT DEFAULT '',
                audio_file TEXT,
                created_at TEXT NOT NULL
            )
        """)
        
        # 工作流表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                nodes TEXT DEFAULT '[]',
                edges TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        conn.commit()
        print(f"[数据库] 初始化完成: {DB_PATH}")


# ==================== 小说项目操作 ====================

def create_novel_project(project_id: str, title: str, genre: str, premise: str) -> dict:
    """创建小说项目"""
    now = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO novel_projects (id, title, genre, premise, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (project_id, title, genre, premise, now, now))
        conn.commit()
        return {
            "id": project_id,
            "title": title,
            "genre": genre,
            "premise": premise,
            "outline": [],
            "chapters": [],
            "characters": [],
            "createdAt": now,
            "updatedAt": now
        }


def get_novel_project(project_id: str) -> dict:
    """获取小说项目"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM novel_projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        return {
            "id": row["id"],
            "title": row["title"],
            "genre": row["genre"],
            "premise": row["premise"],
            "outline": json.loads(row["outline"]),
            "chapters": json.loads(row["chapters"]),
            "characters": json.loads(row["characters"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"]
        }


def get_all_novel_projects() -> list:
    """获取所有小说项目"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM novel_projects ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        
        projects = []
        for row in rows:
            projects.append({
                "id": row["id"],
                "title": row["title"],
                "genre": row["genre"],
                "premise": row["premise"],
                "outline": json.loads(row["outline"]),
                "chapters": json.loads(row["chapters"]),
                "characters": json.loads(row["characters"]),
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"]
            })
        return projects


def update_novel_project(project_id: str, updates: dict) -> bool:
    """更新小说项目"""
    now = datetime.now().isoformat()
    
    # 处理 JSON 字段
    json_fields = ["outline", "chapters", "characters"]
    set_clauses = ["updated_at = ?"]
    values = [now]
    
    for field in json_fields:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            values.append(json.dumps(updates[field]))
    
    # 处理普通字段
    for field in ["title", "genre", "premise"]:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            values.append(updates[field])
    
    values.append(project_id)
    
    sql = f"UPDATE novel_projects SET {', '.join(set_clauses)} WHERE id = ?"
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, values)
        conn.commit()
        return cursor.rowcount > 0


def delete_novel_project(project_id: str) -> bool:
    """删除小说项目"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM novel_projects WHERE id = ?", (project_id,))
        conn.commit()
        return cursor.rowcount > 0


# ==================== 工作流操作 ====================

def create_workflow(workflow_id: str, name: str, description: str = "") -> dict:
    """创建工作流"""
    now = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO workflows (id, name, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (workflow_id, name, description, now, now))
        conn.commit()
        return {
            "id": workflow_id,
            "name": name,
            "description": description,
            "nodes": [],
            "edges": [],
            "createdAt": now,
            "updatedAt": now
        }


def get_workflow(workflow_id: str) -> dict:
    """获取工作流"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        return {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "nodes": json.loads(row["nodes"]),
            "edges": json.loads(row["edges"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"]
        }


def get_all_workflows() -> list:
    """获取所有工作流"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workflows ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        
        workflows = []
        for row in rows:
            workflows.append({
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "nodes": json.loads(row["nodes"]),
                "edges": json.loads(row["edges"]),
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"]
            })
        return workflows


def update_workflow(workflow_id: str, updates: dict) -> bool:
    """更新工作流"""
    now = datetime.now().isoformat()
    
    json_fields = ["nodes", "edges"]
    set_clauses = ["updated_at = ?"]
    values = [now]
    
    for field in json_fields:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            values.append(json.dumps(updates[field]))
    
    for field in ["name", "description"]:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            values.append(updates[field])
    
    values.append(workflow_id)
    
    sql = f"UPDATE workflows SET {', '.join(set_clauses)} WHERE id = ?"
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, values)
        conn.commit()
        return cursor.rowcount > 0


def delete_workflow(workflow_id: str) -> bool:
    """删除工作流"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
        conn.commit()
        return cursor.rowcount > 0


# 初始化数据库
init_db()
