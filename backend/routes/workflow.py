import uuid
from flask import Blueprint, request, jsonify

# 导入数据库模块
from database import (
    create_workflow, get_workflow, get_all_workflows,
    update_workflow, delete_workflow
)

workflow_bp = Blueprint("workflow", __name__)

# 内存缓存（用于临时存储，与数据库同步）
workflows_cache = {}


@workflow_bp.route("/", methods=["GET"])
def get_workflows():
    """获取所有工作流"""
    try:
        workflow_list = get_all_workflows()
        return jsonify({"success": True, "workflows": workflow_list})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@workflow_bp.route("/", methods=["POST"])
def create_workflow_route():
    """创建新工作流"""
    data = request.get_json()
    workflow_id = str(uuid.uuid4())
    name = data.get("name") or "未命名工作流"
    description = data.get("description") or ""
    
    try:
        workflow = create_workflow(workflow_id, name, description)
        return jsonify({"success": True, "workflow": workflow})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@workflow_bp.route("/<workflow_id>", methods=["GET"])
def get_workflow_route(workflow_id):
    """获取单个工作流"""
    try:
        workflow = get_workflow(workflow_id)
        if not workflow:
            return jsonify({"success": False, "error": "工作流不存在"}), 404
        return jsonify({"success": True, "workflow": workflow})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@workflow_bp.route("/<workflow_id>", methods=["PUT"])
def update_workflow_route(workflow_id):
    """更新工作流"""
    data = request.get_json()
    
    try:
        existing = get_workflow(workflow_id)
        if not existing:
            return jsonify({"success": False, "error": "工作流不存在"}), 404
        
        # 构建更新数据
        updates = {}
        if "name" in data:
            updates["name"] = data["name"]
        if "description" in data:
            updates["description"] = data["description"]
        if "nodes" in data:
            updates["nodes"] = data["nodes"]
        if "edges" in data:
            updates["edges"] = data["edges"]
        
        update_workflow(workflow_id, updates)
        updated = get_workflow(workflow_id)
        return jsonify({"success": True, "workflow": updated})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@workflow_bp.route("/<workflow_id>", methods=["DELETE"])
def delete_workflow_route(workflow_id):
    """删除工作流"""
    try:
        success = delete_workflow(workflow_id)
        if not success:
            return jsonify({"success": False, "error": "工作流不存在"}), 404
        return jsonify({"success": True, "message": "工作流已删除"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@workflow_bp.route("/<workflow_id>/execute", methods=["POST"])
def execute_workflow(workflow_id):
    """执行工作流"""
    try:
        workflow = get_workflow(workflow_id)
        if not workflow:
            return jsonify({"success": False, "error": "工作流不存在"}), 404

        execution_id = str(uuid.uuid4())

        return jsonify(
            {
                "success": True,
                "executionId": execution_id,
                "message": "工作流执行已启动",
                "status": "running",
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
