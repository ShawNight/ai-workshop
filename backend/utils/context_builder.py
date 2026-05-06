import re
from utils.token_budget import estimate_tokens, smart_truncate, allocate_context_budget

def build_chapter_context(project_data, current_chapter_index):
    chapters = project_data.get('chapters', [])
    characters = project_data.get('characters', [])
    relationships = project_data.get('relationships', [])
    locations = project_data.get('locations', [])
    outline = project_data.get('outline', [])

    budget = allocate_context_budget()

    summary_parts = []
    current_summary_tokens = 0
    for i, ch in enumerate(chapters):
        if i >= current_chapter_index:
            break
        is_written = bool(ch.get('content', '').strip())
        status_tag = "[已写]" if is_written else "[未写]"
        desc = ch.get('description', '')
        if is_written and desc:
            summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」{status_tag}：{desc}"
        elif is_written:
            summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」{status_tag}"
        else:
            summary_line = f"第{i+1}章「{ch.get('title', '未命名')}」{status_tag}：{desc}"
        if current_summary_tokens + estimate_tokens(summary_line) > budget['summary']:
            summary_parts.insert(0, f"...(省略了前{i}章中更早的章节)")
            break
        summary_parts.append(summary_line)
        current_summary_tokens += estimate_tokens(summary_line)
    summary_text = '\n'.join(summary_parts) if summary_parts else ''

    prev_content = ''
    if current_chapter_index > 0 and current_chapter_index <= len(chapters):
        raw_prev = chapters[current_chapter_index - 1].get('content', '')
        if raw_prev:
            plain_prev = raw_prev.replace('<br>', '\n').replace('</p>', '\n')
            plain_prev = re.sub(r'<[^>]+>', '', plain_prev)
            prev_content = smart_truncate(plain_prev, budget['previous'], preserve_first=False, preserve_last=True)

    setting_parts = []
    current_setting_tokens = 0

    relevant_char_ids = set()
    for ch in chapters[max(0, current_chapter_index - 3):current_chapter_index]:
        content = ch.get('content', '')
        for char in characters:
            if char.get('name') and char['name'] in content:
                relevant_char_ids.add(char.get('id'))
    for char in characters[:10]:
        relevant_char_ids.add(char.get('id'))

    for char in characters:
        if char.get('id') in relevant_char_ids:
            line = f"- {char.get('name', '')}({char.get('role', '角色')})：{char.get('description', '')}"
            if char.get('traits'):
                traits = char.get('traits', [])
                if isinstance(traits, list):
                    line += f" 性格：{', '.join(traits)}"
                else:
                    line += f" 性格：{traits}"
            if current_setting_tokens + estimate_tokens(line) > budget['setting'] * 0.5:
                break
            setting_parts.append(line)
            current_setting_tokens += estimate_tokens(line)

    for rel in relationships:
        from_name = next((c.get('name', '?') for c in characters if c.get('id') == rel.get('fromId')), '?')
        to_name = next((c.get('name', '?') for c in characters if c.get('id') == rel.get('toId')), '?')
        if from_name == '?' and to_name == '?':
            continue
        line = f"- {from_name} ←{rel.get('type', '关系')}→ {to_name}：{rel.get('description', '')}"
        if current_setting_tokens + estimate_tokens(line) > budget['setting'] * 0.75:
            break
        setting_parts.append(line)
        current_setting_tokens += estimate_tokens(line)

    for loc in locations[:5]:
        line = f"- 📍{loc.get('name', '')}({loc.get('type', '')})：{loc.get('description', '')}"
        if current_setting_tokens + estimate_tokens(line) > budget['setting']:
            break
        setting_parts.append(line)
        current_setting_tokens += estimate_tokens(line)

    setting_text = '\n'.join(setting_parts) if setting_parts else ''

    current_outline = ''
    if 0 <= current_chapter_index < len(outline):
        outline_item = outline[current_chapter_index]
        if isinstance(outline_item, dict):
            current_outline = outline_item.get('description', '')
        elif isinstance(outline_item, str):
            current_outline = outline_item

    return {
        'summary': summary_text,
        'previous_content': prev_content,
        'settings': setting_text,
        'current_outline': current_outline,
        'total_chapters': len(chapters),
        'current_chapter_index': current_chapter_index,
    }