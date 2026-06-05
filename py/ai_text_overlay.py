"""AI 文案叠加 — LLM 设计参数，FFmpeg 渲染"""
import json
import os
import subprocess
import sys
import tempfile


def _log(msg: str):
    sys.stderr.write(f"  [AI-Text] {msg}\n")
    sys.stderr.flush()


def _ask_llm_design_text(texts: list[str], video_w: int, video_h: int, duration: float,
                         api_key: str) -> dict:
    """调用豆包 LLM，让它设计文字叠加参数。返回 FFmpeg drawtext 可用的参数列表。"""
    from volcenginesdkarkruntime import Ark

    client = Ark(
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        api_key=api_key,
    )

    system_prompt = """你是专业视频后期制作师，擅长设计电影级文字叠加效果。

你的任务：为视频设计文字叠加参数，返回严格 JSON 格式。

输出格式（必须严格遵守）：
```json
{
  "texts": [
    {
      "text": "原文字内容",
      "start_time": 1.5,
      "end_time": 4.5,
      "font_size": 72,
      "x": "center",
      "y": "20%",
      "color": "white",
      "shadow": true,
      "border": 3,
      "animation": "fade_in_out",
      "animation_duration": 0.5
    }
  ]
}
```

设计原则：
- 不超过2条文案，不重叠出现
- 文字在安全区域内（距边缘至少10%）
- 字号按视频短边的 5-8% 计算
- 淡入淡出动画 0.3-0.6 秒
- 根据文案长度调整显示时间（短文字2秒，长文字3-4秒）
- 中文用优雅字体风格
"""

    # 计算建议文字参数
    min_dim = min(video_w, video_h)
    suggest_font_size = max(int(min_dim * 0.06), 48)

    user_prompt = f"""视频信息：
- 分辨率：{video_w}×{video_h}（{video_w/video_h:.2f}:1）
- 总时长：{duration:.1f} 秒
- 建议字号：{suggest_font_size}px（基于短边 6%）

需要叠加的文案：
{chr(10).join(f'{i+1}. {t}' for i, t in enumerate(texts))}

请设计每条文案的叠加参数，输出 JSON。"""

    _log(f"Asking LLM to design text overlay (texts={len(texts)}, {video_w}x{video_h}, {duration:.1f}s)...")

    try:
        response = client.chat.completions.create(
            model="doubao-1-5-pro-32k-250115",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=1024,
        )
        content = response.choices[0].message.content
        _log(f"LLM response: {content[:500]}")

        # 提取 JSON
        # 可能被 ```json ... ``` 包裹
        json_str = content
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        design = json.loads(json_str.strip())
        _log(f"LLM designed {len(design.get('texts', []))} text overlays")
        return design
    except Exception as e:
        _log(f"LLM call failed: {e}, using fallback design")
        return _fallback_design(texts, video_w, video_h, duration)


def _fallback_design(texts: list[str], video_w: int, video_h: int, duration: float) -> dict:
    """LLM 不可用时的回退设计。"""
    min_dim = min(video_w, video_h)
    font_size = max(int(min_dim * 0.06), 48)
    designs = []
    segment = duration / max(len(texts), 1)
    for i, text in enumerate(texts):
        designs.append({
            "text": text,
            "start_time": segment * i + 0.5,
            "end_time": min(segment * (i + 1) - 0.5, duration),
            "font_size": font_size,
            "x": "center",
            "y": "20%" if i == 0 else "50%",
            "color": "white",
            "shadow": True,
            "border": 4,
            "animation": "fade_in_out",
            "animation_duration": 0.4,
        })
    return {"texts": designs}


