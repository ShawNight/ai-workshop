"""API Key 加密存储工具"""
import os
from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    """获取 Fernet 实例，密钥来自 PROVIDER_ENCRYPTION_KEY 环境变量"""
    key = os.getenv("PROVIDER_ENCRYPTION_KEY", "")
    if not key:
        key = Fernet.generate_key().decode()
        _write_key_to_env(key)
    return Fernet(key.encode() if isinstance(key, str) else key)


def _write_key_to_env(key: str):
    """将自动生成的加密密钥写入 .env"""
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            lines = f.readlines()

    # 移除旧的 PROVIDER_ENCRYPTION_KEY 行
    lines = [l for l in lines if not l.startswith("PROVIDER_ENCRYPTION_KEY=")]

    # 追加新密钥
    lines.append(f"\nPROVIDER_ENCRYPTION_KEY={key}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    # 更新当前进程的环境变量
    os.environ["PROVIDER_ENCRYPTION_KEY"] = key


def encrypt_api_key(plain: str) -> str:
    """加密 API Key"""
    if not plain:
        return ""
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_api_key(cipher: str) -> str:
    """解密 API Key"""
    if not cipher:
        return ""
    return _get_fernet().decrypt(cipher.encode()).decode()


def mask_api_key(key: str) -> str:
    """对 API Key 进行脱敏展示"""
    if not key or len(key) < 8:
        return "***"
    return key[:4] + "..." + key[-4:]
