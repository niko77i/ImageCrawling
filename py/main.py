import os
import subprocess
import sys
import webbrowser

# 确保当前目录优先于 site-packages（解决 py 包名冲突）
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from scraper import scrape_images, scrape_logo, ScrapeError
from resizer import process_image, save_logo, ResizeError
from utils import extract_package_name
from video_processor import VideoTask, VideoError
from ai_service import get_provider, AIServiceError

# 判断是否为 PyInstaller 打包模式
_FROZEN = getattr(sys, "frozen", False)

if _FROZEN:
    # 打包后所有文件在 sys._MEIPASS 下
    _FRONTEND_DIR = sys._MEIPASS
else:
    # 开发模式：前端文件在 py/ 的上级目录
    _FRONTEND_DIR = os.path.dirname(_current_dir)

app = Flask(__name__, static_folder=_FRONTEND_DIR, static_url_path="")
CORS(app)

# 视频生成任务存储
_video_tasks: dict[str, VideoTask] = {}


def _get_ffmpeg_path() -> str:
    """获取 FFmpeg 可执行文件路径。打包模式从 MEIPASS 加载，开发模式查 PATH。"""
    if _FROZEN:
        bundled = os.path.join(sys._MEIPASS, "ffmpeg.exe")
        if os.path.isfile(bundled):
            return bundled
    import shutil
    path = shutil.which("ffmpeg")
    if path:
        return path
    # 开发模式常见位置
    for p in [
        os.path.join(os.path.dirname(_current_dir), "ffmpeg.exe"),
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ]:
        if os.path.isfile(p):
            return p
    return "ffmpeg"


# ---------- 前端页面 ----------

@app.route("/")
def index():
    """返回前端页面。"""
    return send_from_directory(_FRONTEND_DIR, "index.html")


# ---------- API ----------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/scrape", methods=["POST"])
def scrape():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "请求体不能为空"}), 400

    url = data.get("url", "").strip()
    save_dir = data.get("save_dir", "").strip()
    # 新增参数：是否按 Google Ads 规格放大图片（默认 true，向后兼容）
    include_ads_images = data.get("include_ads_images", True)

    if not url:
        return jsonify({"success": False, "error": "URL 不能为空"}), 400
    if not save_dir:
        return jsonify({"success": False, "error": "保存路径不能为空"}), 400

    # 1. 提取包名
    try:
        pkg_name = extract_package_name(url)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400

    # 2. 创建保存目录
    pkg_dir = os.path.join(save_dir, pkg_name)
    try:
        os.makedirs(pkg_dir, exist_ok=True)
    except OSError as e:
        return jsonify({"success": False, "error": f"无法创建目录: {e}"}), 500

    response = {
        "success": True,
        "package_name": pkg_name,
        "saved_path": pkg_dir,
    }

    # ---- 3a. Logo 爬取（始终执行） ----
    try:
        logo_url = scrape_logo(url)
        if logo_url:
            logo_dir = os.path.join(pkg_dir, "包logo")
            try:
                os.makedirs(logo_dir, exist_ok=True)
                logo_result = save_logo(logo_url, logo_dir, f"{pkg_name}_logo")
                response["logo"] = logo_result
            except (ResizeError, OSError):
                response["logo"] = None
        else:
            response["logo"] = None
    except Exception:
        response["logo"] = None

    # ---- 3b. 广告图片爬取（始终执行） ----
    try:
        img_urls = scrape_images(url)
    except ScrapeError as e:
        response["image_count"] = 0
        response["images"] = []
        if response["logo"] is None:
            return jsonify({"success": False, "error": str(e)}), 500
        # 有 logo 但广告图爬取失败 — 部分成功
        response["success"] = True
        return jsonify(response)

    if not img_urls:
        response["image_count"] = 0
        response["images"] = []
        if response["logo"] is None:
            return jsonify({"success": False, "error": "该页面未找到图片"}), 404
    else:
        results = []
        # 不勾选时跳过 Google Ads 规格缩放，保留原图
        skip_scaling = not include_ads_images
        for i, img_url in enumerate(img_urls):
            try:
                result = process_image(img_url, pkg_dir, f"{pkg_name}_{i+1:03d}", skip_scaling=skip_scaling)
                results.append(result)
            except ResizeError:
                continue
        response["image_count"] = len(results)
        response["images"] = results

    return jsonify(response)


