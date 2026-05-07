"""
统一配置管理 - 从 .env 读取
支持多 Provider，默认从 DEFAULT_TEXT_PROVIDER / DEFAULT_MUSIC_PROVIDER 获取
"""
import os
from dotenv import load_dotenv

load_dotenv()

# 默认 Provider 选择
DEFAULT_TEXT_PROVIDER = os.getenv("DEFAULT_TEXT_PROVIDER", "deepseek")
DEFAULT_MUSIC_PROVIDER = os.getenv("DEFAULT_MUSIC_PROVIDER", "minimax")

# ==================== DeepSeek 配置 ====================
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_CHAT_MODEL = os.getenv("DEEPSEEK_CHAT_MODEL", "deepseek-chat")

# ==================== MiniMax 配置 ====================
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_CHAT_MODEL = os.getenv("MINIMAX_CHAT_MODEL", "MiniMax-M2.7")
MINIMAX_MUSIC_MODEL = os.getenv("MINIMAX_MUSIC_MODEL", "music-2.6")

# ==================== 向后兼容（迁移期保留） ====================
# 旧 .env 中 LLM_API_KEY 映射到 MINIMAX_API_KEY
if not MINIMAX_API_KEY:
    MINIMAX_API_KEY = os.getenv("LLM_API_KEY", "")
if not DEEPSEEK_API_KEY:
    DEEPSEEK_API_KEY = os.getenv("LLM_API_KEY", "")

# Server 配置
PORT = int(os.getenv("PORT", "3001"))
HOST = os.getenv("HOST", "0.0.0.0")

# LLM 输出 token 限制配置
LLM_MAX_TOKENS_CHAPTER = int(os.getenv("LLM_MAX_TOKENS_CHAPTER", "8192"))
LLM_MAX_TOKENS_MEDIUM = int(os.getenv("LLM_MAX_TOKENS_MEDIUM", "4096"))
LLM_MAX_TOKENS_SHORT = int(os.getenv("LLM_MAX_TOKENS_SHORT", "2048"))

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
