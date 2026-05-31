"""Agent 专用 LLM 调用 —— 读取 agent_config 表的配置

Phase 2 新增：call_agent_llm_stream 流式调用
"""

from database import get_agent_config
from providers import call_llm, call_llm_stream


def get_agent_llm_config(agent_name: str) -> tuple:
    """获取 Agent 配置的 provider_name 和 model_name，未配置则返回 (None, None)"""
    try:
        config = get_agent_config(agent_name)
        if config and config.get("providerName") and config.get("modelName"):
            return config["providerName"], config["modelName"]
    except Exception:
        pass
    return None, None


def call_agent_llm(agent_name: str, messages: list, temperature=0.7,
                   max_tokens=None, timeout=120):
    """使用 Agent 专属配置调用 LLM，未配置则使用默认 Provider 和默认模型。
    默认超时 120 秒。"""
    provider_name, model = get_agent_llm_config(agent_name)

    kwargs = dict(
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )
    if provider_name:
        kwargs["provider_name"] = provider_name
    if model:
        kwargs["model"] = model

    return call_llm(**kwargs)


def call_agent_llm_stream(agent_name: str, messages: list, temperature=0.7,
                          max_tokens=None, timeout=120, on_chunk=None):
    """流式 LLM 调用 — yield content chunks

    用于 Writer 等需要实时输出的 Agent。
    """
    provider_name, model = get_agent_llm_config(agent_name)

    kwargs = dict(
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
        on_chunk=on_chunk,
    )
    if provider_name:
        kwargs["provider_name"] = provider_name
    if model:
        kwargs["model"] = model

    return call_llm_stream(**kwargs)
