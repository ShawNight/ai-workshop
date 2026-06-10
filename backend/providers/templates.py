"""Provider 模板 — 常见 LLM 服务的快速添加配置

使用：
- 后端 GET /api/provider/templates 返回给前端
- 前端展示"快速添加"按钮
- 选中模板后，前端用模板字段预填表单

加新模板 = 在 PROVIDER_TEMPLATES 加一个 dict
"""

PROVIDER_TEMPLATES = [
    {
        "key": "deepseek",
        "name": "deepseek",
        "displayName": "DeepSeek",
        "protocol": "deepseek",
        "chatUrl": "https://api.deepseek.com/chat/completions",
        "defaultModels": ["deepseek-chat", "deepseek-reasoner"],
        "defaultChatModel": "deepseek-chat",
        "apiKeyUrl": "https://platform.deepseek.com/api_keys",
        "description": "国产高性价比推理模型，支持思考模式",
    },
    {
        "key": "minimax",
        "name": "minimax",
        "displayName": "MiniMax",
        "protocol": "minimax",
        "chatUrl": "https://api.minimaxi.com/v1/chat/completions",
        "defaultModels": ["MiniMax-Text-01", "MiniMax-M1"],
        "defaultChatModel": "MiniMax-Text-01",
        "apiKeyUrl": "https://platform.minimaxi.com/user-center/basic-information/interface-key",
        "description": "MiniMax 大模型，支持长上下文与多模态",
    },
    {
        "key": "openai",
        "name": "openai",
        "displayName": "OpenAI (官方)",
        "protocol": "openai",
        "chatUrl": "https://api.openai.com/v1/chat/completions",
        "defaultModels": ["gpt-4o", "gpt-4o-mini", "o3-mini"],
        "defaultChatModel": "gpt-4o-mini",
        "apiKeyUrl": "https://platform.openai.com/api-keys",
        "description": "OpenAI 官方 GPT / o-series 模型",
    },
    {
        "key": "anthropic",
        "name": "anthropic",
        "displayName": "Anthropic Claude",
        "protocol": "anthropic",
        "chatUrl": "https://api.anthropic.com/v1/messages",
        "defaultModels": [
            "claude-sonnet-4-5",
            "claude-opus-4-1",
            "claude-3-5-sonnet-20241022",
        ],
        "defaultChatModel": "claude-sonnet-4-5",
        "apiKeyUrl": "https://console.anthropic.com/settings/keys",
        "description": "Anthropic Claude 模型，支持 Extended Thinking",
    },
    {
        "key": "moonshot",
        "name": "moonshot",
        "displayName": "Moonshot (Kimi)",
        "protocol": "openai",  # Moonshot 兼容 OpenAI 协议
        "chatUrl": "https://api.moonshot.cn/v1/chat/completions",
        "defaultModels": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
        "defaultChatModel": "moonshot-v1-8k",
        "apiKeyUrl": "https://platform.moonshot.cn/console/api-keys",
        "description": "Moonshot Kimi 大模型，长上下文能力强",
    },
    {
        "key": "zhipu",
        "name": "zhipu",
        "displayName": "智谱 GLM",
        "protocol": "openai",  # 智谱也兼容 OpenAI 协议
        "chatUrl": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        "defaultModels": ["glm-4-plus", "glm-4-flash", "glm-4-air"],
        "defaultChatModel": "glm-4-flash",
        "apiKeyUrl": "https://open.bigmodel.cn/usercenter/apikeys",
        "description": "智谱 GLM-4 系列模型",
    },
    {
        "key": "qwen",
        "name": "qwen",
        "displayName": "通义千问 (Qwen)",
        "protocol": "openai",  # 阿里云 DashScope 兼容模式
        "chatUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        "defaultModels": ["qwen-plus", "qwen-turbo", "qwen-max"],
        "defaultChatModel": "qwen-plus",
        "apiKeyUrl": "https://dashscope.console.aliyun.com/apiKey",
        "description": "阿里云通义千问，OpenAI 兼容模式",
    },
    {
        "key": "custom",
        "name": "",
        "displayName": "自定义 (Custom)",
        "protocol": "openai",
        "chatUrl": "",
        "defaultModels": [],
        "defaultChatModel": "",
        "apiKeyUrl": "",
        "description": "手动填写所有字段，适配任意 OpenAI 兼容服务",
    },
]
