// YouTube 视频管理面板

var ytState = { selectedId: null, videos: [], page: 0, pageSize: 20, checked: {}, copied: {} };

// 从 localStorage 恢复复制历史
try { ytState.copied = JSON.parse(localStorage.getItem("ytCopied") || "{}"); } catch(e) { ytState.copied = {}; }

function switchYoutubeTab(tab) {
    document.querySelectorAll(".yt-subtab").forEach(function (el, i) {
        el.classList.toggle("active", (tab === "view" && i === 0) || (tab === "import" && i === 1) || (tab === "config" && i === 2));
    });
    document.getElementById("yt-view").style.display = tab === "view" ? "block" : "none";
    document.getElementById("yt-import").style.display = tab === "import" ? "block" : "none";
    document.getElementById("yt-config").style.display = tab === "config" ? "block" : "none";
    if (tab === "view") loadYoutubeList();
    if (tab === "config") loadYoutubeConfig();
}

async function loadYoutubeList() {
    var region = document.getElementById("ytFilterRegion").value;
    var ft = document.getElementById("ytFilterFrame").value;
    var eff = document.getElementById("ytFilterEff").value;
    var prod = document.getElementById("ytFilterProd").value;
    var params = [];
    if (region) params.push("region=" + encodeURIComponent(region));
    if (ft) params.push("frame_type=" + encodeURIComponent(ft));
    if (eff) params.push("effectiveness=" + encodeURIComponent(eff));
    if (prod) params.push("product_name=" + encodeURIComponent(prod));
    var qs = params.length ? "?" + params.join("&") : "";

    try {
        var resp = await fetch(API_BASE + "/api/youtube/list" + qs);
        var data = await resp.json();
        if (!data.success) return;
        ytState.videos = data.videos || [];
        // 更新筛选下拉框的计数
        if (data.counts) updateFilterCounts(data.counts);
        renderYoutubeList();
    } catch (e) { }
}

