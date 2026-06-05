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
        duration_per_frame = int(settings.get("duration_per_frame", 3))
        resolution = settings.get("resolution", "1920:1080")
        output_path = settings["output_path"]
        background_path = settings.get("background_path")
        background_color = settings.get("background_color", "1a1a2e")
        content_scale = float(settings.get("content_scale", 0.82))
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

        img_start = next_idx
        for img_path in images:
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

        # ② 内容图片 → 缩放到 inner_W×inner_H → 透明填充到 W×H → [v0],[v1],...
        for i in range(len(images)):
            idx = img_start + i
            filter_parts.append(
                f"[{idx}:v]loop=loop=-1:size=1:start=0,"
                f"trim=duration={duration_per_frame},setpts=PTS-STARTPTS,"
                f"scale={inner_W}:{inner_H}:force_original_aspect_ratio=decrease,"
                f"format=rgba,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black@0,"
                f"setsar=1,fps=30[v{i}]"
            )

        # ③ xfade 转场链（rgba 格式，alpha 会被保留）
        if len(images) == 1:
            fg_label = "[v0]"
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
            overlay_expr = self._logo_overlay(logo_pos)

            if logo_effect == "fade":
                filter_parts.append(
                    f"[{logo_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"scale={logo_max_w}:-1:force_original_aspect_ratio=decrease,"
                    f"format=rgba,"
                    f"fade=t=in:st=0:d=1,fade=t=out:st={total_duration-1}:d=1[l]"
                )
                filter_parts.append(f"[comp][l]overlay={overlay_expr}[post_logo]")
            else:
                filter_parts.append(
                    f"[{logo_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"scale={logo_max_w}:-1:force_original_aspect_ratio=decrease,"
                    f"format=rgba[l]"
                )
                if logo_effect == "bounce":
                    overlay_expr = self._logo_overlay("floating")
                filter_parts.append(f"[comp][l]overlay={overlay_expr}[post_logo]")

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
                # 字号按短边的 6% 计算（9:16 竖屏约 65px）
                font_size = max(int(min(W, H) * 0.06), 36)

                for ti, text in enumerate(texts[:2]):
                    # 随机开始时间（避开开头 1s 和结尾 3s）
                    max_start = max(0.0, total_duration - 3.0)
                    if max_start > 1.0:
                        start_t = round(rng.uniform(1.0, max_start), 2)
                    else:
                        start_t = 1.0
                    disp_dur = round(rng.uniform(2.0, 3.0), 1)

                    # 位置：第一条靠上，第二条靠下
                    y_expr = f"h*0.13" if ti == 0 else f"h*0.75"

                    # alpha 表达式：淡入 0.3s + 停留 + 淡出 0.3s
                    fade_dur = 0.3
                    alpha = (
                        f"if(lt(t,{start_t}),0,"
                        f"if(lt(t,{start_t}+{fade_dur}),(t-{start_t})/{fade_dur},"
                        f"if(lt(t,{start_t}+{disp_dur}-{fade_dur}),1,"
                        f"if(lt(t,{start_t}+{disp_dur}),({start_t}+{disp_dur}-t)/{fade_dur},0))))"
                    )

                    escaped = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
                    out_label = f"[txt{ti}]"
                    filter_parts.append(
                        f"{current_vid}drawtext="
                        f"fontfile={font_file}:"
                        f"text='{escaped}':"
                        f"fontsize={font_size}:"
                        f"fontcolor=white:"
                        f"shadowcolor=black@0.7:shadowx=3:shadowy=3:"
                        f"borderw=2:bordercolor=black@0.4:"
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
        cmd = self.build_command()
        self.status = "processing"
        self.message = "正在启动 FFmpeg..."
        self._stderr_lines = []  # 收集 stderr 用于错误诊断

        try:
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
    def _logo_overlay(position: str) -> str:
        """根据位置返回 FFmpeg overlay 表达式。"""
        margin = 10
        expressions = {
            "top-left": f"{margin}:{margin}",
            "top-right": f"W-w-{margin}:{margin}",
            "bottom-left": f"{margin}:H-h-{margin}",
            "bottom-right": f"W-w-{margin}:H-h-{margin}",
            "floating": f"{margin}+20*sin(t*2):H-h-{margin}-20*abs(cos(t*1.5))",
        }
        return expressions.get(position, expressions["top-right"])

    @staticmethod
    def _find_font() -> str | None:
        """查找可用中文字体文件（Windows），返回正斜杠路径供 FFmpeg 使用。"""
        font_dir = r"C:\Windows\Fonts"
        candidates = [
            os.path.join(font_dir, "simhei.ttf"),       # 黑体 — 粗壮醒目
            os.path.join(font_dir, "msyh.ttc"),         # 微软雅黑 — 现代
            os.path.join(font_dir, "simsun.ttc"),        # 宋体 — 回退
        ]
        for p in candidates:
            if os.path.isfile(p):
                # 去掉盘符避免冒号（FFmpeg 用 : 分隔选项名值对）
                # C:\Windows\Fonts\simhei.ttf → /Windows/Fonts/simhei.ttf
                path = p.replace("\\", "/")
                if ":" in path:
                    path = path.split(":", 1)[1]  # 去掉 C:
                return path
        return None
