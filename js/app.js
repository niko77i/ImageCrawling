// 使用相对路径，自动适配当前访问地址（本地、局域网、打包后均可用）
const API_BASE = "";

function parseUrls(input) {
    // 先按换行分割，再按逗号分割，过滤空字符串
    return input
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

async function startScrape() {
    const urlsText = document.getElementById("urls").value.trim();
    const saveDir = document.getElementById("saveDir").value.trim();
    const startBtn = document.getElementById("startBtn");
    const resultList = document.getElementById("resultList");
    const summary = document.getElementById("summary");

    if (!urlsText) {
        alert("请输入至少一个 Google Play 链接");
        return;
    }
    if (!saveDir) {
        alert("请输入保存路径");
        return;
    }

    const urls = parseUrls(urlsText);

    // 重置状态
    resultList.innerHTML = "";
    summary.style.display = "none";
    startBtn.disabled = true;
    startBtn.textContent = "⏳ 处理中...";

    let successCount = 0;
    let failCount = 0;
    let totalImages = 0;

    for (const url of urls) {
        // 创建结果行
        const item = document.createElement("div");
        item.className = "result-item pending";
        item.innerHTML = `<span class="icon">⏳</span> <span class="text">${url}</span>`;
        resultList.appendChild(item);

        try {
            const includeAds = document.getElementById("includeAds").checked;
            const resp = await fetch(`${API_BASE}/api/scrape`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: url, save_dir: saveDir, include_ads_images: includeAds }),
            });
            const data = await resp.json();

            if (data.success) {
                item.className = "result-item success";
                const logoInfo = data.logo ? " + logo" : "";
                const imgInfo = includeAds ? ` — ${data.image_count} 张广告图` : "";
                item.innerHTML = `<span class="icon">✅</span> <span class="text">${data.package_name}</span> <span class="detail">${imgInfo}${logoInfo} → ${data.saved_path}</span>`;
                successCount++;
                totalImages += (data.image_count || 0) + (data.logo ? 1 : 0);
            } else {
                item.className = "result-item error";
                item.innerHTML = `<span class="icon">❌</span> <span class="text">${url}</span> <span class="detail">— ${data.error}</span>`;
                failCount++;
            }
        } catch (err) {
            item.className = "result-item error";
            item.innerHTML = `<span class="icon">❌</span> <span class="text">${url}</span> <span class="detail">— 网络错误: ${err.message}</span>`;
            failCount++;
        }
    }

    // 显示汇总
    startBtn.disabled = false;
    startBtn.textContent = "🚀 开始爬取";
    summary.style.display = "block";
    summary.textContent = `完成！成功 ${successCount} 个，失败 ${failCount} 个，共保存 ${totalImages} 张图片`;
}
