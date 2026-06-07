// 视频生成面板 UI 逻辑
// 依赖：API_BASE 已在 app.js 中定义为 ""

// ---- 全局状态 ----

var videoState = {
    images: [],
    logo: null,
    selectedImages: {},
    allSelected: true,
    taskId: null,
    pollTimer: null,
};

// ---- 文件浏览按钮 ----

async function browseFile(inputId, fileType) {
    var inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    try {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 30000);
        var resp = await fetch(API_BASE + "/api/browse-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: fileType }),
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        var data = await resp.json();
        if (data.success && data.path) {
            inputEl.value = data.path;
            if (inputId === "bgImagePath") toggleBgColorRow();
        }
    } catch (err) {
        if (err.name !== "AbortError") console.error("文件选择失败:", err);
    }
}

async function browseSave() {
    try {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 30000);
        var resp = await fetch(API_BASE + "/api/browse-save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        var data = await resp.json();
        if (data.success && data.path) {
            var outEl = document.getElementById("outputPath");
            if (outEl) outEl.value = data.path;
        }
    } catch (err) {
        if (err.name !== "AbortError") console.error("保存路径选择失败:", err);
    }
}

async function browseFolder() {
    try {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 30000);
        var resp = await fetch(API_BASE + "/api/browse-folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        var data = await resp.json();
        if (data.success && data.path) {
            var dirEl = document.getElementById("videoDir");
            if (dirEl) dirEl.value = data.path;
        }
    } catch (err) {
        if (err.name !== "AbortError") console.error("文件夹选择失败:", err);
    }
}

// ---- 背景颜色行显示/隐藏 ----

function toggleBgColorRow() {
    var bgPathEl = document.getElementById("bgImagePath");
    var row = document.getElementById("bgColorRow");
    if (!bgPathEl || !row) return;
    var bgPath = bgPathEl.value.trim();
    if (bgPath) {
        // 选了背景图片就隐藏颜色选择器
        row.style.opacity = "0.4";
        row.style.pointerEvents = "none";
    } else {
        row.style.opacity = "1";
        row.style.pointerEvents = "";
    }
}

// ---- 目录扫描 ----

async function scanDirectory() {
    var dir = document.getElementById("videoDir").value.trim();
    if (!dir) {
        alert("请输入图片目录路径");
        return;
    }

    var btn = document.getElementById("scanDirBtn");
    btn.disabled = true;
    btn.textContent = "⏳ 扫描中...";

    try {
        var resp = await fetch(API_BASE + "/api/video/scan-dir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dir: dir }),
        });
        var data = await resp.json();

        if (data.success) {
            videoState.images = data.images || [];
            videoState.logo = data.logo || null;
            // 自动填充输出路径：{输入目录上一级}/ai/{包名}.mp4
            var dirClean = dir.replace(/[\\/]+$/, "").replace(/\\/g, "/");
            var parts = dirClean.split("/");
            var pkgName = parts[parts.length - 1];
            var parentDir = parts.slice(0, -1).join("/");
            var outDir = parentDir + "/ai";
            var outPath = outDir + "/" + pkgName + ".mp4";
            var outEl = document.getElementById("outputPath");
            if (outEl) {
                outEl.value = outPath;
            }
            // 默认全选
            videoState.selectedImages = {};
            videoState.images.forEach(function (img) {
                videoState.selectedImages[img.path] = true;
            });
            videoState.allSelected = true;
            renderImageGrid();
            renderLogoSection();
        } else {
            alert("扫描失败: " + data.error);
            document.getElementById("imageListSection").style.display = "none";
            document.getElementById("logoSection").style.display = "none";
        }
    } catch (err) {
        alert("扫描请求失败: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "🔍 扫描";
    }
}

// ---- 图片网格渲染 ----

