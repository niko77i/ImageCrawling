// 使用相对路径，自动适配当前访问地址（本地、局域网、打包后均可用）
const API_BASE = "";

// 爬取结果缓存（桥接视频面板使用）
var _crawledPackages = [];

// ---------- 标签页切换 ----------

function switchTab(tabName) {
    localStorage.setItem("activeTab", tabName);
    // 更新导航激活态 + ARIA
    document.querySelectorAll(".nav-item").forEach(function(el) {
        var isActive = el.getAttribute("data-tab") === tabName;
        el.classList.toggle("active", isActive);
        el.setAttribute("aria-selected", isActive ? "true" : "false");
        el.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    // 切换面板
    document.getElementById("panel-scrape").classList.toggle("active", tabName === "scrape");
    document.getElementById("panel-video").classList.toggle("active", tabName === "video");
    document.getElementById("panel-toolkit").classList.toggle("active", tabName === "toolkit");
    document.getElementById("panel-youtube").classList.toggle("active", tabName === "youtube");
    document.getElementById("panel-account").classList.toggle("active", tabName === "account");
    if (tabName === "account") { try { loadProducts(1); } catch(e) {} }
}

/** Keyboard navigation for sidebar tabs (Arrow keys) */
function handleNavKey(e, currentTab) {
    var tabs = document.querySelectorAll('[role="tablist"] .nav-item');
    var idx = -1;
    for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].getAttribute('data-tab') === currentTab) { idx = i; break; }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        var next = (idx + 1) % tabs.length;
        switchTab(tabs[next].getAttribute('data-tab'));
        tabs[next].focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var prev = (idx - 1 + tabs.length) % tabs.length;
        switchTab(tabs[prev].getAttribute('data-tab'));
        tabs[prev].focus();
    } else if (e.key === 'Home') {
        e.preventDefault();
        switchTab(tabs[0].getAttribute('data-tab'));
        tabs[0].focus();
    } else if (e.key === 'End') {
        e.preventDefault();
        switchTab(tabs[tabs.length - 1].getAttribute('data-tab'));
        tabs[tabs.length - 1].focus();
    }
}

function switchToolkitTab(name) {
    document.querySelectorAll(".tk-subtab").forEach(function(el) {
        el.classList.toggle("active", el.getAttribute("data-tk") === name);
    });
    document.querySelectorAll(".tk-subpanel").forEach(function(el) {
        el.style.display = el.id === "tk-" + name ? "block" : "none";
    });
}

function parseUrls(input) {
    // 从脏数据中提取所有 Google Play http 链接
    var matches = input.match(/https?:\/\/play\.google\.com\/[^\s,;，；\n]+/gi);
    if (matches && matches.length > 0) return matches;
    // 没有匹配到则回退到按分隔符分割
    return input
        .split(/[\n,]+/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0 && s.indexOf("http") === 0; });
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
                const cacheInfo = data.from_cache ? " 📂本地" : "";
                item.innerHTML = `<span class="icon">✅</span> <span class="text">${data.package_name}${cacheInfo}</span> <span class="detail">— ${data.image_count} 张图片${scaleInfo}${logoInfo} → ${data.saved_path}</span>`;
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

// 页面加载时恢复上次标签（等所有脚本加载完）
window.addEventListener("DOMContentLoaded", function() {
    var saved = localStorage.getItem("activeTab");
    // 兼容旧版本：audio 已移入工具集
    if (saved === "audio") saved = "toolkit";
    if (saved) switchTab(saved);
    else switchTab("account");  // 默认激活账户管理
});
