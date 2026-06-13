# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

谷歌广告图片爬取与处理工具 — 多功能运营工具箱，包含图片爬取、AI 视频生成、YouTube 视频管理、产品管理、数据做表等模块。单文件 Flask 后端 + 多 JS 模块前端，支持 PyInstaller 打包为独立 EXE。

## 使用SKILLS的时机
- 对于新增需求，使用 /superpowers
- 对于前端编写，使用 /frontend-design

## 技术栈

- 前端：HTML + CSS + JavaScript（无框架，无构建工具），5 个独立 JS 模块
- 后端：Python 3 + Flask + flask-cors（所有 API 集中在 `py/main.py`）
- 存储：SQLite（`temp/app.db`，通过 `py/database.py` 统一管理）
- 爬虫：requests + beautifulsoup4
- 图片/视频处理：Pillow + FFmpeg
- 外部 API：Google Ads API v24（按需加载，不打包进 EXE）

## 项目结构

```
├── index.html              # 主前端页面（5 个标签面板）
├── google-ads.html         # 独立的 Google Ads 报告页面
├── css/
│   └── style.css           # Glassmorphism 明亮毛玻璃主题
├── js/
│   ├── app.js              # 标签页切换 + 图片爬取面板逻辑 + API_BASE=""
│   ├── video.js            # AI 视频生成面板（任务队列、历史、文件对话框）
│   ├── youtube.js          # YouTube 视频管理面板（筛选、批量操作、分页）
│   ├── account.js         # 账户管理面板（产品/包 + 广告账户 + MCC + 设置）
│   └── audio.js            # 音频替换工具面板
├── py/
│   ├── __init__.py         # 空文件，使 py/ 成为包
│   ├── main.py             # Flask API 入口 — 所有路由集中于此（~1600 行）
│   ├── scraper.py          # 爬取 <c-wiz jsrenderer="UZStuc"> 内图片 + Logo
│   ├── resizer.py          # 下载、缩放、.png 保存（≤5 MiB）
│   ├── utils.py            # 包名提取 + 宽高比判断（detect_format）
│   ├── video_processor.py  # VideoTask 类 — FFmpeg 滤镜链构建与子进程执行
│   ├── ai_service.py       # AIProvider 抽象接口 + 豆包/Seedance/Veo/Atlas Provider
│   ├── database.py         # 统一 SQLite 存储（建表、迁移、CRUD 便捷函数）
│   └── google_ads_service.py  # Google Ads API 客户端（按需加载，不打包进 EXE）
├── requirements.txt        # Python 依赖（>= 最低版本约束）
├── temp/                   # 运行时数据（app.db、视频历史等）
├── fonts/                  # 用户导入的字体文件
└── docs/
    └── superpowers/        # 设计文档与实现计划
        ├── specs/          # 设计规格
        └── plans/          # 实现计划
```

## 前端架构 — 5 个标签面板

侧边栏导航，`switchTab()` 切换面板可见性，`localStorage` 记忆上次激活的标签。

| 面板 ID | 导航名 | JS 模块 | 默认 |
|---------|--------|---------|------|
| `panel-account` | 🏢 账户管理 | `account.js` | ✅ 默认激活 |
| `panel-youtube` | 📺 视频管理 | `youtube.js` | |
| `panel-scrape` | 📥 图片爬取 | `app.js` | |
| `panel-video` | 🎬 AI 视频生成 | `video.js` | |
| `panel-toolkit` | 🧰 工具集 | `app.js`（内联） | |

账户管理面板有 4 个子标签（产品管理/广告账户/MCC 管理/设置）。YouTube 面板有 3 个子标签（视频展示/导入视频/标签配置）。工具集面板有 2 个子标签（做表数据/音频替换）。

## 存储架构

### SQLite 统一存储 (`py/database.py`)

数据库路径：`temp/app.db`，自动建表 + 迁移。表结构：

| 表 | 用途 | 原存储方式 |
|----|------|-----------|
| `video_history` | 视频生成历史 | `temp/video_set/*.json` |
| `video_tasks` | 视频任务记录 | 内存 dict（重启丢失） |
| `videos` | YouTube 视频 | `temp/youtube.db` |
| `tags` | 标签（地区/帧类型/成效/产品名） | `temp/youtube.db` |
| `config` | 键值配置（含字体最近使用） | `fonts/.recent.json` |
| `products` | 产品管理 | 新建 |
| `packages` | 产品下的包 | 新建 |

**迁移机制**：首次启动时自动从旧 JSON/SQLite 文件导入，导入后原文件重命名为 `.bak`。

### main.py 中的直连 SQLite