function renderImageGrid() {
    var section = document.getElementById("imageListSection");
    var grid = document.getElementById("imageGrid");
    var countEl = document.getElementById("imageCount");

    if (videoState.images.length === 0) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";
    countEl.textContent = videoState.images.length;
    grid.innerHTML = "";

    videoState.images.forEach(function (img) {
        var card = document.createElement("div");
        var isSelected = videoState.selectedImages[img.path];
        card.className = "image-card" + (isSelected ? " selected" : "");
        card.setAttribute("data-path", img.path);
        card.onclick = function () { toggleImage(img.path, card); };

        var wrapper = document.createElement("div");
        wrapper.className = "card-img-wrapper";

        var check = document.createElement("div");
        check.className = "card-check";
        check.textContent = isSelected ? "✓" : "";

        var thumb = document.createElement("img");
        thumb.className = "card-img";
        thumb.src = API_BASE + "/api/image?path=" + encodeURIComponent(img.path);
        thumb.alt = img.filename;
        thumb.loading = "lazy";

        wrapper.appendChild(thumb);
        wrapper.appendChild(check);

        var info = document.createElement("div");
        info.className = "card-info";
        info.innerHTML =
            '<div class="card-name">' + img.filename + '</div>' +
            '<div class="card-size">' + img.width + ' × ' + img.height + '</div>';

        card.appendChild(wrapper);
        card.appendChild(info);
        grid.appendChild(card);
    });

    updateSelectAllLabel();
}

function toggleImage(path, card) {
    if (videoState.selectedImages[path]) {
        delete videoState.selectedImages[path];
        card.classList.remove("selected");
        card.querySelector(".card-check").textContent = "";
    } else {
        videoState.selectedImages[path] = true;
        card.classList.add("selected");
        card.querySelector(".card-check").textContent = "✓";
    }
    videoState.allSelected = Object.keys(videoState.selectedImages).length === videoState.images.length;
    updateSelectAllLabel();
}

function toggleSelectAll() {
    if (videoState.allSelected) {
        videoState.selectedImages = {};
        videoState.allSelected = false;
    } else {
        videoState.images.forEach(function (img) {
            videoState.selectedImages[img.path] = true;
        });
        videoState.allSelected = true;
    }
    // 刷新所有卡片
    var cards = document.querySelectorAll(".image-card");
    cards.forEach(function (card) {
        var path = card.getAttribute("data-path");
        if (videoState.selectedImages[path]) {
            card.classList.add("selected");
            card.querySelector(".card-check").textContent = "✓";
        } else {
            card.classList.remove("selected");
            card.querySelector(".card-check").textContent = "";
        }
    });
    updateSelectAllLabel();
}

function updateSelectAllLabel() {
    var label = document.querySelector(".select-all");
    if (label) {
        label.textContent = videoState.allSelected ? "☐ 取消全选" : "☑ 全选";
    }
}

// ---- Logo 区域 ----

function renderLogoSection() {
    var section = document.getElementById("logoSection");
    if (videoState.logo) {
        section.style.display = "block";
        document.getElementById("logoFileName").textContent =
            videoState.logo.filename + " (" + videoState.logo.width + "×" + videoState.logo.height + ")";
    } else {
        section.style.display = "none";
        document.getElementById("useLogo").checked = false;
        document.getElementById("logoOptions").classList.remove("open");
    }
}

function toggleLogoOptions() {
    var checked = document.getElementById("useLogo").checked;
    document.getElementById("logoOptions").classList.toggle("open", checked);
}

// ---- AI 选项 ----

function toggleAIOptions() {
    var checked = document.getElementById("useAI").checked;
    document.getElementById("aiOptions").classList.toggle("open", checked);
}

// ---- 视频生成 ----

