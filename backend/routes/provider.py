"""Provider 配置 API"""
from flask import Blueprint, request, jsonify
from providers import get_all_providers, get_current_text_provider, get_current_music_provider, set_provider_config

provider_bp = Blueprint("provider", __name__)


@provider_bp.route("/providers", methods=["GET"])
def list_providers():
    """列出所有已注册 provider 及其能力"""
    providers = get_all_providers()
    result = []
    for p in providers.values():
        result.append({
            "name": p.name,
            "displayName": p.display_name,
            "supportsMusic": p.supports_music,
            "chatModel": p.chat_model,
            "hasApiKey": bool(p.api_key),
        })
    return jsonify({"success": True, "providers": result})


@provider_bp.route("/config", methods=["GET"])
def get_config():
    """获取当前 provider 配置"""
    text_provider = get_current_text_provider()
    music_provider = get_current_music_provider()

    providers = get_all_providers()
    text_provider_info = None
    music_provider_info = None

    if text_provider in providers:
        p = providers[text_provider]
        text_provider_info = {
            "name": p.name,
            "displayName": p.display_name,
            "chatModel": p.chat_model,
            "hasApiKey": bool(p.api_key),
        }

    if music_provider in providers:
        p = providers[music_provider]
        music_provider_info = {
            "name": p.name,
            "displayName": p.display_name,
            "chatModel": p.chat_model,
            "musicModel": p.music_model,
            "hasApiKey": bool(p.api_key),
        }

    return jsonify({
        "success": True,
        "textProvider": text_provider,
        "musicProvider": music_provider,
        "textProviderInfo": text_provider_info,
        "musicProviderInfo": music_provider_info,
    })


@provider_bp.route("/config", methods=["PUT"])
def update_config():
    """更新 provider 配置"""
    data = request.get_json()

    if "textProvider" in data:
        name = data["textProvider"]
        providers = get_all_providers()
        if name not in providers:
            return jsonify({"success": False, "error": f"Unknown provider: {name}"}), 400
        set_provider_config("text_provider", name)

    if "musicProvider" in data:
        name = data["musicProvider"]
        providers = get_all_providers()
        if name not in providers:
            return jsonify({"success": False, "error": f"Unknown provider: {name}"}), 400
        p = providers[name]
        if not p.supports_music:
            return jsonify({"success": False, "error": f"Provider {p.display_name} 不支持音乐生成"}), 400
        set_provider_config("music_provider", name)

    return jsonify({"success": True, "message": "配置已更新"})
