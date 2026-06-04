# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

谷歌广告图片爬取与处理工具 — 从 Google Play 链接批量爬取图片，按 Google Ads 规格缩放，按包名分类保存。

## 技术栈

- 前端：HTML + CSS + JavaScript（无框架，无构建工具）
- 后端：Python 3 + Flask + flask-cors
- 爬虫：requests + beautifulsoup4
- 图片处理：Pillow

## 项目结构

```
├── index.html              # 前端页面
├── css/
│   └── style.css           # 样式
├── js/
│   └── app.js              # 前端逻辑（API_BASE="" 自动适配访问地址）
├── py/
│   ├── __init__.py         # 空文件，使 py/ 成为包
│   ├── main.py             # Flask API 入口（含 _FROZEN 标志切换开发/打包模式）
│   ├── scraper.py          # 爬取 <c-wiz jsrenderer="UZStuc"> 内图片，升级为高清 URL
│   ├── resizer.py          # 下载、缩放、.png 保存（≤5 MiB），FORMAT_CONFIG + MAX_FILE_SIZE 常量
│   └── utils.py            # 包名提取 + 宽高比判断（detect_format）
├── requirements.txt        # Python 依赖（全部使用 >= 最低版本约束）
└── docs/
    └── superpowers/        # 设计文档与实现计划
        ├── specs/          # 设计规格
        └── plans/          # 实现计划
```

## 数据流

```
用户浏览器 → http://localhost:5000（Flask 直接提供前端页面 + API）
  → POST /api/scrape（逐条串行，非批量）
    → extract_package_name(url) → 创建 save_dir/包名/ 文件夹
    → scrape_images(url) → requests 获取 HTML → BeautifulSoup 查找 c-wiz
    → 对每张图: detect_format(w,h) → 确保短边 ≥ min_short → 保存 .png（≤ 5 MiB）
    → 返回结果 JSON
  → 前端逐条更新 ⏳/✅/❌ 状态，最后显示汇总
```

### 关键实现细节

- **高清 URL 升级**：`scraper.py` 的 `_upgrade_image_url()` 将 Google CDN 图片 URL 中的 `=w数字-h数字` 替换为 `=w2400-h2400`，以请求最高可用分辨率。
- **打包 vs 开发模式**：`main.py` 通过 `_FROZEN = getattr(sys, "frozen", False)` 判断是否为 PyInstaller 打包模式。打包后前端文件在 `sys._MEIPASS` 下，开发模式在 `py/` 上级目录。
- **前端 API 路径**：`js/app.js` 使用 `API_BASE = ""`（相对路径），自动适配 localhost、局域网 IP、打包后 EXE 等不同访问方式。

## 启动方式

### 开发模式

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动（在 py/ 目录下运行）
cd py
python main.py
# 打开浏览器访问 http://localhost:5000
```

### 打包为 EXE（无需 Python 环境）

```bash
# 确保在有 Flask 等依赖的 Python 环境中
pip install pyinstaller

# 在项目根目录运行
pyinstaller --onefile --clean --name "gp-image-scraper" \
  --paths py \
  --add-data "index.html;." \
  --add-data "css/style.css;css" \
  --add-data "js/app.js;js" \
  py/main.py

# 生成的 EXE 在 dist/gp-image-scraper.exe（约 33 MB）
# 双击即可运行，自动打开浏览器
```

EXE 绑定 `0.0.0.0:5000`，局域网内其他设备可通过 IP 访问。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/scrape` | 爬取单个 URL 的图片 |

### POST /api/scrape

请求：`{"url": "https://play.google.com/store/apps/details?id=...", "save_dir": "/path/to/save"}`

成功响应：`{"success": true, "package_name": "...", "image_count": N, "saved_path": "...", "images": [...]}`

失败响应（400/404/500）：`{"success": false, "error": "错误描述"}`

## 核心功能需求

### 输入
- **URL 输入框**：支持批量输入多个 Google Play 链接，换行或逗号分隔
- **保存路径输入框**：用户指定图片保存的本地文件夹路径

### 图片爬取
- 只爬取 `<c-wiz jsrenderer="UZStuc">` 标签内的图片
- 保存为 `.png` 格式

### 图片缩放算法（实际行为）

图片**不会**强制缩放到 Google Ads 目标尺寸。实际逻辑：

1. `detect_format(w, h)` 根据宽高比判断规格：ratio > 1.3 → landscape，ratio ≤ 0.8 → portrait，否则 → square
2. 如果短边小于该规格的 `min_short`，等比放大到短边 = min_short，保持原始宽高比
3. 保存为 PNG（optimize=True，RGBA 转 RGB）
4. 如果文件 > 5 MiB，以 0.85 倍逐步缩小直到 ≤ 5 MiB 或低于最小尺寸

| 类型 | min_short | 宽高比判断 |
|------|-----------|-----------|
| landscape | 314 | 宽/高 > 1.3 |
| square    | 200 | > 0.8 且 ≤ 1.3 |
| portrait  | 320 | 宽/高 ≤ 0.8 |

### 保存规则
- 从 URL 中提取 Google Play 包名，创建对应文件夹
- 图片保存到用户指定的路径下的对应包名文件夹中

## 导入约定

所有 Python 文件使用**绝对导入**（无前导点），因为 `main.py` 从 `py/` 目录内运行：

```python
# ✅ 正确 — 代码中使用的方式
from scraper import scrape_images, ScrapeError
from resizer import process_image, ResizeError
from utils import extract_package_name

# ❌ 错误 — 相对导入在直接运行 main.py 时会失败
from .scraper import scrape_images
```

`main.py` 开头通过 `sys.path.insert(0, _current_dir)` 确保导入正确。

## 异常设计

- `ScrapeError`（scraper.py）：页面不可访问、未找到目标标签
- `ResizeError`（resizer.py）：图片下载失败、无法识别格式
- `ValueError`（utils.py）：无法从 URL 提取包名

`main.py` 在顶层捕获这些异常并转为对应的 HTTP 错误响应。单张图片处理失败（ResizeError）不会中断其他图片。

## 注意事项

- `py/` 目录名可能与某些 Python 环境的 site-packages 冲突（如 pytest 的 `py.py`），`main.py` 已通过 `sys.path` 处理此问题
- 必须从 `py/` 目录内运行 `python main.py`
- Google Play 页面结构可能变化，如爬取失败需检查 `<c-wiz jsrenderer="UZStuc">` 标签是否仍然存在
- 项目无自动化测试，测试通过 curl 调用 API 和手动操作前端完成
- 完整设计文档见 `docs/superpowers/specs/`，实现计划见 `docs/superpowers/plans/`
- 本机存在两个 Python 环境：`/f/niko/python/`（有项目依赖）和 `C:\Users\Niko\AppData\Local\Programs\Python\Python312\`（系统默认），打包 EXE 时必须用前者
