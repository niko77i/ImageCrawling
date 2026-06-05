"""用 SDK + data URI 测试豆包"""
import base64, os, sys, time, json
from io import BytesIO
from PIL import Image
from volcenginesdkarkruntime import Ark

api_key = os.environ.get("ARK_API_KEY", "").strip()
if not api_key and len(sys.argv) > 1:
    api_key = sys.argv[1]
if not api_key:
    print("[FAIL] Usage: python test_doubao.py <api_key>")
    print("   or: set ARK_API_KEY=xxx && python test_doubao.py")
    sys.exit(1)
print(f"[OK] API Key: {api_key[:8]}...{api_key[-4:]}")

# 缩小图片减小 payload
img_path = None
base_dirs = ["F:/carl_work/carl/Google/2026test/爬取"]
for base in base_dirs:
    if not os.path.isdir(base): continue
    for root, dirs, files in os.walk(base):
        for f in files:
            if f.endswith(".png") and "_logo" not in f.lower() and "logo" not in root.lower():
                img_path = os.path.join(root, f)
                break
        if img_path: break
    if img_path: break

if not img_path:
    print("[FAIL] No test image")
    sys.exit(1)

# 原图（不缩小，保持 ≥300px 宽度）
img = Image.open(img_path)
w, h = img.size
print(f"[OK] Original image: {w}x{h}")
# 如果宽度小于 300，等比放大到 300
if w < 300:
    ratio = 300 / w
    img = img.resize((300, int(h*ratio)), Image.LANCZOS)
    print(f"[OK] Upscaled to: {img.size}")
# 转 JPEG 减小 payload
buf = BytesIO()
img.save(buf, format="JPEG", quality=85)
data_uri = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"
print(f"[OK] Data URI: {len(data_uri)//1024} KB")

client = Ark(base_url="https://ark.cn-beijing.volces.com/api/v3", api_key=api_key)

print("\n>>> Trying with data URI...")
try:
    result = client.content_generation.tasks.create(
        model="doubao-seedance-1-5-pro-251215",
        content=[
            {"type": "text", "text": "Slow cinematic panning shot --duration 5 --camerafixed false --watermark true"},
            {"type": "image_url", "image_url": {"url": data_uri}},
        ],
    )
    print(f"Task ID: {result.id}")
    task_id = result.id

    print(">>> Polling...")
    start = time.time()
    last = ""
    while time.time() - start < 300:
        r = client.content_generation.tasks.get(task_id=task_id)
        s = r.status
        if s != last:
            print(f"  [{time.time()-start:.0f}s] {s}")
            last = s
        if s == "succeeded":
            d = r.model_dump() if hasattr(r, 'model_dump') else vars(r)
            print(f">>> SUCCESS!\n{json.dumps(d, indent=2, ensure_ascii=False, default=str)[:3000]}")
            break
        elif s == "failed":
            d = r.model_dump() if hasattr(r, 'model_dump') else vars(r)
            print(f">>> FAILED\n{json.dumps(d, indent=2, ensure_ascii=False, default=str)[:3000]}")
            break
        time.sleep(3)
except Exception as e:
    print(f">>> ERROR: {type(e).__name__}: {e}")