function renderYoutubeList() {
    var list = document.getElementById("ytVideoList");
    if (!list) return;
    list.innerHTML = "";
    // 搜索过滤
    var search = (document.getElementById("ytSearch") || {}).value || "";
    var clearBtn = document.getElementById("ytClearSearchBtn");
    if (clearBtn) clearBtn.style.display = search ? "" : "none";
    var filtered = ytState.videos;
    if (search) {
        var q = search.toLowerCase();
        filtered = ytState.videos.filter(function (v) {
            return (v.url || "").toLowerCase().indexOf(q) >= 0 ||
                   (v.title || "").toLowerCase().indexOf(q) >= 0 ||
                   (v.id || "").toLowerCase().indexOf(q) >= 0;
        });
    }
    // 仅搜索/首次加载时重置页码（翻页时不重置）
    if (search || ytState._lastSearch !== search) {
        ytState.page = 0;
        ytState._lastSearch = search;
    }
    var start = ytState.page * ytState.pageSize;
    var pageVideos = filtered.slice(start, start + ytState.pageSize);
    pageVideos.forEach(function (v) {
        var div = document.createElement("div");
        div.className = "yt-video-item" + (ytState.selectedId === v.id ? " selected" : "");
        var tags = '';
        if (v.region) tags += '<span class="yt-tag region">' + v.region + '</span>';
        if (v.frame_type) tags += '<span class="yt-tag frame">' + v.frame_type + '</span>';
        if (v.effectiveness) tags += '<span class="yt-tag eff">' + v.effectiveness + '</span>';
        if (v.product_name) tags += '<span class="yt-tag prod">' + v.product_name + '</span>';
        if (ytState.copied[v.id]) tags += '<span class="yt-tag copied">已复制 ✓</span>';
        div.innerHTML =
            '<div style="display:flex;align-items:flex-start;gap:6px;">' +
            '<div onclick="var cb=this.querySelector(\'.yt-check\');cb.checked=!cb.checked;ytState.checked[cb.getAttribute(\'data-id\')]=cb.checked;updateYtSelectedCount();event.stopPropagation();" style="flex-shrink:0;cursor:pointer;padding:2px 4px 2px 0;min-height:50px;">' +
            '<input type="checkbox" class="yt-check" data-id="' + v.id + '" ' + (ytState.checked[v.id] ? "checked" : "") + ' onclick="event.stopPropagation();ytState.checked[this.getAttribute(\'data-id\')]=this.checked;updateYtSelectedCount();" style="pointer-events:none;" />' +
            '</div>' +
            '<div style="flex:1;min-width:0;" onclick="playYoutube(ytState.videos.find(function(x){return x.id===\'' + v.id + '\'}))">' +
            '<div class="yt-title">' + (v.title || v.id) + '</div>' +
            '<div class="yt-id">' + v.id + '</div>' +
            '<div class="yt-tags">' + tags + '</div>' +
            '<div class="yt-time">' + (v.imported_at || "") + '</div>' +
            '</div></div>';
        list.appendChild(div);
    });
    // 分页（用过滤后的数量）
    var totalPages = Math.ceil(filtered.length / ytState.pageSize);
    var pag = document.getElementById("ytPagination");
    if (pag && totalPages > 1) {
        pag.style.display = "block";
        pag.innerHTML = "";
        var renderPageBtn = function (pg, label) {
            label = label || (pg + 1);
            var span = document.createElement("span");
            span.textContent = label;
            span.style.cssText = "display:inline-block;padding:3px 10px;cursor:pointer;margin:0 2px;font-size:12px;border-radius:3px;" +
                (pg === ytState.page ? "background:var(--accent);color:#0c0c10;font-weight:600;" : "color:var(--text-muted);");
            span.onclick = (function (p) { return function () { ytState.page = p; renderYoutubeList(); }; })(pg);
            pag.appendChild(span);
        };

        var cur = ytState.page, last = totalPages - 1;
        // 始终显示第1页
        renderPageBtn(0);
        if (cur > 2) { var dots = document.createElement("span"); dots.textContent = "..."; dots.style.cssText = "padding:3px 6px;color:var(--text-muted);font-size:12px;"; pag.appendChild(dots); }
        // 当前页附近
        for (var p = Math.max(1, cur - 2); p <= Math.min(last - 1, cur + 2); p++) {
            renderPageBtn(p);
        }
        if (cur < last - 2) { var dots2 = document.createElement("span"); dots2.textContent = "..."; dots2.style.cssText = "padding:3px 6px;color:var(--text-muted);font-size:12px;"; pag.appendChild(dots2); }
        // 末页
        if (last > 0) renderPageBtn(last);
    } else if (pag) {
        pag.style.display = "none";
    }
    updateYtSelectedCount();
}

function showDuplicatePopup(dupes) {
    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100;display:flex;align-items:center;justify-content:center;";
    var box = document.createElement("div");
    box.style.cssText = "background:var(--bg-surface);border:1px solid var(--border-subtle);padding:20px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;";
    var maxIframes = 5;
    box.innerHTML = "<h3 style='font-family:var(--font-mono);'>⚠ 重复视频 (" + dupes.length + ")</h3><p style='font-size:12px;color:var(--text-muted);margin-bottom:12px;'>以下视频已存在" + (dupes.length > maxIframes ? "（前" + maxIframes + "个可预览）" : "") + "，未重复导入：</p>";
    dupes.forEach(function (d, i) {
        var div = document.createElement("div");
        div.style.cssText = "margin-bottom:8px;padding:8px;border:1px solid var(--border-subtle);";
        if (i < maxIframes) {
            div.innerHTML =
                '<div style="display:flex;gap:8px;">' +
                '<iframe width="160" height="90" src="https://www.youtube.com/embed/' + d.id + '" frameborder="0" allowfullscreen style="flex-shrink:0;"></iframe>' +
                '<div style="font-size:11px;">' +
                '<strong>' + (d.title || d.id) + '</strong><br>' +
                '地区: ' + (d.region || "-") + ' | 帧: ' + (d.frame_type || "-") + '<br>' +
                '导入于: ' + (d.imported_at || "") + '<br>' +
                '<a href="' + d.url + '" target="_blank" style="color:var(--accent);font-size:10px;">打开 YouTube</a>' +
                '</div></div>';
        } else {
            div.innerHTML = '<div style="font-size:11px;"><strong>' + (i + 1) + '. ' + (d.title || d.id) +
                '</strong> | 地区: ' + (d.region || "-") + ' | 帧: ' + (d.frame_type || "-") +
                ' | <a href="' + d.url + '" target="_blank" style="color:var(--accent);font-size:10px;">打开</a></div>';
        }
        box.appendChild(div);
    });
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "关闭";
    closeBtn.style.cssText = "margin-top:8px;";
    closeBtn.onclick = function () { document.body.removeChild(overlay); };
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    overlay.onclick = function (e) { if (e.target === overlay) document.body.removeChild(overlay); };
    document.body.appendChild(overlay);
}

