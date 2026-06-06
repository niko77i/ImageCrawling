// 音频替换面板 UI 逻辑
// 依赖：API_BASE 已在 app.js 中定义，browseFile 在 video.js 中定义

async function startAudioReplace() {
    var videoPath = document.getElementById("audioVideoPath").value.trim();
    var audioPath = document.getElementById("audioSourcePath").value.trim();

    if (!videoPath) {
        alert("请选择原视频文件");
        return;
    }
    if (!audioPath) {
        alert("请选择新音频源");
        return;
    }

    var btn = document.getElementById("audioReplaceBtn");
    btn.disabled = true;
    btn.textContent = "⏳ 处理中...";

    var progress = document.getElementById("audioProgress");
    var status = document.getElementById("audioStatus");
    progress.style.display = "block";
    status.innerHTML = '<div class="result-item pending"><span class="icon">⏳</span> 正在替换音频...</div>';

    try {
        var resp = await fetch(API_BASE + "/api/audio-replace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                video_path: videoPath,
                audio_source: audioPath,
            }),
        });
        var data = await resp.json();

        if (data.success) {
            status.innerHTML =
                '<div class="result-item success"><span class="icon">✅</span> 音频替换完成</div>' +
                '<div class="summary">输出文件: ' + data.output +
                '<br>大小: ' + data.size_mb + ' MB</div>';
        } else {
            status.innerHTML =
                '<div class="result-item error"><span class="icon">❌</span> ' +
                (data.error || "处理失败") + '</div>';
        }
    } catch (err) {
        status.innerHTML =
            '<div class="result-item error"><span class="icon">❌</span> 网络错误: ' + err.message + '</div>';
    } finally {
        btn.disabled = false;
        btn.textContent = "🎵 替换音频";
    }
}
