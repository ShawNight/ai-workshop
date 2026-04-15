import uuid
from flask import Blueprint, request, jsonify

workflow_bp = Blueprint("workflow", __name__)

workflows = {}


@workflow_bp.route("/", methods=["GET"])
def get_workflows():
    workflow_list = list(workflows.values())
    return jsonify({"success": True, "workflows": workflow_list})


@workflow_bp.route("/", methods=["POST"])
def create_workflow():
    data = request.get_json()
    workflow_id = str(uuid.uuid4())
    from datetime import datetime

    workflow = {
        "id": workflow_id,
        "name": data.get("name") or "未命名工作流",
        "description": data.get("description") or "",
        "nodes": data.get("nodes") or [],
        "edges": data.get("edges") or [],
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
    }
    workflows[workflow_id] = workflow
    return jsonify({"success": True, "workflow": workflow})


@workflow_bp.route("/<workflow_id>", methods=["GET"])
def get_workflow(workflow_id):
    workflow = workflows.get(workflow_id)
    if not workflow:
        return jsonify({"success": False, "error": "工作流不存在"}), 404
    return jsonify({"success": True, "workflow": workflow})


@workflow_bp.route("/<workflow_id>", methods=["PUT"])
def update_workflow(workflow_id):
    workflow = workflows.get(workflow_id)
    if not workflow:
        return jsonify({"success": False, "error": "工作流不存在"}), 404

    data = request.get_json()
    from datetime import datetime

    updated = {
        **workflow,
        **data,
        "id": workflow["id"],
        "updatedAt": datetime.now().isoformat(),
    }
    workflows[workflow_id] = updated
    return jsonify({"success": True, "workflow": updated})


@workflow_bp.route("/<workflow_id>", methods=["DELETE"])
def delete_workflow(workflow_id):
    if workflow_id not in workflows:
        return jsonify({"success": False, "error": "工作流不存在"}), 404
    del workflows[workflow_id]
    return jsonify({"success": True, "message": "工作流已删除"})


@workflow_bp.route("/<workflow_id>/execute", methods=["POST"])
def execute_workflow(workflow_id):
    workflow = workflows.get(workflow_id)
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