function playYoutube(v) {
    ytState.selectedId = v.id;
    renderYoutubeList();
    var player = document.getElementById("ytPlayer");
    var info = document.getElementById("ytInfo");
    player.innerHTML = '<iframe width="100%" height="100%" src="https://www.youtube.com/embed/' + v.id +
        '" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    info.innerHTML =
        '<strong>' + (v.title || v.id) + '</strong><br>' +
        '<a href="' + v.url + '" target="_blank" style="color:var(--accent);">' + v.url + '</a><br>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px;">' +
        '<select onchange="quickEdit(\'' + v.id + '\',\'region\',this.value)" style="width:auto;padding:3px 6px;font-size:11px;">' +
        '<option value="巴西"' + (v.region==="巴西"?" selected":"") + '>巴西</option>' +
        '<option value="菲律宾"' + (v.region==="菲律宾"?" selected":"") + '>菲律宾</option>' +
        '<option value="孟加拉"' + (v.region==="孟加拉"?" selected":"") + '>孟加拉</option>' +
        '<option value="印尼"' + (v.region==="印尼"?" selected":"") + '>印尼</option>' +
        '<option value="东南亚通用"' + (v.region==="东南亚通用"?" selected":"") + '>东南亚通用</option>' +
        '<option value="通用"' + (v.region==="通用"?" selected":"") + '>通用</option>' +
        '</select>' +
        '<select onchange="quickEdit(\'' + v.id + '\',\'frame_type\',this.value)" style="width:auto;padding:3px 6px;font-size:11px;">' +
        '<option value="融帧"' + (v.frame_type==="融帧"?" selected":"") + '>融帧</option>' +
        '<option value="非融帧"' + (v.frame_type==="非融帧"?" selected":"") + '>非融帧</option>' +
        '</select>' +
        '<select onchange="quickEdit(\'' + v.id + '\',\'effectiveness\',this.value)" style="width:auto;padding:3px 6px;font-size:11px;">' +
        '<option value=""' + (!v.effectiveness?" selected":"") + '>（不选）</option>' +
        '<option value="成效"' + (v.effectiveness==="成效"?" selected":"") + '>成效</option>' +
        '<option value="一般"' + (v.effectiveness==="一般"?" selected":"") + '>一般</option>' +
        '</select>' +
        '<select onchange="quickEdit(\'' + v.id + '\',\'product_name\',this.value)" style="width:auto;padding:3px 6px;font-size:11px;">' +
        '<option value=""' + (!v.product_name?" selected":"") + '>（不选）</option>' +
        '<option value="p222"' + (v.product_name==="p222"?" selected":"") + '>p222</option>' +
        '<option value="93ok"' + (v.product_name==="93ok"?" selected":"") + '>93ok</option>' +
        '</select>' +
        '<span style="font-size:10px;color:var(--text-muted);">' + (v.imported_at || "") + '</span>' +
        '</div>';
}

