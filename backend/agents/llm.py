"""Agent 专用 LLM 调用 —— 读取 agent_config 表的配置

Phase 2 新增：call_agent_llm_stream 流式调用
Phase 6 新增：自动记录每次 LLM 调用到 agent_runs 表
"""

import json
import time
import uuid

from database import get_agent_config, insert_agent_run
from providers import call_llm, call_llm_stream


_ACTIVE_PROJECT_ID = {}


def set_current_project(project_id: str):
    """设置当前执行的 project_id（用于 run logger 关联）"""
    _ACTIVE_PROJECT_ID["id"] = project_id


def clear_current_project():
    _ACTIVE_PROJECT_ID.pop("id", None)


def _log_run(agent_name: str, messages: list, response, started_at: float):
    """将一次 LLM 调用写入 agent_runs 表"""
    project_id = _ACTIVE_PROJECT_ID.get("id")
    if not project_id:
        return

    try:
        duration_ms = int((time.time() - started_at) * 1000)
        output_text = response.content if response and response.success else ""
        error = None if (response and response.success) else (response.error if response else "no response")

        output_parsed = None
        if output_text:
            try:
                from routes.novel import parse_json_from_response
                if "{" in output_text and "}" in output_text:
                    parsed_obj = parse_json_from_response(output_text, r'\{.*\}')
                    if isinstance(parsed_obj, dict):
                        output_parsed = parsed_obj
                if output_parsed is None and "[" in output_text and "]" in output_text:
                    parsed_arr = parse_json_from_response(output_text, r'\[.*\]')
                    if isinstance(parsed_arr, list):
                        output_parsed = parsed_arr
            except Exception:
                pass

        insert_agent_run(
            run_id=f"run-{uuid.uuid4().hex[:12]}",
            project_id=project_id,
            agent_name=agent_name,
            chapter_index=None,
            phase="",
            input_messages=messages,
            output=output_text or "",
            output_parsed=output_parsed,
            status="success" if (response and response.success) else "error",
            error=error,
            duration_ms=duration_ms,
        )
    except Exception as e:
        print(f"[llm] log_run failed: {e}")


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

    started_at = time.time()
    response = call_llm(**kwargs)
    _log_run(agent_name, messages, response, started_at)
    return response


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

    started_at = time.time()
    response = call_llm_stream(**kwargs)
    _log_run(agent_name, messages, response, started_at)
    return response
