import os
import io
import zipfile
from flask import Blueprint, request, jsonify, send_file

export_bp = Blueprint("export", __name__)


def parse_lyrics_to_lrc(lyrics_text, title="未命名歌曲", artist="未知艺术家"):
    lines = lyrics_text.split("\n")
    lrc = ""

    lrc += f"[ti:{title}]\n"
    lrc += f"[ar:{artist}]\n"
    lrc += "[al:AI Workshop]\n"
    lrc += "[by:AI Workshop]\n"
    lrc += "[offset:0]\n"

    current_time = 0
    section_durations = {
        "Verse": 30,
        "Chorus": 25,
        "Bridge": 20,
        "Intro": 10,
        "Outro": 10,
    }

    for line in lines:
        trimmed_line = line.strip()
        if not trimmed_line:
            continue

        import re

        section_match = re.match(
            r"^\[(Verse|Chorus|Bridge|Intro|Outro)\]?$", trimmed_line, re.IGNORECASE
        )
        if section_match:
            section = section_match.group(1).capitalize()
            current_time += section_durations.get(section, 25)
            continue

        clean_line = re.sub(r"^\[.*?\]\s*", "", trimmed_line)
        if not clean_line:
            continue

        minutes = int(current_time // 60)
        seconds = int(current_time % 60)
        centiseconds = int((current_time % 1) * 100)

        timestamp = f"{minutes:02d}:{seconds:02d}.{centiseconds:02d}"
        lrc += f"[{timestamp}]{clean_line}\n"

        current_time += 3.5

    return lrc


@export_bp.route("/netease", methods=["POST"])
def export_for_netease():
    data = request.get_json()
    music_file_path = data.get("musicFilePath")
    lyrics = data.get("lyrics")
    title = data.get("title", "AI创作歌曲")
    artist = data.get("artist", "AI Artist")

    if not lyrics:
        return jsonify({"success": False, "error": "缺少歌词内容"}), 400

    song_title = title or "AI创作歌曲"
    song_artist = artist or "AI Artist"
    uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")

    lrc_content = parse_lyrics_to_lrc(lyrics, song_title, song_artist)

    music_file_name = (
        os.path.basename(music_file_path) if music_file_path else "music.mp3"
    )
    music_source_path = os.path.join(uploads_dir, music_file_name)

    music_exists = os.path.exists(music_source_path)

    metadata = {
        "title": song_title,
        "artist": song_artist,
        "album": "AI Workshop",
        "duration": "unknown",
        "format": "netEase",
        "exportedAt": "2026-04-13",
        "lyricsFormat": "LRC",
    }

    cover_placeholder = b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as zf:
        if music_exists:
            with open(music_source_path, "rb") as f:
                zf.writestr(f"{song_title}.mp3", f.read())

        zf.writestr(f"{song_title}.lrc", lrc_content)
        import json

        zf.writestr("metadata.json", json.dumps(metadata, indent=2, ensure_ascii=False))
        zf.writestr("cover.jpg", cover_placeholder)

    memory_file.seek(0)

    from flask import make_response

    response = make_response(
        send_file(
            memory_file,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"{song_title}_netease.zip",
        )
    )
    response.headers["Content-Disposition"] = (
        f"attachment; filename*=UTF-8''{song_title}_netease.zip"
    )
    return response