产品管理和 YouTube 管理 API 目前直接在 `main.py` 中通过 `_yt_db()` 操作 SQLite（使用同一个 `temp/youtube.db` 文件的兼容路径）。`database.py` 是新的统一存储层，逐步替换直接 SQLite 操作。

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
- **打包 vs 开发模式**：`main.py` 通过 `_FROZEN = getattr(sys, "frozen", False)` 判断是否为 PyInstaller 打包模式。打包后前端文件在 `sys._MEIPASS` 下，开发模式在 `py/` 上级目录。数据目录 `_DATA_ROOT` 打包时指向 EXE 所在目录，开发时指向项目根。
- **前端 API 路径**：`js/app.js` 使用 `API_BASE = ""`（相对路径），自动适配 localhost、局域网 IP、打包后 EXE 等不同访问方式。
- **Google Ads 按需加载**：`google_ads_service.py` 在 API 路由中通过 try/except ImportError 按需导入，打包 EXE 时排除 `google-ads` 依赖以减小体积（约 110MB → 33MB）。
- **文件对话框**：通过 PowerShell 子进程（`_ps_*_dialog_fast`）或 Windows ctypes API（`_win32_*_dialog`）打开原生文件选择/保存/文件夹对话框，仅允许本机请求（`_is_local_request()` 检查 `remote_addr`）。

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

## API 路由一览

所有路由均返回 `{"success": bool, ...}` 格式。`main.py` 中按功能分组。

### 基础 + 爬取
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 前端页面 |
| GET | `/api/health` | 健康检查 |
| POST | `/api/scrape` | 爬取单个 URL（含 Logo + 广告图），支持本地缓存命中 |

### 文件浏览（仅本机）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/browse-file` | 打开文件选择对话框（支持 mp3/audio/video/image/all 类型过滤） |
| POST | `/api/browse-save` | 打开保存文件对话框（默认 .mp4） |
| POST | `/api/browse-folder` | 打开文件夹选择对话框 |

### 视频生成
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/video/scan-dir` | 扫描目录返回 PNG 图片列表 + logo 信息 |
| GET | `/api/image?path=` | 返回本地图片文件流（供缩略图加载） |
| POST | `/api/video/generate` | 提交视频生成任务（后台线程执行，返回 task_id，202 状态码） |
| GET | `/api/video/progress?task_id=` | 轮询生成进度 |
| POST | `/api/video/next-filename` | 检查输出路径，返回不冲突的文件名 |
| POST | `/api/video/history/save` | 保存视频设置到历史 |
| GET | `/api/video/history/list` | 获取所有历史（按包名分组） |
| POST | `/api/video/history/delete` | 删除历史条目或整包 |

### 音频替换
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/audio-replace` | 替换视频音频轨道（FFmpeg） |

### YouTube 视频管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/youtube/import` | 批量导入 YouTube 链接（自动获取标题） |
| GET | `/api/youtube/list` | 列表查询（支持地区/帧类型/成效/产品名筛选） |
| POST | `/api/youtube/delete` | 批量删除 |
| POST | `/api/youtube/edit` | 编辑单条视频属性 |
| GET | `/api/youtube/tags` | 获取标签配置 |
| POST | `/api/youtube/tags` | 保存标签配置（含重命名/删除同步） |

### 产品管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/products/list` | 列表查询（搜索/地区/暂停筛选/分页） |
| POST | `/api/products/create` | 创建产品（含批量包，同名产品追加包） |
| PUT | `/api/products/<pid>` | 更新产品 |
| DELETE | `/api/products/<pid>` | 删除产品及关联包 |
| POST | `/api/products/<pid>/packages` | 添加包到产品 |
| PUT | `/api/products/packages/<pkg_id>` | 更新包 |
| DELETE | `/api/products/packages/<pkg_id>` | 删除包 |
| POST | `/api/products/import-text` | 从脏数据文本解析包链接（支持 6 种脏数据格式） |

### 字体管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/fonts/list` | 列出系统 + 用户导入的字体 |
| GET | `/api/fonts/preview?font=` | 生成字体预览图片（标本卡） |
| GET | `/api/fonts/file/<font_id>` | 提供字体文件（供 CSS @font-face） |
| POST | `/api/fonts/import` | 导入字体文件（仅本机） |
| POST | `/api/fonts/mark-used` | 标记最近使用 |

### Google Ads（按需加载）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/google-ads/accounts` | 获取可访问的子账户列表 |
| POST | `/api/google-ads/report` | 拉取广告系列报告 |

### POST /api/scrape

请求：`{"url": "https://play.google.com/store/apps/details?id=...", "save_dir": "/path/to/save", "include_ads_images": true}`

成功响应：`{"success": true, "package_name": "...", "image_count": N, "saved_path": "...", "images": [...], "logo": {...}}`