# ---------- 视频 API ----------


@app.route("/api/video/scan-dir", methods=["POST"])
def video_scan_dir():
    """扫描目录，返回 PNG 图片列表和 logo 信息。"""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "请求体不能为空"}), 400

    dir_path = (data.get("dir") or "").strip()
    if not dir_path or not os.path.isdir(dir_path):
        return jsonify({"success": False, "error": "目录不存在或不可访问"}), 400

    images = []
    try:
        entries = sorted(os.listdir(dir_path))
    except OSError as e:
        return jsonify({"success": False, "error": f"无法读取目录: {e}"}), 400

    for f in entries:
        if not f.lower().endswith(".png"):
            continue
        full = os.path.join(dir_path, f)
        if not os.path.isfile(full):
            continue
        try:
            from PIL import Image
            with Image.open(full) as img:
                images.append({
                    "filename": f,
                    "path": full.replace("\\", "/"),
                    "width": img.width,
                    "height": img.height,
                })
        except Exception:
            pass

    if not images:
        return jsonify({"success": False, "error": "目录中无有效的 PNG 图片"}), 404

    # 检测 logo（包logo/ 子目录中的 _logo.png 文件）
    logo = None
    logo_dir = os.path.join(dir_path, "包logo")
    if os.path.isdir(logo_dir):
        for f in sorted(os.listdir(logo_dir)):
            if f.lower().endswith(".png") and "_logo" in f.lower():
                full = os.path.join(logo_dir, f)
                try:
                    from PIL import Image
                    with Image.open(full) as img:
                        logo = {
                            "filename": f,
                            "path": full.replace("\\", "/"),
                            "width": img.width,
                            "height": img.height,
                        }
                except Exception:
                    pass
                break

    pkg_name = os.path.basename(dir_path.rstrip("/\\"))

    return jsonify({
        "success": True,
        "package_name": pkg_name,
        "images": images,
        "logo": logo,
    })


@app.route("/api/image", methods=["GET"])
def serve_image():
    """返回本地图片文件流，供前端缩略图加载。"""
    path = request.args.get("path", "")
    if not path:
        return "", 400

    # 安全检查
    normalized = os.path.normpath(path)
    if not os.path.isfile(normalized) or not normalized.lower().endswith(".png"):
        return "", 404

    from flask import send_file
    return send_file(normalized, mimetype="image/png", max_age=3600)


@app.route("/api/video/generate", methods=["POST"])
def video_generate():
    """提交视频生成任务（后台线程执行）。"""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "error": "请求体不能为空"}), 400

    images = data.get("images") or []
    settings = data.get("settings") or {}
    output_path = settings.get("output_path", "").strip()

    if not images:
        return jsonify({"success": False, "error": "请至少选择一张图片"}), 400
    if not output_path:
        return jsonify({"success": False, "error": "请输入输出路径"}), 400

    # 确保输出目录存在
    out_dir = os.path.dirname(output_path)
    if out_dir:
        try:
            os.makedirs(out_dir, exist_ok=True)
        except OSError as e:
            return jsonify({"success": False, "error": f"无法创建输出目录: {e}"}), 400

    # 创建任务
    task = VideoTask(data)
    _video_tasks[task.task_id] = task

    # 后台线程执行
    import threading

    def _run():
        # 可选：AI 动态化
        ai = data.get("ai") or {}
        if ai.get("enabled") and ai.get("api_key"):
            ai_provider = None
            try:
                ai_provider = get_provider(ai.get("service", "doubao"))
            except AIServiceError as e:
                task.message = f"AI 服务初始化失败: {e}"

            if ai_provider:
                duration = int(ai.get("duration", 4))
                api_key = ai["api_key"]
                ai_videos = {}
                for idx, img_path in enumerate(images):
                    task.message = f"AI 动态化: {idx + 1}/{len(images)}"
                    task.progress = idx / len(images) * 0.5
                    try:
                        ai_video = ai_provider.generate_video(img_path, duration, api_key)
                        ai_videos[img_path] = ai_video
                        task.message = f"AI 动态化: {idx + 1}/{len(images)} 完成"
                    except AIServiceError as e:
                        task.message = f"AI 动态化: {idx + 1}/{len(images)} 失败({e})，降级为静态帧"
                task.params["_ai_videos"] = ai_videos

        # 执行 FFmpeg
        task.run()

        # 清理 AI 临时文件
        for tmp_path in task.params.get("_ai_videos", {}).values():
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    t = threading.Thread(target=_run, daemon=True)
    t.start()

    return jsonify({
        "success": True,
        "task_id": task.task_id,
        "message": "视频生成已开始",
    }), 202


