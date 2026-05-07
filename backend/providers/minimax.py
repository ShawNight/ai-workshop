"""MiniMax Provider 适配器"""
from providers.base import ProviderConfig


class MiniMaxProvider(ProviderConfig):
    """MiniMax LLM Provider"""

    def __init__(self, api_key: str, chat_model: str = "MiniMax-M2.7",
                 music_model: str = "music-2.6"):
        super().__init__(
            name="minimax",
            display_name="MiniMax",
            chat_url="https://api.minimaxi.com/v1/chat/completions",
            api_key=api_key,
            chat_model=chat_model,
            supports_music=True,
            music_url="https://api.minimaxi.com/v1/music_generation",
            music_model=music_model,
            lyrics_url="https://api.minimaxi.com/v1/lyrics_generation",
        )

    def check_error(self, data: dict) -> tuple[bool, str]:
        """MiniMax 使用 base_resp 包装错误信息"""
        base_resp = data.get("base_resp", {})
        status_code = base_resp.get("status_code")
        if status_code is not None and status_code != 0:
            return True, base_resp.get("status_msg", f"MiniMax API error (status_code={status_code})")
        # 也检查标准 OpenAI 格式错误
        if "error" in data and isinstance(data["error"], dict):
            return True, data["error"].get("message", "MiniMax API error")
        return False, ""

    def extract_content(self, data: dict) -> str:
        """MiniMax Chat Completions 格式与 OpenAI 相同"""
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        # 兼容 reply 格式
        return data.get("reply", "")