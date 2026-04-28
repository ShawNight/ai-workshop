import os
import uuid
import subprocess
import threading
import time
import shutil
import re
import json
from flask import Blueprint, request, jsonify, send_file
import requests
from datetime import datetime
from database import get_connection
from config import LLM_API_KEY, LLM_CHAT_URL, LLM_LYRICS_URL, LLM_MUSIC_URL, LLM_LYRICS_MODEL, LLM_CHAT_MODEL, LLM_MUSIC_MODEL, get_proxies

music_bp = Blueprint("music", __name__)


# 任务状态存储（带过期清理）
jobs = {}
JOB_EXPIRY_SECONDS = 3600  # 1小时后自动清理


def cleanup_expired_jobs():
    """清理过期任务"""
    now = time.time()
    expired = [jid for jid, job in jobs.items()
               if now - job.get("created_at", 0) > JOB_EXPIRY_SECONDS]
    for jid in expired:
        del jobs[jid]


def ensure_uploads_dir():
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def sanitize_filename(name):
    """清理文件名，移除非法字符"""
    # 移除或替换非法字符
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name)
    # 移除前后空格
    name = name.strip()
    # 如果为空，使用默认名称
    if not name:
        name = "AI创作歌曲"
    # 限制长度
    if len(name) > 50:
        name = name[:50]
    return name


