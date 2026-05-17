"""Provider 协议定义 — 标准化请求构建与响应解析

openai 协议：覆盖所有 OpenAI 兼容 API（DeepSeek、MiniMax、Moonshot、GLM、Qwen 等）
anthropic 协议：Anthropic Messages API 标准格式
"""

from abc import ABC, abstractmethod


class BaseProtocol(ABC):
    """协议基类 — 定义请求构建与响应解析的标准接口"""

    @abstractmethod
    def build_headers(self, api_key: str) -> dict:
        """构建请求头"""

    @abstractmethod
    def build_body(self, model, messages, max_tokens, temperature,
                   thinking_enabled=False, reasoning_effort="high",
                   thinking_budget=10000, seed=None) -> dict:
        """构建请求体"""

    @abstractmethod
    def check_error(self, data: dict) -> tuple[bool, str]:
        """检查 API 响应错误 → (is_error, error_message)"""

    @abstractmethod
    def extract_content(self, data: dict) -> str:
        """提取回答内容"""

    @abstractmethod
    def get_display_name(self) -> str:
        """协议显示名"""

    def extract_reasoning(self, data: dict) -> str:
        """提取思考链内容（默认返回空）"""
        return ""

    def supports_thinking(self) -> bool:
        """是否支持思考模式"""
        return False


class OpenAIProtocol(BaseProtocol):
    """OpenAI 兼容协议 — 标准 Chat Completions 格式"""

    def get_display_name(self) -> str:
        return "OpenAI 兼容"

    def build_headers(self, api_key: str) -> dict:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def build_body(self, model, messages, max_tokens, temperature,
                   thinking_enabled=False, reasoning_effort="high",
                   thinking_budget=10000, seed=None) -> dict:
        body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if thinking_enabled:
            body["thinking"] = {"type": "enabled"}
            body["reasoning_effort"] = reasoning_effort
            # 思考模式不支持 temperature 等参数
        else:
            body["temperature"] = temperature
            if seed is not None:
                body["seed"] = seed
        return body

    def check_error(self, data: dict) -> tuple[bool, str]:
        if "error" in data and isinstance(data["error"], dict):
            return True, data["error"].get("message", "API error")
        if data.get("object") == "error":
            return True, data.get("message", "API error")
        return False, ""

    def extract_content(self, data: dict) -> str:
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        return ""

    def extract_reasoning(self, data: dict) -> str:
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("reasoning_content", "") or ""
        return ""

    def supports_thinking(self) -> bool:
        return True


class AnthropicProtocol(BaseProtocol):
    """Anthropic Messages API 协议"""

    def get_display_name(self) -> str:
        return "Anthropic"

    def build_headers(self, api_key: str) -> dict:
        return {
            "x-api-key": api_key,
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
        }

    def build_body(self, model, messages, max_tokens, temperature,
                   thinking_enabled=False, reasoning_effort="high",
                   thinking_budget=10000, seed=None) -> dict:
        # Anthropic: system 消息提取为顶层参数
        system_text = ""
        api_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_text += msg["content"] + "\n"
            else:
                api_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        body = {
            "model": model,
            "messages": api_messages,
            "max_tokens": max_tokens,
        }
        if system_text.strip():
            body["system"] = system_text.strip()

        if thinking_enabled:
            body["thinking"] = {
                "type": "enabled",
                "budget_tokens": thinking_budget,
            }
            # 思考模式不支持 temperature
        else:
            body["temperature"] = temperature

        return body

    def check_error(self, data: dict) -> tuple[bool, str]:
        if "error" in data and isinstance(data["error"], dict):
            return True, data["error"].get("message", "API error")
        return False, ""

    def extract_content(self, data: dict) -> str:
        content_blocks = data.get("content", [])
        texts = []
        for block in content_blocks:
            if block.get("type") == "text":
                texts.append(block.get("text", ""))
        return "\n".join(texts)

    def extract_reasoning(self, data: dict) -> str:
        content_blocks = data.get("content", [])
        texts = []
        for block in content_blocks:
            if block.get("type") == "thinking":
                texts.append(block.get("thinking", ""))
        return "\n".join(texts)

    def supports_thinking(self) -> bool:
        return True


# 协议注册表
PROTOCOLS = {
    "openai": OpenAIProtocol(),
    "anthropic": AnthropicProtocol(),
}
