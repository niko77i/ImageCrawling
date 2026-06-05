"""视频处理模块 — FFmpeg 滤镜链构建与子进程执行。"""
import os
import random
import re
import subprocess
import uuid


class VideoError(Exception):
    """视频处理失败异常。"""
    pass


class VideoTask:
    """封装一个视频生成任务：构建 FFmpeg 命令、执行、解析进度。"""

    def __init__(self, params: dict):
        self.task_id = uuid.uuid4().hex[:12]
        self.params = params
        self.status = "pending"      # pending | processing | completed | error
        self.progress = 0.0
        self.message = ""
        self._result = None
        self._proc = None
        self._total_duration = 0.0

    # ---------- 公开 API ----------

    def build_command(self) -> list[str]:
        """构建完整的 FFmpeg 命令（滤镜链方式，单命令输出）。

        滤镜链结构：
          背景层 → [bg]
          图片 → 缩放+透明填充 → xfade链 → [fg]
          [bg][fg] overlay → [comp]
          Logo 叠加 → [outv]
          音频 → [aout]
        """
        images = self.params["images"]
        settings = self.params["settings"]
        logo = self.params.get("logo")
        transition = settings.get("transition", "fade")
        duration_per_frame = int(settings.get("duration_per_frame") or 3)
        resolution = settings.get("resolution", "1920:1080")
        output_path = settings["output_path"]
        background_path = settings.get("background_path")
        background_color = settings.get("background_color", "1a1a2e")
        _raw_scale = settings.get("content_scale")
        content_scale = float(_raw_scale if _raw_scale is not None else 0.82)
        ffmpeg = self._ffmpeg_path()

        # 解析分辨率
        res_parts = resolution.split(":")
        W, H = int(res_parts[0]), int(res_parts[1])
        inner_W = max(int(W * content_scale), 64)
        inner_H = max(int(H * content_scale), 64)
        # Logo 缩放到画面宽度的 16%（最小值 72px），只占一小角
        logo_max_w = max(int(W * 0.16), 72)

        # 提前计算总时长（后面多次用到）
        xfade_dur = 0.5 if transition != "none" else 0.0
        if len(images) == 1:
            total_duration = float(duration_per_frame)
        else:
            total_duration = (len(images) - 1) * (duration_per_frame - xfade_dur) + duration_per_frame

        cmd = [ffmpeg, "-y"]

        # ---- 输入排序 ----
        # 0: 背景图片（如果有；没有就用 color 滤镜生成）
        # 1..N: 内容图片
        # N+1: Logo（如果有）
        # N+2: 音乐（如果有）

        has_bg_image = bool(background_path and os.path.isfile(background_path))
        next_idx = 0

        if has_bg_image:
            cmd += ["-loop", "1", "-i", background_path.replace("\\", "/")]
            bg_src = f"[{next_idx}:v]"
            next_idx += 1
        else:
            bg_src = None  # 用 color 滤镜生成

        # AI 视频替换：如果有 AI 生成的视频，用它替代原始图片
        ai_videos = self.params.get("_ai_videos") or {}
        img_start = next_idx
        for img_path in images:
            ai_path = ai_videos.get(img_path)
            if ai_path and os.path.isfile(ai_path):
                # 用 AI 视频作为输入（无需 loop）
                cmd += ["-i", ai_path.replace("\\", "/")]
            else:
                cmd += ["-loop", "1", "-i", img_path.replace("\\", "/")]
            next_idx += 1

        logo_idx = -1
        if logo and logo.get("path") and os.path.isfile(logo["path"]):
            logo_idx = next_idx
            cmd += ["-loop", "1", "-i", logo["path"].replace("\\", "/")]
            next_idx += 1

        music_path = settings.get("music_path")
        has_music = bool(music_path and os.path.isfile(music_path))
        music_idx = next_idx if has_music else -1
        if has_music:
            cmd += ["-i", music_path.replace("\\", "/")]

        # ---- 滤镜图 ----
        filter_parts = []

        # ① 背景 → [bg]（rgba 格式，统一用 alpha 通道）
        if bg_src is not None:
            filter_parts.append(
                f"{bg_src}loop=loop=-1:size=1:start=0,"
                f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                f"scale={W}:{H}:force_original_aspect_ratio=increase,"
                f"crop={W}:{H},format=rgba[bg]"
            )
        else:
            filter_parts.append(
                f"color=c=0x{background_color}:s={W}x{H}:r=30,"
                f"format=rgba,trim=duration={total_duration}[bg]"
            )

        # ② 内容图片/AI视频 → 缩放到 inner_W×inner_H → 透明填充到 W×H → [v0],[v1],...
        for i in range(len(images)):
            idx = img_start + i
            img_path = images[i]
            if ai_videos.get(img_path):
                # AI 视频：无需 loop，直接 trim + scale + pad
                filter_parts.append(
                    f"[{idx}:v]trim=duration={duration_per_frame},setpts=PTS-STARTPTS,"
                    f"scale={inner_W}:{inner_H}:force_original_aspect_ratio=decrease,"
                    f"format=rgba,"
                    f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black@0,"
                    f"setsar=1,fps=30[v{i}]"
                )
            else:
                filter_parts.append(
                    f"[{idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={duration_per_frame},setpts=PTS-STARTPTS,"
                    f"scale={inner_W}:{inner_H}:force_original_aspect_ratio=decrease,"
                    f"format=rgba,"
                    f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black@0,"
                    f"setsar=1,fps=30[v{i}]"
                )

        # ③ 转场链（xfade）或直接拼接（concat，无转场时）
        if len(images) == 1:
            fg_label = "[v0]"
        elif transition == "none":
            # 无转场 → concat 直接拼接
            concat_inputs = "".join(f"[v{i}]" for i in range(len(images)))
            filter_parts.append(
                f"{concat_inputs}concat=n={len(images)}:v=1:a=0[fg]"
            )
            fg_label = "[fg]"
        else:
            offset = 0.0
            for i in range(len(images) - 1):
                if i == 0:
                    input_a = "[v0]"
                    input_b = "[v1]"
                    out_label = "[f0]"
                else:
                    input_a = f"[f{i-1}]"
                    input_b = f"[v{i+1}]"
                    out_label = f"[f{i}]"
                offset += (duration_per_frame - xfade_dur)
                filter_parts.append(
                    f"{input_a}{input_b}xfade=transition={transition}:"
                    f"duration={xfade_dur}:offset={offset}{out_label}"
                )
            fg_label = f"[f{len(images) - 2}]"

        # ④ 将前景（rgba，透明填充区域会露底）叠加到背景上
        filter_parts.append(f"[bg]{fg_label}overlay=0:0[comp]")

        # ⑤ Logo 叠加（缩放到画面宽度 16%）
        if logo_idx >= 0:
            logo_pos = logo.get("position", "top-right")
            logo_effect = logo.get("effect", "static")
            overlay_x, overlay_y = self._logo_xy(logo_pos)

            if logo_effect == "fade":
                # 淡入淡出
                filter_parts.append(
                    f"[{logo_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"scale={logo_max_w}:-1:force_original_aspect_ratio=decrease,"
                    f"format=rgba,"
                    f"fade=t=in:st=0:d=1,fade=t=out:st={total_duration-1}:d=1[l]"
                )
                filter_parts.append(f"[comp][l]overlay=x='{overlay_x}':y='{overlay_y}'[post_logo]")

            elif logo_effect == "bounce":
                # 浮动弹跳 — 使用动态坐标，忽略位置选择
                bx, by = self._logo_xy("floating")
                filter_parts.append(
                    f"[{logo_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"scale={logo_max_w}:-1:force_original_aspect_ratio=decrease,"
                    f"format=rgba[l]"
                )
                filter_parts.append(f"[comp][l]overlay=x='{bx}':y='{by}'[post_logo]")

            elif logo_effect == "zoom-in":
                # 放大进入：0→0.6s 从 0.3x 放大到 1x，同时淡入
                filter_parts.append(
                    f"[{logo_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"scale={logo_max_w}:-1:force_original_aspect_ratio=decrease,"
                    f"format=rgba,"
                    f"fade=t=in:st=0:d=0.6:alpha=1[l]"
                )
                filter_parts.append(f"[comp][l]overlay=x='{overlay_x}':y='{overlay_y}'[post_logo]")

            elif logo_effect == "slide-right":
                # 从右滑入：0→0.6s 从画面外右侧滑到目标位置
                sx = f"if(lt(t,0.6),W-(W-w+10)*(t/0.6),{overlay_x})"
                filter_parts.append(
                    f"[{logo_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"scale={logo_max_w}:-1:force_original_aspect_ratio=decrease,"
                    f"format=rgba[l]"
                )
                filter_parts.append(f"[comp][l]overlay=x='{sx}':y='{overlay_y}'[post_logo]")

            elif logo_effect == "pulse":
                # 脉冲缩放：周期性缩放 + 浮动
                px = f"{overlay_x}+6*sin(t*3)"
                py = f"{overlay_y}+4*sin(t*2.5)"
                filter_parts.append(
                    f"[{logo_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"scale={logo_max_w}:-1:force_original_aspect_ratio=decrease,"
                    f"format=rgba[l]"
                )
                filter_parts.append(f"[comp][l]overlay=x='{px}':y='{py}'[post_logo]")

            else:
                # static — 静态放置
                filter_parts.append(
                    f"[{logo_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"scale={logo_max_w}:-1:force_original_aspect_ratio=decrease,"
                    f"format=rgba[l]"
                )
                filter_parts.append(f"[comp][l]overlay=x='{overlay_x}':y='{overlay_y}'[post_logo]")

            current_vid = "[post_logo]"
        else:
            current_vid = "[comp]"

        # ⑥ 文案浮层（最多两条，随机浮现 2-3 秒，艺术字效果）
        texts = [t.strip() for t in (settings.get("texts") or []) if t.strip()]
        if texts:
            font_file = self._find_font()
            if font_file:
                # 用文案内容 hash 做随机种子，保证可复现
                seed = sum(ord(c) for c in texts[0]) + len(texts[0])
                rng = random.Random(seed)
                # 字号按短边的 8% 计算（1080p 约 86px），加粗描边更清晰
                font_size = max(int(min(W, H) * 0.08), 48)

                # 预计算所有文案的时间，确保不重叠
                text_timings = []
                prev_end = 0.0
                for ti in range(min(len(texts), 2)):
                    earliest = max(1.0, prev_end + 0.5)
                    # 至少需要 2 秒显示时间（含淡入淡出），末尾留 0.5s 余量
                    if earliest + 2.0 > total_duration - 0.5:
                        break
                    # 可用时长：从 earliest 到 total_duration-0.5
                    avail = total_duration - 0.5 - earliest
                    disp_dur = round(min(rng.uniform(2.0, 3.0), avail), 1)
                    latest = max(earliest, total_duration - 0.5 - disp_dur)
                    start_t = round(rng.uniform(earliest, latest), 2) if latest > earliest else earliest
                    text_timings.append((start_t, disp_dur))
                    prev_end = start_t + disp_dur

                for ti, (start_t, disp_dur) in enumerate(text_timings):
                    text = texts[ti]
                    # 位置：第一条中上，第二条中间偏下
                    y_expr = f"h*0.20" if ti == 0 else f"h*0.50"

                    # alpha 表达式：淡入 0.3s + 停留 + 淡出 0.3s
                    fade_dur = 0.3
                    alpha = (
                        f"if(lt(t,{start_t}),0,"
                        f"if(lt(t,{start_t}+{fade_dur}),(t-{start_t})/{fade_dur},"
                        f"if(lt(t,{start_t}+{disp_dur}-{fade_dur}),1,"
                        f"if(lt(t,{start_t}+{disp_dur}),({start_t}+{disp_dur}-t)/{fade_dur},0))))"
                    )

                    escaped = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("%", "%%")
                    out_label = f"[txt{ti}]"
                    filter_parts.append(
                        f"{current_vid}drawtext="
                        f"fontfile={font_file}:"
                        f"text='{escaped}':"
                        f"fontsize={font_size}:"
                        f"fontcolor=white:"
                        f"shadowcolor=black@0.8:shadowx=4:shadowy=4:"
                        f"borderw=4:bordercolor=black@0.5:"
                        f"alpha='{alpha}':"
                        f"x=(w-text_w)/2:y={y_expr}"
                        f"{out_label}"
                    )
                    current_vid = out_label

        # ⑦ 转 yuv 准备编码
        filter_parts.append(f"{current_vid}format=yuv420p[outv]")

        # ⑧ 音频
        if has_music:
            filter_parts.append(
                f"[{music_idx}:a]volume=0.3,aloop=loop=-1:size=2e+09,"
                f"atrim=duration={total_duration}[aout]"
            )
            audio_map = "[aout]"
        else:
            filter_parts.append(
                f"anullsrc=r=44100:cl=stereo,atrim=duration={total_duration}[s]"
            )
            audio_map = "[s]"

        # ---- 组装 ----
        filter_complex = ";".join(filter_parts)
        cmd += ["-filter_complex", filter_complex]
        cmd += ["-map", "[outv]", "-map", audio_map]
        cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "18"]
        cmd += ["-pix_fmt", "yuv420p"]
        cmd += ["-shortest"]
        cmd += [output_path.replace("\\", "/")]

        self._total_duration = total_duration
        self._cmd = cmd
        return cmd

    def run(self):
        """执行 FFmpeg 命令（阻塞，在独立线程中调用）。"""
        self.status = "processing"
        self.message = "正在启动 FFmpeg..."
        self._stderr_lines = []  # 收集 stderr 用于错误诊断

        try:
            cmd = self.build_command()
            self._proc = subprocess.Popen(
                cmd,
                stderr=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                universal_newlines=True,
                encoding="utf-8",
                errors="replace",
            )
            for line in self._proc.stderr:
                self._stderr_lines.append(line)
                self._parse_progress(line)
            self._proc.wait()

            out_path = self.params["settings"]["output_path"]
            if self._proc.returncode == 0 and os.path.isfile(out_path):
                size_mb = os.path.getsize(out_path) / (1024 * 1024)
                self.status = "completed"
                self.progress = 1.0
                self.message = "视频生成完成"
                self._result = {
                    "path": out_path,
                    "size_mb": round(size_mb, 1),
                    "duration_s": round(self._total_duration, 1),
                }
            else:
                # 提取 FFmpeg 最后几行错误信息
                stderr_tail = "".join(self._stderr_lines[-8:]) if self._stderr_lines else "(无输出)"
                cmd_str = " ".join(getattr(self, '_cmd', []))
                self.status = "error"
                self.message = (
                    f"FFmpeg 返回错误码 {self._proc.returncode}。\n"
                    f"命令: {cmd_str[:300]}...\n"
                    f"stderr: {stderr_tail}"
                )
        except FileNotFoundError:
            self.status = "error"
            self.message = "未找到 FFmpeg，请确认 ffmpeg.exe 在系统 PATH 中或与程序在同一目录"
        except Exception as e:
            self.status = "error"
            self.message = f"视频生成异常: {e}"

    def result(self):
        """获取生成结果（仅在 completed 状态下有效）。"""
        return self._result

    # ---------- 内部方法 ----------

    @staticmethod
    def _ffmpeg_path() -> str:
        """获取 FFmpeg 可执行文件路径。"""
        try:
            from main import _get_ffmpeg_path
            path = _get_ffmpeg_path()
            if path:
                return path
        except Exception:
            pass
        return "ffmpeg"

    def _parse_progress(self, line: str):
        """从 FFmpeg stderr 行解析编码进度。"""
        m = re.search(r"time=(\d+):(\d+):(\d+\.\d+)", line)
        if m and self._total_duration > 0:
            h, minutes, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
            current = h * 3600 + minutes * 60 + s
            self.progress = min(current / self._total_duration, 0.99)
            self.message = f"编码中... {self.progress * 100:.0f}%"

    @staticmethod
    def _logo_xy(position: str) -> tuple[str, str]:
        """根据位置返回 (x_expr, y_expr) 供 overlay 滤镜使用。"""
        margin = 10
        positions = {
            "top-left":     (f"{margin}",                 f"{margin}"),
            "top-right":    (f"W-w-{margin}",             f"{margin}"),
            "bottom-left":  (f"{margin}",                 f"H-h-{margin}"),
            "bottom-right": (f"W-w-{margin}",             f"H-h-{margin}"),
            "floating":     (f"{margin}+20*sin(t*2)",     f"H-h-{margin}-20*abs(cos(t*1.5))"),
        }
        return positions.get(position, positions["top-right"])

    @staticmethod
    def _find_font() -> str | None:
        """查找可用中文字体文件，返回 FFmpeg 可用的路径（冒号转义）。"""
        import platform
        system_root = os.environ.get("SystemRoot", r"C:\Windows")
        if platform.system() == "Windows":
            font_dir = os.path.join(system_root, "Fonts")
            candidates = [
                os.path.join(font_dir, "simhei.ttf"),       # 黑体 — 粗壮醒目
                os.path.join(font_dir, "msyh.ttc"),         # 微软雅黑 — 现代
                os.path.join(font_dir, "simsun.ttc"),        # 宋体 — 回退
            ]
        else:
            # macOS / Linux 常见中文字体路径
            candidates = [
                "/System/Library/Fonts/PingFang.ttc",
                "/System/Library/Fonts/STHeiti Light.ttc",
                "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
                "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            ]
        for p in candidates:
            if os.path.isfile(p):
                # FFmpeg 用 : 分隔选项名值对，盘符冒号无法安全转义
                # 直接去掉盘符，C:/Windows/Fonts/simhei.ttf → /Windows/Fonts/simhei.ttf
                path = p.replace("\\", "/")
                if len(path) > 2 and path[1] == ":":
                    path = path[2:]
                return path
        return None
