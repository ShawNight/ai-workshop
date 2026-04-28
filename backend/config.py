"""
统一配置管理 - 从 .env 读取
支持多 Provider，默认 minimax
"""
import os
from dotenv import load_dotenv

load_dotenv()

# 默认 Provider
DEFAULT_PROVIDER = os.getenv("DEFAULT_PROVIDER", "minimax")

# LLM API 配置
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_URL = os.getenv("LLM_API_URL", "https://api.minimaxi.com/v1")
LLM_CHAT_URL = os.getenv("LLM_CHAT_URL", "https://api.minimaxi.com/v1/chat/completions")
LLM_TEXT_URL = os.getenv("LLM_TEXT_URL", "https://api.minimaxi.com/v1/chat/completions")
LLM_LYRICS_URL = os.getenv("LLM_LYRICS_URL", "https://api.minimaxi.com/v1/lyrics_generation")
LLM_MUSIC_URL = os.getenv("LLM_MUSIC_URL", "https://api.minimaxi.com/v1/music_generation")

# 模型配置
LLM_LYRICS_MODEL = os.getenv("LLM_LYRICS_MODEL", "MiniMax-M2.7")
LLM_CHAT_MODEL = os.getenv("LLM_CHAT_MODEL", "MiniMax-M2.7")
LLM_TEXT_MODEL = os.getenv("LLM_TEXT_MODEL", "MiniMax-Text-01")
LLM_MUSIC_MODEL = os.getenv("LLM_MUSIC_MODEL", "music-2.6")

# Server 配置
PORT = int(os.getenv("PORT", "3001"))
HOST = os.getenv("HOST", "0.0.0.0")

# 代理配置
HTTP_PROXY = os.getenv("HTTP_PROXY", "")
HTTPS_PROXY = os.getenv("HTTPS_PROXY", "")


def get_proxies():
    """获取代理配置，未配置时返回空字典（直连）"""
    proxies = {}
    if HTTP_PROXY:
        proxies["http"] = HTTP_PROXY
    if HTTPS_PROXY:
        proxies["https"] = HTTPS_PROXY
    return proxies


def get_model_config(provider=None):
    """获取指定 provider 的配置，provider=None 时使用默认 provider"""
    if provider is None:
        provider = DEFAULT_PROVIDER

    if provider == "minimax":
        return {
            "api_key": LLM_API_KEY,
            "api_url": LLM_API_URL,
            "chat_url": LLM_CHAT_URL,
            "lyrics_url": LLM_LYRICS_URL,
            "music_url": LLM_MUSIC_URL,
            "lyrics_model": LLM_LYRICS_MODEL,
            "chat_model": LLM_CHAT_MODEL,
            "music_model": LLM_MUSIC_MODEL,
        }
    # 可扩展其他 provider...
    raise ValueError(f"Unknown provider: {provider}")
