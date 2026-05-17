"""Provider 管理和统一 LLM 调用 — 从数据库加载配置"""
import re
import requests
from providers.base import ProviderConfig, LLMResponse
from providers.protocols import PROTOCOLS
from config import get_proxies

# Provider 内存缓存
_PROVIDERS: dict[str, ProviderConfig] = {}


def _load_providers_from_db():
    """从数据库加载所有启用的 provider 到内存缓存"""
    global _PROVIDERS
    _PROVIDERS = {}
    try:
        from providers.db import db_get_all_providers_raw
        for raw in db_get_all_providers_raw():
            provider = ProviderConfig(**raw)
            _PROVIDERS[provider.name] = provider
    except Exception as e:
        print(f"[Providers] DB load failed: {e}")


def reload_providers():
    """重新从数据库加载 provider（CRUD 后调用）"""
    _load_providers_from_db()


def get_provider(name: str) -> ProviderConfig:
    """获取指定 provider"""
    if name not in _PROVIDERS:
        # 尝试从 DB 加载（可能刚创建）
        _load_providers_from_db()
    if name not in _PROVIDERS:
        raise KeyError(f"Unknown provider: {name}. Available: {list(_PROVIDERS.keys())}")
    return _PROVIDERS[name]


def get_all_providers() -> dict[str, ProviderConfig]:
    """获取所有已加载 provider"""
    return dict(_PROVIDERS)


def get_current_text_provider() -> str:
    from providers.db import db_get_setting
    value = db_get_setting("text_provider")
    if value:
        return value
    if _PROVIDERS:
        return next(iter(_PROVIDERS.keys()))
    return "deepseek"


def get_current_music_provider() -> str:
    from providers.db import db_get_setting
    value = db_get_setting("music_provider")
    if value:
        return value
    for name, p in _PROVIDERS.items():
        if p.supports_music:
            return name
    return "minimax"


def set_provider_config(key: str, value: str):
    """设置 provider 全局配置到数据库"""
    from providers.db import db_set_setting
    db_set_setting(key, value)


def call_llm(messages, temperature=0.7, max_tokens=None, timeout=None,
             provider_name=None, system_prompt=None, prompt=None, seed=None) -> LLMResponse:
    """统一 LLM 调用入口"""
    if provider_name is None:
        provider_name = get_current_text_provider()

    provider = get_provider(provider_name)

    if not provider.api_key:
        return LLMResponse(success=False, error=f"未配置 {provider.display_name} API Key")

    # 构建 messages
    if messages is None:
        messages = []
    if system_prompt and not any(m.get("role") == "system" for m in messages):
        messages.insert(0, {"role": "system", "content": system_prompt})
    if prompt and not any(m.get("role") == "user" for m in messages):
        messages.append({"role": "user", "content": prompt})

    if max_tokens is None:
        from config import LLM_MAX_TOKENS_CHAPTER
        max_tokens = LLM_MAX_TOKENS_CHAPTER

    if timeout is None:
        timeout = max(120, max_tokens // 20 + 30)

    # 通过协议处理器构建请求
    protocol = PROTOCOLS.get(provider.protocol)
    if not protocol:
        return LLMResponse(success=False, error=f"未知协议: {provider.protocol}")

    headers = protocol.build_headers(provider.api_key)
    body = protocol.build_body(
        model=provider.chat_model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        thinking_enabled=provider.thinking_enabled,
        reasoning_effort=provider.reasoning_effort,
        thinking_budget=provider.thinking_budget,
        seed=seed,
    )

    try:
        response = requests.post(
            provider.chat_url,
            json=body,
            headers=headers,
            proxies=get_proxies(),
            timeout=timeout,
        )

        data = response.json()

        is_error, error_msg = provider.check_error(data)
        if is_error:
            print(f"[LLM:{provider.name}] API error: {error_msg}")
            return LLMResponse(success=False, error=error_msg, raw=data)

        content = provider.extract_content(data)
        if not content:
            print(f"[LLM:{provider.name}] API returned empty content")
            return LLMResponse(success=False, error="API returned empty content", raw=data)

        # 提取思考链内容
        reasoning = provider.extract_reasoning(data)

        # Strip <think/> tags from content (兜底处理部分模型内联思维链)
        content = re.sub(r'<think.*?</think />\s*', '', content, flags=re.DOTALL).strip()

        return LLMResponse(success=True, content=content, reasoning=reasoning, raw=data)

    except requests.exceptions.Timeout:
        print(f"[LLM:{provider.name}] Request timeout")
        return LLMResponse(success=False, error="Request timeout")
    except Exception as e:
        print(f"[LLM:{provider.name}] Call failed: {e}")
        return LLMResponse(success=False, error=str(e))


# 模块加载时从数据库加载 provider
_load_providers_from_db()
