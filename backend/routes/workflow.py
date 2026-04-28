import os
import uuid
import json
import requests
import time
import threading
import re
from flask import Blueprint, request, jsonify
from datetime import datetime

# 导入数据库模块
from database import (
    create_workflow, get_workflow, get_all_workflows,
    update_workflow, delete_workflow, get_connection
)

# 导入配置
from config import LLM_API_KEY, LLM_CHAT_URL, LLM_LYRICS_URL, LLM_MUSIC_URL, LLM_MUSIC_MODEL, get_proxies

workflow_bp = Blueprint("workflow", __name__)

# 执行任务状态存储
execution_jobs = {}


def ensure_uploads_dir():
    """确保上传目录存在"""
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def sanitize_filename(name):
    """清理文件名"""
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name)
    name = name.strip()
    if not name:
        name = "workflow_output"
    if len(name) > 50:
        name = name[:50]
    return name


# ==================== 工作流执行引擎 ====================

def topological_sort(nodes, edges):
    """
    拓扑排序确定节点执行顺序
    返回节点 ID 列表，按执行顺序排列
    """
    # 构建邻接表和入度计数
    node_ids = {n['id'] for n in nodes}
    in_degree = {nid: 0 for nid in node_ids}
    adj = {nid: [] for nid in node_ids}

    for edge in edges:
        source = edge['source']
        target = edge['target']
        if source in node_ids and target in node_ids:
            adj[source].append(target)
            in_degree[target] += 1

    # Kahn 算法
    queue = [nid for nid in node_ids if in_degree[nid] == 0]
    result = []

    while queue:
        current = queue.pop(0)
        result.append(current)
        for neighbor in adj[current]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # 检查是否有环
    if len(result) != len(node_ids):
        return None  # 有环

    return result


def get_node_input(node_id, edges, node_outputs):
    """
    获取节点的上游输入数据
    返回上游节点的输出拼接结果
    """
    inputs = []
    for edge in edges:
        if edge['target'] == node_id:
            source_id = edge['source']
            if source_id in node_outputs:
                inputs.append(node_outputs[source_id])
    return '\n'.join(inputs) if inputs else None


def execute_input_node(node, node_outputs):
    """
    执行输入节点：返回用户配置的输入文本
    """
    config = node.get('config', {})
    text = config.get('text', '')
    node_outputs[node['id']] = text
    return {
        'nodeId': node['id'],
        'nodeName': node.get('label', '输入'),
        'status': 'success',
        'output': text[:500] + '...' if len(text) > 500 else text
    }


def execute_llm_node(node, input_data, node_outputs):
    """
    执行 LLM 节点：调用 MiniMax Chat API
    """
    config = node.get('config', {})
    prompt_template = config.get('prompt', '')
    model = config.get('model', 'MiniMax-M2.7')

    # 构建实际 prompt
    if prompt_template:
        # 替换 {{input}} 为上游数据
        actual_prompt = prompt_template.replace('{{input}}', input_data or '')
    else:
        # 没有 prompt 模板，直接使用上游数据
        actual_prompt = input_data or '请生成一些内容'

    if not LLM_API_KEY:
        # Mock 模式
        mock_output = f"[Mock LLM Response] 处理输入: {actual_prompt[:100]}..."
        node_outputs[node['id']] = mock_output
        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', 'LLM'),
            'status': 'success',
            'output': mock_output
        }

    try:
        response = requests.post(
            LLM_CHAT_URL,
            json={
                "model": model,
                "messages": [{"role": "user", "content": actual_prompt}],
                "temperature": 0.7,
                "max_tokens": 2000
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json"
            },
            proxies=get_proxies(),
            timeout=60
        )

        data = response.json()

        if data.get('base_resp', {}).get('status_code') != 0:
            error_msg = data.get('base_resp', {}).get('status_msg', 'API 错误')
            return {
                'nodeId': node['id'],
                'nodeName': node.get('label', 'LLM'),
                'status': 'error',
                'error': error_msg
            }

        # 提取响应内容
        choices = data.get('choices', [])
        if choices:
            content = choices[0].get('message', {}).get('content', '')
            node_outputs[node['id']] = content
            return {
                'nodeId': node['id'],
                'nodeName': node.get('label', 'LLM'),
                'status': 'success',
                'output': content[:500] + '...' if len(content) > 500 else content
            }

        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', 'LLM'),
            'status': 'error',
            'error': 'API 返回空内容'
        }

    except requests.exceptions.Timeout:
        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', 'LLM'),
            'status': 'error',
            'error': '请求超时'
        }
    except Exception as e:
        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', 'LLM'),
            'status': 'error',
            'error': str(e)
        }


