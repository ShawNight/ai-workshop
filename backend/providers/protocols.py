"""Provider 协议定义 — 标准化请求构建与响应解析

设计原则：
- 每个协议类只负责"按自家 API 格式构造请求"和"解析自家响应"
- 思考模式配置通过统一的 `thinking` dict 传入（由前端 schema 驱动）
- 加新 Provider = 写一个 Protocol 子类（重写 build_body / get_thinking_schema）
- 加新协议 = 继承对应基类改 1-2 个方法
"""

from abc import ABC, abstractmethod


class BaseProtocol(ABC):
    """协议基类 — 定义请求构建与响应解析的标准接口

    思考模式接口：
    - get_thinking_schema() 返回前端 UI 渲染用的 schema（None = 不支持）
    - build_body() 通过 `thinking: dict | None` 参数接收统一格式的思考配置
      协议内部把 thinking dict 翻译成自家 API 字段
    """

    @abstractmethod
    def build_headers(self, api_key: str) -> dict:
        """构建请求头"""

    @abstractmethod
    def build_body(self, model, messages, max_tokens, temperature,
                   thinking: dict | None = None,
                   seed=None) -> dict:
        """构建请求体

        Args:
            thinking: 思考模式配置 dict，格式由本协议的 get_thinking_schema 决定
                      例如：{"type": "enabled", "reasoning_effort": "high"}
                            {"type": "enabled", "budget_tokens": 10000}
                            None 或 {} = 关闭思考模式
        """

    @abstractmethod
    def check_error(self, data: dict) -> tuple[bool, str]:
        """检查 API 响应错误 → (is_error, error_message)"""

    @abstractmethod
    def extract_content(self, data: dict) -> str:
        """提取回答内容"""

    @abstractmethod
    def get_display_name(self) -> str:
        """协议显示名"""

    def get_thinking_schema(self) -> dict | None:
        """返回思考模式配置 schema，供前端 UI 渲染

        Returns:
            None — 不支持思考模式
            dict — 形如：
                {
                    "type": "group",
                    "label": "思考模式",
                    "description": "...",
                    "fields": [
                        {"key": "type", "control": "select",
                         "options": ["enabled", "disabled"], "default": "enabled",
                         "label": "开关", "description": "..."},
                        {"key": "reasoning_effort", "control": "select",
                         "options": ["high", "max"], "default": "high",
                         "label": "思考强度", "description": "..."},
                    ]
                }
        """
        return None

    def extract_reasoning(self, data: dict) -> str:
        """提取思考链内容（默认返回空）"""
        return ""

    def supports_thinking(self) -> bool:
        """是否支持思考模式"""
        return self.get_thinking_schema() is not None

    # ---------- 内部辅助方法 ----------

    def _build_messages(self, messages: list) -> list:
        """默认 messages 处理（OpenAI 格式），子类可覆盖"""
        return messages


class OpenAICompatProtocol(BaseProtocol):
    """OpenAI 兼容协议基类 — 标准 Chat Completions 格式

    子类只需覆盖：
    - get_thinking_schema() / build_body() 中对 thinking 字段的翻译部分
    - 默认 extract_content / extract_reasoning 已经能处理标准 OpenAI 响应
    """

    def get_display_name(self) -> str:
        return "OpenAI 兼容"

    def build_headers(self, api_key: str) -> dict:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def build_body(self, model, messages, max_tokens, temperature,
                   thinking: dict | None = None,
                   seed=None) -> dict:
        body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if thinking:
            # 子类应重写本方法实现自己的 thinking 翻译
            # 默认行为：按 OpenAI 标准 o-series 翻译
            if thinking.get("type") and thinking["type"] != "disabled":
                body["reasoning_effort"] = thinking.get("reasoning_effort", "high")
            else:
                # 思考关闭 → 走 temperature
                body["temperature"] = temperature
                if seed is not None:
                    body["seed"] = seed
        else:
            body["temperature"] = temperature
            if seed is not None:
                body["seed"] = seed
        return body

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

    def extract_reasoning(self, data: dict) -> str:
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("reasoning_content", "") or ""
        return ""


