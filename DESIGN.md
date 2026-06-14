---
name: ImageCrawling — 运营工具箱
description: 谷歌广告素材管理多功能工具，精密工作台风格的运营控制面板
colors:
  signal-cyan: "#0891b2"
  signal-green: "#059669"
  signal-red: "#dc2626"
  signal-blue: "#2563eb"
  frosted-steel: "#e8ecf1"
  glass-surface: "#f7f8fa"
  glass-elevated: "#fbfcfc"
  deep-sea-ink: "#1a1a2e"
  storm-gray: "#555770"
  fog-gray: "#8888a0"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.04em"
    textTransform: "uppercase"
  nav:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "'Courier New', monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.signal-cyan}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 28px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "#22d3ee"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.signal-cyan}"
    rounded: "{rounded.md}"
    padding: "10px 28px"
  input-default:
    backgroundColor: "rgba(0,0,0,0.03)"
    textColor: "{colors.deep-sea-ink}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  card-surface:
    backgroundColor: "{colors.glass-surface}"
    rounded: "{rounded.lg}"
  nav-item-active:
    backgroundColor: "rgba(6,182,212,0.15)"
    textColor: "{colors.signal-cyan}"
    rounded: "{rounded.sm}"
---

# Design System: ImageCrawling 运营工具箱

## 1. Overview

**Creative North Star: "精密工作台"**

这是一个运营人员的工作台面 — 每样工具有固定位置，操作精准可预期，不需要花哨的装饰语言。界面的存在意义是让重复性运营任务更快完成，而不是展示设计能力。

设计哲学：**信息先行，装饰后撤。** 颜色标记状态（进行中/成功/失败），而非装饰。间距服务于内容分组，而非呼吸感。动画仅用于操作反馈（≤150ms），没有"让页面看起来生动"的动画。

这个系统明确拒绝：传统 ERP 的密集表格海洋、Material Design 的过度阴影层次、任何让操作变慢的视觉手法。引用 PRODUCT.md 的原话 — "不为了好看而增加点击次数"。

**Key Characteristics:**
- 冷灰蓝底 + 青色单强调色，色彩克制
- 扁平表面为主，弹窗保留下沉的毛玻璃模糊作为注意力聚焦信号
- 锐利交互反馈，过渡 ≤150ms，hover 即时响应
- 功能色（绿/红/蓝）严格用于状态标记，不用于装饰
- 等宽字体用于数据（包名、路径、数字），无衬线用于操作界面

## 2. Colors

调色板服务于信息层级：一个主强调色驱动操作流，三个功能色标记状态，冷灰色系承载内容。

