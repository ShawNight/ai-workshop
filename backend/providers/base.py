"""Provider 基础类型定义"""
from dataclasses import dataclass, field


@dataclass
class ProviderConfig:
    """Provider 配置 — 所有字段均可从数据库加载"""
    name: str
    display_name: str
    protocol: str           # "openai" 或 "minimax"
    chat_url: str
    api_key: str
    chat_model: str
    supports_music: bool = False
    music_url: str = ""
    music_model: str = ""
    lyrics_url: str = ""
    enabled: bool = True

    def check_error(self, data: dict) -> tuple[bool, str]:
        """委托给协议处理器检查 API 响应错误"""
        from providers.protocols import PROTOCOLS
        handler = PROTOCOLS.get(self.protocol)
        if not handler:
            return False, ""
        return handler.check_error(data)

    def extract_content(self, data: dict) -> str:
        """委托给协议处理器提取文本内容"""
        from providers.protocols import PROTOCOLS
        handler = PROTOCOLS.get(self.protocol)
        if not handler:
            return ""
        return handler.extract_content(data)


@dataclass
class LLMResponse:
    """统一 LLM 响应格式"""
    success: bool
    content: str = ""
    error: str = ""
    raw: dict = field(default_factory=dict)
