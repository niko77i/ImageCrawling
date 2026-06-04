import os
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
    # 新增参数：是否下载广告图片（默认 true，向后兼容）
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

    # ---- 3b. 广告图片爬取（可选） ----
    if include_ads_images:
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
            for i, img_url in enumerate(img_urls):
                try:
                    # 命名改为 包名_序号
                    result = process_image(img_url, pkg_dir, f"{pkg_name}_{i+1:03d}")
                    results.append(result)
                except ResizeError:
                    continue
            response["image_count"] = len(results)
            response["images"] = results
    else:
        response["image_count"] = 0
        response["images"] = []

    return jsonify(response)


# ---------- 启动 ----------

if __name__ == "__main__":
    host = "0.0.0.0"
    port = 5000
    print(f"服务已启动: http://{host}:{port}")
    print("在浏览器中打开上方地址即可使用。")
    # 自动打开浏览器
    webbrowser.open(f"http://127.0.0.1:{port}")
    app.run(host=host, port=port, debug=False)
