"""Provider 配置 API — 完整 CRUD + 测试连接 + 协议列表"""
import requests as http_requests
from flask import Blueprint, request, jsonify
from providers import (
    get_all_providers, get_provider, get_current_text_provider,
    set_provider_config, reload_providers,
)
from providers.db import (
    db_get_all_providers, db_get_provider, db_create_provider,
    db_update_provider, db_delete_provider,
)
from database import (
    get_provider_models, add_provider_model,
    update_provider_model, delete_provider_model,
)
from providers.protocols import PROTOCOLS
from providers.templates import PROVIDER_TEMPLATES
from config import get_proxies

provider_bp = Blueprint("provider", __name__)


@provider_bp.route("/providers", methods=["GET"])
def list_providers():
    """列出所有 provider（Key 脱敏）"""
    providers = db_get_all_providers()
    return jsonify({"success": True, "providers": providers})


@provider_bp.route("/providers/<name>", methods=["GET"])
def get_provider_detail(name):
    """获取单个 provider 详情"""
    p = db_get_provider(name)
    if not p:
        return jsonify({"success": False, "error": "Provider 不存在"}), 404
    return jsonify({"success": True, "provider": p})


@provider_bp.route("/providers", methods=["POST"])
def create_provider():
    """创建新 provider"""
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"success": False, "error": "标识名称不能为空"}), 400
    if not data.get("chatUrl"):
        return jsonify({"success": False, "error": "API 地址不能为空"}), 400
    if not data.get("chatModel"):
        return jsonify({"success": False, "error": "模型名称不能为空"}), 400

    # 检查是否已存在
    if db_get_provider(name):
        return jsonify({"success": False, "error": f"Provider '{name}' 已存在"}), 400

    # 验证协议
    protocol = data.get("protocol", "openai")
    if protocol not in PROTOCOLS:
        return jsonify({"success": False, "error": f"未知协议: {protocol}"}), 400

    p = db_create_provider(data)
    reload_providers()
    return jsonify({"success": True, "provider": p}), 201


@provider_bp.route("/providers/<name>", methods=["PUT"])
def update_provider(name):
    """更新 provider"""
    data = request.get_json()
    p = db_update_provider(name, data)
    if not p:
        return jsonify({"success": False, "error": "Provider 不存在"}), 404
    reload_providers()
    return jsonify({"success": True, "provider": p})


@provider_bp.route("/providers/<name>", methods=["DELETE"])
def delete_provider(name):
    """删除 provider"""
    # 检查是否是当前活跃的 provider
    text_provider = get_current_text_provider()
    if name == text_provider:
        set_provider_config("text_provider", "")

    success = db_delete_provider(name)
    if not success:
        return jsonify({"success": False, "error": "Provider 不存在"}), 404
    reload_providers()
    return jsonify({"success": True, "message": "已删除"})


@provider_bp.route("/providers/<name>/test", methods=["POST"])
def test_provider(name):
    """测试 provider 连接"""
    try:
        provider = get_provider(name)
    except KeyError:
        return jsonify({"success": False, "error": "Provider 不存在或未启用"}), 404

    if not provider.api_key:
        return jsonify({"success": False, "error": "未配置 API Key"})

    try:
        protocol = PROTOCOLS.get(provider.protocol) or PROTOCOLS["openai"]

        headers = protocol.build_headers(provider.api_key)
        body = protocol.build_body(
            model=provider.chat_model,
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5,
            temperature=0,
            thinking=None,
        )

        resp = http_requests.post(
            provider.chat_url,
            json=body,
            headers=headers,
            proxies=get_proxies(),
            timeout=15,
        )

        data = resp.json()
        is_error, error_msg = provider.check_error(data)
        if is_error:
            return jsonify({"success": False, "error": error_msg})

        return jsonify({"success": True, "message": "连接成功"})
    except http_requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "连接超时"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@provider_bp.route("/protocols", methods=["GET"])
def list_protocols():
    """列出可用协议 — 返回每个协议的 thinkingSchema 供前端 UI 渲染"""
    protocols = []
    for name, proto in PROTOCOLS.items():
        item = {
            "name": name,
            "displayName": proto.get_display_name(),
            "supportsThinking": proto.supports_thinking(),
            "thinkingSchema": proto.get_thinking_schema(),
        }
        protocols.append(item)
    return jsonify({"success": True, "protocols": protocols})


@provider_bp.route("/templates", methods=["GET"])
def list_templates():
    """列出 Provider 模板 — 前端"快速添加"使用"""
    return jsonify({"success": True, "templates": PROVIDER_TEMPLATES})


@provider_bp.route("/config", methods=["GET"])
def get_config():
    """获取当前 provider 选择"""
    text_provider = get_current_text_provider()

    providers = get_all_providers()
    text_provider_info = None

    if text_provider and text_provider in providers:
        p = providers[text_provider]
        text_provider_info = {
            "name": p.name,
            "displayName": p.display_name,
            "chatModel": p.chat_model,
        }

    return jsonify({
        "success": True,
        "textProvider": text_provider,
        "textProviderInfo": text_provider_info,
    })


@provider_bp.route("/config", methods=["PUT"])
def update_config():
    """切换活跃 provider"""
    data = request.get_json()

    if "textProvider" in data:
        name = data["textProvider"]
        try:
            get_provider(name)
        except KeyError:
            return jsonify({"success": False, "error": f"Provider '{name}' 不存在"}), 400
        set_provider_config("text_provider", name)

    return jsonify({"success": True, "message": "配置已更新"})


# ==================== Provider 模型管理 ====================

@provider_bp.route("/providers/<name>/models", methods=["GET"])
def list_models(name):
    """获取某 Provider 的可用模型列表"""
    try:
        models = get_provider_models(name)
        return jsonify({"success": True, "models": models})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@provider_bp.route("/providers/<name>/models", methods=["POST"])
def create_model(name):
    """为 Provider 添加一个可用模型"""
    data = request.get_json()
    model_name = (data.get("modelName") or "").strip()
    if not model_name:
        return jsonify({"success": False, "error": "模型名称不能为空"}), 400
    try:
        model = add_provider_model(name, model_name)
        return jsonify({"success": True, "model": model})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@provider_bp.route("/providers/<name>/models/<int:model_id>", methods=["PUT"])
def update_model(name, model_id):
    """更新模型名称"""
    data = request.get_json()
    model_name = (data.get("modelName") or "").strip()
    if not model_name:
        return jsonify({"success": False, "error": "模型名称不能为空"}), 400
    try:
        success = update_provider_model(model_id, model_name)
        if success:
            return jsonify({"success": True, "message": "已更新"})
        return jsonify({"success": False, "error": "模型不存在"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@provider_bp.route("/providers/<name>/models/<int:model_id>", methods=["DELETE"])
def delete_model(name, model_id):
    """删除一个模型"""
    try:
        success = delete_provider_model(model_id)
        if success:
            return jsonify({"success": True, "message": "已删除"})
        return jsonify({"success": False, "error": "模型不存在"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
