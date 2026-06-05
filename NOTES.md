# NOTES.md

## 实现状态

- [x] Task 1: CSS 侧边栏 + 视频面板样式 ✅
- [x] Task 2: HTML 侧边栏 + 双面板结构 ✅
- [x] Task 3: JS switchTab() 函数 ✅
- [x] Task 4: video_processor.py ✅
- [x] Task 5: ai_service.py（Seedance/Veo/Atlas）✅
- [x] Task 6: main.py API 路由 ✅
- [x] Task 7: video.js 视频面板逻辑 ✅
- [x] Task 8: 端到端验证 ✅（服务器启动正常，API 响应正常）
- [ ] Task 9: 下载 FFmpeg + 打包 EXE
- [x] Task 10: 更新 CLAUDE.md ✅

---

## 2026-06-05 — 免费视频 AI API 调研

### 背景

在现有 Google Play 图片爬取工具中新增"AI 视频生成"功能（图片转视频），需要免费的云端 AI 视频 API。

设计文档：[docs/superpowers/specs/2026-06-05-ai-video-generation-design.md](docs/superpowers/specs/2026-06-05-ai-video-generation-design.md)

---

### 推荐的前三方案

#### 🥇 1. Seedance 2.0（字节跳动/即梦）⭐ 首选

- **免费额度**: 每日 225 积分 ≈ 10-15 个短视频
- **接入方式**: REST API，通过 Atlas Cloud 统一调用（兼容 OpenAI SDK 格式）
- **能力**: 图片→视频、文本→视频、多模态联合生成
- **ELO 评分**: 全球第 2（1271 分），超过 Kling
- **超量价格**: ~$0.081/秒
- **最适合**: 将静态截图转为动态短视频片段

```python
import requests
resp = requests.post(
    "https://api.atlascloud.ai/v1/video/generate",
    headers={"Authorization": "Bearer YOUR_KEY"},
    json={
        "model": "seedance-2.0",
        "image_url": "https://your-image.png",
        "duration": 4
    }
)
```

#### 🥈 2. Google Veo 3.1 Lite

- **免费额度**: 完全免费（Google AI Studio / Gemini API），NexaAPI 代理额外 100 次
- **接入方式**: Gemini API SDK (`pip install google-genai`) 或 NexaAPI
- **能力**: 图片→视频、文本→视频，**原生音频生成**（唯一免费支持视频+音效同步的）
- **限制**: 最长 8 秒，720p-1080p，有速率限制
- **最适合**: 不需要额外音乐文件，视频自带音效

```python
from nexaapi import NexaAPI
client = NexaAPI(api_key="free")  # 100 次免费额度，无需绑卡
video = client.video.generate(
    model="veo-3.1-lite-i2v",
    image_url="https://your-image.png",
    duration=8, aspect_ratio="16:9"
)
```

#### 🥉 3. Atlas Cloud（聚合平台）

- **免费额度**: 注册送 $1 体验金 ≈ 3-4 个高清视频
- **接入方式**: 统一 REST API，兼容 OpenAI SDK，一个 Key 接入 300+ 模型
- **可选模型**: Seedance 2.0、Kling 3.0、Vidu Q3、Wan-2.2
- **价格**: Wan-2.2 $0.01/秒（最便宜），Vidu Q3 $0.034/秒
- **最适合**: `AIProvider` 抽象类无缝切换多个后端

```python
models = ["kling-3.0", "seedance-2.0", "vidu-q3", "wan-2.2"]
# 一个 key 切任意模型
```

---

### 对比总结

| 维度 | Seedance 2.0 | Veo 3.1 Lite | Atlas Cloud |
|------|-------------|-------------|-------------|
| 免费额度 | 每日 225 积分 | 完全免费 + 100次 | $1 体验金 |
| 图片转视频 | ✅ 最强 | ✅ 支持 | ✅ 多模型可选 |
| 原生音频 | ❌ | ✅ 独有 | 视模型而定 |
| 国内访问 | 需代理 | 需代理 | 需代理 |
| 适配难度 | ⭐⭐ | ⭐⭐⭐ | ⭐（最易） |

---

### 建议

- 主要使用 **Seedance 2.0**（图转视频效果最好 + 每日免费）
- **Veo 3.1 Lite** 作为音频生成的备选
- 通过 **Atlas Cloud** 统一接入多个后端
- `ai_service.py` 实现 `SeedanceProvider` + `VeoProvider`，复用 `AIProvider` 抽象

### 视频分析 API（备选）

| 平台 | 免费额度 | 用途 |
|------|----------|------|
| Google Cloud Video Intelligence | 每月 1000 分钟 | 物体/人脸/文字检测 |
| Twelve Labs | 600 分钟索引 | 自然语言视频搜索 |

### 参考来源

- [Atlas Cloud - 免费调用 Seedance 2.0 API](https://www.atlascloud.ai/zh/blog/case-studies/how-to-access-seedance-2-0-api-free)
- [Free Veo3 API via NexaAPI](https://dev.to/diwushennian4955/free-veo3-api-generate-ai-videos-without-google-cloud-no-credit-card-via-nexaapi-35ka)
- [2026 AI Video Generator Shootout](https://dev.to/jack_717554a455b014efaf35/2026-ai-video-generator-shootout-a-developers-technical-comparison-d3g)

---

## 同日 — Skills 安装

- ✅ `frontend-design` — 从 `claude-plugins-official` 官方 marketplace 安装成功
- ⚠️ `fullstack-developer` — 不在官方和 superpowers marketplace 中，社区方案待确认
