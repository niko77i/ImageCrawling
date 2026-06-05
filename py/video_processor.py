"""视频处理模块 — FFmpeg 滤镜链构建与子进程执行。"""
import os
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
        """构建完整的 FFmpeg 命令（滤镜链方式，单命令输出）。"""
        images = self.params["images"]
        settings = self.params["settings"]
        logo = self.params.get("logo")
        transition = settings.get("transition", "fade")
        duration_per_frame = int(settings.get("duration_per_frame", 3))
        resolution = settings.get("resolution", "1920:1080")
        output_path = settings["output_path"]
        ffmpeg = self._ffmpeg_path()

        cmd = [ffmpeg, "-y"]

        # 输入：每张图片
        for img_path in images:
            cmd += ["-loop", "1", "-i", img_path.replace("\\", "/")]

        # 输入：Logo（如果有）
        logo_input_idx = len(images)
        if logo and logo.get("path") and os.path.isfile(logo["path"]):
            cmd += ["-loop", "1", "-i", logo["path"].replace("\\", "/")]
        else:
            logo_input_idx = -1

        # 输入：背景音乐（如果有）
        music_path = settings.get("music_path")
        has_music = bool(music_path and os.path.isfile(music_path))
        music_input_idx = len(images) + (1 if logo_input_idx >= 0 else 0)
        if has_music:
            cmd += ["-i", music_path.replace("\\", "/")]

        # 构建滤镜图
        filter_parts = []
        total_duration = 0.0

        # 第一步：每张图片 → 标准化视频流 [v0], [v1], ...
        for i in range(len(images)):
            filter_parts.append(
                f"[{i}:v]loop=loop=-1:size=1:start=0,trim=duration={duration_per_frame},"
                f"setpts=PTS-STARTPTS,scale={resolution}:force_original_aspect_ratio=decrease,"
                f"pad={resolution}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v{i}]"
            )

        # 第二步：xfade 转场链
        if len(images) == 1:
            prev_label = "v0"
            total_duration = duration_per_frame
        else:
            offset = 0.0
            xfade_dur = 0.5 if transition != "none" else 0.0
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
            prev_label = f"f{len(images) - 2}"
            total_duration = offset + duration_per_frame

        # 第三步：Logo 叠加（如果有）
        if logo_input_idx >= 0:
            logo_pos = logo.get("position", "top-right")
            logo_effect = logo.get("effect", "static")
            overlay_expr = self._logo_overlay(logo_pos)

            if logo_effect == "fade":
                filter_parts.append(
                    f"[{logo_input_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS,"
                    f"fade=t=in:st=0:d=1,fade=t=out:st={total_duration-1}:d=1[l]"
                )
                filter_parts.append(f"{prev_label}[l]overlay={overlay_expr}[outv]")
            else:
                filter_parts.append(
                    f"[{logo_input_idx}:v]loop=loop=-1:size=1:start=0,"
                    f"trim=duration={total_duration},setpts=PTS-STARTPTS[l]"
                )
                if logo_effect == "bounce":
                    overlay_expr = self._logo_overlay("floating")
                filter_parts.append(f"{prev_label}[l]overlay={overlay_expr}[outv]")
            video_out = "[outv]"
        else:
            video_out = prev_label if len(images) == 1 else f"[f{len(images) - 2}]"

        # 第四步：音频处理
        if has_music:
            filter_parts.append(
                f"[{music_input_idx}:a]volume=0.3,aloop=loop=-1:size=2e+09,"
                f"atrim=duration={total_duration}[aout]"
            )
            audio_map = "[aout]"
        else:
            filter_parts.append(
                f"anullsrc=r=44100:cl=stereo,atrim=duration={total_duration}[s]"
            )
            audio_map = "[s]"

        # 组装完整滤镜
        filter_complex = ";".join(filter_parts)
        cmd += ["-filter_complex", filter_complex]
        cmd += ["-map", video_out, "-map", audio_map]
        cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "18"]
        cmd += ["-pix_fmt", "yuv420p"]
        cmd += ["-shortest"]
        cmd += [output_path.replace("\\", "/")]

        self._total_duration = total_duration
        return cmd

    def run(self):
        """执行 FFmpeg 命令（阻塞，在独立线程中调用）。"""
        cmd = self.build_command()
        self.status = "processing"
        self.message = "正在启动 FFmpeg..."

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
                self.status = "error"
                self.message = f"FFmpeg 返回错误码 {self._proc.returncode}"
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
