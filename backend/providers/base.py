"""Provider 基础类型定义"""
from dataclasses import dataclass, field


@dataclass
class ProviderConfig:
    """Provider 连接配置"""
    name: str
    display_name: str
    chat_url: str
    api_key: str
    chat_model: str
    supports_music: bool = False
    music_url: str = ""
    music_model: str = ""
    lyrics_url: str = ""

    def check_error(self, data: dict) -> tuple[bool, str]:
        """检查 API 响应是否有错误。返回 (is_error, error_msg)"""
        raise NotImplementedError

    def extract_content(self, data: dict) -> str:
        """从 API 响应中提取文本内容"""
        raise NotImplementedError


@dataclass
class LLMResponse:
    """统一 LLM 响应格式"""
    success: bool
    content: str = ""
    error: str = ""
    raw: dict = field(default_factory=dict)