"""Provider 管理和统一 LLM 调用"""
import re
import requests
from providers.base import ProviderConfig, LLMResponse
from config import get_proxies

# Provider 注册表
_PROVIDERS: dict[str, ProviderConfig] = {}


def register_provider(provider: ProviderConfig):
    """注册一个 provider"""
    _PROVIDERS[provider.name] = provider


def get_provider(name: str) -> ProviderConfig:
    """获取指定 provider，不存在则抛出 KeyError"""
    if name not in _PROVIDERS:
        raise KeyError(f"Unknown provider: {name}. Available: {list(_PROVIDERS.keys())}")
    return _PROVIDERS[name]


def get_all_providers() -> dict[str, ProviderConfig]:
    """获取所有已注册 provider"""
    return dict(_PROVIDERS)


def get_current_text_provider() -> str:
    """从数据库获取当前文本 provider，无则从 .env 取默认值"""
    from database import get_connection
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM provider_config WHERE key = 'text_provider'")
            row = cursor.fetchone()
            if row:
                return row["value"]
    except Exception:
        pass
    from config import DEFAULT_TEXT_PROVIDER
    return DEFAULT_TEXT_PROVIDER


def get_current_music_provider() -> str:
    """从数据库获取当前音乐 provider，无则从 .env 取默认值"""
    from database import get_connection
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM provider_config WHERE key = 'music_provider'")
            row = cursor.fetchone()
            if row:
                return row["value"]
    except Exception:
        pass
    from config import DEFAULT_MUSIC_PROVIDER
    return DEFAULT_MUSIC_PROVIDER


def set_provider_config(key: str, value: str):
    """设置 provider 配置到数据库"""
    from database import get_connection
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO provider_config (key, value) VALUES (?, ?)",
            (key, value)
        )
        conn.commit()


def call_llm(messages, temperature=0.7, max_tokens=None, timeout=None,
             provider_name=None, system_prompt=None, prompt=None) -> LLMResponse:
    """统一 LLM 调用入口。

    Args:
        messages: 消息列表（优先使用）
        temperature: 生成温度
        max_tokens: 最大输出 token 数
        timeout: 请求超时（秒）
        provider_name: 指定 provider，None 则使用当前文本 provider
        system_prompt: 便捷参数，会插入 messages 开头
        prompt: 便捷参数，会追加到 messages 末尾

    Returns:
        LLMResponse 统一响应对象
    """
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

    try:
        response = requests.post(
            provider.chat_url,
            json={
                "model": provider.chat_model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            headers={
                "Authorization": f"Bearer {provider.api_key}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=timeout,
        )

        data = response.json()

        # Provider-specific error check
        is_error, error_msg = provider.check_error(data)
        if is_error:
            print(f"[LLM:{provider.name}] API error: {error_msg}")
            return LLMResponse(success=False, error=error_msg, raw=data)

        # Extract content
        content = provider.extract_content(data)
        if not content:
            print(f"[LLM:{provider.name}] API returned empty content")
            return LLMResponse(success=False, error="API returned empty content", raw=data)

        # Strip <think>...</think> reasoning blocks
        content = re.sub(r'<think>.*?</think>\s*', '', content, flags=re.DOTALL).strip()

        return LLMResponse(success=True, content=content, raw=data)

    except requests.exceptions.Timeout:
        print(f"[LLM:{provider.name}] Request timeout")
        return LLMResponse(success=False, error="Request timeout")
    except Exception as e:
        print(f"[LLM:{provider.name}] Call failed: {e}")
        return LLMResponse(success=False, error=str(e))


def _auto_register_providers():
    """从 .env 配置自动注册所有 provider"""
    from config import DEEPSEEK_API_KEY, DEEPSEEK_CHAT_MODEL
    from config import MINIMAX_API_KEY, MINIMAX_CHAT_MODEL, MINIMAX_MUSIC_MODEL
    from providers.minimax import MiniMaxProvider
    from providers.deepseek import DeepSeekProvider

    register_provider(DeepSeekProvider(
        api_key=DEEPSEEK_API_KEY,
        chat_model=DEEPSEEK_CHAT_MODEL,
    ))
    register_provider(MiniMaxProvider(
        api_key=MINIMAX_API_KEY,
        chat_model=MINIMAX_CHAT_MODEL,
        music_model=MINIMAX_MUSIC_MODEL,
    ))


# 模块加载时自动注册
_auto_register_providers()