失败响应（400/404/500）：`{"success": false, "error": "错误描述"}`

特殊行为：如果 `save_dir/包名/` 已存在 PNG 文件，直接返回本地缓存（`from_cache: true`），跳过爬取。

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
from video_processor import VideoTask, VideoError
from ai_service import get_provider, AIServiceError

# ❌ 错误 — 相对导入在直接运行 main.py 时会失败
from .scraper import scrape_images
```

`main.py` 开头通过 `sys.path.insert(0, _current_dir)` 确保导入正确。

`database.py` 独立计算自己的 `_db_path()`（不依赖 main.py），通过 `getattr(sys, "frozen", False)` 判断打包模式。

`google_ads_service.py` **不参与绝对导入** — 在 API 路由内通过 try/except ImportError 按需加载，打包 EXE 时排除 `google-ads` 依赖。

## 异常设计

| 异常 | 所在模块 | 触发场景 |
|------|---------|---------|
| `ScrapeError` | `scraper.py` | 页面不可访问、未找到目标标签 |
| `ResizeError` | `resizer.py` | 图片下载失败、无法识别格式 |
| `VideoError` | `video_processor.py` | FFmpeg 执行失败、参数非法 |
| `AIServiceError` | `ai_service.py` | AI API 调用失败、认证错误 |
| `GoogleAdsServiceError` | `google_ads_service.py` | Google Ads API 错误 |
| `ValueError` | `utils.py` | 无法从 URL 提取包名 |

`main.py` 在顶层捕获这些异常并转为对应的 HTTP 错误响应。单张图片处理失败（ResizeError）不会中断其他图片。AI 单段生成失败会降级为静态帧，不阻塞整体流程。

## 工作流规范（最高优先级）

**所有新功能需求，必须先写设计文档，等用户确认后再动手写代码。** 此规则适用于所有模式（包括 Plan Mode、普通模式、fast mode 等），无例外。

流程：
1. 接到新需求 → 在 `docs/superpowers/specs/` 创建 `YYYY-MM-DD-<功能名>-design.md`
2. 文档内容至少包含：需求描述、技术方案、涉及的 API/文件、数据结构、UI 交互
3. 呈现给用户确认（可同时给出简要概述）
4. 用户确认后 → 在 `docs/superpowers/plans/` 创建 `YYYY-MM-DD-<功能名>-plan.md`（实现计划）
5. 按计划逐步实现

**文档命名规范**：
- 设计规格：`docs/superpowers/specs/YYYY-MM-DD-<功能名>-design.md`
- 实现计划：`docs/superpowers/plans/YYYY-MM-DD-<功能名>-plan.md`

**禁止事项**：未确认设计就直接改代码。简单 bug 修复、样式微调、配置变更不受此限制。

## 注意事项

- `py/` 目录名可能与某些 Python 环境的 site-packages 冲突（如 pytest 的 `py.py`），`main.py` 已通过 `sys.path` 处理此问题
- 必须从 `py/` 目录内运行 `python main.py`
- Google Play 页面结构可能变化，如爬取失败需检查 `<c-wiz jsrenderer="UZStuc">` 标签是否仍然存在
- 项目无自动化测试，测试通过 curl 调用 API 和手动操作前端完成
- 完整设计文档见 `docs/superpowers/specs/`，实现计划见 `docs/superpowers/plans/`
- 本机存在两个 Python 环境：`/f/niko/python/`（有项目依赖）和 `C:\Users\Niko\AppData\Local\Programs\Python\Python312\`（系统默认），打包 EXE 时必须用前者
- **单文件架构**：所有 Flask 路由集中在 `main.py`（~1600 行），新增 API 也加在此文件中。`database.py` 是新的统一存储层，逐步替换 `main.py` 中直连 SQLite 的代码
- YouTube 和产品管理目前共用 `temp/youtube.db`（通过 `_yt_db()`），未来迁移到 `database.py` 统一管理 `temp/app.db`
- `google-ads.html` 是独立页面，不走 Flask 路由，直接浏览器打开
- 前端 JS 模块通过 `<script>` 标签顺序加载（无模块打包），`app.js` 中定义的 `API_BASE` 和 `browseFile` 被后续模块共享使用
- `NOTES.md` 记录了脏数据处理的 6 种格式，`_guess_series()` 按优先级匹配：类型2（神包上线）→ 类型1（APK行）→ 类型3（应用名在链接后）→ 类型4（名称行）→ 类型6（首列含 `-`）→ 类型5（包名兜底）

## AI 视频生成（2026-06-05 新增）

### 功能概述
- 视频面板流程：选择目录 → 扫描图片（缩略图网格预览）→ 勾选 → 设置参数 → 生成 MP4
- 混合方案：默认本地 FFmpeg 拼接（零成本），可选 AI 动态化
- Logo 水印叠加：位置（左上/右上/左下/右下/浮动）+ 效果（静态/淡入淡出/浮动弹跳/放大进入/从右滑入/脉冲缩放）
- 任务队列：支持添加多个任务到队列，一键生成全部
- 视频设置历史：按包名保存/恢复设置（存储在 SQLite `video_history` 表）
- 背景图片支持 + 动态背景（呼吸/波浪/律动/流光）
- 文案浮层：最多两条，随机浮现 2-3 秒，淡入淡出 + 阴影描边
- 转场效果：14 种（淡入淡出/黑场/白场/滑动/缩放/溶解/像素化/圆形/擦除等）

### AI 服务选择
| Provider | 后端模型 | 特点 |
|----------|---------|------|
| doubao | 豆包 Seedance 1.5 Pro | 首选推荐，效果最佳 |
| doubao-fast | 豆包 Seedance 1.0 Pro Fast | 极速模式 |
| seedance | Seedance 2.0（字节/即梦） | 每日免费积分，通过 Atlas Cloud 调用 |
| veo | Veo 3.1 Lite（Google） | 免费，视频自带音频生成 |
| atlas | Atlas Cloud 多模型 | 一个 Key 切换 300+ 模型 |

### FFmpeg 打包
- FFmpeg 打包进 EXE（`--add-binary ffmpeg.exe;.`），EXE 约 110MB
- 开发模式：`ffmpeg.exe` 放项目根目录或系统 PATH 中（`_get_ffmpeg_path()` 自动探测）
- 打包模式：从 `sys._MEIPASS` 自动加载
- Flask 需 `threaded=True`（视频生成在后台线程执行，AI 动态化使用 ThreadPoolExecutor 并行）
- 打包之后，对于在生产模式需要保存的数据，都保存到 `temp/` 目录下，不同功能创建不同的文件

## YouTube 视频管理（2026-06-09 新增）

- SQLite 存储，支持地区/帧类型/成效/产品名 4 维分类
- 批量导入（自动通过 oEmbed 获取标题）、批量删除、批量编辑
- 搜索过滤 + 分页（10/20/50/100 条/页）
- 内嵌 YouTube 播放器 + 复制链接（记录复制历史到 localStorage）
- 标签配置面板：自定义下拉选项，修改后自动同步已有数据
- 成效排序优先（成效 > 一般 > 未标记），同级别按导入时间倒序

## 产品管理（2026-06-10 新增）

- 产品-包 两级结构：一个产品可以有多个包
- 支持搜索（产品名/KPI）、地区筛选、暂停/正常切换
- 复制导入：从聊天记录等脏数据中自动解析 Google Play 链接
- 脏数据解析支持 6 种格式（`_guess_series()`）：APK 行、神包上线、应用名、名称、纯链接、首列含 `-`
- 同一产品下相同包名+链接视为重复，只更新系列名

## 工具集（2026-06-11 新增）

### 做表数据
- 从 Google Ads 原始竖排数据中自动解析账号/客户ID/广告系列/费用/展示/点击
- 生成三种视图：原始清洗数据、做表数据（按客户ID+广告系列聚合费用）、客户表数据（按广告系列聚合）
- 一键复制（TSV 格式贴到 Excel）+ 导出 XLSX（依赖 SheetJS CDN）

### 音频替换
- 替换视频的音频轨道（FFmpeg `-c:v copy -map 0:v:0 -map 1:a:0 -shortest`）
- 支持音频文件（.mp3/.wav 等）和视频文件（自动提取音频）作为音频源

## Google Ads API（2026-06-11 新增）

- 独立页面 `google-ads.html`，通过 Google Ads API v24 拉取广告系列报告
- 支持 OAuth 2.0 凭据配置（client_id/secret/refresh_token/developer_token/manager_id）
- `google_ads_service.py` 通过 try/except ImportError 按需加载，不打包进 EXE
- 输出：广告系列 ID/名称、客户 ID/名称、消耗/展示/点击/CTR/转化/CPA

## 设计文档索引

- [图片爬取](docs/superpowers/specs/image-scraping-design.md)
- [AI 视频生成](docs/superpowers/specs/ai-video-generation-design.md)
- [YouTube 视频管理](docs/superpowers/specs/youtube-video-management-design.md)
- [账户与产品管理](docs/superpowers/specs/account-product-management-design.md)
- [Google Ads API](docs/superpowers/specs/google-ads-api-design.md)
- [SQLite 统一存储](docs/superpowers/specs/sqlite-unified-storage-design.md)
- [Vue 前端重构](docs/superpowers/specs/vue-migration-design.md)
