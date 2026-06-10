"""Provider 数据库 CRUD 操作

Phase 2 改造：增加 thinking_config 字段（JSON 格式）
- 新增：thinking_config 存协议特定的思考模式配置
- 兼容：旧记录从 thinking_enabled / reasoning_effort / thinking_budget 列自动迁移
"""

import json
from datetime import datetime
from cryptography.fernet import InvalidToken
from database import get_connection, get_provider_models
from providers.crypto import encrypt_api_key, decrypt_api_key, mask_api_key


def _get_models_for_provider(provider_name: str) -> list:
    """获取 Provider 的模型列表"""
    try:
        return get_provider_models(provider_name)
    except Exception:
        return []


def _safe_decrypt(cipher: str) -> str:
    """解密 API Key，密钥不匹配时返回空字符串"""
    if not cipher:
        return ""
    try:
        return decrypt_api_key(cipher)
    except InvalidToken:
        return ""


def _row_has_col(row, col: str) -> bool:
    return col in row.keys()


def _row_get(row, col: str, default=None):
    """安全读取列（兼容旧库）"""
    try:
        return row[col] if _row_has_col(row, col) else default
    except (IndexError, KeyError):
        return default


def _migrate_legacy_thinking(row) -> dict:
    """从旧字段构造 thinking_config dict

    旧字段语义：
    - thinking_enabled: bool
    - reasoning_effort: "high" | "max"  → OpenAI / DeepSeek 兼容
    - thinking_budget: int               → Anthropic 兼容

    新字段 thinking_config 是 JSON 字符串，存协议特定的配置
    """
    raw = _row_get(row, "thinking_config", "{}")
    if isinstance(raw, str) and raw.strip() and raw.strip() != "{}":
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            pass

    # 旧数据兜底：按 enabled 状态构造
    enabled = bool(_row_get(row, "thinking_enabled", 0))
    if not enabled:
        return {"type": "disabled"}

    proto = _row_get(row, "protocol", "openai")
    effort = _row_get(row, "reasoning_effort", "high")
    budget = _row_get(row, "thinking_budget", 10000)

    if proto == "anthropic":
        return {"type": "enabled", "budget_tokens": budget}
    elif proto == "minimax":
        return {"type": "adaptive", "reasoning_split": False}
    else:  # openai / deepseek
        return {"type": "enabled", "reasoning_effort": effort}


def db_row_to_dict(row) -> dict:
    """将数据库行转为前端友好的 dict（API Key 脱敏）"""
    api_key_plain = _safe_decrypt(row["api_key"])
    key_broken = bool(row["api_key"]) and not api_key_plain
    thinking = _migrate_legacy_thinking(row)

    return {
        "name": row["name"],
        "displayName": row["display_name"],
        "protocol": row["protocol"],
        "chatUrl": row["chat_url"],
        "chatModel": row["chat_model"],
        "apiKeySet": bool(api_key_plain),
        "apiKeyBroken": key_broken,
        "apiKeyMasked": mask_api_key(api_key_plain) if api_key_plain else ("***解密失败***" if key_broken else ""),

        "enabled": bool(row["enabled"]),
        "thinkingEnabled": thinking.get("type") not in (None, "", "disabled"),
        "thinkingConfig": thinking,
        # 兼容字段（旧版前端 / Agent 等可能还在用）
        "reasoningEffort": _row_get(row, "reasoning_effort", "high"),
        "thinkingBudget": _row_get(row, "thinking_budget", 10000),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "models": _get_models_for_provider(row["name"]),
    }


def db_row_to_config(row) -> dict:
    """将数据库行转为 ProviderConfig 需要的参数（API Key 解密）"""
    thinking = _migrate_legacy_thinking(row)
    return {
        "name": row["name"],
        "display_name": row["display_name"],
        "protocol": row["protocol"],
        "chat_url": row["chat_url"],
        "chat_model": row["chat_model"],
        "api_key": _safe_decrypt(row["api_key"]),

        "enabled": bool(row["enabled"]),
        "thinking_config": thinking,
        "thinking_enabled": thinking.get("type") not in (None, "", "disabled"),
        "reasoning_effort": _row_get(row, "reasoning_effort", "high"),
        "thinking_budget": _row_get(row, "thinking_budget", 10000),
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


def _merge_thinking_config(data: dict) -> dict:
    """从前端提交的 data 中提取/构造 thinking_config JSON

    前端新协议：
    - data["thinkingEnabled"]: bool（主开关）
    - data["thinkingConfig"]: {type, reasoning_effort, budget_tokens, reasoning_split, ...}
    """
    cfg = data.get("thinkingConfig") or {}
    if not isinstance(cfg, dict):
        cfg = {}

    if not data.get("thinkingEnabled"):
        # 主开关关闭 → 强制 type=disabled
        cfg = {**cfg, "type": "disabled"}

    # 移除 None 值
    return {k: v for k, v in cfg.items() if v is not None}


def _sync_legacy_thinking_columns(data: dict, cfg: dict) -> tuple:
    """根据 thinking_config 同步旧列 reasoning_effort / thinking_budget

    旧 Agent / 旧代码可能还在读这两个列；保持同步以防回归
    """
    # reasoning_effort
    effort = cfg.get("reasoning_effort")
    if effort is None:
        # 旧字段直接给了
        effort = data.get("reasoningEffort", "high")
    # thinking_budget
    budget = cfg.get("budget_tokens")
    if budget is None:
        try:
            budget = int(data.get("thinkingBudget", 10000))
        except (TypeError, ValueError):
            budget = 10000
    return effort, budget


def db_create_provider(data: dict) -> dict:
    """创建 provider"""
    now = datetime.now().isoformat()
    api_key_encrypted = encrypt_api_key(data.get("apiKey", ""))

    cfg = _merge_thinking_config(data)
    effort, budget = _sync_legacy_thinking_columns(data, cfg)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO providers (name, display_name, protocol, chat_url, chat_model,
                api_key, enabled,
                thinking_enabled, reasoning_effort, thinking_budget,
                thinking_config,
                created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        """, (
            data["name"],
            data.get("displayName", data["name"]),
            data.get("protocol", "openai"),
            data.get("chatUrl", ""),
            data.get("chatModel", ""),
            api_key_encrypted,
            1 if cfg.get("type") not in (None, "", "disabled") else 0,
            effort,
            budget,
            json.dumps(cfg, ensure_ascii=False),
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
        current_masked = mask_api_key(_safe_decrypt(current_encrypted)) if current_encrypted else ""

        if new_key and new_key != current_masked and new_key != "***":
            api_key_encrypted = encrypt_api_key(new_key)
        else:
            api_key_encrypted = current_encrypted

        cfg = _merge_thinking_config(data)
        effort, budget = _sync_legacy_thinking_columns(data, cfg)

        cursor.execute("""
            UPDATE providers SET
                display_name = ?, protocol = ?, chat_url = ?, chat_model = ?,
                api_key = ?,
                thinking_enabled = ?, reasoning_effort = ?, thinking_budget = ?,
                thinking_config = ?,
                updated_at = ?
            WHERE name = ?
        """, (
            data.get("displayName", row["display_name"]),
            data.get("protocol", row["protocol"]),
            data.get("chatUrl", row["chat_url"]),
            data.get("chatModel", row["chat_model"]),
            api_key_encrypted,
            1 if cfg.get("type") not in (None, "", "disabled") else 0,
            effort,
            budget,
            json.dumps(cfg, ensure_ascii=False),
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
        cursor.execute("INSERT OR REPLACE INTO provider_settings (key, value) VALUES (?, value)", (key, value))
        conn.commit()
