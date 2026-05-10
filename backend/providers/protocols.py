"""Provider 协议定义 — 不同 API 的响应解析策略

openai 协议：覆盖所有 OpenAI 兼容的 API（DeepSeek、Moonshot、GLM、Qwen 等）
minimax 协议：MiniMax 特有的 base_resp 响应格式
"""


class OpenAIProtocol:
    """OpenAI 兼容协议 — 标准 Chat Completions 格式"""

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


class MiniMaxProtocol:
    """MiniMax 协议 — base_resp 包装格式"""

    def check_error(self, data: dict) -> tuple[bool, str]:
        base_resp = data.get("base_resp", {})
        status_code = base_resp.get("status_code")
        if status_code is not None and status_code != 0:
            return True, base_resp.get("status_msg", f"API error (status_code={status_code})")
        if "error" in data and isinstance(data["error"], dict):
            return True, data["error"].get("message", "API error")
        return False, ""

    def extract_content(self, data: dict) -> str:
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        return data.get("reply", "")


# 协议注册表
PROTOCOLS = {
    "openai": OpenAIProtocol(),
    "minimax": MiniMaxProtocol(),
}
