import re


def extract_package_name(url: str) -> str:
    """从 Google Play URL 提取包名。

    支持格式:
    - https://play.google.com/store/apps/details?id=com.abc.def
    - https://play.google.com/store/apps/details?id=com.abc.def&hl=zh
    - https://play.google.com/store/apps/details/com.abc.def

    返回包名字符串，无法提取时抛出 ValueError。
    """
    # 匹配 ?id=xxx 或 &id=xxx 格式
    m = re.search(r"[?&]id=([^&#]+)", url)
    if m:
        return m.group(1)

    # 匹配 /details/xxx 路径格式
    m = re.search(r"/details/([^/?#]+)", url)
    if m:
        return m.group(1)

    raise ValueError(f"无法从 URL 提取包名: {url}")


def detect_format(width: int, height: int) -> str:
    """根据图片宽高比判断 Google Ads 规格。

    返回: "landscape" | "square" | "portrait"
    """
    ratio = width / height
    if ratio > 1.3:
        return "landscape"
    elif ratio <= 0.8:
        return "portrait"
    else:
        return "square"
