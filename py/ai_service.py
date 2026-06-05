"""AI 图片转视频服务 — 抽象接口 + Seedance/Veo/Atlas Provider。

Provider 选择:
- seedance: 通过 Atlas Cloud 调用 Seedance 2.0（每日 225 免费积分，图转视频最佳）
- veo: Google Veo 3.1 Lite（完全免费，视频自带音频）
- atlas: Atlas Cloud 统一网关，可切换多个后端
"""
import os
import time
import tempfile
import requests


class AIServiceError(Exception):
    """AI 服务调用失败异常。"""
    pass


class AIProvider:
    """AI 图片转视频抽象基类。"""

    def generate_video(self, image_path: str, duration: int, api_key: str) -> str:
        """将图片转为短视频，返回生成的 MP4 本地路径。"""
        raise NotImplementedError


class AtlasProvider(AIProvider):
    """通过 Atlas Cloud 统一网关调用 AI 视频模型。

    支持模型: seedance-2.0, kling-3.0, vidu-q3, wan-2.2 等
    参考: https://www.atlascloud.ai/
    """

    BASE_URL = "https://api.atlascloud.ai/v1"
    DEFAULT_MODEL = "seedance-2.0"

    def __init__(self, model: str = None):
        self.model = model or self.DEFAULT_MODEL

    def generate_video(self, image_path: str, duration: int, api_key: str) -> str:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # Step 1: 提交生成请求
        task_id = self._create_task(image_path, duration, headers)

        # Step 2: 轮询直到完成
        video_url = self._poll_task(task_id, headers)

        # Step 3: 下载视频到临时目录
        return self._download_video(video_url)

    def _create_task(self, image_path: str, duration: int, headers: dict) -> str:
        """提交视频生成任务，返回 task_id。"""
        url = f"{self.BASE_URL}/video/generate"
        body = {
            "model": self.model,
            "image_url": f"file://{image_path}",
            "duration": duration,
        }
        try:
            resp = requests.post(url, headers=headers, json=body, timeout=30)
            data = resp.json()
            task_id = data.get("task_id") or data.get("id")
            if resp.status_code != 200 or not task_id:
                raise AIServiceError(
                    f"Atlas Cloud 创建任务失败: {data.get('message', resp.text)}"
                )
            return task_id
        except requests.RequestException as e:
            raise AIServiceError(f"Atlas Cloud 网络错误: {e}")

    def _poll_task(self, task_id: str, headers: dict, timeout: int = 600) -> str:
        """轮询任务状态，返回视频下载 URL。"""
        url = f"{self.BASE_URL}/video/status/{task_id}"
        start = time.time()
        while time.time() - start < timeout:
            try:
                resp = requests.get(url, headers=headers, timeout=15)
                data = resp.json()
                status = data.get("status", "")
                if status in ("completed", "succeeded", "done"):
                    video_url = data.get("video_url") or data.get("output_url") or data.get("url")
                    if not video_url:
                        raise AIServiceError("任务完成但缺少视频 URL")
                    return video_url
                elif status in ("failed", "cancelled", "error"):
                    raise AIServiceError(f"任务失败: {data.get('message', status)}")
            except requests.RequestException:
                pass  # 网络抖动，继续轮询
            time.sleep(2)
        raise AIServiceError("任务超时")

    def _download_video(self, video_url: str) -> str:
        """下载视频到临时文件，返回本地路径。"""
        try:
            resp = requests.get(video_url, timeout=120, stream=True)
            resp.raise_for_status()
            fd, tmp_path = tempfile.mkstemp(suffix=".mp4", prefix="ai_video_")
            with os.fdopen(fd, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            return tmp_path
        except requests.RequestException as e:
            raise AIServiceError(f"下载视频失败: {e}")


class VeoProvider(AIProvider):
    """Google Veo 3.1 Lite — 通过 NexaAPI 免费调用（无需绑卡）。

    特点: 完全免费，视频自带同步音频生成，最长 8 秒。
    限制: 有速率限制，适合少量图片。
    参考: https://dev.to/diwushennian4955/free-veo3-api
    """

    BASE_URL = "https://api.nexaapi.ai/v1"

    def generate_video(self, image_path: str, duration: int, api_key: str) -> str:
        # Veo 限制最长 8 秒
        duration = min(duration, 8)
        headers = {
            "Authorization": f"Bearer {api_key or 'free'}",
            "Content-Type": "application/json",
        }

        try:
            resp = requests.post(
                f"{self.BASE_URL}/video/generate",
                headers=headers,
                json={
                    "model": "veo-3.1-lite-i2v",
                    "image_url": f"file://{image_path}",
                    "duration": duration,
                    "aspect_ratio": "16:9",
                },
                timeout=30,
            )
            data = resp.json()
            if resp.status_code != 200:
                raise AIServiceError(f"Veo 生成失败: {data.get('message', resp.text)}")

            # 同步返回
            video_url = data.get("video_url") or data.get("url")
            if video_url:
                return self._download_video(video_url)

            # 异步轮询
            task_id = data.get("task_id") or data.get("id")
            if task_id:
                return self._poll_and_download(task_id, headers)

            raise AIServiceError("Veo 返回格式未知")
        except requests.RequestException as e:
            raise AIServiceError(f"Veo 网络错误: {e}")

    def _poll_and_download(self, task_id: str, headers: dict) -> str:
        """轮询 Veo 任务并下载视频。"""
        url = f"{self.BASE_URL}/video/status/{task_id}"
        start = time.time()
        while time.time() - start < 600:
            try:
                resp = requests.get(url, headers=headers, timeout=15)
                data = resp.json()
                if data.get("status") in ("completed", "done"):
                    video_url = data.get("video_url") or data.get("url")
                    if video_url:
                        return self._download_video(video_url)
                    raise AIServiceError("Veo 完成但无视频 URL")
                elif data.get("status") in ("failed", "error"):
                    raise AIServiceError(f"Veo 任务失败: {data.get('message')}")
            except requests.RequestException:
                pass
            time.sleep(2)
        raise AIServiceError("Veo 任务超时")

    def _download_video(self, video_url: str) -> str:
        """下载 Veo 视频到临时文件。"""
        try:
            resp = requests.get(video_url, timeout=120, stream=True)
            resp.raise_for_status()
            fd, tmp_path = tempfile.mkstemp(suffix=".mp4", prefix="veo_ai_")
            with os.fdopen(fd, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            return tmp_path
        except requests.RequestException as e:
            raise AIServiceError(f"Veo 下载视频失败: {e}")


# 服务注册表
# 注意: "seedance" 和 "atlas" 共用 AtlasProvider，seedance 使用默认模型 seedance-2.0
class SeedanceProvider(AtlasProvider):
    """Seedance 2.0（字节/即梦）— 图片转视频效果最佳。"""
    def __init__(self):
        super().__init__(model="seedance-2.0")


AI_PROVIDERS = {
    "seedance": SeedanceProvider,  # 🥇 推荐：Seedance 2.0（每日 225 免费积分）
    "veo": VeoProvider,           # 🥈 备选：Google Veo 3.1 Lite（免费 + 音频）
    "atlas": AtlasProvider,       # Atlas Cloud 多模型网关
}


def get_provider(name: str, **kwargs) -> AIProvider:
    """根据名称获取 AI Provider 实例。

    Args:
        name: Provider 名称 (seedance/veo/atlas)
        **kwargs: 传递给 Provider 构造函数的额外参数 (如 model)

    Returns:
        AIProvider 实例

    Raises:
        AIServiceError: 不支持的 provider
    """
    cls = AI_PROVIDERS.get(name)
    if cls is None:
        raise AIServiceError(
            f"不支持的 AI 服务: {name}。可用: {list(AI_PROVIDERS.keys())}"
        )
    return cls(**kwargs)