async function importYoutube() {
    var urlsText = document.getElementById("ytUrls").value.trim();
    if (!urlsText) { alert("请输入链接"); return; }
    var urls = urlsText.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });
    if (urls.length === 0) { alert("请输入链接"); return; }

    // 显示进度
    var btn = document.getElementById("ytImportBtn");
    var progressDiv = document.getElementById("ytImportProgress");
    var fill = document.getElementById("ytImportFill");
    var status = document.getElementById("ytImportStatus");
    btn.disabled = true; btn.textContent = "⏳ 导入中...";
    progressDiv.style.display = "block"; fill.style.width = "30%";
    status.textContent = "正在获取视频标题...";

    var resp = await fetch(API_BASE + "/api/youtube/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            urls: urls,
            region: document.getElementById("ytRegion").value,
            frame_type: document.getElementById("ytFrameType").value,
            effectiveness: document.getElementById("ytEffectiveness").value,
            product_name: document.getElementById("ytProductName").value,
        }),
    });
    fill.style.width = "100%";
    status.textContent = "完成！";
    var data = await resp.json();
    progressDiv.style.display = "none";
    btn.disabled = false; btn.textContent = "💾 保存视频";

    var result = document.getElementById("ytImportResult");
    if (data.success || data.imported > 0) {
        var msg = '✅ 成功导入 ' + (data.imported || 0) + ' 个视频';
        if (data.duplicates && data.duplicates.length > 0) {
            msg += '，' + data.duplicates.length + ' 个重复已跳过';
            showDuplicatePopup(data.duplicates);
        }
        result.innerHTML = '<span style="color:var(--accent-green);">' + msg + '</span>';
        document.getElementById("ytUrls").value = "";
        loadYoutubeList();
    } else if (data.duplicates && data.duplicates.length > 0) {
        showDuplicatePopup(data.duplicates);
        result.innerHTML = '<span style="color:var(--accent);">⚠ 全部 ' + data.duplicates.length + ' 个链接已存在</span>';
    } else {
        result.innerHTML = '<span style="color:var(--accent-red);">❌ ' + (data.error || "导入失败") + '</span>';
        progressDiv.style.display = "none";
        btn.disabled = false; btn.textContent = "💾 保存视频";
    }
}

async function deleteSelectedYoutube() {
    var ids = [];
    document.querySelectorAll(".yt-check:checked").forEach(function (cb) {
        ids.push(cb.getAttribute("data-id"));
    });
    if (ids.length === 0) { alert("请先勾选要删除的视频"); return; }
    if (!confirm("删除 " + ids.length + " 个视频？")) return;

    await fetch(API_BASE + "/api/youtube/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids }),
    });
    if (ids.indexOf(ytState.selectedId) >= 0) {
        ytState.selectedId = null;
        document.getElementById("ytPlayer").innerHTML = "选择左侧视频播放";
        document.getElementById("ytInfo").innerHTML = "";
    }
    loadYoutubeList();
}

// 批量修改选中视频
function setupBatchEdit() {
    var field = document.getElementById("ytBatchField").value;
    var valSel = document.getElementById("ytBatchValue");
    if (!field) { valSel.style.display = "none"; return; }
    valSel.style.display = "";
    // 填充下拉值
    fetch(API_BASE + "/api/youtube/tags").then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) return;
        var values = field === "region" ? (d.tags.regions || []) :
                     field === "frame_type" ? (d.tags.frame_types || []) :
                     (d.tags.effectiveness || []);
        if (field === "product_name") values = (d.tags.product_names || []);
        valSel.innerHTML = '<option value="">选值</option>';
        values.forEach(function (v) {
            if (v || field === "effectiveness") {
                var o = document.createElement("option");
                o.value = v; o.text = v || "（不选）"; valSel.appendChild(o);
            }
        });
    });
}

