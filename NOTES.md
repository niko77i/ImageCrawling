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

- 当你使用 /frontend-design, 你是一个资深的前端设计，但只需要修改ui，不动逻辑

## 要处理的脏数据
- 系列名所在行，一般是“-”所连接的字符，删除特殊符号。一般都是多行包，同时复制进来，需要进行每个包区分，再取对应的系列名，链接，包名。以下脏数据，我都是使用的两行数据
- 第一种：系列名种包含有多个“-”
[2026/6/9 14:08] 老渔民 代投: 😀 FF345【神包】上线   ⚡️
📱FF345-APK-24 三方回传：AD
📱下户时区：巴西 -3时区【重要】
📱应用名称：FF345Hue
📱TT识别码：21pzdc6w
📱APP包名：com.foldhueabc.logicjklmno
📱APP链接：https://play.google.com/store/apps/details?id=com.foldhueabc.logicjklmno&
[2026/6/9 14:08] 老渔民 代投: 😀 FF345【神包】上线   ⚡️
📱FF345-APK-25 三方回传：AD
📱下户时区：巴西 -3时区【重要】
📱应用名称：GlyphGrid
📱TT识别码：21cl7iim
📱APP包名：com.glyphgridwqtep.designvzqxsb
📱APP链接：https://play.google.com/store/apps/details?id=com.glyphgridwqtep.designvzqxsb&

- 第二种：系列名中也包含了多个“-”，但脏数据也有多个“-”，但一般情况这种数据，系列名是在最前面的。
[2026/6/9 23:08] 青稚 引流: 🔥神包上线：7274-apk-包37
🔥APP名称：7274Muse
🔥APP链接：https://play.google.com/store/apps/details?id=com.museweaveqwert.designasdfgh&
🔥三方回传：AD
🔥下户时区：-3时区【重要】
🔥禁止使用注册送彩金、下载送彩金、免费旋转、别的站点LOGO，域名，等误导性虚假素材，如有发现，立即停止合作！
🔥AD广告系列名称举例：⚠️7274-群编号-媒体-apk-包号⚠️
🔥TT识别码215dxoip
[2026/6/9 23:08] 青稚 引流: 🔥神包上线：7274-apk-包38
🔥APP名称：7274Weave
🔥APP链接：https://play.google.com/store/apps/details?id=com.hueweavexopjr.designtqchjz&
🔥三方回传：AD
🔥下户时区：-3时区【重要】
🔥禁止使用注册送彩金、下载送彩金、免费旋转、别的站点LOGO，域名，等误导性虚假素材，如有发现，立即停止合作！
🔥AD广告系列名称举例：⚠️7274-群编号-媒体-apk-包号⚠️
🔥TT识别码21syx52u

- 第三种：和第一种类似，但出现在最后。
https://play.google.com/store/apps/details?id=com.Edgedod.game&gl=un&pli=1
类名
com.Edgedod.game.MainActivity
包名
com.Edgedod.game
应用名：Edge dod-27包

https://play.google.com/store/apps/details?id=com.evd.Sandevd&gl=un&pli=1
类名
com.timedblast.countdown.MainActivity
包名
com.evd.Sandevd
应用名：Sand evd-28包

- 第四种：没有“-”，系列名就是“：”后的，链接之外的那列
谷歌11 名称：NexaPulse
https://play.google.com/store/apps/details?id=com.nexapulsezfp.puzzlegmhxqwr&

谷歌12 名称：Spin Prism Hit
https://play.google.com/store/apps/details?id=com.spojig.SpinPrismHit&gl=un&pli=1

- 第五种：只有一个链接，系列名就只用用包名
https://play.google.com/store/apps/details?id=com.vibe.arc3&gl=un&pli=1

- 第六种：我修改好的，第一列包含“-”的就是系列名


## 新需求，账户管理 

- 使用 /brainstorming。现在我想要一个侧边栏，用于管理我的Google ads 账户，与产品管理相关联，后续Googleapi 基本访问权限下来之后，会与之关联。

### 首先是存储内容

- 包含账号名称，账号id，账户时区，账户代理，账户状态（默认存活，死亡，验证，限额，不花费），账户到手时间。增删改查是基本（包含批量操作）

### 产品管理进行需求增加

- 现在的产品是下拉展示页面，我想增加，产品所在mcc名字，mcc账号。现在是手动输入，后续Googleapi 基本访问权限有了之后，自动获取到所有的mcc子经理，账户，用户可以直接选择。现在手动输入，mcc名字，mcc账号，那些账户在跑这个产品。
- 基于上面的需求，产品管理页面需要优化，产品和包依然是下拉展示。但mcc名字，mcc账号可以直接显示在产品那一列。并且需要实现从账户管理哪里直接获取到账户，然后可以在对应产品直接选择账户。

## 注意：
你要做的是和我确认需求，完善需求之后，才开始写代码，使用 /Superpowers。
页面ui使用 /frontend-design	进行优化。
没有我的要求，不要自动上传git。

## 新需求，增加用户功能，使用vue修改前端

- 使用 /brainstorming。后续我要能够统一管理，而不是一个用户用自己的数据，我想要有用户系统。前端修改使用架构，使用vue把代码重新完善。

- 然后增加用户登录，用户管理，只有管理员可登录的，里面可以管理用户所有信息，以及后续可能会增加的多种配置。用户也分等级，隐性的，自己创建的用户都是最低等级，只有一个开发者是最高级。

### 注意
- 先和我讨论，我还有很多疑惑。

## 新需求 计算户的违规率，使用图表展示