class DeepSeekProtocol(OpenAICompatProtocol):
    """DeepSeek 协议 — OpenAI 兼容格式 + thinking.type + reasoning_effort

    API 规范（api-docs.deepseek.com/guides/thinking_mode）：
    - thinking: {"type": "enabled" | "disabled"} （注意：不接受 "adaptive" 也不接受 "max"）
    - reasoning_effort: "high" | "max"
    - 响应中 reasoning_content 单独字段
    - 启用思考时 temperature / top_p / penalties 无效
    """

    name = "deepseek"

    def get_display_name(self) -> str:
        return "DeepSeek"

    def get_thinking_schema(self) -> dict:
        return {
            "type": "group",
            "label": "思考模式",
            "description": "DeepSeek 思考模式：在输出最终答案前先输出思维链",
            "fields": [
                {
                    "key": "type",
                    "control": "select",
                    "label": "开关",
                    "options": ["enabled", "disabled"],
                    "default": "enabled",
                    "description": "DeepSeek 仅支持 enabled / disabled（不接受 adaptive）",
                },
                {
                    "key": "reasoning_effort",
                    "control": "select",
                    "label": "思考强度",
                    "options": ["high", "max"],
                    "default": "high",
                    "description": "high = 一般任务；max = 复杂推理 / Agent",
                },
            ],
        }

    def build_body(self, model, messages, max_tokens, temperature,
                   thinking: dict | None = None,
                   seed=None) -> dict:
        body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if thinking and thinking.get("type") == "enabled":
            body["thinking"] = {"type": "enabled"}
            body["reasoning_effort"] = thinking.get("reasoning_effort", "high")
            # 思考模式不支持 temperature
        else:
            body["temperature"] = temperature
            if seed is not None:
                body["seed"] = seed
        return body


class MiniMaxProtocol(OpenAICompatProtocol):
    """MiniMax 协议 — OpenAI 兼容格式 + thinking.type

    API 规范（platform.minimaxi.com/docs/api-reference/text-chat）：
    - thinking: {"type": "enabled" | "disabled" | "adaptive"}
    - 没有独立的 reasoning_effort / budget 概念（强度通过 type 或模型名区分）
    - 默认返回的 content 内联思维链（"让我一步步思考..."）
    - 启用 reasoning_split=true 后才把思考拆到 reasoning_content 字段
    """

    name = "minimax"

    def get_display_name(self) -> str:
        return "MiniMax"

    def get_thinking_schema(self) -> dict:
        return {
            "type": "group",
            "label": "思考模式",
            "description": "MiniMax 思考模式：通过 thinking.type 控制（adaptive = 自适应）",
            "fields": [
                {
                    "key": "type",
                    "control": "select",
                    "label": "开关",
                    "options": ["disabled", "enabled", "adaptive"],
                    "default": "adaptive",
                    "description": "adaptive = 模型自适应决定是否深度思考",
                },
                {
                    "key": "reasoning_split",
                    "control": "toggle",
                    "label": "拆分思考内容",
                    "default": False,
                    "description": "开启后将思考内容拆分到 reasoning_content 字段（默认内联在 content 中）",
                },
            ],
        }

    def build_body(self, model, messages, max_tokens, temperature,
                   thinking: dict | None = None,
                   seed=None) -> dict:
        body = {
            "model": model,
            "messages": messages,
            "max_completion_tokens": max_tokens,
        }
        # MiniMax thinking.type 默认 adaptive
        t = (thinking or {}).get("type", "adaptive")
        if t == "disabled":
            body["thinking"] = {"type": "disabled"}
        else:
            body["thinking"] = {"type": t}  # enabled | adaptive

        # reasoning_split（可选）
        if thinking and thinking.get("reasoning_split"):
            body["reasoning_split"] = True

        # MiniMax 默认使用 temperature=1（不传时），传了也支持
        if temperature is not None:
            body["temperature"] = temperature
        if seed is not None:
            body["seed"] = seed
        return body


