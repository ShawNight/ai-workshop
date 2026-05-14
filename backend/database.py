"""
数据库模块 - SQLite 持久化存储

用于存储小说项目和工作流数据，支持服务器重启后数据不丢失。
"""
import os
import re
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
                synopsis TEXT DEFAULT '',
                target_word_count INTEGER DEFAULT 0,
                current_word_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'planning',
                writing_style TEXT DEFAULT '',
                cover_color TEXT DEFAULT '#6366F1',
                outline TEXT DEFAULT '[]',
                chapters TEXT DEFAULT '[]',
                characters TEXT DEFAULT '[]',
                locations TEXT DEFAULT '[]',
                relationships TEXT DEFAULT '[]',
                settings TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # 数据库迁移：为旧表添加新列
        migrations = [
            "ALTER TABLE novel_projects ADD COLUMN synopsis TEXT DEFAULT ''",
            "ALTER TABLE novel_projects ADD COLUMN target_word_count INTEGER DEFAULT 0",
            "ALTER TABLE novel_projects ADD COLUMN current_word_count INTEGER DEFAULT 0",
            "ALTER TABLE novel_projects ADD COLUMN status TEXT DEFAULT 'planning'",
            "ALTER TABLE novel_projects ADD COLUMN writing_style TEXT DEFAULT ''",
            "ALTER TABLE novel_projects ADD COLUMN cover_color TEXT DEFAULT '#6366F1'",
            "ALTER TABLE novel_projects ADD COLUMN locations TEXT DEFAULT '[]'",
            "ALTER TABLE novel_projects ADD COLUMN relationships TEXT DEFAULT '[]'",
            "ALTER TABLE novel_projects ADD COLUMN settings TEXT DEFAULT '{}'",
        ]
        for migration in migrations:
            try:
                cursor.execute(migration)
            except sqlite3.OperationalError:
                pass  # 列已存在，跳过
        
        try:
            cursor.execute("ALTER TABLE novel_projects ADD COLUMN notes TEXT DEFAULT '[]'")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        
        # 音乐历史记录表（只保存已完成的音乐）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS music_history (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                user_description TEXT DEFAULT '',
                prompt TEXT DEFAULT '',
                lyrics TEXT DEFAULT '',
                audio_file TEXT,
                duration_ms INTEGER DEFAULT 0,
                lrc TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)

        # music_history 表迁移
        music_migrations = [
            "ALTER TABLE music_history ADD COLUMN duration_ms INTEGER DEFAULT 0",
            "ALTER TABLE music_history ADD COLUMN lrc TEXT DEFAULT ''",
        ]
        for m in music_migrations:
            try:
                cursor.execute(m)
            except sqlite3.OperationalError:
                pass
        
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
        
        # 写作日志表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS writing_log (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                chapter_id TEXT,
                word_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES novel_projects(id) ON DELETE CASCADE
            )
        """)
        
        # 章节草稿版本表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chapter_drafts (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                chapter_id TEXT NOT NULL,
                content TEXT DEFAULT '',
                word_count INTEGER DEFAULT 0,
                version INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES novel_projects(id) ON DELETE CASCADE
            )
        """)

        # Provider 配置表（新 schema）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS providers (
                name TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                protocol TEXT NOT NULL DEFAULT 'openai',
                chat_url TEXT NOT NULL,
                chat_model TEXT NOT NULL,
                api_key TEXT NOT NULL DEFAULT '',
                supports_music INTEGER NOT NULL DEFAULT 0,
                music_url TEXT NOT NULL DEFAULT '',
                music_model TEXT NOT NULL DEFAULT '',
                lyrics_url TEXT NOT NULL DEFAULT '',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS provider_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)

        # providers 表迁移：新增思考模式字段
        provider_migrations = [
            "ALTER TABLE providers ADD COLUMN thinking_enabled INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE providers ADD COLUMN reasoning_effort TEXT NOT NULL DEFAULT 'high'",
            "ALTER TABLE providers ADD COLUMN thinking_budget INTEGER NOT NULL DEFAULT 10000",
        ]
        for m in provider_migrations:
            try:
                cursor.execute(m)
            except sqlite3.OperationalError:
                pass

        # 将 minimax 协议迁移为 openai（MiniMax 兼容标准 OpenAI 协议）
        try:
            cursor.execute("UPDATE providers SET protocol = 'openai' WHERE protocol = 'minimax'")
        except Exception:
            pass

        # 从旧 provider_config 表迁移数据到 provider_settings
        try:
            cursor.execute("SELECT key, value FROM provider_config")
            old_rows = cursor.fetchall()
            for row in old_rows:
                cursor.execute(
                    "INSERT OR IGNORE INTO provider_settings (key, value) VALUES (?, ?)",
                    (row["key"], row["value"])
                )
        except Exception:
            pass  # 旧表不存在，跳过

        # 首次启动时插入默认 Provider 模板（仅 providers 表为空时，API Key 为空需用户在前端配置）
        cursor.execute("SELECT COUNT(*) as cnt FROM providers")
        if cursor.fetchone()["cnt"] == 0:
            now = datetime.now().isoformat()

            cursor.execute("""INSERT INTO providers
                (name, display_name, protocol, chat_url, chat_model, api_key,
                 supports_music, enabled, created_at, updated_at)
                VALUES (?, ?, 'openai', ?, ?, '', 0, 1, ?, ?)""",
                ("deepseek", "DeepSeek",
                 "https://api.deepseek.com/chat/completions",
                 "deepseek-chat",
                 now, now))

            cursor.execute("""INSERT INTO providers
                (name, display_name, protocol, chat_url, chat_model, api_key,
                 supports_music, music_url, music_model, lyrics_url, enabled, created_at, updated_at)
                VALUES (?, ?, 'openai', ?, ?, '', 1, ?, ?, ?, 1, ?, ?)""",
                ("minimax", "MiniMax",
                 "https://api.minimaxi.com/v1/chat/completions",
                 "MiniMax-M2.7",
                 "https://api.minimaxi.com/v1/music_generation",
                 "music-2.6",
                 "https://api.minimaxi.com/v1/lyrics_generation",
                 now, now))

            cursor.execute("INSERT OR REPLACE INTO provider_settings (key, value) VALUES ('text_provider', 'deepseek')")
            cursor.execute("INSERT OR REPLACE INTO provider_settings (key, value) VALUES ('music_provider', 'minimax')")

        # 删除旧表
        cursor.execute("DROP TABLE IF EXISTS provider_config")

        conn.commit()
        print(f"[数据库] 初始化完成: {DB_PATH}")


