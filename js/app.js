// 使用相对路径，自动适配当前访问地址（本地、局域网、打包后均可用）
const API_BASE = "";

// 爬取结果缓存（桥接视频面板使用）
var _crawledPackages = [];

// ---------- 标签页切换 ----------

function switchTab(tabName) {
    // 更新导航激活态
    document.querySelectorAll(".nav-item").forEach((el, i) => {
        el.classList.toggle("active", (tabName === "scrape" && i === 0) || (tabName === "video" && i === 1));
    });
    // 切换面板
    document.getElementById("panel-scrape").classList.toggle("active", tabName === "scrape");
    document.getElementById("panel-video").classList.toggle("active", tabName === "video");
}

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
    _crawledPackages = [];

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
                const scaleInfo = includeAds ? "" : "（原图）";
                item.innerHTML = `<span class="icon">✅</span> <span class="text">${data.package_name}</span> <span class="detail">— ${data.image_count} 张图片${scaleInfo}${logoInfo} → ${data.saved_path}</span>`;
                successCount++;
                totalImages += (data.image_count || 0) + (data.logo ? 1 : 0);
                _crawledPackages.push({
                    package_name: data.package_name,
                    saved_path: data.saved_path
                });
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

    // ---- 桥接：自动跳转到视频面板 ----
    if (successCount === 1) {
        _autoBridgeToVideo(_crawledPackages[0].saved_path);
    } else if (successCount > 1) {
        _renderPackagePicker();
    }
}

function _autoBridgeToVideo(dirPath) {
    var dirInput = document.getElementById("videoDir");
    if (dirInput) dirInput.value = dirPath;
    switchTab("video");
    scanDirectory();
}

function _renderPackagePicker() {
    var old = document.getElementById("packagePicker");
    if (old) old.remove();

    var summaryEl = document.getElementById("summary");
    if (!summaryEl) return;

    var picker = document.createElement("div");
    picker.id = "packagePicker";
    picker.innerHTML = "<strong>选择一个包跳转到视频面板：</strong>";

    var list = document.createElement("div");
    list.style.marginTop = "8px";
    list.style.display = "flex";
    list.style.flexWrap = "wrap";
    list.style.gap = "8px";

    _crawledPackages.forEach(function (pkg) {
        var btn = document.createElement("button");
        btn.textContent = pkg.package_name;
        btn.onclick = function () {
            _autoBridgeToVideo(pkg.saved_path);
        };
        list.appendChild(btn);
    });

    picker.appendChild(list);
    summaryEl.parentNode.insertBefore(picker, summaryEl.nextSibling);
}