@app.route("/api/video/progress", methods=["GET"])
def video_progress():
    """查询视频生成任务进度。"""
    task_id = request.args.get("task_id", "")
    task = _video_tasks.get(task_id)
    if task is None:
        return jsonify({"success": False, "error": "未知任务 ID"}), 404

    resp = {
        "task_id": task.task_id,
        "status": task.status,
        "progress": task.progress,
        "message": task.message,
    }
    if task.status == "completed":
        resp["output"] = task.result()
    elif task.status == "error":
        resp["error"] = task.message
    return jsonify(resp)


# ---------- 文件浏览 API ----------


def _is_local_request() -> bool:
    """检查请求是否来自本机（防止远程触发文件对话框）。"""
    remote_addr = request.remote_addr or ""
    return remote_addr in ("127.0.0.1", "::1", "localhost")


def _powershell_file_dialog(filter_str: str, title: str = "选择文件") -> str | None:
    """通过 PowerShell 打开 Windows 原生文件对话框，返回选中路径。"""
    ps = f'''
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = "{title}"
$d.Filter = "{filter_str}"
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ $d.FileName }}
'''
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True, text=True, timeout=120,
        )
        path = out.stdout.strip()
        return path if path else None
    except Exception:
        return None


def _powershell_save_dialog(title: str = "保存文件") -> str | None:
    """通过 PowerShell 打开 Windows 原生保存文件对话框。"""
    ps = f'''
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.SaveFileDialog
$d.Title = "{title}"
$d.Filter = "MP4 文件 (*.mp4)|*.mp4|所有文件 (*.*)|*.*"
$d.DefaultExt = ".mp4"
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ $d.FileName }}
'''
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True, text=True, timeout=120,
        )
        path = out.stdout.strip()
        return path if path else None
    except Exception:
        return None


def _powershell_folder_dialog(title: str = "选择文件夹") -> str | None:
    """通过 PowerShell 打开 Windows 原生选择文件夹对话框。"""
    ps = f'''
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = "{title}"
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ $d.SelectedPath }}
'''
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True, text=True, timeout=120,
        )
        path = out.stdout.strip()
        return path if path else None
    except Exception:
        return None


@app.route("/api/browse-file", methods=["POST"])
def browse_file():
    """打开本地文件选择对话框，返回选中路径。"""
    if not _is_local_request():
        return jsonify({"success": False, "error": "仅允许本机访问"}), 403
    data = request.get_json(silent=True) or {}
    file_type = data.get("type", "all")

    filters_map = {
        "mp3": "MP3 文件|*.mp3|所有文件|*.*",
        "image": "图片文件|*.png;*.jpg;*.jpeg;*.bmp|所有文件|*.*",
        "all": "所有文件|*.*",
    }
    path = _powershell_file_dialog(filters_map.get(file_type, filters_map["all"]))
    if path:
        return jsonify({"success": True, "path": path.replace("\\", "/")})
    return jsonify({"success": True, "path": ""})


@app.route("/api/browse-save", methods=["POST"])
def browse_save():
    """打开文件保存对话框。"""
    if not _is_local_request():
        return jsonify({"success": False, "error": "仅允许本机访问"}), 403
    path = _powershell_save_dialog()
    if path:
        return jsonify({"success": True, "path": path.replace("\\", "/")})
    return jsonify({"success": True, "path": ""})


@app.route("/api/browse-folder", methods=["POST"])
def browse_folder():
    """打开文件夹选择对话框。"""
    if not _is_local_request():
        return jsonify({"success": False, "error": "仅允许本机访问"}), 403
    path = _powershell_folder_dialog()
    if path:
        return jsonify({"success": True, "path": path.replace("\\", "/")})
    return jsonify({"success": True, "path": ""})


# ---------- 启动 ----------

if __name__ == "__main__":
    host = "0.0.0.0"
    port = 5000
    print(f"服务已启动: http://{host}:{port}")
    print("在浏览器中打开上方地址即可使用。")
    # 自动打开浏览器
    webbrowser.open(f"http://127.0.0.1:{port}")
    app.run(host=host, port=port, debug=False, threaded=True)
