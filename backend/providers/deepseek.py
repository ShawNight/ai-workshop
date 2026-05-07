"""DeepSeek Provider 适配器"""
from providers.base import ProviderConfig


class DeepSeekProvider(ProviderConfig):
    """DeepSeek LLM Provider — 兼容 OpenAI Chat Completions 格式"""

    def __init__(self, api_key: str, chat_model: str = "deepseek-chat"):
        super().__init__(
            name="deepseek",
            display_name="DeepSeek",
            chat_url="https://api.deepseek.com/chat/completions",
            api_key=api_key,
            chat_model=chat_model,
            supports_music=False,
        )

    def check_error(self, data: dict) -> tuple[bool, str]:
        """DeepSeek 使用标准 OpenAI 错误格式"""
        if "error" in data and isinstance(data["error"], dict):
            return True, data["error"].get("message", "DeepSeek API error")
        # 检查 HTTP 层面的错误（非 200 但 JSON body 已解析）
        if data.get("object") == "error":
            return True, data.get("message", "DeepSeek API error")
        return False, ""

    def extract_content(self, data: dict) -> str:
        """DeepSeek 响应格式与 OpenAI 相同"""
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        return ""