class StandardOpenAIProtocol(OpenAICompatProtocol):
    """标准 OpenAI / o-series 协议（GPT-5 / o1 / o3 等）

    API 规范（OpenAI 官方）：
    - reasoning_effort: "low" | "medium" | "high"（o-series）
    - 普通 GPT 模型不支持 reasoning
    - max_completion_tokens 替代 max_tokens
    """

    name = "openai"

    def get_display_name(self) -> str:
        return "OpenAI (含 o-series)"

    def get_thinking_schema(self) -> dict:
        return {
            "type": "group",
            "label": "思考模式 (reasoning)",
            "description": "OpenAI o-series 推理模型支持 reasoning_effort",
            "fields": [
                {
                    "key": "reasoning_effort",
                    "control": "select",
                    "label": "推理强度",
                    "options": ["low", "medium", "high"],
                    "default": "medium",
                    "description": "仅 o-series 推理模型有效",
                },
            ],
        }

    def build_body(self, model, messages, max_tokens, temperature,
                   thinking: dict | None = None,
                   seed=None) -> dict:
        body = {
            "model": model,
            "messages": messages,
            "max_completion_tokens": max_tokens,
        }
        if thinking and thinking.get("reasoning_effort"):
            body["reasoning_effort"] = thinking["reasoning_effort"]
        if temperature is not None:
            body["temperature"] = temperature
        if seed is not None:
            body["seed"] = seed
        return body


class AnthropicProtocol(BaseProtocol):
    """Anthropic Messages API 协议

    API 规范（docs.anthropic.com）：
    - thinking: {"type": "enabled", "budget_tokens": N}（type 只接受 enabled / disabled）
    - max_tokens 必须 ≥ budget_tokens
    - 启用思考时不支持 temperature
    - 响应中 thinking 块单独包含思维链
    """

    name = "anthropic"

    def get_display_name(self) -> str:
        return "Anthropic"

    def get_thinking_schema(self) -> dict:
        return {
            "type": "group",
            "label": "Extended Thinking",
            "description": "Anthropic 扩展思考：通过 budget_tokens 控制思考预算",
            "fields": [
                {
                    "key": "type",
                    "control": "select",
                    "label": "开关",
                    "options": ["enabled", "disabled"],
                    "default": "enabled",
                    "description": "启用 Extended Thinking",
                },
                {
                    "key": "budget_tokens",
                    "control": "number",
                    "label": "思考预算 (tokens)",
                    "min": 1024,
                    "max": 128000,
                    "default": 10000,
                    "step": 1024,
                    "description": "模型在思考阶段可使用的最大 token 数",
                },
            ],
        }

    def build_headers(self, api_key: str) -> dict:
        return {
            "x-api-key": api_key,
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
        }

    def build_body(self, model, messages, max_tokens, temperature,
                   thinking: dict | None = None,
                   seed=None) -> dict:
        # system 消息提取为顶层参数
        system_text = ""
        api_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_text += msg["content"] + "\n"
            else:
                api_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        body = {
            "model": model,
            "messages": api_messages,
            "max_tokens": max_tokens,
        }
        if system_text.strip():
            body["system"] = system_text.strip()

        if thinking and thinking.get("type") == "enabled":
            budget = int(thinking.get("budget_tokens", 10000))
            body["thinking"] = {
                "type": "enabled",
                "budget_tokens": budget,
            }
            # Anthropic 要求 max_tokens > budget_tokens
            if body["max_tokens"] <= budget:
                body["max_tokens"] = budget + 4096
            # 思考模式不支持 temperature
        else:
            if temperature is not None:
                body["temperature"] = temperature

        return body

    def check_error(self, data: dict) -> tuple[bool, str]:
        if "error" in data and isinstance(data["error"], dict):
            return True, data["error"].get("message", "API error")
        return False, ""

    def extract_content(self, data: dict) -> str:
        content_blocks = data.get("content", [])
        texts = []
        for block in content_blocks:
            if block.get("type") == "text":
                texts.append(block.get("text", ""))
        return "\n".join(texts)

    def extract_reasoning(self, data: dict) -> str:
        content_blocks = data.get("content", [])
        texts = []
        for block in content_blocks:
            if block.get("type") == "thinking":
                texts.append(block.get("thinking", ""))
        return "\n".join(texts)


# 协议注册表 — provider.protocol 字段从这里查找
# key = 数据库里 protocol 列存的字符串
PROTOCOLS = {
    "openai": StandardOpenAIProtocol(),
    "deepseek": DeepSeekProtocol(),
    "minimax": MiniMaxProtocol(),
    "anthropic": AnthropicProtocol(),
}


def get_protocol(name: str) -> BaseProtocol:
    """获取协议实例，未知协议 fallback 到标准 OpenAI"""
    return PROTOCOLS.get(name) or StandardOpenAIProtocol()
