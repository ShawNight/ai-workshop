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
from providers import call_llm, get_provider, get_current_music_provider
from config import get_proxies
from prompts import render

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
    """使用 LLM 生成歌名"""
    try:
        prompt = render('music/song_title.j2', theme=theme, mood=mood, genre=genre, lyrics_preview=lyrics_preview[:200])

        resp = call_llm(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=20,
            timeout=30,
        )

        if not resp.success or not resp.content:
            return sanitize_filename(theme) or "AI创作歌曲"

        title = resp.content.strip()
        title = re.sub(r'^["\']|["\']$', '', title)
        title = re.sub(r'\n.*', '', title)
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
    """使用音乐 Provider 专有 API 生成歌词"""
    music_provider_name = get_current_music_provider()
    provider = get_provider(music_provider_name)

    if not provider.api_key:
        raise ValueError("未配置音乐生成 API Key，请在 .env 文件中设置")

    if not provider.supports_music or not provider.lyrics_url:
        raise ValueError(f"当前音乐 provider ({provider.display_name}) 不支持歌词生成")

    try:
        response = requests.post(
            provider.lyrics_url,
            json={
                "mode": "write_full_song",
                "prompt": prompt_text,
            },
            headers={
                "Authorization": f"Bearer {provider.api_key}",
                "Content-Type": "application/json",
            },
            proxies=get_proxies(),
            timeout=60,
        )

        data = response.json()
        print(f"[歌词生成] API Response: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}")

        is_error, error_msg = provider.check_error(data)
        if is_error:
            raise ValueError(f"歌词生成 API error: {error_msg}")

        lyrics_content = data.get("lyrics", "")
        if not lyrics_content:
            raise ValueError("歌词生成 API returned empty content")

        song_title = data.get("song_title", "AI创作歌曲")
        print(f"[歌词生成] Title from API: {song_title}")

        return {
            "content": lyrics_content,
            "title": song_title,
            "updatedAt": datetime.now().isoformat(),
        }
    except Exception as e:
        raise


