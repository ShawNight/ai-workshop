import os
import uuid
import subprocess
from flask import Blueprint, request, jsonify, send_file
import requests
from datetime import datetime

music_bp = Blueprint("music", __name__)

MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MINIMAX_API_URL = "https://api.minimaxi.com/v1/lyrics_generation"

jobs = {}


def ensure_uploads_dir():
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def generate_lyrics_with_llm(
    theme, mood, genre, current_lyrics="", conversation=None, user_request=""
):
    if not MINIMAX_API_KEY:
        raise ValueError("未配置 MiniMax API Key，请在 .env 文件中设置 MINIMAX_API_KEY")

    if current_lyrics:
        prompt = f'用户当前歌词：\n{current_lyrics}\n\n用户修改意见："{user_request or "请改进这段歌词"}"\n\n请根据用户的修改意见改进歌词，保持主题「{theme}」，风格{mood} {genre}。'
    else:
        prompt = f"一首关于{theme}的{mood}{genre}歌曲"

    try:
        response = requests.post(
            MINIMAX_API_URL,
            json={
                "mode": "write_full_song",
                "prompt": prompt,
            },
            headers={
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )

        data = response.json()
        if data.get("base_resp", {}).get("status_code") != 0:
            raise ValueError(
                f"MiniMax API error: status_code={data.get('base_resp', {}).get('status_code')}"
            )

        lyrics_content = data.get("lyrics", "")
        if not lyrics_content:
            raise ValueError("MiniMax API returned empty content")

        return {
            "content": lyrics_content,
            "version": 1 if current_lyrics else 0,
            "updatedAt": datetime.now().isoformat(),
        }
    except Exception as e:
        raise


@music_bp.route("/lyrics", methods=["POST"])
def generate_or_improve_lyrics():
    data = request.get_json()
    theme = data.get("theme")
    mood = data.get("mood")
    genre = data.get("genre")
    current_lyrics = data.get("currentLyrics", "")
    conversation = data.get("conversation", [])
    user_request = data.get("userRequest", "")

    if not theme or not mood or not genre:
        return jsonify(
            {"success": False, "error": "缺少必要参数：theme, mood, genre"}
        ), 400

    try:
        lyrics = generate_lyrics_with_llm(
            theme, mood, genre, current_lyrics, conversation, user_request
        )
        return jsonify(
            {
                "success": True,
                "lyrics": lyrics,
                "message": "歌词已改进" if current_lyrics else "歌词已生成",
            }
        )
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"生成歌词失败: {str(e)}"}), 500


@music_bp.route("/generate", methods=["POST"])
def generate_music():
    data = request.get_json()
    lyrics = data.get("lyrics")
    style = data.get("style", "")

    if not lyrics:
        return jsonify({"success": False, "error": "缺少歌词内容"}), 400

    job_id = str(uuid.uuid4())
    uploads_dir = ensure_uploads_dir()
    output_file = os.path.join(uploads_dir, f"{job_id}.mp3")

    jobs[job_id] = {"status": "pending", "progress": 0, "outputFile": output_file}

    generation_prompt = style or "pop music, upbeat, catchy melody"
    escaped_lyrics = lyrics.replace('"', '\\"').replace("\n", "\\n")
    escaped_prompt = generation_prompt.replace('"', '\\"')

    command = f'mmx music generate --lyrics "{escaped_lyrics}" --prompt "{escaped_prompt}" --out "{output_file}" --quiet --non-interactive'

    jobs[job_id] = {"status": "generating", "progress": 5}

    try:
        subprocess.Popen(
            command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
    except Exception as e:
        print(f"Generation error: {e}")
        jobs[job_id] = {"status": "failed", "error": str(e)}
        return jsonify({"success": False, "error": str(e)}), 500

    import threading
    import time

    def update_progress():
        while True:
            job = jobs.get(job_id)
            if not job or job["status"] != "generating" or job["progress"] >= 90:
                break
            job["progress"] = min(90, job["progress"] + 10)
            time.sleep(3)
        if job and job["status"] == "generating":
            job["status"] = "completed"
            job["progress"] = 100

    threading.Thread(target=update_progress, daemon=True).start()

    return jsonify({"success": True, "jobId": job_id, "message": "音乐生成任务已启动"})


@music_bp.route("/status/<job_id>", methods=["GET"])
def get_status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"success": False, "error": "任务不存在"}), 404

    return jsonify(
        {
            "success": True,
            "status": job["status"],
            "progress": job.get("progress", 100),
            "error": job.get("error"),
            "outputFile": os.path.basename(job.get("outputFile", ""))
            if job.get("outputFile")
            else None,
        }
    )


@music_bp.route("/download/<filename>", methods=["GET"])
def download(filename):
    uploads_dir = ensure_uploads_dir()
    file_path = os.path.join(uploads_dir, filename)
    if not os.path.exists(file_path):
        return jsonify({"success": False, "error": "文件不存在"}), 404
    return send_file(file_path, mimetype="audio/mpeg")


@music_bp.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    theme = data.get("theme")
    mood = data.get("mood")
    genre = data.get("genre")
    message = data.get("message")
    current_lyrics = data.get("currentLyrics", "")
    conversation = data.get("conversation", [])

    if not message:
        return jsonify({"success": False, "error": "消息内容不能为空"}), 400

    conversation = list(conversation) if conversation else []
    conversation.append({"role": "user", "content": message})

    lyrics = generate_lyrics_with_llm(theme, mood, genre, current_lyrics, conversation)

    return jsonify({"success": True, "lyrics": lyrics, "message": "歌词已更新"})
