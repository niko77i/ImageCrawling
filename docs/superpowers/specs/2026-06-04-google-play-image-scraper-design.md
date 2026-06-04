# Google Play 图片爬取与处理工具 — 设计文档

**日期**：2026-06-04
**状态**：已确认

---

## 项目概述

从 Google Play 链接批量爬取图片，按 Google Ads 规格自动缩放，按包名分类保存到本地。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | HTML + CSS + JavaScript（无框架，无构建工具） |
| 后端 | Python 3, Flask, flask-cors |
| 爬虫 | requests, beautifulsoup4 |
| 图片处理 | Pillow |

## 项目结构

```
tt/
├── index.html              # 前端页面
├── css/
│   └── style.css           # 样式
├── js/
│   └── app.js              # 前端逻辑
├── py/
│   ├── main.py             # Flask API 入口
│   ├── scraper.py          # 爬取模块
│   ├── resizer.py          # 图片处理模块
│   └── utils.py            # 工具函数
└── requirements.txt        # Python 依赖
```

## 数据流

```
URL 列表（前端）
  → POST /api/scrape（逐条）
    → extract_package_name(url) → 创建 保存路径/包名/ 文件夹
    → scrape_images(url) → 获取图片 URL 列表
    → 对每张图: detect_format() → resize() → save .png
    → 返回结果 JSON
  → 前端实时更新状态
```

## API 契约

### POST /api/scrape

**请求**：`{"url": "https://play.google.com/store/apps/details?id=...", "save_dir": "F:/images/"}`

**成功响应 (200)**：
```json
{
  "success": true,
  "package_name": "com.spotify.music",
  "image_count": 5,
  "saved_path": "F:/images/com.spotify.music",
  "images": [
    {"filename": "img_001.png", "width": 1200, "height": 628, "format": "landscape"}
  ]
}
```

**错误响应 (400/500)**：`{"success": false, "error": "错误描述"}`

### GET /api/health

返回 `{"status": "ok"}`，用于健康检查。

## 模块设计

### scraper.py — 爬取模块

- `scrape_images(url: str) -> list[str]`
- 用 requests 获取 HTML，BeautifulSoup 查找 `<c-wiz jsrenderer="UZStuc">`
- 提取其中所有 `<img>` 的 src，补全相对路径，去重返回
- 异常：页面不可访问、未找到目标标签

### resizer.py — 图片处理模块

- `process_image(img_url: str, save_dir: str, filename: str) -> dict`
- 下载图片 → 检测宽高比 → 匹配规格 → Pillow 缩放 → 保存 .png（≤5 MiB）

### utils.py — 工具函数

- `extract_package_name(url: str) -> str` — 正则匹配 `?id=` 及路径格式
- `detect_format(w: int, h: int) -> str` — 根据宽高比返回 "landscape"/"square"/"portrait"

## Google Ads 图片规格

| 类型 | 目标尺寸 | 最小尺寸 | 宽高比 | 判断规则 |
|------|----------|----------|--------|----------|
| 横向 | 1200×628 | 600×314 | 1.91:1 | 宽/高 > 1.3 |
| 方形 | 1200×1200 | 200×200 | 1:1 | 0.8 ≤ 宽/高 ≤ 1.3 |
| 纵向 | 1200×1500 | 320×400 | 4:5 | 宽/高 < 0.8 |

- 如果原图小于目标尺寸：LANCZOS 放大到目标尺寸
- 如果原图大于等于目标尺寸：保持原尺寸
- 如果文件超过 5 MiB：压缩至限制以内

## 前端交互

- URL 输入框：支持多行，换行或逗号分隔
- 保存路径输入框：用户指定本地文件夹
- "开始爬取" 按钮：逐条调用 API，实时显示进度
- 结果区：每行显示 ⏳/✅/❌ 状态，完成后统计汇总

## 启动方式

```bash
pip install flask flask-cors requests beautifulsoup4 pillow
cd py
python main.py
# 服务运行在 http://localhost:5000
# 打开 index.html 即可使用
```