async function startGenerate() {
    var outputPath = document.getElementById("outputPath").value.trim();
    if (!outputPath) {
        alert("请输入输出路径");
        return;
    }
    // 自动补全 .mp4 扩展名
    if (!outputPath.toLowerCase().endsWith(".mp4")) {
        outputPath = outputPath + ".mp4";
    }

    // 获取选中的图片路径
    var selectedPaths = videoState.images
        .filter(function (img) { return videoState.selectedImages[img.path]; })
        .map(function (img) { return img.path; });

    if (selectedPaths.length === 0) {
        alert("请至少选择一张图片");
        return;
    }

    var generateBtn = document.getElementById("generateBtn");
    generateBtn.disabled = true;
    generateBtn.textContent = "⏳ 提交中...";

    var useLogo = document.getElementById("useLogo").checked;
    var useAI = document.getElementById("useAI").checked;
    var musicPath = document.getElementById("musicPath").value.trim();
    var bgImagePathEl = document.getElementById("bgImagePath");
    var bgColorEl = document.getElementById("bgColor");
    var scaleEl = document.getElementById("contentScale");
    var text1El = document.getElementById("textOverlay1");
    var text2El = document.getElementById("textOverlay2");

    var bgImagePath = (bgImagePathEl && bgImagePathEl.value || "").trim();
    var bgColor = (bgColorEl && bgColorEl.value || "#1a1a2e").replace("#", "");
    var contentScale = scaleEl ? (parseFloat(scaleEl.value) || 0.82) : 0.82;
    var text1 = (text1El && text1El.value || "").trim();
    var text2 = (text2El && text2El.value || "").trim();
    var texts = [];
    if (text1) texts.push(text1);
    if (text2) texts.push(text2);

    var body = {
        images: selectedPaths,
        logo: useLogo && videoState.logo ? {
            path: videoState.logo.path,
            position: document.getElementById("logoPosition").value,
            effect: document.getElementById("logoEffect").value,
        } : null,
        ai: useAI ? {
            enabled: true,
            service: document.getElementById("aiService").value,
            api_key: document.getElementById("aiApiKey").value.trim(),
            duration: parseInt(document.getElementById("aiDuration").value),
            prompt: (document.getElementById("aiPrompt").value || "").trim() || null,
        } : { enabled: false },
        settings: {
            duration_per_frame: parseInt(document.getElementById("frameDuration").value),
            transition: document.getElementById("transition").value,
            music_path: musicPath || null,
            resolution: document.getElementById("resolution").value,
            output_path: outputPath,
            background_path: bgImagePath || null,
            background_color: bgColor || "1a1a2e",
            content_scale: contentScale,
            texts: texts,
        },
    };

    try {
        var resp = await fetch(API_BASE + "/api/video/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        var data = await resp.json();

        if (data.success) {
            videoState.taskId = data.task_id;
            showProgress();
            startPolling();
        } else {
            alert("生成失败: " + (data.error || "未知错误"));
            resetGenerateButton();
        }
    } catch (err) {
        alert("请求失败: " + err.message);
        resetGenerateButton();
    }
}

function showProgress() {
    document.getElementById("videoProgress").style.display = "block";
    document.getElementById("videoResult").style.display = "none";
    document.getElementById("videoStatus").innerHTML =
        '<div class="result-item pending"><span class="icon">⏳</span> 正在初始化...</div>';
}

function startPolling() {
    if (videoState.pollTimer) clearInterval(videoState.pollTimer);
    videoState.pollTimer = setInterval(pollProgress, 1000);
}

async function pollProgress() {
    try {
        var resp = await fetch(API_BASE + "/api/video/progress?task_id=" + videoState.taskId);
        var data = await resp.json();

        var statusEl = document.getElementById("videoStatus");
        var fillEl = document.getElementById("progressFill");

        fillEl.style.width = (data.progress * 100) + "%";

        if (data.status === "completed") {
            clearInterval(videoState.pollTimer);
            videoState.pollTimer = null;
            statusEl.innerHTML =
                '<div class="result-item success"><span class="icon">✅</span> 视频生成完成</div>';
            var out = data.output;
            document.getElementById("videoResult").style.display = "block";
            document.getElementById("videoResult").innerHTML =
                '<div class="summary">输出文件: ' + out.path +
                '<br>大小: ' + out.size_mb + ' MB, 时长: ' + out.duration_s + ' 秒</div>';
            resetGenerateButton();
        } else if (data.status === "error") {
            clearInterval(videoState.pollTimer);
            videoState.pollTimer = null;
            statusEl.innerHTML =
                '<div class="result-item error"><span class="icon">❌</span> ' +
                (data.error || "生成失败") + '</div>';
            resetGenerateButton();
        } else {
            statusEl.innerHTML =
                '<div class="result-item pending"><span class="icon">⏳</span> ' +
                data.message + '</div>';
        }
    } catch (err) {
        // 网络错误不中断轮询
    }
}

function resetGenerateButton() {
    var btn = document.getElementById("generateBtn");
    btn.disabled = false;
    btn.textContent = "🎬 生成视频";
}