# ==================== 小说项目操作 ====================

def create_novel_project(project_id: str, title: str, genre: str, premise: str,
                         synopsis: str = "", target_word_count: int = 0,
                         writing_style: str = "", cover_color: str = "#6366F1") -> dict:
    """创建小说项目"""
    now = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO novel_projects (id, title, genre, premise, synopsis,
                target_word_count, current_word_count, status, writing_style,
                cover_color, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'planning', ?, ?, ?, ?)
        """, (project_id, title, genre, premise, synopsis,
              target_word_count, writing_style, cover_color, now, now))
        conn.commit()
        return {
            "id": project_id,
            "title": title,
            "genre": genre,
            "premise": premise,
            "synopsis": synopsis,
            "targetWordCount": target_word_count,
            "currentWordCount": 0,
            "status": "planning",
            "writingStyle": writing_style,
            "coverColor": cover_color,
            "outline": [],
            "chapters": [],
            "characters": [],
            "locations": [],
            "relationships": [],
            "settings": {},
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
            "synopsis": row["synopsis"] if "synopsis" in row.keys() else "",
            "targetWordCount": row["target_word_count"] if "target_word_count" in row.keys() else 0,
            "currentWordCount": row["current_word_count"] if "current_word_count" in row.keys() else 0,
            "status": row["status"] if "status" in row.keys() else "planning",
            "writingStyle": row["writing_style"] if "writing_style" in row.keys() else "",
            "coverColor": row["cover_color"] if "cover_color" in row.keys() else "#6366F1",
            "outline": json.loads(row["outline"]),
            "chapters": json.loads(row["chapters"]),
            "characters": json.loads(row["characters"]),
            "locations": json.loads(row["locations"]) if "locations" in row.keys() else [],
            "relationships": json.loads(row["relationships"]) if "relationships" in row.keys() else [],
            "settings": json.loads(row["settings"]) if "settings" in row.keys() else {},
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
                "synopsis": row["synopsis"] if "synopsis" in row.keys() else "",
                "targetWordCount": row["target_word_count"] if "target_word_count" in row.keys() else 0,
                "currentWordCount": row["current_word_count"] if "current_word_count" in row.keys() else 0,
                "status": row["status"] if "status" in row.keys() else "planning",
                "writingStyle": row["writing_style"] if "writing_style" in row.keys() else "",
                "coverColor": row["cover_color"] if "cover_color" in row.keys() else "#6366F1",
                "outline": json.loads(row["outline"]),
                "chapters": json.loads(row["chapters"]),
                "characters": json.loads(row["characters"]),
                "locations": json.loads(row["locations"]) if "locations" in row.keys() else [],
                "relationships": json.loads(row["relationships"]) if "relationships" in row.keys() else [],
                "settings": json.loads(row["settings"]) if "settings" in row.keys() else {},
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"]
            })
        return projects


def update_novel_project(project_id: str, updates: dict) -> bool:
    """更新小说项目"""
    now = datetime.now().isoformat()
    
    # 处理 JSON 字段
    json_fields = ["outline", "chapters", "characters", "locations", "relationships", "settings"]
    set_clauses = ["updated_at = ?"]
    values = [now]
    
    for field in json_fields:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            values.append(json.dumps(updates[field]))
    
    # 处理普通字段
    for field in ["title", "genre", "premise", "synopsis", "writing_style", "cover_color", "status"]:
        if field in updates:
            set_clauses.append(f"{field} = ?")
            values.append(updates[field])
    
    # 处理整数字段
    for field in ["target_word_count", "current_word_count"]:
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


def _count_words(html_content):
    text = re.sub(r'<[^>]+>', '', html_content or '')
    return len(text.replace(' ', ''))


def update_chapter(project_id, chapter_id, content=None, title=None):
    with get_connection() as conn:
        project = get_novel_project(project_id)
        if not project:
            return False
        chapters = project.get('chapters', [])
        found = False
        for i, ch in enumerate(chapters):
            if ch.get('id') == chapter_id:
                if content is not None:
                    chapters[i]['content'] = content
                if title is not None:
                    chapters[i]['title'] = title
                found = True
                break
        if not found:
            return False
        total_words = sum(_count_words(c.get('content', '')) for c in chapters)
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE novel_projects SET chapters = ?, current_word_count = ?, updated_at = ? WHERE id = ?',
            (json.dumps(chapters, ensure_ascii=False), total_words, datetime.now().isoformat(), project_id)
        )
        conn.commit()
        return True


def delete_novel_project(project_id: str) -> bool:
    """删除小说项目（级联删除关联的写作日志和草稿）"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM writing_log WHERE project_id = ?", (project_id,))
        cursor.execute("DELETE FROM chapter_drafts WHERE project_id = ?", (project_id,))
        cursor.execute("DELETE FROM novel_projects WHERE id = ?", (project_id,))
        conn.commit()
        return cursor.rowcount > 0


