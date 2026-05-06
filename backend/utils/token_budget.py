import re

CHINESE_CHARS_PER_TOKEN = 1.5

def estimate_tokens(text):
    if not text:
        return 0
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    other_chars = len(text) - chinese_chars
    return int(chinese_chars / CHINESE_CHARS_PER_TOKEN + other_chars / 4)

def allocate_context_budget(total_budget=6000, summary_ratio=0.25, prev_ratio=0.50, setting_ratio=0.25):
    return {
        'summary': int(total_budget * summary_ratio),
        'previous': int(total_budget * prev_ratio),
        'setting': int(total_budget * setting_ratio),
    }

def smart_truncate(text, max_tokens, preserve_first=True, preserve_last=True):
    if estimate_tokens(text) <= max_tokens:
        return text
    paragraphs = text.split('\n')
    if len(paragraphs) <= 3:
        half = len(text) // 2
        return text[:half] + '\n...(已截断)...\n'
    target_chars = int(max_tokens * CHINESE_CHARS_PER_TOKEN)
    if preserve_first and preserve_last:
        first_para = paragraphs[0]
        last_para = paragraphs[-1]
        budget = target_chars - len(first_para) - len(last_para) - 20
        if budget < 100:
            return first_para + '\n...(前文摘要)...\n' + last_para
        middle = '\n'.join(paragraphs[1:-1])[:budget]
        return first_para + '\n...(前文摘要)...\n' + middle + '\n...(已截断)...\n' + last_para
    if preserve_first:
        return text[:target_chars] + '\n...(已截断)'
    if preserve_last:
        return '...(前文截断)...\n' + text[-target_chars:]
    return text[:target_chars] + '\n...(已截断)'