def apply_text_overlay(input_video: str, output_video: str, design: dict,
                       duration: float, ffmpeg_path: str = "ffmpeg") -> str:
    """用 FFmpeg 将 AI 设计的文字叠加到视频上。"""
    texts = design.get("texts", [])
    if not texts:
        # 没有文字，直接复制
        _log("No text designs, copying video unchanged")
        import shutil
        shutil.copy2(input_video, output_video)
        return output_video

    # 查找可用中文字体
    font_file = _find_font()
    if not font_file:
        _log("No Chinese font found, skipping text overlay")
        import shutil
        shutil.copy2(input_video, output_video)
        return output_video

    _log(f"Applying {len(texts)} text overlays with font: {font_file}")

    # 构建 drawtext 滤镜链
    filter_parts = ["[0:v]"]
    current_label = "0:v"
    for i, t in enumerate(texts):
        text = t["text"]
        start = t.get("start_time", 1)
        end = t.get("end_time", duration)
        font_size = t.get("font_size", 64)
        x_pos = t.get("x", "center")
        y_pos = t.get("y", "20%")
        color = t.get("color", "white")
        shadow = t.get("shadow", True)
        border = t.get("border", 3)
        animation = t.get("animation", "fade_in_out")
        anim_dur = t.get("animation_duration", 0.4)

        # 转义特殊字符
        escaped = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")

        # Alpha 表达式：淡入淡出
        if animation == "fade_in_out":
            alpha = (
                f"if(lt(t,{start}),0,"
                f"if(lt(t,{start}+{anim_dur}),(t-{start})/{anim_dur},"
                f"if(lt(t,{end}-{anim_dur}),1,"
                f"if(lt(t,{end}),({end}-t)/{anim_dur},0))))"
            )
        else:
            alpha = "1"

        # 位置计算
        if x_pos == "center":
            x_expr = "(w-text_w)/2"
        elif x_pos == "left":
            x_expr = f"w*0.05"
        elif x_pos == "right":
            x_expr = f"w*0.95-text_w"
        elif x_pos.endswith("%"):
            pct = float(x_pos[:-1]) / 100
            x_expr = f"w*{pct}"
        else:
            x_expr = x_pos

        if y_pos == "center":
            y_expr = "(h-text_h)/2"
        elif y_pos.endswith("%"):
            pct = float(y_pos[:-1]) / 100
            y_expr = f"h*{pct}"
        else:
            y_expr = y_pos

        # 阴影 + 描边
        shadow_opts = ""
        if shadow:
            shadow_opts = ":shadowcolor=black@0.7:shadowx=3:shadowy=3"

        border_opts = f":borderw={border}:bordercolor=black@0.4"

        out_label = f"[txt{i}]" if i < len(texts) - 1 else "[outv]"
        filter_parts.append(
            f"[{current_label}]drawtext="
            f"fontfile={font_file}:"
            f"text='{escaped}':"
            f"fontsize={font_size}:"
            f"fontcolor={color}"
            f"{shadow_opts}"
            f"{border_opts}:"
            f"alpha='{alpha}':"
            f"x={x_expr}:y={y_expr}"
            f"{out_label}"
        )
        current_label = out_label if not out_label.startswith("[outv]") else ""

    if current_label:
        filter_parts.append(f"[{current_label}]format=yuv420p[outv]")

    filter_complex = ";".join(filter_parts)

    cmd = [
        ffmpeg_path, "-y",
        "-i", input_video.replace("\\", "/"),
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "0:a?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac",
        "-pix_fmt", "yuv420p",
        output_video.replace("\\", "/"),
    ]

    _log(f"FFmpeg text overlay: {subprocess.list2cmdline(cmd)[:200]}...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        _log(f"FFmpeg text overlay FAILED: {result.stderr[-500:]}")
        raise RuntimeError(f"FFmpeg text overlay failed: {result.stderr[-200:]}")

    _log(f"Text overlay complete: {output_video}")
    return output_video


def _find_font() -> str | None:
    """查找可用中文字体（去掉盘符避免 FFmpeg 冒号问题）。"""
    import platform
    system_root = os.environ.get("SystemRoot", r"C:\Windows")
    if platform.system() == "Windows":
        font_dir = os.path.join(system_root, "Fonts")
        candidates = [
            os.path.join(font_dir, "simhei.ttf"),
            os.path.join(font_dir, "msyh.ttc"),
            os.path.join(font_dir, "simsun.ttc"),
        ]
    else:
        candidates = [
            "/System/Library/Fonts/PingFang.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        ]
    for p in candidates:
        if os.path.isfile(p):
            path = p.replace("\\", "/")
            if len(path) > 2 and path[1] == ":":
                path = path[2:]
            return path
    return None