# ==================== 写作日志操作 ====================

def create_writing_log(log_id: str, project_id: str, chapter_id: str = None, word_count: int = 0) -> dict:
    """记录写作日志"""
    now = datetime.now().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO writing_log (id, project_id, chapter_id, word_count, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (log_id, project_id, chapter_id, word_count, now))
        conn.commit()
        return {"id": log_id, "projectId": project_id, "chapterId": chapter_id,
                "wordCount": word_count, "createdAt": now}


def get_project_stats(project_id: str) -> dict:
    """获取项目写作统计"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) as total_sessions,
                   COALESCE(SUM(word_count), 0) as total_words,
                   DATE(created_at) as date
            FROM writing_log
            WHERE project_id = ?
            GROUP BY DATE(created_at)
            ORDER BY date DESC
            LIMIT 30
        """, (project_id,))
        rows = cursor.fetchall()
        daily_stats = [{"date": r["date"], "wordCount": r["total_words"],
                        "sessions": r["total_sessions"]} for r in rows]
        
        cursor.execute("""
            SELECT COALESCE(SUM(word_count), 0) as total
            FROM writing_log WHERE project_id = ?
        """, (project_id,))
        total = cursor.fetchone()["total"]
        
        return {"totalWords": total, "dailyStats": daily_stats}


# ==================== 章节草稿操作 ====================

def save_chapter_draft(project_id: str, chapter_id: str, content: str, word_count: int = 0) -> dict:
    """保存章节草稿版本"""
    import uuid
    now = datetime.now().isoformat()
    draft_id = str(uuid.uuid4())
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COALESCE(MAX(version), 0) + 1 as next_version
            FROM chapter_drafts
            WHERE project_id = ? AND chapter_id = ?
        """, (project_id, chapter_id))
        next_version = cursor.fetchone()["next_version"]
        
        cursor.execute("""
            INSERT INTO chapter_drafts (id, project_id, chapter_id, content, word_count, version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (draft_id, project_id, chapter_id, content, word_count, next_version, now))
        conn.commit()
        return {"id": draft_id, "chapterId": chapter_id, "version": next_version,
                "wordCount": word_count, "createdAt": now}


def get_chapter_drafts(project_id: str, chapter_id: str) -> list:
    """获取章节草稿历史版本"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, chapter_id, version, word_count, created_at
            FROM chapter_drafts
            WHERE project_id = ? AND chapter_id = ?
            ORDER BY version DESC
            LIMIT 20
        """, (project_id, chapter_id))
        rows = cursor.fetchall()
        return [{"id": r["id"], "chapterId": r["chapter_id"], "version": r["version"],
                 "wordCount": r["word_count"], "createdAt": r["created_at"]} for r in rows]


def get_chapter_draft_content(draft_id: str) -> dict:
    """获取特定草稿版本的内容"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM chapter_drafts WHERE id = ?", (draft_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {"id": row["id"], "chapterId": row["chapter_id"], "content": row["content"],
                "wordCount": row["word_count"], "version": row["version"],
                "createdAt": row["created_at"]}


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
