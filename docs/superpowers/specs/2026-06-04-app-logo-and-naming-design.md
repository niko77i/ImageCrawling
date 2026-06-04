# 应用 Logo 爬取 + 广告图片可选 + 命名优化

日期：2026-06-04

## 需求概述

1. 新增爬取 Google Play 页面 `<div class="Mqg6jb Mhrnjf">` 中第一张图片（应用图标/Logo），保存到 `包logo/` 子文件夹，不做缩放，保持原图
2. 增加前端开关：是否下载 Google Ads 规格图片（缩放处理），默认开启保持向后兼容
3. 图片命名从 `img_001.png` 改为 `包名_001.png` 格式

## 变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `py/scraper.py` | 新增函数 | `scrape_logo(url)` — 提取 `<div class="Mqg6jb Mhrnjf">` 内第一张图片 URL |
| `py/resizer.py` | 新增函数 | `save_logo(img_url, save_dir, filename)` — 下载原图直接保存 PNG |
| `py/main.py` | 修改 | 接收 `include_ads_images` 参数，调用 logo 流程，图片命名改用包名前缀 |
| `index.html` | 修改 | 新增复选框控件 |
| `js/app.js` | 修改 | 传递复选框状态，更新结果展示 |
| `css/style.css` | 可选 | 复选框样式微调 |

## 详细设计

### scraper.py — scrape_logo()

```python
def scrape_logo(url: str) -> str | None:
    """提取 Google Play 页面 <div class="Mqg6jb Mhrnjf"> 中第一张 <img> 的 src。
    返回绝对 URL，未找到返回 None。
    不抛异常 — logo 缺失不应阻断主流程。
    """
```

- 复用已有的 headers 和 requests 会话模式
- 查找目标：`soup.find("div", class_="Mqg6jb Mhrnjf")`
- 取第一个 `<img>` 标签的 `src`，补全为绝对路径
- 不对 logo URL 做 `_upgrade_image_url` 升级（logo 原图通常已足够清晰）
- 返回 `None` 而非抛异常（logo 是附加功能，不应中断广告图片爬取）

### resizer.py — save_logo()

```python
def save_logo(img_url: str, save_dir: str, filename: str) -> dict:
    """下载 logo 原图并保存为 PNG，不做缩放。
    返回格式与 process_image() 一致。
    """
```

- 与 `process_image` 相同的前半段：下载 → BytesIO → Image.open
- 跳过 `detect_format` 和 `min_short` 缩放
- RGBA → RGB 转换（如需要）
- ≤ 5 MiB 检查（以 0.85 倍逐步缩小）
- 返回格式：`{"filename": "...", "width": w, "height": h, "format": "logo"}`

### main.py — 修改点

**命名变更：**
```python
# 旧：f"img_{i+1:03d}"
# 新：f"{pkg_name}_{i+1:03d}"
```

**新增参数：**
- `include_ads_images`: bool，默认 `True`（向后兼容）

**Logo 流程（始终执行）：**
```python
logo_url = scrape_logo(url)
if logo_url:
    logo_dir = os.path.join(pkg_dir, "包logo")
    os.makedirs(logo_dir, exist_ok=True)
    logo_result = save_logo(logo_url, logo_dir, f"{pkg_name}_logo")
```

**API 响应新增字段：**
```json
{
    "logo": {"filename": "...", "width": 120, "height": 120, "format": "logo"} | null
}
```

### 前端 — 复选框

- 位置：保存路径输入框下方，"开始爬取"按钮上方
- 默认勾选
- 标签文字：「下载 Google Ads 规格图片（缩放处理）」

### 前端 — JS 逻辑

- `startScrape()` 中读取复选框状态
- POST body 新增 `include_ads_images: true/false`
- 结果行显示 logo 状态
- 汇总中区分 logo / 广告图片数量

## 保存目录结构

```
<保存路径>/
└── com.example.app/
    ├── 包logo/
    │   └── com.example.app_logo.png
    ├── com.example.app_001.png
    ├── com.example.app_002.png
    └── ...
```

## 错误处理

- `scrape_logo` 返回 `None` 时不报错，前端显示 "logo 未找到"
- `save_logo` 中的 `ResizeError` 不阻断广告图片处理
- 向后兼容：不传 `include_ads_images` 等同于 `true`（保持旧行为）

## 不涉及的部分

- 打包 EXE 命令不变
- `utils.py` 无需修改
- `detect_format` 规格表不变
- 广告图片缩放算法不变