def execute_music_node(node, input_data, node_outputs, execution_id):
    """
    执行音乐节点：调用 MiniMax 音乐生成 API
    """
    config = node.get('config', {})
    style = config.get('style', '流行')
    lyrics_override = config.get('lyrics', '')

    # 使用配置的歌词或上游输入
    lyrics = lyrics_override if lyrics_override else (input_data or '')

    if not lyrics:
        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', '音乐'),
            'status': 'error',
            'error': '缺少歌词内容'
        }

    if not LLM_API_KEY:
        # Mock 模式
        mock_output = f"[Mock Music] 歌词: {lyrics[:100]}... | 风格: {style}"
        node_outputs[node['id']] = mock_output
        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', '音乐'),
            'status': 'success',
            'output': mock_output
        }

    try:
        uploads_dir = ensure_uploads_dir()
        safe_name = sanitize_filename(node.get('label', 'workflow_music'))
        output_file = os.path.join(uploads_dir, f"{safe_name}_{execution_id[:8]}.mp3")

        # 调用 MiniMax 音乐生成 HTTP API
        headers = {
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": LLM_MUSIC_MODEL,
            "prompt": style,
            "lyrics": lyrics
        }

        response = requests.post(LLM_MUSIC_URL, headers=headers, json=payload, proxies=get_proxies(), timeout=300)
        result = response.json()

        # 检查业务错误
        base_resp = result.get("base_resp", {})
        if base_resp.get("status_code") != 0:
            error_msg = base_resp.get("status_msg", "音乐生成失败")
            return {
                'nodeId': node['id'],
                'nodeName': node.get('label', '音乐'),
                'status': 'error',
                'error': error_msg
            }

        # 获取音频数据
        data = result.get("data", {})
        audio_hex = data.get("audio")
        if not audio_hex:
            return {
                'nodeId': node['id'],
                'nodeName': node.get('label', '音乐'),
                'status': 'error',
                'error': '未获取到音频数据'
            }

        # music-2.6 返回十六进制字符串，转换为字节并保存
        audio_bytes = bytes.fromhex(audio_hex)
        with open(output_file, "wb") as f:
            f.write(audio_bytes)

        audio_url = f"/api/music/download/{os.path.basename(output_file)}"
        node_outputs[node['id']] = audio_url
        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', '音乐'),
            'status': 'success',
            'output': f'音乐生成成功: {audio_url}',
            'audioUrl': audio_url
        }

    except requests.exceptions.Timeout:
        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', '音乐'),
            'status': 'error',
            'error': '音乐生成超时（5分钟）'
        }
    except Exception as e:
        return {
            'nodeId': node['id'],
            'nodeName': node.get('label', '音乐'),
            'status': 'error',
            'error': str(e)
        }


def execute_output_node(node, input_data, node_outputs):
    """
    执行输出节点：收集并显示最终结果
    """
    node_outputs[node['id']] = input_data or ''
    return {
        'nodeId': node['id'],
        'nodeName': node.get('label', '输出'),
        'status': 'success',
        'output': input_data[:500] + '...' if input_data and len(input_data) > 500 else (input_data or '(空)')
    }