### Primary
- **Signal Cyan** (#0891b2): 唯一的操作强调色。用于主按钮背景、导航 active 态、焦点光环、链接、进度条填充。覆盖面控制在任何屏幕的 10% 以内 — 它的稀缺性就是它的力量。

### Neutral
- **Frosted Steel** (#e8ecf1): 页面底色。冷灰蓝，不暖不冷，安静承载所有内容。叠加三个径向渐变营造微弱环境光（左上青、右下蓝、中心绿），但不改变整体色调。
- **Glass Surface** (#f7f8fa): 面板和卡片的扁平底色。这是当前半透明白色 rgba(255,255,255,0.65) 在 Frosted Steel 上的等效色 — 面板层级已从毛玻璃转为扁平纯色。
- **Glass Elevated** (#fbfcfc): 搜索框、按钮、表头等次级表面的底色。稍亮于 Glass Surface，提供微妙的信息层级区分。
- **Deep Sea Ink** (#1a1a2e): 正文和标题色。深海军蓝，非纯黑。在 Frosted Steel 上对比度 ≥ 8:1，远高于 WCAG AA。
- **Storm Gray** (#555770): 次要文本、标签、导航文字。中灰偏蓝，在背景上对比度 ≥ 5:1。
- **Fog Gray** (#8888a0): 占位符、提示文字、禁用态。最浅灰色，仅用于"可以忽略"的信息。

### Functional
- **Signal Green** (#059669): 成功状态。爬取完成 ✓、保存成功、正常状态指示。
- **Signal Red** (#dc2626): 错误和危险操作。爬取失败 ✗、删除按钮、暂停标记。不用于装饰。
- **Signal Blue** (#2563eb): 信息标记和辅助强调。AI 功能区块、辅助徽章。

### Named Rules
**The One Accent Rule.** Signal Cyan 在任何屏幕上覆盖率 ≤10%。按钮、链接、导航、焦点环共享同一个青色 — 使用者凭颜色就知道"这里可以操作"。功能色（绿/红/蓝）仅用于状态标记，永远不作为装饰色。

**The Flat-By-Default Rule.** 日常面板和卡片使用纯色背景（Glass Surface）。毛玻璃模糊（backdrop-filter）仅保留在模态框和弹窗上，作为注意力聚焦信号。日常浏览不消耗 blur 性能。

## 3. Typography

**Font:** Inter (Google Fonts, weights 300/400/500/600/700)
**Mono Font:** Courier New (数据展示)

**Character:** Inter 是一个现代功能型无衬线字体，中性、高可读性，适合工具界面的信息密度。不做字体配对 — 同一个字体家族通过字重和大小区分层级，减少视觉噪音。

### Hierarchy
- **Headline** (600, 24px, line-height 1.3, letter-spacing -0.02em): 面板主标题。每个面板只有一个 h1。
- **Body** (400, 15px, line-height 1.5): 正文和表单内容。最大行宽 75ch（在 1050px 容器内自然成立）。
- **Label** (600, 12px, line-height 1.4, letter-spacing 0.04em, uppercase): 表单标签、按钮文字、侧边栏标题。大写 + 加宽字间距区分于正文。
- **Nav** (500, 13px, line-height 1.4): 导航项目和子标签页。比正文小，比标签大，处于中间信息层。
- **Mono** (400, 13px, line-height 1.5): 包名、文件路径、搜索输入、数据数字。Courier New 回退至系统等宽字体。

### Named Rules
**The One Font Rule.** 全界面仅使用 Inter 一个字体家族。等宽数据展示使用 Courier New。禁止引入第三个字体家族。层级通过字重（300–700）和大小（10px–24px）区分，不通过字体切换。

## 4. Elevation

混合层级策略：日常表面扁平，注意力阻断处保留毛玻璃。

面板、卡片、表格等日常界面使用纯色背景，通过色调深浅区分层级（Frosted Steel → Glass Surface → Glass Elevated）。不使用阴影表达层级关系。

模态框和弹窗是唯一的例外 — 保留 `backdrop-filter: blur(20px)` 的毛玻璃效果。这不是装饰，是功能：模糊背景告诉使用者"当前焦点在这里，其他区域不可操作"。`backdrop-filter: blur(2px)` 用于模态框遮罩层。

### Shadow Vocabulary
- **Focus Glow** (`box-shadow: 0 0 0 3px rgba(8,145,178,0.2)`): 输入框聚焦指示。替代浏览器默认 outline。
- **Button Hover** (`box-shadow: 0 4px 24px rgba(8,145,178,0.2)`): 主按钮 hover 态。青色光晕，不是阴影抬升。
- **Surface Rest** (`box-shadow: 0 2px 12px rgba(0,0,0,0.04)`): 卡片和面板的极微阴影。几乎不可见，仅防止和背景融为一体。

### Named Rules
**The Focus-Not-Shadow Rule.** 阴影仅用于两个目的：聚焦指示（青色光环）和 hover 反馈（同色光晕放大）。阴影不作为层级表达手段 — 色调深浅承担那个角色。

## 5. Components

### Buttons
**Character:** 干脆利落。hover 瞬间变亮（不是渐变动画），点击即时生效。过渡 150ms。

- **Shape:** 12px 圆角 (--radius: 12px)
- **Primary:** 实心 Signal Cyan 背景、白色文字、10px 28px 内边距。字重 600，大写，0.04em 字间距
- **Hover:** 背景变为 #22d3ee（更亮的青色），4px 24px 青色光晕。150ms ease 过渡
- **Focus:** 3px 青色光环 (box-shadow)，无 outline
- **Disabled:** opacity: 0.4，cursor: not-allowed，无阴影
- **Secondary:** 透明背景，Signal Cyan 边框和文字。Hover 时变为实心青色
- **Danger:** Signal Red 背景，白色文字。Hover 时变亮 (#ef4444)
- **Icon:** 44px × 44px 正方，透明背景，hover 时变为青色

### Cards / Containers
**Character:** 安静承载内容，不做卡片套卡片。

- **Panel:** Glass Surface 背景，14px 圆角。右下角装饰性渐变三角形伪元素（当前设计特征，但非必须）
- **Product Card:** Glass Surface 背景 + 左边框强调。hover 时左边框变为 Signal Cyan，边框色加深
- **Image Card (video panel):** 2px 边框，10px 圆角，16:10 宽高比图片。选中时 Signal Cyan 边框 + 半透明青底
- **Prohibition:** 禁止卡片套卡片。面板本身就是容器，内部不嵌套 box-shadow 卡片

### Inputs / Fields
**Character:** 安静等待输入，聚焦时明确响应。

- **Style:** rgba(0,0,0,0.03) 深色背景，10px 圆角，12px 16px 内边距
- **Focus:** 无 outline，3px Signal Cyan 光晕 (box-shadow)，边框色变为 Signal Cyan
- **Placeholder:** Fog Gray (#8888a0)，确保 ≥4.5:1 对比度
- **Select:** 同 input 样式，自定义下拉箭头

### Navigation
**Character:** 固定侧边栏，清晰的当前位置指示。

- **Sidebar:** 220px 固定宽度，sticky 定位，独立滚动。顶部 2px 渐变装饰条（青→蓝→绿）
- **Nav Item:** 13px Inter 500，10px 圆角。hover 时 rgba(0,0,0,0.04) 暗化。active 时 Signal Cyan 15% 透明背景 + Signal Cyan 文字
- **Sub-tabs:** 底部边框风格。12px Inter 600 等宽。active 时 2px Signal Cyan 底部边框
- **Responsive (< 900px):** 侧边栏缩至 160px

### Tags / Chips
**Character:** 彩色标签标记分类，颜色 = 类别，不是装饰。

- **Style:** 小圆角底色徽章，11px 字，600 字重
- **Variants:** 橙色 (地区 #e07b3c)、蓝色 (帧类型 #3b82f6)、绿色 (成效 #10b981)、紫色 (产品 #7c3aed)
- **State Badges:** 绿色点 (正常)、红色点 (暂停)，6px 圆点 + 等宽文字

### Progress Bars
**Character:** 薄条进度，不给进度过多视觉重量。

- **Track:** 4px 高，Glass Elevated 背景，2px 圆角
- **Fill:** Signal Cyan，width 0.3s 过渡
- **Purpose:** 文件处理进度、视频生成进度

### Modals
**Character:** 系统唯一的毛玻璃保留区。下沉 + 模糊 = 不可忽略的注意力聚焦。

- **Overlay:** 固定定位，半透明黑色 + backdrop-filter: blur(2px)
- **Box:** Glass Surface 背景 + backdrop-filter: blur(20px)，14px 圆角，右下角装饰渐变三角形
- **Animation:** translateY(12px) scale(0.97) → 原位，200ms ease
- **Max Width:** 480px，92% 屏幕宽（小屏自适应）

## 6. Do's and Don'ts

### Do:
- **Do** 用 Signal Cyan 标记所有可操作元素 — 一个颜色，一个含义
- **Do** 用功能色（绿/红/蓝）仅标记状态，不用作装饰
- **Do** 保持操作路径 ≤2 步：面板切换（1 步）+ 面板内操作（1 步）
- **Do** 每个异步操作给出 ⏳/✅/❌ 三段式状态反馈
- **Do** 表单输入用 localStorage 自动保留，防止误关闭丢失
- **Do** 扁平纯色表面用于日常浏览，毛玻璃仅用于模态框
- **Do** 标签使用大写 + 0.04em 字间距，统一区分于正文
- **Do** 数据展示（包名/路径/数字）使用 Courier New 等宽字体

### Don't:
- **Don't** 使用传统 ERP 式的密集表格 + 10px 小字体 + 灰色海洋 — PRODUCT.md 明确拒绝
- **Don't** 卡片套卡片 — 面板就是容器，内部不嵌套 box-shadow 卡片
- **Don't** 使用超过 150ms 的操作动画 — 工具不需要"呼吸感"
- **Don't** 引入第三个字体家族 — Inter + Courier New 足够
- **Don't** 用弹跳/弹性缓动 — ease-out 即可
- **Don't** 使用 `border-left` 大于 1px 的彩色侧边条纹（已有 3px 左边框的卡片除外，那是产品卡片的选择指示器，有功能含义）
- **Don't** 灰色文字放彩色背景上 — 用背景同色相的深色版或文字色的透明度
- **Don't** 纯黑色 (#000) 或纯白色 (#fff) — 始终 tint（深海军蓝代替纯黑，微暖/微冷白代替纯白）
- **Don't** 在非模态场景使用 backdrop-filter: blur() — 性能成本不值得
- **Don't** 为了"好看"增加操作步骤 — PRODUCT.md 核心原则
