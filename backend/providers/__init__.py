"""Provider 管理和统一 LLM 调用 — 从数据库加载配置

Phase 2 新增：call_llm_stream 流式调用
"""
import re
import json
import requests
from providers.base import ProviderConfig, LLMResponse
from providers.protocols import PROTOCOLS
from config import get_proxies

# 思考标签清理（兜底处理部分模型内联思维链）
_THINK_TAG_RE = re.compile(r'<think[^>]*>.*?</think\s*>\s*', re.DOTALL)


def _strip_think_tags(text: str) -> str:
    """移除内联 <think...>...</think...> 标签"""
    if not text or '<think' not in text:
        return text
    return _THINK_TAG_RE.sub('', text).strip()


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


def set_provider_config(key: str, value: str):
    """设置 provider 全局配置到数据库"""
    from providers.db import db_set_setting
    db_set_setting(key, value)


def _build_llm_request(messages, temperature=0.7, max_tokens=None, timeout=None,
                        provider_name=None, model=None, system_prompt=None,
                        prompt=None, seed=None, stream=False):
    """构建 LLM 请求的公共逻辑（同步和流式共用）

    Returns:
        (provider, headers, body, timeout) 或 LLMResponse（错误时）
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

    # 通过协议处理器构建请求
    protocol = PROTOCOLS.get(provider.protocol)
    if not protocol:
        return LLMResponse(success=False, error=f"未知协议: {provider.protocol}")

    headers = protocol.build_headers(provider.api_key)
    body = protocol.build_body(
        model=model or provider.chat_model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        thinking_enabled=provider.thinking_enabled,
        reasoning_effort=provider.reasoning_effort,
        thinking_budget=provider.thinking_budget,
        seed=seed,
    )

    if stream:
        body["stream"] = True

    return provider, headers, body, timeout


def call_llm(messages, temperature=0.7, max_tokens=None, timeout=None,
             provider_name=None, model=None, system_prompt=None, prompt=None, seed=None) -> LLMResponse:
    """统一 LLM 调用入口"""
    result = _build_llm_request(
        messages=messages, temperature=temperature, max_tokens=max_tokens,
        timeout=timeout, provider_name=provider_name, model=model,
        system_prompt=system_prompt, prompt=prompt, seed=seed,
    )

    # 如果返回的是 LLMResponse，说明构建阶段出错
    if isinstance(result, LLMResponse):
        return result

    provider, headers, body, timeout = result

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
        content = _strip_think_tags(content)

        return LLMResponse(success=True, content=content, reasoning=reasoning, raw=data)

    except requests.exceptions.Timeout:
        print(f"[LLM:{provider.name}] Request timeout")
        return LLMResponse(success=False, error="Request timeout")
    except Exception as e:
        print(f"[LLM:{provider.name}] Call failed: {e}")
        return LLMResponse(success=False, error=str(e))


def call_llm_stream(messages, temperature=0.7, max_tokens=None, timeout=None,
                    provider_name=None, model=None, system_prompt=None, prompt=None,
                    on_chunk=None):
    """流式 LLM 调用 — yield content chunks

    Args:
        on_chunk: 可选回调，每收到一个 chunk 时调用 on_chunk(chunk_text)

    Yields:
        str: 内容文本片段
    """
    result = _build_llm_request(
        messages=messages, temperature=temperature, max_tokens=max_tokens,
        timeout=timeout, provider_name=provider_name, model=model,
        system_prompt=system_prompt, prompt=prompt, stream=True,
    )

    if isinstance(result, LLMResponse):
        return

    provider, headers, body, timeout = result

    try:
        response = requests.post(
            provider.chat_url,
            json=body,
            headers=headers,
            proxies=get_proxies(),
            timeout=timeout,
            stream=True,
        )

        protocol = PROTOCOLS.get(provider.protocol)

        full_content = []
        for line in response.iter_lines(decode_unicode=True):
            if not line:
                continue

            # SSE 格式：data: {...}
            if line.startswith("data: "):
                data_str = line[6:]

                # 结束标记
                if data_str.strip() == "[DONE]":
                    break

                try:
                    chunk_data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                # 根据协议提取内容
                chunk_text = _extract_stream_chunk(protocol, chunk_data)
                if chunk_text:
                    full_content.append(chunk_text)
                    if on_chunk:
                        on_chunk(chunk_text)
                    yield chunk_text

    except requests.exceptions.Timeout:
        print(f"[LLM:{provider.name}] Stream timeout")
    except Exception as e:
        print(f"[LLM:{provider.name}] Stream failed: {e}")


def _extract_stream_chunk(protocol, chunk_data: dict) -> str:
    """从流式响应中提取内容片段"""
    if isinstance(protocol, type(PROTOCOLS.get("openai"))) and protocol is PROTOCOLS.get("openai"):
        # OpenAI 格式
        choices = chunk_data.get("choices", [])
        if choices:
            delta = choices[0].get("delta", {})
            return _strip_think_tags(delta.get("content", ""))
    elif isinstance(protocol, type(PROTOCOLS.get("anthropic"))) and protocol is PROTOCOLS.get("anthropic"):
        # Anthropic 格式
        if chunk_data.get("type") == "content_block_delta":
            delta = chunk_data.get("delta", {})
            if delta.get("type") == "text_delta":
                return _strip_think_tags(delta.get("text", ""))
    return ""


# 模块加载时从数据库加载 provider
_load_providers_from_db()