async function batchEditSelected() {
    var field = document.getElementById("ytBatchField").value;
    var newVal = document.getElementById("ytBatchValue").value;
    if (!field || newVal === "") return;
    var ids = [];
    document.querySelectorAll(".yt-check:checked").forEach(function (cb) { ids.push(cb.getAttribute("data-id")); });
    if (ids.length === 0) { alert("请先勾选视频"); return; }
    for (var i = 0; i < ids.length; i++) {
        var body = { id: ids[i] };
        body[field] = newVal;
        await fetch(API_BASE + "/api/youtube/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    document.getElementById("ytBatchField").value = "";
    document.getElementById("ytBatchValue").style.display = "none";
    document.getElementById("ytBatchValue").value = "";
    loadYoutubeList();
    alert("已修改 " + ids.length + " 个视频");
}

function updateFilterCounts(counts) {
    var maps = {
        ytFilterRegion: counts.region || {},
        ytFilterFrame: counts.frame_type || {},
        ytFilterEff: counts.effectiveness || {},
        ytFilterProd: counts.product_name || {},
    };
    Object.keys(maps).forEach(function (selId) {
        var sel = document.getElementById(selId);
        if (!sel) return;
        var countMap = maps[selId];
        sel.querySelectorAll("option").forEach(function (opt) {
            if (!opt.value) {
                // "全部"选项：显示总数
                var total = Object.values(countMap).reduce(function (a, b) { return a + b; }, 0);
                opt.textContent = (selId === "ytFilterRegion" ? "全部地区" :
                                   selId === "ytFilterFrame" ? "全部帧类型" :
                                   selId === "ytFilterEff" ? "全部成效" : "全部产品") + " (" + total + ")";
            } else {
                var cnt = countMap[opt.value] || 0;
                opt.textContent = opt.value + " (" + cnt + ")";
            }
        });
    });
}

function copySelectedLinks() {
    var ids = [];
    document.querySelectorAll(".yt-check:checked").forEach(function (cb) { ids.push(cb.getAttribute("data-id")); });
    if (ids.length === 0) return;
    var links = ids.map(function (id) { return "https://www.youtube.com/watch?v=" + id; }).join("\n");
    var ok = false;
    try {
        var ta = document.createElement("textarea");
        ta.value = links; ta.style.position = "fixed"; ta.style.left = "-9999px";
        document.body.appendChild(ta); ta.focus(); ta.select();
        ok = document.execCommand("copy"); document.body.removeChild(ta);
    } catch (e) {}
    if (!ok) {
        navigator.clipboard.writeText(links).catch(function () {});
    }
    // 标记已复制（持久化到 localStorage）
    ids.forEach(function (id) { ytState.copied[id] = true; });
    localStorage.setItem("ytCopied", JSON.stringify(ytState.copied));
    renderYoutubeList();
    _ytToast("已复制 " + ids.length + " 个链接");
}

function _ytToast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--accent);color:#fff;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;z-index:9999;pointer-events:none;transition:opacity 0.3s;opacity:1;";
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; setTimeout(function () { document.body.removeChild(t); }, 300); }, 1200);
}

function changePageSize() {
    ytState.pageSize = parseInt(document.getElementById("ytPageSize").value) || 20;
    ytState.page = 0;
    renderYoutubeList();
}

function clearSearch() {
    document.getElementById("ytSearch").value = "";
    document.getElementById("ytClearSearchBtn").style.display = "none";
    renderYoutubeList();
}

function updateYtSelectedCount() {
    var el = document.getElementById("ytSelectedCount");
    if (!el) return;
    var count = document.querySelectorAll(".yt-check:checked").length;
    el.textContent = "已选 " + count + " 条";
}

function toggleSelectAllYoutube() {
    var checks = document.querySelectorAll(".yt-check");
    if (checks.length === 0) return;
    var allChecked = true;
    checks.forEach(function (cb) { if (!cb.checked) allChecked = false; });
    checks.forEach(function (cb) {
        cb.checked = !allChecked;
        ytState.checked[cb.getAttribute("data-id")] = cb.checked;
    });
    updateYtSelectedCount();
}

function invertSelectionYoutube() {
    var checks = document.querySelectorAll(".yt-check");
    checks.forEach(function (cb) {
        cb.checked = !cb.checked;
        ytState.checked[cb.getAttribute("data-id")] = cb.checked;
    });
    updateYtSelectedCount();
}