def save_music_to_db(job_id, title, user_description, prompt, lyrics, audio_file, duration_ms=0, lrc=""):
    """保存已完成的音乐到数据库"""
    with get_connection() as conn:
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        cursor.execute("""
            INSERT INTO music_history (id, title, user_description, prompt, lyrics, audio_file, duration_ms, lrc, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (job_id, title, user_description, prompt, lyrics, audio_file, duration_ms, lrc, now))
        conn.commit()


def _equal_distribute_lrc(lyrics_text, duration_seconds):
    """将歌词按行等距分配时间戳，作为 LRC 生成失败的兜底"""
    raw_lines = [l.strip() for l in (lyrics_text or '').split('\n') if l.strip()]
    if not raw_lines or duration_seconds <= 0:
        return ""

    SECTION_RE = re.compile(r'^\[(verse|chorus|bridge|pre[- ]?chorus|intro|outro|solo|instrumental|主歌|副歌|桥段|预副歌|前奏|尾奏|尾声|间奏|器乐)\]', re.IGNORECASE)
    content_lines = [l for l in raw_lines if not SECTION_RE.match(l)]
    if not content_lines:
        return ""

    # 前奏占 5%，尾奏占 3%，剩余给歌词行
    intro = max(0.5, duration_seconds * 0.05)
    outro = max(0.3, duration_seconds * 0.03)
    body = max(1.0, duration_seconds - intro - outro)
    per_line = body / len(content_lines)

    result_lines = []
    cur = intro
    for line in content_lines:
        mins = int(cur) // 60
        secs = cur - mins * 60
        ts = f"[{mins:02d}:{secs:05.2f}]"
        result_lines.append(f"{ts}{line}")
        cur += per_line
    return "\n".join(result_lines)


def generate_lrc_for_lyrics(lyrics, duration_seconds):
    """同步生成 LRC，失败回退等距分配。返回字符串（可能为空）"""
    if not lyrics:
        return ""

    duration_hint = ""
    if duration_seconds > 0:
        mins = int(duration_seconds) // 60
        secs = int(duration_seconds) % 60
        duration_hint = f"歌曲总时长为{mins}分{secs}秒（{duration_seconds:.2f}秒），"

    lines_for_count = [l.strip() for l in lyrics.strip().split('\n') if l.strip()]
    SECTION_RE = re.compile(r'^\[(verse|chorus|bridge|pre[- ]?chorus|intro|outro|solo|instrumental|主歌|副歌|桥段|预副歌|前奏|尾奏|尾声|间奏|器乐)\]', re.IGNORECASE)
    expected_content_lines = [l for l in lines_for_count if not SECTION_RE.match(l)]
    expected_count = len(expected_content_lines)

    try:
        prompts = render('music/lrc.j2', lyrics=lyrics, duration_hint=duration_hint)
        resp = call_llm(
            messages=[
                {"role": "system", "content": prompts['system']},
                {"role": "user", "content": prompts['user']}
            ],
            temperature=0.3,
            max_tokens=2048,
            timeout=60,
        )

        if not resp.success or not resp.content:
            print(f"[LRC生成] LLM 失败，使用等距分配: {resp.error if not resp.success else 'empty content'}")
            return _equal_distribute_lrc(lyrics, duration_seconds)

        content = resp.content.strip()
        content = re.sub(r'^```lrc\s*', '', content)
        content = re.sub(r'^```\s*', '', content)
        content = re.sub(r'\s*```$', '', content)

        # 校验 LRC：必须有时间戳行，且行数应大致匹配
        lrc_lines = [l for l in content.strip().split('\n') if re.match(r'\[\d{2}:\d{2}', l)]
        if not lrc_lines:
            print("[LRC生成] 无有效时间戳行，回退等距分配")
            return _equal_distribute_lrc(lyrics, duration_seconds)

        # 行数偏差超过 50% 视为不可信
        if expected_count > 0:
            ratio = len(lrc_lines) / expected_count
            if ratio < 0.5 or ratio > 2.0:
                print(f"[LRC生成] 行数偏差过大 ({len(lrc_lines)}/{expected_count})，回退等距分配")
                return _equal_distribute_lrc(lyrics, duration_seconds)

        # 校验时间戳不超过总时长（留 5% 容差）
        if duration_seconds > 0:
            last_line = lrc_lines[-1]
            m = re.match(r'\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]', last_line)
            if m:
                last_t = int(m.group(1)) * 60 + int(m.group(2)) + (int(m.group(3).ljust(3, '0')) / 1000 if m.group(3) else 0)
                if last_t > duration_seconds * 1.1:
                    print(f"[LRC生成] 末行时间戳 {last_t}s 超过总时长 {duration_seconds}s，回退等距分配")
                    return _equal_distribute_lrc(lyrics, duration_seconds)

        return content.strip()
    except Exception as e:
        print(f"[LRC生成] 异常，回退等距分配: {e}")
        return _equal_distribute_lrc(lyrics, duration_seconds)


@music_bp.route("/prompt", methods=["POST"])
def generate_prompt():
    """根据用户简单描述生成完整创作提示词"""
    data = request.get_json()
    user_description = data.get("description", "")

    if not user_description:
        return jsonify({"success": False, "error": "请输入歌曲描述"}), 400

    prompts = render('music/prompt_gen.j2', user_description=user_description)

    try:
        resp = call_llm(
            messages=[
                {"role": "system", "content": prompts['system']},
                {"role": "user", "content": prompts['user']}
            ],
            temperature=0.7,
            max_tokens=1024,
            timeout=30,
        )

        if not resp.success:
            return jsonify({"success": False, "error": resp.error}), 500

        content = resp.content.strip()

        # 尝试解析JSON
        try:
            content = re.sub(r'^```json\s*', '', content)
            content = re.sub(r'^```\s*', '', content)
            content = re.sub(r'\s*```$', '', content)

            json_match = re.search(r'\{[^{}]*\}', content)
            if json_match:
                content = json_match.group(0)

            prompt_data = json.loads(content)

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

    # 使用 Provider API 生成音乐
    def run_generation():
        try:
            import base64
            music_provider_name = get_current_music_provider()
            music_provider = get_provider(music_provider_name)

            if not music_provider.supports_music or not music_provider.api_key:
                jobs[job_id]["status"] = "failed"
                jobs[job_id]["error"] = "当前音乐 Provider 不支持音乐生成或未配置 API Key"
                return

            headers = {
                "Authorization": f"Bearer {music_provider.api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": music_provider.music_model,
                "prompt": generation_prompt,
                "lyrics": lyrics
            }

            response = requests.post(music_provider.music_url, headers=headers, json=payload, proxies=get_proxies(),
            timeout=300)
            result = response.json()

            # 检查业务错误
            is_error, error_msg = music_provider.check_error(result)
            if is_error:
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

            # 提取真实时长（毫秒）
            extra_info = result.get("extra_info") or {}
            duration_ms = int(extra_info.get("music_duration") or 0)
            duration_seconds = duration_ms / 1000.0 if duration_ms > 0 else 0
            jobs[job_id]["durationMs"] = duration_ms

            # 同步生成 LRC（带兜底）
            jobs[job_id]["progress"] = 80
            lrc_content = generate_lrc_for_lyrics(lyrics, duration_seconds)
            jobs[job_id]["lrc"] = lrc_content

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
                    os.path.basename(output_file),
                    duration_ms=duration_ms,
                    lrc=lrc_content,
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
            "durationMs": job.get("durationMs", 0),
            "lrc": job.get("lrc", ""),
        }
    )


@music_bp.route("/history", methods=["GET"])
def get_music_history():
    """获取已完成的音乐历史记录"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, user_description, prompt, lyrics, audio_file, duration_ms, lrc, created_at
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
                "durationMs": row[6] if row[6] is not None else 0,
                "lrc": row[7] or "",
                "createdAt": row[8]
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
    try:
        music_provider_name = get_current_music_provider()
        music_provider = get_provider(music_provider_name)
    except (KeyError, Exception) as e:
        return jsonify({
            "success": True,
            "available": False,
            "error": f"音乐 Provider 配置错误: {str(e)}"
        })

    if not music_provider.supports_music:
        return jsonify({
            "success": True,
            "available": False,
            "error": f"当前 Provider ({music_provider.display_name}) 不支持音乐生成"
        })

    if not music_provider.api_key:
        return jsonify({
            "success": True,
            "available": False,
            "error": "未配置音乐 Provider API Key"
        })

    try:
        headers = {
            "Authorization": f"Bearer {music_provider.api_key}",
            "Content-Type": "application/json"
        }
        response = requests.post(music_provider.music_url, headers=headers, json={}, proxies=get_proxies(),
        timeout=10)
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

    # 构建歌曲结构描述，帮助模型理解段落
    lines = [l.strip() for l in lyrics.strip().split('\n') if l.strip()]
    line_count = len(lines)

    duration_hint = ""
    if duration > 0:
        mins = int(duration) // 60
        secs = int(duration) % 60
        duration_hint = f"歌曲总时长为{mins}分{secs}秒（{duration}秒），"

    prompts = render('music/lrc.j2', lyrics=lyrics, duration_hint=duration_hint)

    try:
        resp = call_llm(
            messages=[
                {"role": "system", "content": prompts['system']},
                {"role": "user", "content": prompts['user']}
            ],
            temperature=0.3,
            max_tokens=2048,
            timeout=30,
        )

        if not resp.success:
            return jsonify({"success": False, "error": resp.error}), 500

        content = resp.content.strip()

        # 清理可能的 markdown 代码块标记
        content = re.sub(r'^```lrc\s*', '', content)
        content = re.sub(r'^```\s*', '', content)
        content = re.sub(r'\s*```$', '', content)

        # 验证 LRC 格式
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
    """局部修改歌词 - 使用 LLM"""
    data = request.get_json()
    full_lyrics = data.get("fullLyrics", "")
    selected_text = data.get("selectedText", "")
    suggestion = data.get("suggestion", "")

    if not selected_text:
        return jsonify({"success": False, "error": "请先选择要修改的歌词部分"}), 400

    if not suggestion:
        return jsonify({"success": False, "error": "请输入修改建议"}), 400

    # 构建 Prompt - 不依赖mood/genre，让AI自动判断风格
    prompt = render('music/lyrics_modify.j2', full_lyrics=full_lyrics, selected_text=selected_text, suggestion=suggestion)

    try:
        resp = call_llm(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=200,
            timeout=30,
        )

        if not resp.success:
            return jsonify({"success": False, "error": resp.error}), 500

        new_content = resp.content.strip()
        new_content = re.sub(r'^修改后的内容[：:]\s*', '', new_content)
        new_content = re.sub(r'^["\']|["\']$', '', new_content)

        if new_content:
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