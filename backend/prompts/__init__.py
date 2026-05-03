import os
from jinja2 import Environment, FileSystemLoader

_PROMPTS_DIR = os.path.dirname(__file__)

_env = Environment(
    loader=FileSystemLoader(_PROMPTS_DIR),
    keep_trailing_newline=True,
    trim_blocks=True,
    lstrip_blocks=True,
)


def render(name, **kwargs):
    """渲染提示词模板。

    Args:
        name: 模板路径，如 'novel/chapter.j2'
        **kwargs: 模板变量

    Returns:
        str: 如果模板只有 user 内容，返回渲染后的字符串
        dict: 如果模板包含 ---SYSTEM---/---USER--- 分隔符，返回
              {'system': '...', 'user': '...'}
    """
    template = _env.get_template(name)
    rendered = template.render(**kwargs)

    if '---SYSTEM---' in rendered:
        parts = rendered.split('---USER---', 1)
        system = parts[0].replace('---SYSTEM---', '', 1).strip()
        user = parts[1].strip() if len(parts) > 1 else ''
        return {'system': system, 'user': user}

    return rendered