function deselectAllYoutube() {
    document.querySelectorAll(".yt-check").forEach(function (cb) {
        cb.checked = false;
        ytState.checked[cb.getAttribute("data-id")] = false;
    });
    updateYtSelectedCount();
}

function clearCopyHistory() {
    ytState.copied = {};
    localStorage.removeItem("ytCopied");
    renderYoutubeList();
    _ytToast("已清除复制历史");
}

// ---- 标签配置 ----

async function loadYoutubeConfig() {
    try {
        var resp = await fetch(API_BASE + "/api/youtube/tags");
        var data = await resp.json();
        if (data.success && data.tags) {
            document.getElementById("ytCfgRegion").value = (data.tags.regions || []).join("\n");
            document.getElementById("ytCfgFrame").value = (data.tags.frame_types || []).join("\n");
            document.getElementById("ytCfgEff").value = (data.tags.effectiveness || []).filter(function(x){return x;}).join("\n");
        }
    } catch (e) {}
}

async function saveYoutubeConfig() {
    var regions = document.getElementById("ytCfgRegion").value.split("\n").map(function(s){return s.trim();}).filter(function(s){return s;});
    var frames = document.getElementById("ytCfgFrame").value.split("\n").map(function(s){return s.trim();}).filter(function(s){return s;});
    var prods = document.getElementById("ytCfgProd").value.split("\n").map(function(s){return s.trim();}).filter(function(s){return s;});
    var effs = document.getElementById("ytCfgEff").value.split("\n").map(function(s){return s.trim();}).filter(function(s){return s;});

    var resp = await fetch(API_BASE + "/api/youtube/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regions: regions, frame_types: frames, effectiveness: effs, product_names: prods }),
    });
    var data = await resp.json();
    var msg = document.getElementById("ytCfgMsg");
    if (msg) { msg.textContent = "✅ 已保存"; setTimeout(function(){ msg.textContent = ""; }, 2000); }

    // 有受删除影响的视频
    if (data.affected && data.affected.length > 0) {
        showAffectedPopup(data.affected);
    }

    refreshDropdowns(regions, frames, effs, prods);
}

function showAffectedPopup(affected) {
    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100;display:flex;align-items:center;justify-content:center;";
    var box = document.createElement("div");
    box.style.cssText = "background:var(--bg-surface);border:1px solid var(--border-subtle);padding:20px;max-width:500px;width:90%;max-height:70vh;overflow-y:auto;";
    // 按 field 分组
    var groups = {};
    affected.forEach(function (a) {
        if (!groups[a.field]) groups[a.field] = [];
        groups[a.field].push(a);
    });

    box.innerHTML = "<h3 style='font-family:var(--font-mono);'>⚠ 标签已删除 (" + affected.length + " 个视频受影响)</h3><p style='font-size:12px;color:var(--text-muted);margin-bottom:12px;'>以下视频的标签值已不存在：</p>";

    Object.keys(groups).forEach(function (field) {
        var items = groups[field];
        var fieldName = field === "region" ? "地区" : field === "frame_type" ? "帧类型" : field === "effectiveness" ? "成效" : "产品名称";
        var div = document.createElement("div");
        div.style.cssText = "margin-bottom:10px;padding:8px;border:1px solid var(--border-subtle);";

        // 批量修改行
        var ids = items.map(function (a) { return a.id; });
        var batchHtml = '<div style="margin-bottom:6px;font-size:11px;"><strong>' + fieldName + '</strong>：' + items.length + ' 个视频' +
            ' <select id="batchVal_' + field + '" style="width:auto;padding:2px 6px;font-size:10px;margin:0 4px;"></select>' +
            ' <button onclick="batchEditAffected(\'' + field + '\',' + JSON.stringify(ids) + ')" style="width:auto;padding:2px 6px;font-size:10px;background:var(--accent-green);color:#0c0c10;">批量修改</button></div>';
        div.innerHTML = batchHtml;

        // 视频列表（可折叠）
        items.forEach(function (a) {
            div.innerHTML += '<div style="font-size:10px;padding:2px 0;color:var(--text-muted);">' +
                (a.title || a.id).substring(0, 40) +
                ' <span onclick="editFromPopup(\'' + a.id + '\')" style="cursor:pointer;color:var(--accent);">✏</span></div>';
        });
        box.appendChild(div);
    });

    // 延迟填充批量修改下拉框
    setTimeout(function () {
        fetch(API_BASE + "/api/youtube/tags").then(function (r) { return r.json(); }).then(function (d) {
            if (!d.success) return;
            Object.keys(groups).forEach(function (field) {
                var sel = document.getElementById("batchVal_" + field);
                if (!sel) return;
                var values = field === "region" ? (d.tags.regions || []) :
                             field === "frame_type" ? (d.tags.frame_types || []) :
                             (d.tags.effectiveness || []);
        if (field === "product_name") values = (d.tags.product_names || []);
                values.forEach(function (v) {
                    if (v) { var o = document.createElement("option"); o.value = v; o.text = v; sel.appendChild(o); }
                });
            });
        });
    }, 100);
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "关闭";
    closeBtn.onclick = function () { document.body.removeChild(overlay); };
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    overlay.onclick = function (e) { if (e.target === overlay) document.body.removeChild(overlay); };
    document.body.appendChild(overlay);
}

