import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "3001"))
HOST = os.getenv("HOST", "0.0.0.0")

LLM_MAX_TOKENS_CHAPTER = int(os.getenv("LLM_MAX_TOKENS_CHAPTER", "8192"))
LLM_MAX_TOKENS_MEDIUM = int(os.getenv("LLM_MAX_TOKENS_MEDIUM", "4096"))
LLM_MAX_TOKENS_SHORT = int(os.getenv("LLM_MAX_TOKENS_SHORT", "2048"))

# LLM 响应缓存
LLM_CACHE_ENABLED = os.getenv("LLM_CACHE_ENABLED", "true").lower() in ("1", "true", "yes")
LLM_CACHE_SEED = int(os.getenv("LLM_CACHE_SEED", "42"))
LLM_CACHE_MAX_SIZE = int(os.getenv("LLM_CACHE_MAX_SIZE", "50"))

HTTP_PROXY = os.getenv("HTTP_PROXY", "")
HTTPS_PROXY = os.getenv("HTTPS_PROXY", "")


def get_proxies():
    proxies = {}
    if HTTP_PROXY:
        proxies["http"] = HTTP_PROXY
    if HTTPS_PROXY:
        proxies["https"] = HTTPS_PROXY
    return proxies
