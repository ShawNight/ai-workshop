import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "3001"))
HOST = os.getenv("HOST", "0.0.0.0")

LLM_MAX_TOKENS_CHAPTER = int(os.getenv("LLM_MAX_TOKENS_CHAPTER", "8192"))
LLM_MAX_TOKENS_MEDIUM = int(os.getenv("LLM_MAX_TOKENS_MEDIUM", "4096"))
LLM_MAX_TOKENS_SHORT = int(os.getenv("LLM_MAX_TOKENS_SHORT", "2048"))

HTTP_PROXY = os.getenv("HTTP_PROXY", "")
HTTPS_PROXY = os.getenv("HTTPS_PROXY", "")


def get_proxies():
    proxies = {}
    if HTTP_PROXY:
        proxies["http"] = HTTP_PROXY
    if HTTPS_PROXY:
        proxies["https"] = HTTPS_PROXY
    return proxies
