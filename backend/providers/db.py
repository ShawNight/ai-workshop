"""Provider 数据库 CRUD 操作"""
from datetime import datetime
from database import get_connection
from providers.crypto import encrypt_api_key, decrypt_api_key, mask_api_key


def db_row_to_dict(row) -> dict:
    """将数据库行转为前端友好的 dict（API Key 脱敏）"""
    api_key_plain = decrypt_api_key(row["api_key"]) if row["api_key"] else ""
    return {
        "name": row["name"],
        "displayName": row["display_name"],
        "protocol": row["protocol"],
        "chatUrl": row["chat_url"],
        "chatModel": row["chat_model"],
        "apiKeySet": bool(api_key_plain),
        "apiKeyMasked": mask_api_key(api_key_plain),
        "supportsMusic": bool(row["supports_music"]),
        "musicUrl": row["music_url"],
        "musicModel": row["music_model"],
        "lyricsUrl": row["lyrics_url"],
        "enabled": bool(row["enabled"]),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def db_row_to_config(row) -> dict:
    """将数据库行转为 ProviderConfig 需要的参数（API Key 解密）"""
    return {
        "name": row["name"],
        "display_name": row["display_name"],
        "protocol": row["protocol"],
        "chat_url": row["chat_url"],
        "chat_model": row["chat_model"],
        "api_key": decrypt_api_key(row["api_key"]) if row["api_key"] else "",
        "supports_music": bool(row["supports_music"]),
        "music_url": row["music_url"] or "",
        "music_model": row["music_model"] or "",
        "lyrics_url": row["lyrics_url"] or "",
        "enabled": bool(row["enabled"]),
    }


def db_get_all_providers() -> list[dict]:
    """获取所有 provider（脱敏）"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM providers ORDER BY created_at")
        return [db_row_to_dict(row) for row in cursor.fetchall()]


def db_get_provider(name: str) -> dict | None:
    """获取单个 provider（脱敏）"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM providers WHERE name = ?", (name,))
        row = cursor.fetchone()
        return db_row_to_dict(row) if row else None


def db_get_provider_raw(name: str) -> dict | None:
    """获取单个 provider 原始数据（含解密 Key），用于构建 ProviderConfig"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM providers WHERE name = ?", (name,))
        row = cursor.fetchone()
        return db_row_to_config(row) if row else None


def db_get_all_providers_raw() -> list[dict]:
    """获取所有 provider 原始数据（含解密 Key），用于构建 ProviderConfig"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM providers WHERE enabled = 1 ORDER BY created_at")
        return [db_row_to_config(row) for row in cursor.fetchall()]


def db_create_provider(data: dict) -> dict:
    """创建 provider"""
    now = datetime.now().isoformat()
    api_key_encrypted = encrypt_api_key(data.get("apiKey", ""))

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO providers (name, display_name, protocol, chat_url, chat_model,
                api_key, supports_music, music_url, music_model, lyrics_url, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """, (
            data["name"],
            data.get("displayName", data["name"]),
            data.get("protocol", "openai"),
            data.get("chatUrl", ""),
            data.get("chatModel", ""),
            api_key_encrypted,
            1 if data.get("supportsMusic") else 0,
            data.get("musicUrl", ""),
            data.get("musicModel", ""),
            data.get("lyricsUrl", ""),
            now, now,
        ))
        conn.commit()

    return db_get_provider(data["name"])


def db_update_provider(name: str, data: dict) -> dict | None:
    """更新 provider"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM providers WHERE name = ?", (name,))
        row = cursor.fetchone()
        if not row:
            return None

        now = datetime.now().isoformat()

        # 智能处理 API Key：如果传入的是 masked 值则保留原值
        current_encrypted = row["api_key"]
        new_key = data.get("apiKey", "")
        current_masked = mask_api_key(decrypt_api_key(current_encrypted)) if current_encrypted else ""

        if new_key and new_key != current_masked and new_key != "***":
            api_key_encrypted = encrypt_api_key(new_key)
        else:
            api_key_encrypted = current_encrypted

        cursor.execute("""
            UPDATE providers SET
                display_name = ?, protocol = ?, chat_url = ?, chat_model = ?,
                api_key = ?, supports_music = ?, music_url = ?, music_model = ?,
                lyrics_url = ?, updated_at = ?
            WHERE name = ?
        """, (
            data.get("displayName", row["display_name"]),
            data.get("protocol", row["protocol"]),
            data.get("chatUrl", row["chat_url"]),
            data.get("chatModel", row["chat_model"]),
            api_key_encrypted,
            1 if data.get("supportsMusic", bool(row["supports_music"])) else 0,
            data.get("musicUrl", row["music_url"]),
            data.get("musicModel", row["music_model"]),
            data.get("lyricsUrl", row["lyrics_url"]),
            now, name,
        ))
        conn.commit()

    return db_get_provider(name)


def db_delete_provider(name: str) -> bool:
    """删除 provider"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM providers WHERE name = ?", (name,))
        conn.commit()
        return cursor.rowcount > 0


def db_get_setting(key: str) -> str | None:
    """获取全局设置"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM provider_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else None


def db_set_setting(key: str, value: str):
    """设置全局设置"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO provider_settings (key, value) VALUES (?, ?)", (key, value))
        conn.commit()