def run_workflow_execution(workflow_id, nodes, edges):
    """
    执行工作流的核心逻辑
    """
    execution_id = str(uuid.uuid4())
    execution_jobs[execution_id] = {
        'workflow_id': workflow_id,
        'status': 'running',
        'results': {},
        'node_outputs': {},
        'final_output': None,
        'error': None,
        'started_at': datetime.now().isoformat()
    }

    try:
        # 1. 拓扑排序
        execution_order = topological_sort(nodes, edges)
        if execution_order is None:
            execution_jobs[execution_id]['status'] = 'error'
            execution_jobs[execution_id]['error'] = '工作流存在循环连接'
            return

        # 2. 按顺序执行节点
        node_outputs = {}
        results = {}
        final_output = None

        # 构建节点 ID -> 节点对象的映射
        node_map = {n['id']: n for n in nodes}

        for node_id in execution_order:
            node = node_map.get(node_id)
            if not node:
                continue

            node_type = node.get('type', 'llm')
            input_data = get_node_input(node_id, edges, node_outputs)

            # 根据节点类型执行
            if node_type == 'input':
                result = execute_input_node(node, node_outputs)
            elif node_type == 'llm':
                result = execute_llm_node(node, input_data, node_outputs)
            elif node_type == 'music':
                result = execute_music_node(node, input_data, node_outputs, execution_id)
            elif node_type == 'output':
                result = execute_output_node(node, input_data, node_outputs)
                final_output = node_outputs.get(node_id, '')
            else:
                result = {
                    'nodeId': node_id,
                    'nodeName': node.get('label', '未知'),
                    'status': 'error',
                    'error': f'未知节点类型: {node_type}'
                }

            results[node_id] = result

            # 如果任何节点失败，停止执行
            if result.get('status') == 'error':
                execution_jobs[execution_id]['status'] = 'error'
                execution_jobs[execution_id]['error'] = f'节点 {node.get("label")} 执行失败: {result.get("error")}'
                break

        # 3. 更新执行结果
        execution_jobs[execution_id]['results'] = results
        execution_jobs[execution_id]['node_outputs'] = node_outputs
        execution_jobs[execution_id]['final_output'] = final_output

        if execution_jobs[execution_id]['status'] != 'error':
            execution_jobs[execution_id]['status'] = 'completed'

        execution_jobs[execution_id]['completed_at'] = datetime.now().isoformat()

    except Exception as e:
        execution_jobs[execution_id]['status'] = 'error'
        execution_jobs[execution_id]['error'] = str(e)
        execution_jobs[execution_id]['completed_at'] = datetime.now().isoformat()


# ==================== API 路由 ====================

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
    data = request.get_json() or {}
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    try:
        workflow = get_workflow(workflow_id)
        if not workflow:
            return jsonify({"success": False, "error": "工作流不存在"}), 404

        # 如果请求中没有提供节点/边，使用数据库中的
        if not nodes:
            nodes = workflow.get("nodes", [])
        if not edges:
            edges = workflow.get("edges", [])

        if not nodes:
            return jsonify({"success": False, "error": "工作流中没有节点"}), 400

        execution_id = str(uuid.uuid4())

        # 在后台线程中执行工作流
        thread = threading.Thread(
            target=run_workflow_execution,
            args=(workflow_id, nodes, edges),
            daemon=True
        )
        thread.start()

        # 等待执行完成（最多 2 分钟）
        thread.join(timeout=120)

        job = execution_jobs.get(execution_id)
        if job:
            return jsonify({
                "success": True,
                "executionId": execution_id,
                "status": job['status'],
                "results": job['results'],
                "finalOutput": job.get('final_output'),
                "error": job.get('error')
            })
        else:
            return jsonify({
                "success": False,
                "error": "执行超时或内部错误"
            }), 500

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@workflow_bp.route("/execution/<execution_id>", methods=["GET"])
def get_execution_status(execution_id):
    """获取执行状态"""
    job = execution_jobs.get(execution_id)
    if not job:
        return jsonify({"success": False, "error": "执行任务不存在"}), 404

    return jsonify({
        "success": True,
        "executionId": execution_id,
        "status": job['status'],
        "results": job['results'],
        "finalOutput": job.get('final_output'),
        "error": job.get('error'),
        "startedAt": job.get('started_at'),
        "completedAt": job.get('completed_at')
    })


# 清理过期执行任务
def cleanup_expired_executions():
    """清理超过 1 小时的执行任务"""
    now = datetime.now()
    expired = []
    for eid, job in execution_jobs.items():
        completed_at = job.get('completed_at')
        if completed_at:
            completed_time = datetime.fromisoformat(completed_at)
            if (now - completed_time).total_seconds() > 3600:
                expired.append(eid)

    for eid in expired:
        del execution_jobs[eid]


# 定期清理（在每次请求时检查）
@workflow_bp.before_request
def before_request():
    cleanup_expired_executions()