def generate_song_title_with_llm(theme, mood, genre, lyrics_preview):
    """使用MiniMax文本模型生成歌名"""
    if not LLM_API_KEY:
        return sanitize_filename(theme) or "AI创作歌曲"

    try:
        prompt = f"""请根据以下信息为歌曲生成一个简短、优美的歌名（不超过10个字）：

主题：{theme}
风格：{mood} {genre}
歌词片段：{lyrics_preview[:200]}

只返回歌名本身，不要加任何前缀、引号或解释。"""

        response = requests.post(
            LLM_CHAT_URL,
            json={
                "model": LLM_CHAT_MODEL,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 20
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=30,
        )

        data = response.json()
        if data.get("base_resp", {}).get("status_code") != 0:
            print(f"[歌名生成] API error: {data}")
            return sanitize_filename(theme) or "AI创作歌曲"

        # 从choices中获取歌名
        choices = data.get("choices", [])
        if choices and len(choices) > 0:
            title = choices[0].get("message", {}).get("content", "").strip()
            # 清理可能的引号和多余字符
            title = re.sub(r'^["\']|["\']$', '', title)
            title = re.sub(r'\n.*', '', title)  # 只取第一行
            if title:
                return sanitize_filename(title)

        return sanitize_filename(theme) or "AI创作歌曲"
    except Exception as e:
        print(f"[歌名生成] Error: {e}")
        return sanitize_filename(theme) or "AI创作歌曲"


def extract_song_title(lyrics_content, theme=""):
    """从歌词内容中提取歌名"""
    lines = lyrics_content.strip().split('\n')

    # 尝试匹配多种歌名格式
    for line in lines[:10]:  # 检查前10行
        line_stripped = line.strip()

        # 格式1: 歌名：xxx 或 歌名: xxx
        match = re.match(r'歌名[：:]\s*(.+)', line_stripped)
        if match:
            title = match.group(1).strip()
            # 清除可能的引号
            title = re.sub(r'^["\']|["\']$', '', title)
            return sanitize_filename(title)

        # 格式2: 标题：xxx
        match = re.match(r'标题[：:]\s*(.+)', line_stripped)
        if match:
            return sanitize_filename(match.group(1).strip())

        # 格式3: Title: xxx 或 TITLE: xxx
        match = re.match(r'Title[：:]\s*(.+)', line_stripped, re.IGNORECASE)
        if match:
            return sanitize_filename(match.group(1).strip())

        # 格式4: 《歌名》 格式
        match = re.search(r'《(.+)》', line_stripped)
        if match:
            return sanitize_filename(match.group(1).strip())

        # 格式5: 第一行非结构标识的内容（不含[Verse]等）
        if line_stripped and not re.match(r'^\[.*\]', line_stripped):
            # 检查是否是有效的歌名（不太长，不含特殊歌词标记）
            if len(line_stripped) < 30 and not re.search(r'(verse|chorus|bridge|intro|outro)', line_stripped, re.IGNORECASE):
                # 如果第一行看起来像歌名（短且有意义）
                if len(line_stripped) > 0 and not line_stripped.startswith('#'):
                    return sanitize_filename(line_stripped)

    # 如果都找不到，使用主题作为歌名
    if theme:
        return sanitize_filename(theme)

    return "AI创作歌曲"


def generate_lyrics_with_llm(prompt_text):
    """使用MiniMax生成歌词"""
    if not LLM_API_KEY:
        raise ValueError("未配置 MiniMax API Key，请在 .env 文件中设置 LLM_API_KEY")

    try:
        response = requests.post(
            LLM_LYRICS_URL,
            json={
                "mode": "write_full_song",
                "prompt": prompt_text,
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=60,
        )

        data = response.json()
        print(f"[MiniMax API] Response: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}")

        if data.get("base_resp", {}).get("status_code") != 0:
            raise ValueError(
                f"MiniMax API error: status_code={data.get('base_resp', {}).get('status_code')}"
            )

        lyrics_content = data.get("lyrics", "")
        if not lyrics_content:
            raise ValueError("MiniMax API returned empty content")

        # 直接使用 API 返回的歌名
        song_title = data.get("song_title", "AI创作歌曲")
        print(f"[MiniMax API] Title from API: {song_title}")

        return {
            "content": lyrics_content,
            "title": song_title,
            "updatedAt": datetime.now().isoformat(),
        }
    except Exception as e:
        raise


def save_music_to_db(job_id, title, user_description, prompt, lyrics, audio_file):
    """保存已完成的音乐到数据库"""
    with get_connection() as conn:
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        cursor.execute("""
            INSERT INTO music_history (id, title, user_description, prompt, lyrics, audio_file, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (job_id, title, user_description, prompt, lyrics, audio_file, now))
        conn.commit()


@music_bp.route("/prompt", methods=["POST"])
def generate_prompt():
    """根据用户简单描述生成完整创作提示词"""
    data = request.get_json()
    user_description = data.get("description", "")

    if not user_description:
        return jsonify({"success": False, "error": "请输入歌曲描述"}), 400

    if not LLM_API_KEY:
        return jsonify({"success": False, "error": "未配置 MiniMax API Key"}), 500

    system_msg = """你是一个JSON生成器。你必须直接输出JSON对象，不要输出任何思考过程、解释或额外文字。
不要使用<think>标签，不要推理，直接输出JSON。"""

    prompt_text = f"""根据用户描述生成歌曲创作提示词。

用户描述：{user_description}

直接返回如下格式的JSON，不要包含任何其他文字：
{{"theme":"春天","mood":"欢快","genre":"流行","description":"描述万物复苏的美好景象"}}"""

    try:
        response = requests.post(
            LLM_CHAT_URL,
            json={
                "model": LLM_CHAT_MODEL,
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt_text}
                ],
                "temperature": 0.7,
                "max_tokens": 1024
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=30,
        )

        result = response.json()
        print(f"[提示词生成] API Response: {json.dumps(result, ensure_ascii=False)[:800]}")

        # MiniMax API 返回格式可能有多种
        # 标准 OpenAI 格式: choices[0].message.content
        # MiniMax 格式: choices[0].text 或 reply
        content = None

        # 尝试多种响应格式
        if "choices" in result:
            choice = result["choices"][0]
            if "message" in choice:
                content = choice["message"].get("content", "")
            elif "text" in choice:
                content = choice.get("text", "")

        if "reply" in result:
            content = result.get("reply", "")

        if not content:
            # 检查是否有错误
            if "error" in result:
                error_msg = result.get("error", {}).get("message", "API调用失败")
                return jsonify({"success": False, "error": error_msg}), 500

            return jsonify({"success": False, "error": "AI未返回有效内容"}), 500

        content = content.strip()

        # 尝试解析JSON
        try:
            # 清理可能的markdown代码块标记
            content = re.sub(r'^```json\s*', '', content)
            content = re.sub(r'^```\s*', '', content)
            content = re.sub(r'\s*```$', '', content)

            # 尝试从内容中提取JSON对象
            json_match = re.search(r'\{[^{}]*\}', content)
            if json_match:
                content = json_match.group(0)

            prompt_data = json.loads(content)

            # 确保必要字段存在
            return jsonify({
                "success": True,
                "prompt": {
                    "theme": prompt_data.get("theme", user_description),
                    "mood": prompt_data.get("mood", "欢快"),
                    "genre": prompt_data.get("genre", "流行"),
                    "description": prompt_data.get("description", "")
                },
                "message": "提示词已生成"
            })
        except json.JSONDecodeError:
                # 如果JSON解析失败，返回原始内容让用户编辑
                return jsonify({
                    "success": True,
                    "prompt": {
                        "theme": user_description,
                        "mood": "欢快",
                        "genre": "流行",
                        "description": content
                    },
                    "message": "提示词已生成（请手动调整）"
                })

        return jsonify({"success": False, "error": "AI未返回内容"}), 500

    except requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "请求超时，请重试"}), 500
    except Exception as e:
        print(f"[提示词生成] Error: {e}")
        return jsonify({"success": False, "error": f"生成失败: {str(e)}"}), 500


@music_bp.route("/lyrics", methods=["POST"])
def generate_or_improve_lyrics():
    data = request.get_json()
    prompt = data.get("prompt", "")

    if not prompt:
        return jsonify({"success": False, "error": "请先输入创作提示词"}), 400

    try:
        lyrics = generate_lyrics_with_llm(prompt)
        return jsonify({
            "success": True,
            "lyrics": lyrics,
            "message": "歌词已生成",
        })
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"生成歌词失败: {str(e)}"}), 500


@music_bp.route("/generate", methods=["POST"])
def generate_music():
    data = request.get_json()
    lyrics = data.get("lyrics")
    style = data.get("style", "")
    title = data.get("title", "AI创作歌曲")

    if not lyrics:
        return jsonify({"success": False, "error": "缺少歌词内容"}), 400

    job_id = str(uuid.uuid4())
    uploads_dir = ensure_uploads_dir()

    # 使用歌名作为文件名
    safe_title = sanitize_filename(title)
    output_file = os.path.join(uploads_dir, f"{safe_title}_{job_id[:8]}.mp3")

    # 初始化任务状态
    jobs[job_id] = {
        "status": "pending",
        "progress": 0,
        "outputFile": output_file,
        "title": safe_title,
        "user_description": data.get("userDescription", ""),
        "prompt": data.get("prompt", ""),
        "lyrics": lyrics,
        "created_at": time.time(),
        "error": None
    }

    generation_prompt = style or "pop music, upbeat, catchy melody"

    jobs[job_id]["status"] = "generating"
    jobs[job_id]["progress"] = 5

    # 使用 MiniMax API 生成音乐
    def run_generation():
        try:
            import base64
            headers = {
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": LLM_MUSIC_MODEL,
                "prompt": generation_prompt,
                "lyrics": lyrics
            }

            response = requests.post(LLM_MUSIC_URL, headers=headers, json=payload, proxies=get_proxies(),
            timeout=300)
            result = response.json()

            # 检查业务错误
            base_resp = result.get("base_resp", {})
            if base_resp.get("status_code") != 0:
                error_msg = base_resp.get("status_msg", "音乐生成失败")
                jobs[job_id]["status"] = "failed"
                jobs[job_id]["error"] = error_msg
                return

            # 直接获取 base64 音频数据
            data = result.get("data", {})
            audio_b64 = data.get("audio")
            if not audio_b64:
                jobs[job_id]["status"] = "failed"
                jobs[job_id]["error"] = "未获取到音频数据"
                return

            # music-2.6 返回的是十六进制字符串，不是 base64
            audio_bytes = bytes.fromhex(audio_b64)
            with open(output_file, "wb") as f:
                f.write(audio_bytes)

            jobs[job_id]["status"] = "completed"
            jobs[job_id]["progress"] = 100

            # 保存到数据库历史记录
            try:
                save_music_to_db(
                    job_id,
                    safe_title,
                    jobs[job_id].get("user_description", ""),
                    jobs[job_id].get("prompt", ""),
                    lyrics,
                    os.path.basename(output_file)
                )
            except Exception as e:
                print(f"[警告] 保存音乐历史失败: {e}")

        except requests.exceptions.Timeout:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = "音乐生成请求超时"
        except Exception as e:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = str(e)

    # 在后台线程中运行生成
    threading.Thread(target=run_generation, daemon=True).start()

    return jsonify({"success": True, "jobId": job_id, "message": "音乐生成任务已启动"})


@music_bp.route("/status/<job_id>", methods=["GET"])
def get_status(job_id):
    # 定期清理过期任务
    cleanup_expired_jobs()

    job = jobs.get(job_id)
    if not job:
        return jsonify({"success": False, "error": "任务不存在或已过期"}), 404

    return jsonify(
        {
            "success": True,
            "status": job["status"],
            "progress": job.get("progress", 100),
            "error": job.get("error"),
            "outputFile": os.path.basename(job.get("outputFile", ""))
            if job.get("outputFile")
            else None,
            "title": job.get("title", ""),
        }
    )


@music_bp.route("/history", methods=["GET"])
def get_music_history():
    """获取已完成的音乐历史记录"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, user_description, prompt, lyrics, audio_file, created_at
            FROM music_history
            ORDER BY created_at DESC
            LIMIT 50
        """)
        rows = cursor.fetchall()

        history = []
        for row in rows:
            history.append({
                "id": row[0],
                "title": row[1],
                "userDescription": row[2],
                "prompt": row[3],
                "lyrics": row[4],
                "audioUrl": f"/api/music/download/{row[5]}",
                "createdAt": row[6]
            })

        return jsonify({"success": True, "history": history})


@music_bp.route("/history/<music_id>", methods=["DELETE"])
def delete_music_history(music_id):
    """删除音乐历史记录"""
    with get_connection() as conn:
        cursor = conn.cursor()

        # 先获取音频文件路径，以便删除文件
        cursor.execute("SELECT audio_file FROM music_history WHERE id = ?", (music_id,))
        row = cursor.fetchone()

        if row:
            audio_file = row[0]
            uploads_dir = ensure_uploads_dir()
            file_path = os.path.join(uploads_dir, audio_file)

            # 删除文件
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass

            # 删除数据库记录
            cursor.execute("DELETE FROM music_history WHERE id = ?", (music_id,))
            conn.commit()

            return jsonify({"success": True, "message": "已删除"})

        return jsonify({"success": False, "error": "记录不存在"}), 404


@music_bp.route("/music-check", methods=["GET"])
def check_music_api():
    """检查音乐生成 API 是否可用"""
    if not LLM_API_KEY:
        return jsonify({
            "success": True,
            "available": False,
            "error": "未配置 LLM_API_KEY，音乐生成 API 不可用"
        })

    try:
        # 用轻量请求测试 API 可达性
        headers = {
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json"
        }
        response = requests.post(LLM_MUSIC_URL, headers=headers, json={}, proxies=get_proxies(),
        timeout=10)
        # 只要有响应（即使是参数错误 4xx），说明 API 可达
        if response.status_code < 500:
            return jsonify({
                "success": True,
                "available": True
            })
        else:
            return jsonify({
                "success": True,
                "available": False,
                "error": "音乐生成 API 返回服务端错误"
            })
    except requests.exceptions.ConnectionError:
        return jsonify({
            "success": True,
            "available": False,
            "error": "无法连接到音乐生成 API，请检查网络"
        })
    except requests.exceptions.Timeout:
        return jsonify({
            "success": True,
            "available": False,
            "error": "音乐生成 API 响应超时"
        })
    except Exception as e:
        return jsonify({
            "success": True,
            "available": False,
            "error": f"音乐生成 API 检查失败: {str(e)}"
        })


@music_bp.route("/download/<filename>", methods=["GET"])
def download(filename):
    uploads_dir = ensure_uploads_dir()
    file_path = os.path.join(uploads_dir, filename)
    if not os.path.exists(file_path):
        return jsonify({"success": False, "error": "文件不存在"}), 404
    return send_file(file_path, mimetype="audio/mpeg")


@music_bp.route("/lrc", methods=["POST"])
def generate_lrc():
    """根据歌词文本和音频时长生成 LRC 格式时间戳歌词"""
    data = request.get_json()
    lyrics = data.get("lyrics", "")
    duration = data.get("duration", 0)

    if not lyrics:
        return jsonify({"success": False, "error": "缺少歌词内容"}), 400

    if not LLM_API_KEY:
        return jsonify({"success": False, "error": "未配置 MiniMax API Key"}), 500

    # 构建歌曲结构描述，帮助模型理解段落
    lines = [l.strip() for l in lyrics.strip().split('\n') if l.strip()]
    line_count = len(lines)

    duration_hint = ""
    if duration > 0:
        mins = int(duration) // 60
        secs = int(duration) % 60
        duration_hint = f"歌曲总时长为{mins}分{secs}秒（{duration}秒），"

    prompt = f"""你是一位专业的歌词时间标注专家。请为以下歌词生成 LRC 格式的时间戳。

{duration_hint}请根据段落结构和歌词内容，为每一行歌词分配合理的时间戳。

要求：
1. 返回标准 LRC 格式，每行格式为 [mm:ss.xx]歌词内容
2. 前奏/间奏/尾奏的纯器乐部分用 [mm:ss.xx][Instrumental] 标注
3. 时间戳必须严格递增
4. 确保最后一行时间戳不超过总时长
5. 只返回 LRC 内容，不要任何解释

歌词内容：
{lyrics}"""

    try:
        response = requests.post(
            LLM_CHAT_URL,
            json={
                "model": LLM_CHAT_MODEL,
                "messages": [
                    {"role": "system", "content": "你是LRC歌词时间标注专家，只输出LRC格式内容，不输出任何解释或思考过程。"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 2048
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=30,
        )

        result = response.json()
        print(f"[LRC生成] API Response: {json.dumps(result, ensure_ascii=False)[:500]}")

        if result.get("base_resp", {}).get("status_code") != 0:
            error_msg = result.get("base_resp", {}).get("status_msg", "API调用失败")
            return jsonify({"success": False, "error": error_msg}), 500

        content = None
        choices = result.get("choices", [])
        if choices:
            content = choices[0].get("message", {}).get("content", "").strip()

        if not content:
            return jsonify({"success": False, "error": "AI未返回有效内容"}), 500

        # 清理可能的 markdown 代码块标记
        content = re.sub(r'^```lrc\s*', '', content)
        content = re.sub(r'^```\s*', '', content)
        content = re.sub(r'\s*```$', '', content)

        # 验证 LRC 格式：至少有一行带时间戳
        lrc_lines = [l for l in content.strip().split('\n') if re.match(r'\[\d{2}:\d{2}', l)]
        if not lrc_lines:
            return jsonify({"success": False, "error": "生成的LRC格式无效"}), 500

        return jsonify({
            "success": True,
            "lrc": content.strip(),
            "lineCount": len(lrc_lines)
        })

    except requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "请求超时，请重试"}), 500
    except Exception as e:
        print(f"[LRC生成] Error: {e}")
        return jsonify({"success": False, "error": f"LRC生成失败: {str(e)}"}), 500


@music_bp.route("/lyrics/modify", methods=["POST"])
def modify_lyrics():
    """局部修改歌词 - 使用 MiniMax Chat API"""
    data = request.get_json()
    full_lyrics = data.get("fullLyrics", "")
    selected_text = data.get("selectedText", "")
    suggestion = data.get("suggestion", "")

    if not selected_text:
        return jsonify({"success": False, "error": "请先选择要修改的歌词部分"}), 400

    if not suggestion:
        return jsonify({"success": False, "error": "请输入修改建议"}), 400

    if not LLM_API_KEY:
        return jsonify({"success": False, "error": "未配置 MiniMax API Key"}), 500

    # 构建 Prompt - 不依赖mood/genre，让AI自动判断风格
    prompt = f"""你是一位专业的歌词修改助手。用户希望修改歌曲中的部分歌词。

当前歌曲完整歌词：
{full_lyrics}

用户选中要修改的部分：
"{selected_text}"

用户修改意见：
"{suggestion}"

请根据用户的修改意见和原歌曲风格，修改选中的这部分歌词。要求：
1. 只返回修改后的新内容（替换选中部分的内容）
2. 保持与原歌曲整体风格一致
3. 如果选中的是一行或多行，返回相同行数的内容
4. 不要添加任何解释或前缀，直接返回修改后的歌词内容

修改后的内容："""

    try:
        response = requests.post(
            LLM_CHAT_URL,
            json={
                "model": LLM_CHAT_MODEL,  # 使用支持的模型
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 200
            },
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=30,
        )

        result = response.json()
        print(f"[局部修改] API Response: {json.dumps(result, ensure_ascii=False)[:300]}")

        if result.get("base_resp", {}).get("status_code") != 0:
            error_msg = result.get("base_resp", {}).get("status_msg", "API调用失败")
            # 如果模型不支持，尝试使用默认模型
            if "not support model" in error_msg.lower():
                # 尝试另一种方式：直接返回建议让用户手动修改
                return jsonify({
                    "success": False,
                    "error": "当前API不支持此模型，请手动修改歌词",
                    "suggestion": suggestion
                }), 500
            return jsonify({"success": False, "error": error_msg}), 500

        # 提取修改后的内容
        choices = result.get("choices", [])
        if choices:
            new_content = choices[0].get("message", {}).get("content", "").strip()
            # 清理可能的格式标记
            new_content = re.sub(r'^修改后的内容[：:]\s*', '', new_content)
            new_content = re.sub(r'^["\']|["\']$', '', new_content)

            if new_content:
                # 拼接完整歌词：替换选中部分
                new_lyrics = full_lyrics.replace(selected_text, new_content)
                return jsonify({
                    "success": True,
                    "modifiedText": new_content,
                    "fullLyrics": new_lyrics,
                    "message": "歌词已修改"
                })

        return jsonify({"success": False, "error": "AI未返回修改内容"}), 500

    except requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "请求超时，请重试"}), 500
    except Exception as e:
        print(f"[局部修改] Error: {e}")
        return jsonify({"success": False, "error": f"修改失败: {str(e)}"}), 500