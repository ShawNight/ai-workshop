"""Provider 基础类型定义"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProviderConfig:
    """Provider 配置 — 所有字段均可从数据库加载

    Phase 2 改造：
    - 新增 thinking_config 字段，存协议特定的思考模式配置
    - 保留 thinking_enabled / reasoning_effort / thinking_budget 作为兼容 fallback
    """
    name: str
    display_name: str
    protocol: str           # "openai" | "deepseek" | "minimax" | "anthropic"
    chat_url: str
    api_key: str
    chat_model: str
    enabled: bool = True

    # 思考模式（协议无关的快速访问字段）
    thinking_enabled: bool = False
    reasoning_effort: str = "high"   # OpenAI/DeepSeek 兼容
    thinking_budget: int = 10000      # Anthropic 兼容

    # 思考模式（协议特定配置）— 主字段
    thinking_config: Optional[dict] = None

    def get_thinking(self) -> dict:
        """统一对外的思考配置（call_llm 用）

        Returns:
            dict 给 BaseProtocol.build_body 的 thinking 参数
            当开关关闭时返回 {"type": "disabled"}
        """
        if not self.thinking_enabled:
            return {"type": "disabled"}
        if self.thinking_config:
            cfg = dict(self.thinking_config)
            # 防御：即使主开关为 True，type 也得不是 disabled
            if cfg.get("type") in (None, "", "disabled"):
                cfg["type"] = "enabled"
            return cfg
        # 旧数据兜底
        if self.protocol == "anthropic":
            return {"type": "enabled", "budget_tokens": self.thinking_budget}
        if self.protocol == "minimax":
            return {"type": "adaptive", "reasoning_split": False}
        return {"type": "enabled", "reasoning_effort": self.reasoning_effort}

    def check_error(self, data: dict) -> tuple[bool, str]:
        """委托给协议处理器检查 API 响应错误"""
        from providers.protocols import get_protocol
        return get_protocol(self.protocol).check_error(data)

    def extract_content(self, data: dict) -> str:
        """委托给协议处理器提取文本内容"""
        from providers.protocols import get_protocol
        return get_protocol(self.protocol).extract_content(data)

    def extract_reasoning(self, data: dict) -> str:
        """委托给协议处理器提取思考链内容"""
        from providers.protocols import get_protocol
        return get_protocol(self.protocol).extract_reasoning(data)


@dataclass
class LLMResponse:
    """统一 LLM 响应格式"""
    success: bool
    content: str = ""
    reasoning: str = ""
    error: str = ""
    raw: dict = field(default_factory=dict)