async function batchEditAffected(field, idsJson) {
    var sel = document.getElementById("batchVal_" + field);
    if (!sel || !sel.value) { alert("请先选择一个值"); return; }
    var newVal = sel.value;
    var ids = typeof idsJson === "string" ? JSON.parse(idsJson) : idsJson;
    for (var i = 0; i < ids.length; i++) {
        var body = { id: ids[i] };
        body[field] = newVal;
        await fetch(API_BASE + "/api/youtube/edit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    }
    loadYoutubeList();
    alert("已批量修改 " + ids.length + " 个视频的 " + field + " 为 " + newVal);
}

function editFromPopup(vid) {
    switchYoutubeTab("view");
    ytState.selectedId = vid;
    loadYoutubeList().then(function () {
        var v = ytState.videos.find(function (x) { return x.id === vid; });
        if (v) playYoutube(v);
    });
}

function refreshDropdowns(regions, frames, effs, prods) {
    var updateSelect = function(id, values, selected) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var cur = sel.value;
        sel.innerHTML = "";
        values.forEach(function(v) {
            var opt = document.createElement("option");
            opt.value = v; opt.textContent = v || "（不选）";
            if (v === cur) opt.selected = true;
            sel.appendChild(opt);
        });
    };
    updateSelect("ytRegion", regions);
    updateSelect("ytFrameType", frames);
    updateSelect("ytEffectiveness", [""].concat(effs));
    updateSelect("ytFilterRegion", [""].concat(regions));
    updateSelect("ytFilterFrame", [""].concat(frames));
    updateSelect("ytFilterEff", [""].concat(effs));
    updateSelect("ytProductName", [""].concat(prods));
    updateSelect("ytFilterProd", [""].concat(prods));
    // 更新编辑区下拉框
    loadYoutubeList();
}

// 初始化时加载配置
async function initConfig() {
    try {
        var resp = await fetch(API_BASE + "/api/youtube/tags");
        var data = await resp.json();
        if (data.success && data.tags) {
            refreshDropdowns(
                data.tags.regions || ["巴西","菲律宾","孟加拉","印尼","东南亚通用","通用"],
                data.tags.frame_types || ["融帧","非融帧"],
                data.tags.effectiveness || ["","成效","一般"],
                data.tags.product_names || ["p222","93ok"]
            );
        }
    } catch (e) {}
}
initConfig();

// 初始化
loadYoutubeList();

async function quickEdit(vid, field, value) {
    var body = { id: vid };
    body[field] = value;
    await fetch(API_BASE + "/api/youtube/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    loadYoutubeList();
}
