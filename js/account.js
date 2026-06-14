// 账户管理 — 产品管理 + 广告账户 + MCC 管理 + 设置
// 子标签: switchAccountTab('product'|'accounts'|'mcc'|'settings')

function switchAccountTab(name) {
    document.querySelectorAll(".ac-subtab").forEach(function(el) {
        el.classList.toggle("active", el.getAttribute("data-ac") === name);
    });
    document.querySelectorAll(".ac-subpanel").forEach(function(el) {
        el.style.display = el.id === "ac-" + name ? "block" : "none";
    });
    if (name === "product") { try { loadProducts(1); } catch(e) {} }
    if (name === "accounts") { try { loadAccounts(1); } catch(e) {} }
    if (name === "mcc") { try { loadMccList(1); } catch(e) {} }
    if (name === "settings") { try { loadAccountSettings(); } catch(e) {} }
}

// 全局设置缓存
var acSettings = { account_statuses: ["存活","死亡","验证","限额"], account_agents: [], mcc_levels: [] };

// ======================== 产品管理（迁移自 product.js） ========================

var prodState = { page: 1, pausedMode: false, products: [], pageSize: 10 };

function naturalCompare(a, b) {
    var re = /(\d+)/;
    var aParts = (a || '').split(re);
    var bParts = (b || '').split(re);
    var len = Math.max(aParts.length, bParts.length);
    for (var i = 0; i < len; i++) {
        var ap = aParts[i] || '';
        var bp = bParts[i] || '';
        var aIsNum = /^\d+$/.test(ap);
        var bIsNum = /^\d+$/.test(bp);
        if (aIsNum && bIsNum) {
            var cmp = parseInt(ap, 10) - parseInt(bp, 10);
            if (cmp !== 0) return cmp;
        } else if (aIsNum) { return -1; }
        else if (bIsNum) { return 1; }
        else {
            var cmp = ap.toLowerCase().localeCompare(bp.toLowerCase());
            if (cmp !== 0) return cmp;
        }
    }
    return 0;
}

function updatePausedToggle() {
    var btnN = document.getElementById("prodToggleNormal");
    var btnP = document.getElementById("prodTogglePaused");
    if (btnN) btnN.classList.toggle("active", !prodState.pausedMode);
    if (btnP) btnP.classList.toggle("active", prodState.pausedMode);
}

async function loadProducts(page) {
    if (page) prodState.page = parseInt(page) || 1;
    var region = document.getElementById("prodFilterRegion").value;
    var mccId = document.getElementById("prodFilterMcc").value;
    var search = document.getElementById("prodSearch").value.trim();
    var params = ["page=" + prodState.page, "size=" + prodState.pageSize];
    if (region) params.push("region=" + encodeURIComponent(region));
    if (mccId) params.push("mcc_id=" + encodeURIComponent(mccId));
    if (search) params.push("search=" + encodeURIComponent(search));
    params.push("status=" + (prodState.pausedMode ? "paused" : ""));

    var resp = await fetch(API_BASE + "/api/products/list?" + params.join("&"));
    var data = await resp.json();
    if (!data.success) return;
    prodState.products = data.products || [];
    prodState._total = data.total || 0;

    var regionSel = document.getElementById("prodFilterRegion");
    if (regionSel && data.regions) {
        var cur = regionSel.value;
        regionSel.innerHTML = '<option value="">全部地区</option>';
        data.regions.forEach(function (r) {
            regionSel.innerHTML += '<option value="' + r + '"' + (r === cur ? " selected" : "") + '>' + r + '</option>';
        });
    }
    // MCC 筛选下拉
    var mccSel = document.getElementById("prodFilterMcc");
    if (mccSel && data.mcc_options) {
        var curM = mccSel.value;
        mccSel.innerHTML = '<option value="">全部 MCC</option>';
        data.mcc_options.forEach(function(m) {
            mccSel.innerHTML += '<option value="' + m.id + '"' + (String(m.id) === curM ? " selected" : "") + '>' + m.name + ' (' + m.mcc_id + ')</option>';
        });
    }

    updatePausedToggle();
    renderProductList(data.total);
}

var _prodFilterState = {};
function filterProductPackages(prodId, mode) {
    if (_prodFilterState[prodId] === mode) { _prodFilterState[prodId] = "all"; mode = "all"; }
    else { _prodFilterState[prodId] = mode; }
    var body = document.querySelector(".prod-card[data-prod-id='" + prodId + "'] .prod-card-body");
    var arrow = document.querySelector(".prod-card[data-prod-id='" + prodId + "'] .prod-expand-arrow");
    if (body && !body.classList.contains("open")) {
        body.classList.add("open");
        if (arrow) { arrow.classList.add("open"); arrow.textContent = "▲"; }
    }
    var rows = document.querySelectorAll(".prod-pkg-row[data-prod-id='" + prodId + "']");
    rows.forEach(function (row) {
        if (mode === "all") { row.style.display = ""; }
        else {
            var rs = row.getAttribute("data-status") || "";
            row.style.display = rs === mode ? "" : "none";
        }
    });
    var card = document.querySelector("[data-prod-id='" + prodId + "']");
    if (card) {
        var normalBadge = card.querySelector(".prod-badge-count");
        var pausedBadge = card.querySelector(".prod-badge-count-paused");
        if (normalBadge) normalBadge.classList.toggle("filter-active", mode === "normal");
        if (pausedBadge) pausedBadge.classList.toggle("filter-active", mode === "paused");
    }
}

function copyToClipboard(text) {
    if (!text) return;
    var ok = false;
    try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px"; ta.style.top = "-9999px";
        document.body.appendChild(ta); ta.focus(); ta.select();
        ok = document.execCommand("copy"); document.body.removeChild(ta);
    } catch (e) {}
    if (ok) { _showCopyToast(); return; }
    navigator.clipboard.writeText(text).then(function() { _showCopyToast(); }).catch(function() {});
}

function _showCopyToast() {
    var toast = document.createElement("div");
    toast.textContent = "已复制 ✓";
    toast.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--accent);color:#fff;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;z-index:9999;pointer-events:none;transition:opacity 0.3s;opacity:1;";
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = "0"; setTimeout(function() { document.body.removeChild(toast); }, 300); }, 1000);
}

function renderProductList(total) {
    var list = document.getElementById("prodList");
    if (!list) return;
    list.innerHTML = "";

    if (prodState.products.length === 0) {
        list.innerHTML = '<div class="prod-empty"><span class="prod-empty-icon" aria-hidden="true">📦</span><div class="prod-empty-text">' +
            (prodState.pausedMode ? '没有已暂停的产品' : '创建第一个产品') + '</div><div class="prod-empty-hint">' +
            (prodState.pausedMode ? '' : '每个产品可包含多个 Google Play 包。点击上方「新增产品」手动创建，或「复制导入」从聊天记录批量解析。') + '</div></div>';
    }

    prodState.products.forEach(function (prod) {
        var card = document.createElement("div");
        card.className = "prod-card" + (prod.status ? " paused" : "");
        card.setAttribute("data-prod-id", prod.id);

        var header = document.createElement("div");
        header.className = "prod-card-header";

        var main = document.createElement("div");
        main.className = "prod-card-main";

        var dot = document.createElement("span");
        dot.className = "prod-status-dot " + (prod.status ? "paused" : "active");

        var title = document.createElement("span");
        title.className = "prod-card-title";
        title.textContent = prod.product_name || "";
        title.title = prod.product_name || "";

        var badges = document.createElement("span");
        badges.className = "prod-badges";
        if (prod.kpi) badges.innerHTML += '<span class="prod-badge prod-badge-kpi">' + prod.kpi + '</span>';
        if (prod.region) badges.innerHTML += '<span class="prod-badge prod-badge-region">' + prod.region + '</span>';
        // MCC 徽章
        if (prod.mcc_id) {
            badges.innerHTML += '<span class="prod-badge" style="background:#e0f2fe;color:#0369a1;cursor:pointer;" title="' + (prod.mcc_name||"") + ' (' + (prod.mcc_code||"") + ')">🏢 ' + (prod.mcc_name||"") + '</span>';
            badges.innerHTML += '<span class="prod-badge" style="background:#f0fdf4;color:#166534;" title="关联账户数（通过MCC）">👤 ' + (prod.related_account_count||0) + ' 账户</span>';
        }
        var pkgs = prod.packages || [];
        var counts = {"":0,"rejected":0,"paused":0,"dropped":0};
        pkgs.forEach(function(p){ var s = p.status || ""; counts[s] = (counts[s]||0)+1; });
        [["","正常"],["rejected","拒登"],["paused","暂停"],["dropped","掉包"]].forEach(function(kv){
            if(counts[kv[0]]||0){
                var cl = kv[0]===""?"prod-badge-count":kv[0]==="rejected"?"prod-badge-rejected":kv[0]==="paused"?"prod-badge-count-paused":"prod-badge-dropped";
                badges.innerHTML+='<span class="prod-badge '+cl+'" onclick="var e=arguments[0]||window.event;e.stopPropagation();filterProductPackages('+prod.id+',\''+kv[0]+'\')" style="cursor:pointer;" title="'+kv[1]+'">'+counts[kv[0]]+' '+kv[1]+'</span>';
            }
        });

        main.appendChild(dot); main.appendChild(title); main.appendChild(badges);

        var actions = document.createElement("div");
        actions.className = "prod-card-actions";
        actions.innerHTML =
            '<button class="prod-btn-icon" onclick="event.stopPropagation();showProductDetail(' + prod.id + ')" title="详情" style="color:var(--accent-blue);">📋</button>' +
            '<button class="prod-btn-icon warn" onclick="event.stopPropagation();toggleProductPause(' + prod.id + ',' + (prod.status ? 0 : 1) + ')" title="' + (prod.status ? '恢复' : '暂停') + '">' + (prod.status ? "▶ 恢复" : "⏸ 暂停") + '</button>' +
            '<button class="prod-btn-icon" onclick="event.stopPropagation();editProduct(' + prod.id + ')" title="编辑">✏️</button>' +
            '<button class="prod-btn-icon" onclick="event.stopPropagation();showAddPackageModal(' + prod.id + ')" title="加包" style="color:var(--accent-green);">➕包</button>' +
            '<button class="prod-btn-icon danger" onclick="event.stopPropagation();deleteProduct(' + prod.id + ')" title="删除">🗑</button>';

        var arrow = document.createElement("span");
        arrow.className = "prod-expand-arrow";
        arrow.textContent = "▼";

        header.appendChild(main); header.appendChild(actions); header.appendChild(arrow);

        var bodyRef = null;
        header.addEventListener("click", function () { if (bodyRef) toggleProductExpand(bodyRef, arrow); });

        var body = document.createElement("div");
        body.className = "prod-card-body";
        bodyRef = body;

        var pkgHeader = document.createElement("div");
        pkgHeader.className = "prod-pkg-header";
        pkgHeader.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
        pkgHeader.innerHTML = '<span class="select-all-link" onclick="event.stopPropagation();toggleAllPkgCheck(this,' + prod.id + ')">☑ 全选</span>' +
            '<span style="margin:0 8px;">包含 ' + (prod.packages || []).length + ' 个包</span>' +
            '<span class="prod-batch-actions">' +
            '<button class="prod-btn-sm" onclick="event.stopPropagation();batchPkgAction(' + prod.id + ',&quot;pause&quot;)">⏸ 批量暂停</button>' +
            '<button class="prod-btn-sm" onclick="event.stopPropagation();batchPkgAction(' + prod.id + ',&quot;resume&quot;)">▶ 批量恢复</button>' +
            '<button class="prod-btn-sm" onclick="event.stopPropagation();copyCheckedLinks(' + prod.id + ')" style="background:var(--accent-blue);color:#fff;">📋 复制链接</button>' +
            '</span>';
        body.appendChild(pkgHeader);

        var sortedPkgs = (prod.packages || []).slice().sort(function (a, b) {
            var so = {"":0,"rejected":1,"paused":2,"dropped":3};
            var sa = so[a.status||""]||0; var sb = so[b.status||""]||0;
            if (sa !== sb) return sa - sb;
            return naturalCompare(a.series_name || "", b.series_name || "");
        });

        sortedPkgs.forEach(function (pkg) {
            var row = document.createElement("div");
            var rowCls = "prod-pkg-row";
            if (pkg.status) rowCls += " " + pkg.status;
            row.className = rowCls;
            row.setAttribute("data-prod-id", prod.id);
            row.setAttribute("data-status", pkg.status || "");

            var info = document.createElement("div");
            info.className = "prod-pkg-info";
            info.innerHTML += '<input type="checkbox" class="prod-pkg-check" data-pkg-id="' + pkg.id + '" onclick="event.stopPropagation();updateBatchBar(' + prod.id + ')" style="margin-right:6px;width:auto;" />';
            if (pkg.status) info.innerHTML += '<span class="prod-pkg-paused-dot">⏸</span>';
            info.innerHTML +=
                '<span class="prod-pkg-series" title="' + (pkg.series_name || "") + '" onclick="event.stopPropagation();copyToClipboard(\'' + (pkg.series_name || "").replace(/'/g, "\\'") + '\')">' + (pkg.series_name || "-") + '</span>' +
                '<span class="prod-pkg-sep">│</span>' +
                '<span class="prod-pkg-name" title="点击复制" onclick="event.stopPropagation();copyToClipboard(\'' + (pkg.package_name || "").replace(/'/g, "\\'") + '\')">' + (pkg.package_name || "-") + '</span>';
            if (pkg.url) {
                info.innerHTML +=
                    '<span class="prod-pkg-sep">│</span>' +
                    '<span class="prod-pkg-url" onclick="event.stopPropagation();copyToClipboard(\'' + (pkg.url || "").replace(/'/g, "\\'") + '\')">' + (pkg.url || "") + '</span>' +
                    ' <a href="' + pkg.url + '" target="_blank" class="prod-pkg-link-icon" onclick="event.stopPropagation()">🔗</a>';
            }

            var pkgActions = document.createElement("div");
            pkgActions.className = "prod-pkg-actions";
            pkgActions.innerHTML =
                '<select class="prod-status-select-sm" onchange="setPackageStatus(' + pkg.id + ',this.value)" style="width:auto;padding:3px 6px;font-size:10px;">' +
                '<option value=""' + (!pkg.status ? ' selected' : '') + '>正常</option>' +
                '<option value="paused"' + (pkg.status==="paused" ? ' selected' : '') + '>暂停</option>' +
                '<option value="dropped"' + (pkg.status==="dropped" ? ' selected' : '') + '>掉包</option>' +
                '<option value="rejected"' + (pkg.status==="rejected" ? ' selected' : '') + '>拒登</option>' +
                '</select>' +
                '<button class="prod-btn-sm" onclick="editPackage(' + pkg.id + ')">✏️</button>' +
                '<button class="prod-btn-sm danger" onclick="deletePackage(' + pkg.id + ')">✕</button>';

            row.appendChild(info); row.appendChild(pkgActions);
            body.appendChild(row);
        });

        card.appendChild(header); card.appendChild(body);
        list.appendChild(card);
    });

    // 分页（保持 product.js 逻辑）
    var totalPages = Math.ceil(total / prodState.pageSize);
    var pagDiv = document.getElementById("prodPagination");
    if (pagDiv) {
        pagDiv.innerHTML = "";
        if (totalPages <= 1) return;
        _renderPagination(pagDiv, totalPages, prodState.page, loadProducts);
    }
}

function _renderPagination(pagDiv, totalPages, currentPage, loadFn) {
    var first = document.createElement("span");
    first.className = "prod-page-btn" + (currentPage === 1 ? " current" : "");
    first.textContent = "1"; first.onclick = function () { loadFn(1); };
    pagDiv.appendChild(first);
    if (totalPages > 7) {
        var rangeStart = Math.max(2, currentPage - 1);
        var rangeEnd = Math.min(totalPages - 1, currentPage + 1);
        if (rangeStart > 2) { var e1 = document.createElement("span"); e1.className = "prod-page-ellipsis"; e1.textContent = "…"; pagDiv.appendChild(e1); }
        for (var p = rangeStart; p <= rangeEnd; p++) {
            var span = document.createElement("span");
            span.className = "prod-page-btn" + (p === currentPage ? " current" : "");
            span.textContent = p; span.onclick = (function(pg){return function(){loadFn(pg);};})(p);
            pagDiv.appendChild(span);
        }
        if (rangeEnd < totalPages - 1) { var e2 = document.createElement("span"); e2.className = "prod-page-ellipsis"; e2.textContent = "…"; pagDiv.appendChild(e2); }
    } else {
        for (var p = 2; p < totalPages; p++) {
            var span = document.createElement("span");
            span.className = "prod-page-btn" + (p === currentPage ? " current" : "");
            span.textContent = p; span.onclick = (function(pg){return function(){loadFn(pg);};})(p);
            pagDiv.appendChild(span);
        }
    }
    if (totalPages > 1) {
        var last = document.createElement("span");
        last.className = "prod-page-btn" + (currentPage === totalPages ? " current" : "");
        last.textContent = totalPages; last.onclick = function () { loadFn(totalPages); };
        pagDiv.appendChild(last);
    }
}

// ---- 产品详情弹窗 ----
async function showProductDetail(prodId) {
    var resp = await fetch(API_BASE + "/api/products/" + prodId + "/detail");
    var data = await resp.json();
    if (!data.success) { alert(data.error); return; }
    var prod = data.product;
    var overlay = document.createElement("div");
    overlay.className = "prod-modal-overlay";
    var box = document.createElement("div");
    box.className = "prod-modal-box";
    box.style.maxWidth = "750px";
    var statusHtml = "";
    if (prod.status_count && Object.keys(prod.status_count).length) {
        var scCount = prod.status_count;
        var emojiMap = {"存活":"🟢","验证":"🟡","死亡":"🔴","限额":"⬜"};
        var cols = _statusColors();
        statusHtml = '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
        Object.keys(scCount).forEach(function(s){
            var c = cols[s] || "#f3f4f6;#6b7280";
            var parts = c.split(";");
            statusHtml += '<span style="padding:4px 12px;background:' + parts[0] + ';border-radius:8px;color:' + parts[1] + ';font-weight:600;">' + (emojiMap[s]||"") + ' ' + s + ' ' + (scCount[s]||0) + '</span>';
        });
        statusHtml += '</div>';
    }
    var accountsHtml = "";
    if (prod.related_accounts && prod.related_accounts.length) {
        accountsHtml = '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:4px;"><thead><tr style="background:rgba(0,0,0,0.03);text-align:left;">' +
            '<th style="padding:4px;">账户名称</th><th style="padding:4px;">账户 ID</th><th style="padding:4px;">状态</th></tr></thead><tbody>';
        prod.related_accounts.forEach(function(a){
            var sc = _statusColors();
            var c = sc[a.status] || "#d1fae5;#065f46";
            accountsHtml += '<tr><td style="padding:4px;">' + a.name + '</td><td style="padding:4px;font-family:monospace;">' + a.account_id + '</td>' +
                '<td style="padding:4px;"><span style="background:' + c.split(";")[0] + ';color:' + c.split(";")[1] + ';padding:1px 6px;border-radius:8px;font-size:10px;">' + a.status + '</span></td></tr>';
        });
        accountsHtml += '</tbody></table>';
    } else {
        accountsHtml = '<p style="color:#888;font-size:11px;">未关联 MCC 或 MCC 下无账户</p>';
    }
    box.innerHTML =
        '<div class="prod-modal-title">📋 产品详情 — ' + (prod.product_name||"") + '</div>' +
        '<div style="margin-bottom:12px;font-size:12px;">' +
        '<span>KPI: <strong>' + (prod.kpi||"-") + '</strong></span> &nbsp; ' +
        '<span>地区: <strong>' + (prod.region||"-") + '</strong></span> &nbsp; ' +
        '<span>所属 MCC: <strong>' + (prod.mcc_name ? prod.mcc_name + ' (' + prod.mcc_code + ')' : '未分配') + '</strong></span>' +
        '</div>' +
        '<div style="margin-bottom:12px;"><strong style="font-size:12px;">📌 跑该产品的账户（' + (prod.related_account_count||0) + ' 个）</strong>' + statusHtml + accountsHtml + '</div>' +
        '<div style="margin-bottom:8px;"><strong style="font-size:12px;">📦 包列表（' + (prod.packages||[]).length + ' 个）</strong></div>' +
        '<div style="max-height:200px;overflow-y:auto;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:rgba(0,0,0,0.03);text-align:left;">' +
        '<th style="padding:4px;">系列名</th><th style="padding:4px;">包名</th><th style="padding:4px;">状态</th></tr></thead><tbody>' +
        (prod.packages||[]).map(function(p){ return '<tr><td style="padding:4px;">'+(p.series_name||"-")+'</td><td style="padding:4px;">'+(p.package_name||"-")+'</td><td style="padding:4px;">'+(p.status||"正常")+'</td></tr>'; }).join("") +
        '</tbody></table></div>' +
        '<div class="prod-modal-actions"><button onclick="this.closest(\'.prod-modal-overlay\').remove()" style="background:var(--bg-elevated);color:var(--text-primary);">关闭</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// ---- 复制现有函数的实际实现（因文件太大，委托原有逻辑） ----
showAddPackageModal = function(prodId) {
    var prod = prodState.products.find(function(p){return p.id===prodId;});
    if (!prod) return;
    var overlay = document.createElement("div");
    overlay.className = "prod-modal-overlay";
    var box = document.createElement("div");
    box.className = "prod-modal-box"; box.style.cssText = "max-width:750px;";
    box.innerHTML =
        '<div class="prod-modal-title">➕ 添加包 — ' + (prod.product_name||"") + '</div>' +
        '<div class="form-group"><label>系列名前缀（可选）</label><input id="addPkgPrefix" placeholder="如 P222-A" /></div>' +
        '<div class="form-group"><label>系列名后缀（可选）</label><input id="addPkgSuffix" placeholder="如 carl" /></div>' +
        '<div class="form-group"><label>粘贴内容（支持脏数据）</label><textarea id="addPkgText" rows="8" placeholder="直接粘贴带链接的文本..."></textarea></div>' +
        '<button onclick="previewAddPkg(' + prodId + ')" style="margin-bottom:8px;">🔍 预览解析</button>' +
        '<div id="addPkgPreview" style="margin-bottom:8px;font-size:11px;max-height:150px;overflow-y:auto;"></div>' +
        '<div class="prod-modal-actions"><button onclick="submitAddPackage(' + prodId + ',this)">💾 添加</button><button onclick="this.closest(\'.prod-modal-overlay\').remove()" style="background:var(--bg-elevated);color:var(--text-primary);">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
};

var _addPkgParsed = [];
previewAddPkg = async function(prodId) {
    var text = document.getElementById("addPkgText").value;
    var resp = await fetch(API_BASE + "/api/products/import-text", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({text: text, product_name: "", kpi: "", region: "",
            prefix: document.getElementById("addPkgPrefix").value.trim(),
            suffix: document.getElementById("addPkgSuffix").value.trim(),
        }),
    });
    var data = await resp.json();
    _addPkgParsed = data.parsed || [];
    var preview = document.getElementById("addPkgPreview");
    var html = '<p>识别 <strong>' + _addPkgParsed.length + '</strong> 个包（可编辑）：</p>';
    html += '<textarea id="addPkgEdit" rows="' + Math.max(4, _addPkgParsed.length) + '" style="width:100%;font-size:11px;">';
    _addPkgParsed.forEach(function(p){ html += (p.series_name||"") + " | " + (p.package_name||"") + " | " + (p.url||"") + "\n"; });
    html += '</textarea>';
    preview.innerHTML = html;
};

submitAddPackage = async function(prodId, btn) {
    var overlay = btn.closest(".prod-modal-overlay");
    var editArea = document.getElementById("addPkgEdit");
    var packages = [];
    if (editArea) {
        editArea.value.split("\n").filter(function(l){return l.trim();}).forEach(function(line){
            var parts = line.split("|").map(function(s){return s.trim();});
            if (parts.length >= 3) packages.push({series_name: parts[0], package_name: parts[1], url: parts[2]});
        });
    }
    if (packages.length === 0 && _addPkgParsed.length > 0) {
        _addPkgParsed.forEach(function(p){ packages.push({series_name: p.series_name||"", package_name: p.package_name, url: p.url}); });
    }
    if (packages.length === 0) { alert("没有有效的包数据"); return; }
    for (var i=0; i<packages.length; i++) {
        await fetch(API_BASE + "/api/products/" + prodId + "/packages", {
            method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(packages[i]),
        });
    }
    overlay.remove(); loadProducts(prodState.page);
};

toggleProductExpand = function(bodyEl, arrowEl) {
    var isOpen = bodyEl.classList.contains("open");
    if (isOpen) { bodyEl.classList.remove("open"); if (arrowEl) { arrowEl.classList.remove("open"); arrowEl.textContent = "▼"; } }
    else { bodyEl.classList.add("open"); if (arrowEl) { arrowEl.classList.add("open"); arrowEl.textContent = "▲"; } }
};

// ---- 产品暂停/恢复/编辑/删除（保持原有逻辑，增加 mcc_id） ----
async function toggleProductPause(id, paused) {
    if (!confirm(paused ? "确定暂停此产品？" : "确定恢复此产品？")) return;
    await fetch(API_BASE + "/api/products/" + id, {
        method: "PUT", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ status: paused ? "paused" : "" }),
    }); loadProducts();
}
async function deleteProduct(id) {
    if (!confirm("确定删除此产品及所有包？")) return;
    await fetch(API_BASE + "/api/products/" + id, { method: "DELETE" }); loadProducts();
}
async function deletePackage(pkgId) {
    if (!confirm("删除此包？")) return;
    await fetch(API_BASE + "/api/products/packages/" + pkgId, { method: "DELETE" }); loadProducts();
}
async function setPackageStatus(pkgId, status) {
    await fetch(API_BASE + "/api/products/packages/" + pkgId, {
        method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ status: status }),
    }); loadProducts();
}

function editProduct(id) {
    var prod = prodState.products.find(function(p){return p.id===id;});
    if (!prod) return;
    var overlay = document.createElement("div"); overlay.className = "prod-modal-overlay";
    var box = document.createElement("div"); box.className = "prod-modal-box";
    box.innerHTML =
        '<div class="prod-modal-title">✏️ 编辑产品</div>' +
        '<div class="form-group"><label>产品 / 群名</label><input id="editProdName" value="' + _escAttr(prod.product_name||"") + '" /></div>' +
        '<div class="form-group"><label>KPI</label><input id="editProdKpi" value="' + _escAttr(prod.kpi||"") + '" /></div>' +
        '<div class="form-group"><label>地区</label><input id="editProdRegion" value="' + _escAttr(prod.region||"") + '" /></div>' +
        '<div class="form-group"><label>所属 MCC</label><select id="editProdMcc"><option value="">（未分配）</option></select></div>' +
        '<div class="prod-modal-actions">' +
        '<button class="prod-btn-save" onclick="submitEditProduct(' + prod.id + ', this.parentNode.parentNode.parentNode)">💾 保存</button>' +
        '<button class="prod-btn-cancel" onclick="document.body.removeChild(this.parentNode.parentNode.parentNode)">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    // 加载 MCC 选项
    fetch(API_BASE + "/api/mcc/options").then(function(r){return r.json();}).then(function(d){
        var sel = document.getElementById("editProdMcc");
        if (sel && d.success) {
            d.options.forEach(function(m){ sel.innerHTML += '<option value="' + m.id + '"' + (String(m.id)===String(prod.mcc_id)?" selected":"") + '>' + m.name + ' (' + m.mcc_id + ')</option>'; });
        }
    });
    setTimeout(function(){ var el=document.getElementById("editProdName"); if(el)el.focus(); }, 100);
}

function _escAttr(s) {
    return String(s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

async function submitEditProduct(id, overlay) {
    var mccId = document.getElementById("editProdMcc").value;
    await fetch(API_BASE + "/api/products/" + id, {
        method: "PUT", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
            product_name: document.getElementById("editProdName").value.trim(),
            kpi: document.getElementById("editProdKpi").value.trim(),
            region: document.getElementById("editProdRegion").value.trim(),
            mcc_id: mccId || null,
        }),
    });
    document.body.removeChild(overlay); loadProducts();
}

function showProductModal() {
    var overlay = document.createElement("div"); overlay.className = "prod-modal-overlay";
    var box = document.createElement("div"); box.className = "prod-modal-box";
    box.innerHTML =
        '<div class="prod-modal-title">➕ 新增产品</div>' +
        '<div class="form-group"><label>产品 / 群名</label><input id="modalProdName" placeholder="输入产品名称" /></div>' +
        '<div class="form-group"><label>KPI</label><input id="modalProdKpi" placeholder="如：ROAS 1.5" /></div>' +
        '<div class="form-group"><label>地区</label><input id="modalProdRegion" placeholder="如：巴西" /></div>' +
        '<div class="form-group"><label>所属 MCC</label><select id="modalProdMcc"><option value="">（未分配）</option></select></div>' +
        '<div class="prod-modal-actions">' +
        '<button class="prod-btn-save" onclick="submitNewProduct(this.parentNode.parentNode.parentNode)">💾 保存</button>' +
        '<button class="prod-btn-cancel" onclick="document.body.removeChild(this.parentNode.parentNode.parentNode)">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    fetch(API_BASE + "/api/mcc/options").then(function(r){return r.json();}).then(function(d){
        var sel = document.getElementById("modalProdMcc");
        if (sel && d.success) { d.options.forEach(function(m){ sel.innerHTML += '<option value="' + m.id + '">' + m.name + ' (' + m.mcc_id + ')</option>'; }); }
    });
    setTimeout(function(){ var el=document.getElementById("modalProdName"); if(el)el.focus(); }, 100);
}

async function submitNewProduct(overlay) {
    var mccId = document.getElementById("modalProdMcc").value;
    var resp = await fetch(API_BASE + "/api/products/create", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
            product_name: document.getElementById("modalProdName").value.trim(),
            kpi: document.getElementById("modalProdKpi").value.trim(),
            region: document.getElementById("modalProdRegion").value.trim(),
            mcc_id: mccId || null,
        }),
    });
    var data = await resp.json();
    if (data.success) { document.body.removeChild(overlay); prodState.pausedMode=false; updatePausedToggle(); loadProducts(1); }
    else { alert(data.error || "创建失败"); }
}

// ---- 复制导入（保持原有逻辑） ----
async function showCopyImportModal() {
    var overlay = document.createElement("div"); overlay.className = "prod-modal-overlay";
    var box = document.createElement("div"); box.className = "prod-modal-box"; box.style.maxWidth = "600px";
    box.innerHTML =
        '<div class="prod-modal-title">📋 复制导入</div>' +
        '<div class="form-group"><label>产品 / 群名</label><select id="copyProdName" onchange="var o=this.selectedOptions[0];document.getElementById(\'copyProdKpi\').value=o.getAttribute(\'data-kpi\')||\'\';document.getElementById(\'copyProdRegion\').value=o.getAttribute(\'data-region\')||\'\';"><option value="">（加载中...）</option></select><input id="copyProdNameNew" placeholder="或输入新产品名..." style="margin-top:6px;" /></div>' +
        '<div class="form-group"><label>KPI</label><input id="copyProdKpi" /></div>' +
        '<div class="form-group"><label>地区</label><input id="copyProdRegion" /></div>' +
        '<div class="form-group"><label>系列名前缀（可选）</label><input id="copyPrefix" placeholder="如 P222-A" /></div>' +
        '<div class="form-group"><label>系列名后缀（可选）</label><input id="copySuffix" placeholder="如 carl" /></div>' +
        '<div class="form-group"><label>粘贴内容</label><textarea id="copyText" rows="8" placeholder="粘贴包含链接的文本..."></textarea></div>' +
        '<button class="prod-btn-preview" onclick="previewCopyImport()">🔍 预览解析结果</button>' +
        '<div id="copyPreview" class="prod-copy-preview" style="display:none;"></div>' +
        '<div class="prod-modal-actions"><button class="prod-btn-save" onclick="submitCopyImport(this.parentNode.parentNode.parentNode)">💾 导入</button>' +
        '<button class="prod-btn-cancel" onclick="document.body.removeChild(this.parentNode.parentNode.parentNode)">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    try {
        var r = await fetch(API_BASE + "/api/products/list?size=200");
        var d = await r.json();
        if (d.success) {
            var sel = document.getElementById("copyProdName");
            if (sel) { sel.innerHTML='<option value="">（输入新产品名）</option>'; d.products.forEach(function(p){ sel.innerHTML+='<option value="'+_escAttr(p.product_name)+'" data-kpi="'+_escAttr(p.kpi||"")+'" data-region="'+_escAttr(p.region||"")+'">'+p.product_name+'</option>'; }); }
        }
    } catch(e) {}
}

var _copyParsed = [];
function _getCopyProdName() { return document.getElementById("copyProdName").value || document.getElementById("copyProdNameNew").value.trim(); }
async function previewCopyImport() {
    var resp = await fetch(API_BASE + "/api/products/import-text", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({text:document.getElementById("copyText").value, product_name:_getCopyProdName(), kpi:document.getElementById("copyProdKpi").value, region:document.getElementById("copyProdRegion").value, prefix:document.getElementById("copyPrefix").value, suffix:document.getElementById("copySuffix").value}),
    });
    var data = await resp.json();
    if (!data.success) { alert(data.error); return; }
    _copyParsed = data.parsed || [];
    var preview = document.getElementById("copyPreview"); preview.style.display = "block";
    var html = '<p>识别 <strong>' + _copyParsed.length + '</strong> 个包（可编辑）：</p>';
    html += '<div class="prod-preview-table-wrap"><table class="prod-preview-table"><thead><tr>' +
        '<th style="width:28%;">系列名</th><th style="width:28%;">包名</th><th style="width:36%;">链接</th><th style="width:8%;"></th></tr></thead><tbody>';
    _copyParsed.forEach(function(p,i){ html+='<tr><td><input class="prod-preview-input" data-row="'+i+'" data-field="series_name" value="'+_escAttr(p.series_name||"")+'" /></td><td><input class="prod-preview-input" data-row="'+i+'" data-field="package_name" value="'+_escAttr(p.package_name||"")+'" /></td><td><input class="prod-preview-input" data-row="'+i+'" data-field="url" value="'+_escAttr(p.url||"")+'" /></td><td style="text-align:center;"><button class="prod-btn-sm danger" onclick="this.closest(\'tr\').remove()">✕</button></td></tr>'; });
    html += '</tbody></table></div>'; preview.innerHTML = html;
}
function _collectPreviewRows() {
    var parsed = [];
    document.querySelectorAll("#copyPreview .prod-preview-table tbody tr").forEach(function(tr){
        var inputs = tr.querySelectorAll("input");
        if (inputs.length>=3) { var sn=inputs[0].value.trim(), pn=inputs[1].value.trim(), url=inputs[2].value.trim(); if(sn||pn||url)parsed.push({series_name:sn,package_name:pn,url:url}); }
    }); return parsed;
}
async function submitCopyImport(overlay) {
    var parsed = _collectPreviewRows();
    if (!parsed.length) { alert("没有有效的包数据"); return; }
    var resp = await fetch(API_BASE + "/api/products/create", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({product_name:_getCopyProdName(), kpi:document.getElementById("copyProdKpi").value.trim(), region:document.getElementById("copyProdRegion").value.trim(), packages:parsed}),
    });
    var data = await resp.json();
    if (data.success) { document.body.removeChild(overlay); prodState.pausedMode=false; updatePausedToggle(); loadProducts(1); }
    else { alert(data.error||"导入失败"); }
}

// ---- 包批量操作 ----
function copyCheckedLinks(prodId) {
    var card = document.querySelector(".prod-card[data-prod-id='" + prodId + "']");
    if (!card) return;
    var links = [];
    card.querySelectorAll(".prod-pkg-check:checked").forEach(function(cb) {
        var row = cb.closest(".prod-pkg-row"); var urlEl = row.querySelector(".prod-pkg-url");
        if (urlEl) links.push(urlEl.textContent.trim());
    });
    if (links.length) copyToClipboard(links.join("\n"));
}
function updateBatchBar(prodId) {
    var card = document.querySelector(".prod-card[data-prod-id='" + prodId + "']");
    if (!card) return;
    var checked = card.querySelectorAll(".prod-pkg-check:checked").length;
    var bar = card.querySelector(".prod-batch-actions");
    if (bar) bar.classList.toggle("visible", checked > 0);
}
function toggleAllPkgCheck(span, prodId) {
    var card = document.querySelector(".prod-card[data-prod-id='" + prodId + "']");
    if (!card) return;
    var checks = card.querySelectorAll(".prod-pkg-check");
    var anyChecked = false;
    checks.forEach(function(c){if(c.checked)anyChecked=true;});
    checks.forEach(function(c){
        if (anyChecked) c.checked = false;
        else { var row = c.closest(".prod-pkg-row"); c.checked = !(row && row.classList.contains("dropped")); }
    });
    updateBatchBar(prodId);
    var againAny = false; card.querySelectorAll(".prod-pkg-check").forEach(function(c){if(c.checked)againAny=true;});
    span.textContent = againAny ? "☑ 取消全选" : "☑ 全选";
}
async function batchPkgAction(prodId, action) {
    var card = document.querySelector(".prod-card[data-prod-id='" + prodId + "']");
    if (!card) return;
    var checks = card.querySelectorAll(".prod-pkg-check:checked");
    if (!checks.length) return;
    var label = action === "pause" ? "暂停" : "恢复";
    if (!confirm("确定" + label + "选中的 " + checks.length + " 个包？")) return;
    for (var i=0; i<checks.length; i++) {
        var pkgId = checks[i].getAttribute("data-pkg-id");
        await fetch(API_BASE + "/api/products/packages/" + pkgId, {
            method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status:action==="pause"?"paused":""}),
        });
        prodState.products.forEach(function(prod){(prod.packages||[]).forEach(function(pkg){if(String(pkg.id)===pkgId)pkg.status=(action==="pause"?"paused":"");});});
    }
    renderProductList(prodState._total || prodState.products.length);
}
async function editPackage(pkgId) {
    var pkg = null;
    prodState.products.forEach(function(prod) {
        (prod.packages || []).forEach(function(p) {
            if (p.id === pkgId) pkg = p;
        });
    });
    if (!pkg) return;
    var uid = "ep_" + pkgId + "_" + Date.now();
    var overlay = document.createElement("div");
    overlay.className = "prod-modal-overlay";
    overlay.id = uid;
    var box = document.createElement("div");
    box.className = "prod-modal-box";
    box.innerHTML =
        '<div class="prod-modal-title">✏️ 编辑包</div>' +
        '<div class="form-group"><label>系列名</label><input id="' + uid + '_series" value="' + _escAttr(pkg.series_name || "") + '" /></div>' +
        '<div class="form-group"><label>包名</label><input id="' + uid + '_name" value="' + _escAttr(pkg.package_name || "") + '" /></div>' +
        '<div class="form-group"><label>链接</label><input id="' + uid + '_url" value="' + _escAttr(pkg.url || "") + '" /></div>' +
        '<div class="prod-modal-actions"><button onclick="saveEditPackage(' + pkgId + ',\'' + uid + '\')">💾 保存</button><button onclick="document.getElementById(\'' + uid + '\').remove()" style="background:var(--bg-elevated);color:var(--text-primary);">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

async function saveEditPackage(pkgId, uid) {
    var overlay = document.getElementById(uid);
    var sn = document.getElementById(uid + "_series").value.trim();
    var pn = document.getElementById(uid + "_name").value.trim();
    var url = document.getElementById(uid + "_url").value.trim();
    await fetch(API_BASE + "/api/products/packages/" + pkgId, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series_name: sn, package_name: pn, url: url }),
    });
    overlay.remove();
    var expanded = {};
    document.querySelectorAll(".prod-card .prod-card-body").forEach(function(el) {
        expanded[el.closest(".prod-card").getAttribute("data-prod-id")] = el.classList.contains("open");
    });
    loadProducts(prodState.page);
    setTimeout(function() {
        document.querySelectorAll(".prod-card .prod-card-body").forEach(function(el) {
            var pid = el.closest(".prod-card").getAttribute("data-prod-id");
            if (expanded[pid]) { el.classList.add("open"); el.previousElementSibling.querySelector(".prod-expand-arrow").textContent = "收起 ▲"; }
        });
    }, 300);
}

// ======================== 广告账户管理 ========================

var acState = { page: 1, pageSize: 20, accounts: [], _total: 0 };

async function loadAccounts(page) {
    if (page) acState.page = parseInt(page) || 1;
    var search = document.getElementById("acSearch").value.trim();
    var status = document.getElementById("acFilterStatus").value;
    var mccId = document.getElementById("acFilterMcc").value;
    var agent = document.getElementById("acFilterAgent").value;
    var params = ["page=" + acState.page, "size=" + acState.pageSize];
    if (search) params.push("search=" + encodeURIComponent(search));
    if (status) params.push("status=" + encodeURIComponent(status));
    if (mccId) params.push("mcc_id=" + encodeURIComponent(mccId));
    if (agent) params.push("agent=" + encodeURIComponent(agent));

    var resp = await fetch(API_BASE + "/api/accounts/list?" + params.join("&"));
    var data = await resp.json();
    if (!data.success) return;
    acState.accounts = data.accounts || [];
    acState._total = data.total || 0;

    // 更新筛选下拉
    var mccSel = document.getElementById("acFilterMcc");
    if (mccSel && data.mcc_options) {
        var curM = mccSel.value;
        mccSel.innerHTML = '<option value="">全部 MCC</option>';
        data.mcc_options.forEach(function(m){ mccSel.innerHTML += '<option value="' + m.id + '"' + (String(m.id)===curM?" selected":"") + '>' + m.name + ' (' + m.mcc_id + ')</option>'; });
    }
    var agentSel = document.getElementById("acFilterAgent");
    if (agentSel) {
        var curA = agentSel.value;
        var mergedAgents = {};
        (data.agents || []).forEach(function(a){ mergedAgents[a] = true; });
        (acSettings.account_agents || []).forEach(function(a){ mergedAgents[a] = true; });
        agentSel.innerHTML = '<option value="">全部代理</option>';
        Object.keys(mergedAgents).sort().forEach(function(a){ agentSel.innerHTML += '<option value="' + a + '"' + (a===curA?" selected":"") + '>' + a + '</option>'; });
    }
    // 刷新状态下拉（从设置动态生成）
    _refreshFilterDropdowns();
    renderAccountList();
}

function renderAccountList() {
    var list = document.getElementById("acList");
    if (!list) return;
    list.innerHTML = "";
    if (!acState.accounts.length) { list.innerHTML = '<div class="prod-empty"><div class="prod-empty-text">暂无账户数据</div></div>'; return; }

    var table = '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
        '<thead><tr style="background:rgba(0,0,0,0.03);text-align:left;">' +
        '<th style="padding:6px;"><input type="checkbox" onchange="acToggleAll(this)" /></th>' +
        '<th style="padding:6px;">账号名称</th><th style="padding:6px;">账号 ID</th><th style="padding:6px;">所属 MCC</th>' +
        '<th style="padding:6px;">时区</th><th style="padding:6px;">代理</th><th style="padding:6px;">状态</th>' +
        '<th style="padding:6px;">到手时间</th><th style="padding:6px;">操作</th></tr></thead><tbody>';
    var sc = _statusColors();
    acState.accounts.forEach(function(a){
        var c = sc[a.status] || "#f3f4f6;#6b7280";
        table += '<tr style="border-bottom:1px solid rgba(0,0,0,0.04);">' +
            '<td style="padding:6px;"><input type="checkbox" class="ac-check" data-aid="' + a.id + '" onchange="acUpdateBadge()" /></td>' +
            '<td style="padding:6px;">' + (a.name||"") + '</td>' +
            '<td style="padding:6px;font-family:monospace;">' + (a.account_id||"") + '</td>' +
            '<td style="padding:6px;">' + (a.mcc_name ? '<span style="color:#0891b2;font-family:monospace;">' + a.mcc_name + '</span><br><span style="font-size:10px;color:#888;">' + a.mcc_code + '</span>' : '<span style="color:#888;">未分配</span>') + '</td>' +
            '<td style="padding:6px;">' + (a.timezone||"") + '</td>' +
            '<td style="padding:6px;">' + (a.agent||"") + '</td>' +
            '<td style="padding:6px;"><span style="background:' + c.split(";")[0] + ';color:' + c.split(";")[1] + ';padding:2px 8px;border-radius:8px;font-size:10px;">' + (a.status||"存活") + '</span></td>' +
            '<td style="padding:6px;">' + (a.acquired_date||"") + '</td>' +
            '<td style="padding:6px;"><span style="color:#0891b2;cursor:pointer;" onclick="showAccountModal(' + a.id + ')">✏️</span> <span style="color:#dc2626;cursor:pointer;" onclick="accountsDelete(' + a.id + ')">🗑</span></td>' +
            '</tr>';
    });
    table += '</tbody></table>';
    list.innerHTML = table;

    var pagDiv = document.getElementById("acPagination");
    if (pagDiv) {
        pagDiv.innerHTML = "";
        var tp = Math.ceil(acState._total / acState.pageSize);
        if (tp > 1) _renderPagination(pagDiv, tp, acState.page, loadAccounts);
    }
}

function acToggleAll(cb) {
    document.querySelectorAll(".ac-check").forEach(function(c){ c.checked = cb.checked; });
    acUpdateBadge();
}
function acUpdateBadge() {
    var count = document.querySelectorAll(".ac-check:checked").length;
    var badge = document.getElementById("acSelectedBadge");
    if (badge) badge.textContent = "已选 " + count + " 条";
}
async function accountsDelete(aid) {
    if (!confirm("确定删除此账户？")) return;
    await fetch(API_BASE + "/api/accounts/" + aid, { method: "DELETE" });
    loadAccounts(acState.page);
}
async function accountsBatchDelete() {
    var checks = document.querySelectorAll(".ac-check:checked");
    if (!checks.length) return;
    if (!confirm("确定删除选中的 " + checks.length + " 个账户？")) return;
    var ids = []; checks.forEach(function(c){ ids.push(parseInt(c.getAttribute("data-aid"))); });
    await fetch(API_BASE + "/api/accounts/batch-delete", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ids:ids}) });
    loadAccounts(1);
}
async function accountsBatchUpdate(field, selectEl) {
    var value = selectEl.value; if (!value) return;
    var checks = document.querySelectorAll(".ac-check:checked");
    if (!checks.length) { alert("请先选择账户"); selectEl.value=""; return; }
    var ids = []; checks.forEach(function(c){ ids.push(parseInt(c.getAttribute("data-aid"))); });
    await fetch(API_BASE + "/api/accounts/batch-update", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ids:ids, field:field, value:value}) });
    selectEl.value = ""; loadAccounts(1);
}

async function showAccountModal(aid) {
    var isEdit = !!aid;
    var account = isEdit ? acState.accounts.find(function(a){return a.id===aid;}) : null;
    var uid = "ac_" + (aid || "new") + "_" + Date.now();
    // 获取 MCC 选项
    var mccOpts = "";
    try {
        var r = await fetch(API_BASE + "/api/mcc/options"); var d = await r.json();
        if (d.success) d.options.forEach(function(m){ mccOpts += '<option value="' + m.id + '">' + m.name + ' (' + m.mcc_id + ')</option>'; });
    } catch(e) {}

    var overlay = document.createElement("div"); overlay.className = "prod-modal-overlay";
    var box = document.createElement("div"); box.className = "prod-modal-box";
    box.innerHTML =
        '<div class="prod-modal-title">' + (isEdit ? "✏️ 编辑账户" : "➕ 新增账户") + '</div>' +
        '<div class="form-group"><label>账号名称</label><input id="' + uid + '_name" value="' + (account ? _escAttr(account.name||"") : "") + '" /></div>' +
        '<div class="form-group"><label>账号 ID' + (isEdit ? '（不可修改）' : '') + '</label><input id="' + uid + '_id" value="' + (account ? _escAttr(account.account_id||"") : "") + '" ' + (isEdit ? 'readonly style="background:#f3f4f6;"' : '') + ' /></div>' +
        '<div class="form-group"><label>所属 MCC</label><select id="' + uid + '_mcc"><option value="">（未分配）</option>' + mccOpts + '</select></div>' +
        '<div class="form-group"><label>时区</label><input id="' + uid + '_tz" value="' + (account ? _escAttr(account.timezone||"") : "") + '" /></div>' +
        '<div class="form-group"><label>代理</label><select id="' + uid + '_agent">' + _agentSelectOptions(account ? (account.agent||"") : "") + '</select></div>' +
        '<div class="form-group"><label>状态</label><select id="' + uid + '_status">' + _statusOptions(account ? account.status : "存活") + '</select></div>' +
        '<div class="form-group"><label>到手时间</label><input id="' + uid + '_date" type="date" value="' + (account ? (account.acquired_date||"") : new Date().toISOString().split("T")[0]) + '" /></div>' +
        '<div class="prod-modal-actions"><button class="prod-btn-save" onclick="submitAccount(\'' + uid + '\',' + (aid||0) + ', this.parentNode.parentNode.parentNode)">💾 保存</button>' +
        '<button class="prod-btn-cancel" onclick="document.body.removeChild(this.parentNode.parentNode.parentNode)">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    if (account && account.mcc_id) {
        var sel = document.getElementById(uid + "_mcc"); if (sel) sel.value = account.mcc_id;
    }
    setTimeout(function(){ var el=document.getElementById(uid + "_name"); if(el)el.focus(); }, 100);
}

async function submitAccount(uid, aid, overlay) {
    var body = {
        name: document.getElementById(uid + "_name").value.trim(),
        account_id: document.getElementById(uid + "_id").value.trim(),
        mcc_id: document.getElementById(uid + "_mcc").value || null,
        timezone: document.getElementById(uid + "_tz").value.trim(),
        agent: (document.getElementById(uid + "_agent").value || "").trim(),
        status: document.getElementById(uid + "_status").value,
        acquired_date: document.getElementById(uid + "_date").value,
    };
    if (!body.agent) { alert("请选择代理"); return; }
    var url = aid ? API_BASE + "/api/accounts/" + aid : API_BASE + "/api/accounts/create";
    var method = aid ? "PUT" : "POST";
    var resp = await fetch(url, { method:method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    var data = await resp.json();
    if (data.success) {
        document.body.removeChild(overlay);
        // 自动记忆新代理名
        _autoSaveSetting("account_agents", body.agent);
        loadAccounts(acState.page);
    } else { alert(data.error || "保存失败"); }
}

// ======================== MCC 管理 ========================

var mccState = { page: 1, pageSize: 20, list: [], _total: 0 };

async function loadMccList(page) {
    if (page) mccState.page = parseInt(page) || 1;
    var search = document.getElementById("mccSearch").value.trim();
    var level = document.getElementById("mccFilterLevel").value.trim();
    var parentFilter = document.getElementById("mccFilterParent").value;
    var params = ["page=" + mccState.page, "size=" + mccState.pageSize];
    if (search) params.push("search=" + encodeURIComponent(search));
    if (level) params.push("level=" + encodeURIComponent(level));
    if (parentFilter) params.push("parent_filter=" + parentFilter);
    var resp = await fetch(API_BASE + "/api/mcc/list?" + params.join("&"));
    var data = await resp.json();
    if (!data.success) return;
    mccState.list = data.mcc_list || [];
    mccState._total = data.total || 0;
    renderMccList();
}

function renderMccList() {
    var list = document.getElementById("mccList");
    if (!list) return;
    list.innerHTML = "";
    if (!mccState.list.length) { list.innerHTML = '<div class="prod-empty"><div class="prod-empty-text">暂无 MCC 数据</div></div>'; return; }

    var table = '<table style="width:100%;border-collapse:collapse;font-size:11px;">' +
        '<thead><tr style="background:rgba(0,0,0,0.03);text-align:left;">' +
        '<th style="padding:6px;"><input type="checkbox" onchange="mccToggleAll(this)" /></th>' +
        '<th style="padding:6px;">MCC 名称</th><th style="padding:6px;">MCC ID</th><th style="padding:6px;">等级</th>' +
        '<th style="padding:6px;">上级 MCC</th><th style="padding:6px;">账户数（直属）</th><th style="padding:6px;">操作</th></tr></thead><tbody>';
    mccState.list.forEach(function(m){
        var parentInfo = m.parent_mcc_id ? '<span style="color:#888;">有上级</span>' : '<span style="color:#888;">—（顶级）</span>';
        table += '<tr style="border-bottom:1px solid rgba(0,0,0,0.04);">' +
            '<td style="padding:6px;"><input type="checkbox" class="mcc-check" data-mid="' + m.id + '" onchange="mccUpdateBadge()" /></td>' +
            '<td style="padding:6px;">' + (m.name||"") + '</td>' +
            '<td style="padding:6px;font-family:monospace;">' + (m.mcc_id||"") + '</td>' +
            '<td style="padding:6px;">' + (m.level||"") + '</td>' +
            '<td style="padding:6px;">' + parentInfo + '</td>' +
            '<td style="padding:6px;"><strong>' + (m.direct_count||0) + '</strong></td>' +
            '<td style="padding:6px;"><span style="color:#0891b2;cursor:pointer;" onclick="showMccDetail(' + m.id + ')">📋 详情</span> <span style="color:#0891b2;cursor:pointer;" onclick="showMccModal(' + m.id + ')">✏️</span> <span style="color:#dc2626;cursor:pointer;" onclick="mccDelete(' + m.id + ')">🗑</span></td>' +
            '</tr>';
    });
    table += '</tbody></table>';
    list.innerHTML = table;

    var pagDiv = document.getElementById("mccPagination");
    if (pagDiv) {
        pagDiv.innerHTML = "";
        var tp = Math.ceil(mccState._total / mccState.pageSize);
        if (tp > 1) _renderPagination(pagDiv, tp, mccState.page, loadMccList);
    }
}

function mccToggleAll(cb) {
    document.querySelectorAll(".mcc-check").forEach(function(c){ c.checked = cb.checked; });
    mccUpdateBadge();
}
function mccUpdateBadge() {
    var count = document.querySelectorAll(".mcc-check:checked").length;
    var badge = document.getElementById("mccSelectedBadge");
    if (badge) badge.textContent = "已选 " + count + " 条";
}
async function mccDelete(mid) {
    if (!confirm("确定删除此 MCC？")) return;
    var resp = await fetch(API_BASE + "/api/mcc/" + mid, { method:"DELETE" });
    var data = await resp.json();
    if (data.success) { loadMccList(mccState.page); }
    else { alert(data.error); }
}
async function mccBatchDelete() {
    var checks = document.querySelectorAll(".mcc-check:checked");
    if (!checks.length) return;
    if (!confirm("确定删除选中的 " + checks.length + " 个 MCC？")) return;
    var ids = []; checks.forEach(function(c){ ids.push(parseInt(c.getAttribute("data-mid"))); });
    await fetch(API_BASE + "/api/mcc/batch-delete", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ids:ids}) });
    loadMccList(1);
}

async function showMccModal(mid) {
    var isEdit = !!mid;
    var mcc = isEdit ? mccState.list.find(function(m){return m.id===mid;}) : null;
    var uid = "mcc_" + (mid || "new") + "_" + Date.now();
    var mccOpts = '<option value="">（顶级）</option>';
    try {
        var r = await fetch(API_BASE + "/api/mcc/options"); var d = await r.json();
        if (d.success) d.options.forEach(function(m){ if (!mid || m.id !== mid) mccOpts += '<option value="' + m.id + '">' + m.name + ' (' + m.mcc_id + ')</option>'; });
    } catch(e) {}
    var overlay = document.createElement("div"); overlay.className = "prod-modal-overlay";
    var box = document.createElement("div"); box.className = "prod-modal-box";
    box.innerHTML =
        '<div class="prod-modal-title">' + (isEdit ? "✏️ 编辑 MCC" : "➕ 新增 MCC") + '</div>' +
        '<div class="form-group"><label>MCC 名称</label><input id="' + uid + '_name" value="' + (mcc ? _escAttr(mcc.name||"") : "") + '" /></div>' +
        '<div class="form-group"><label>MCC ID' + (isEdit ? '（不可修改）' : '') + '</label><input id="' + uid + '_id" value="' + (mcc ? _escAttr(mcc.mcc_id||"") : "") + '" ' + (isEdit ? 'readonly style="background:#f3f4f6;"' : '') + ' /></div>' +
        '<div class="form-group"><label>等级</label><select id="' + uid + '_level">' + _mccLevelSelectOptions(mcc ? (mcc.level||"") : "") + '</select></div>' +
        '<div class="form-group"><label>上级 MCC</label><select id="' + uid + '_parent">' + mccOpts + '</select></div>' +
        '<div class="prod-modal-actions"><button class="prod-btn-save" onclick="submitMcc(\'' + uid + '\',' + (mid||0) + ', this.parentNode.parentNode.parentNode)">💾 保存</button>' +
        '<button class="prod-btn-cancel" onclick="document.body.removeChild(this.parentNode.parentNode.parentNode)">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    if (mcc && mcc.parent_mcc_id) { var sel = document.getElementById(uid + "_parent"); if (sel) sel.value = mcc.parent_mcc_id; }
}

async function submitMcc(uid, mid, overlay) {
    var body = {
        name: document.getElementById(uid + "_name").value.trim(),
        mcc_id: document.getElementById(uid + "_id").value.trim(),
        level: (document.getElementById(uid + "_level").value || "").trim(),
        parent_mcc_id: document.getElementById(uid + "_parent").value || null,
    };
    var url = mid ? API_BASE + "/api/mcc/" + mid : API_BASE + "/api/mcc/create";
    var method = mid ? "PUT" : "POST";
    var resp = await fetch(url, { method:method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    var data = await resp.json();
    if (data.success) {
        document.body.removeChild(overlay);
        _autoSaveSetting("mcc_levels", body.level);
        loadMccList(mccState.page);
    } else { alert(data.error || "保存失败"); }
}

async function showMccDetail(mid) {
    var resp = await fetch(API_BASE + "/api/mcc/" + mid + "/detail");
    var data = await resp.json();
    if (!data.success) { alert(data.error); return; }
    var m = data.mcc;
    var overlay = document.createElement("div"); overlay.className = "prod-modal-overlay";
    var box = document.createElement("div"); box.className = "prod-modal-box"; box.style.maxWidth = "700px";

    var sc = _statusColors();
    var directHtml = '<strong>📌 直属账户（' + (m.direct_count||0) + '）</strong>';
    if (m.direct_accounts && m.direct_accounts.length) {
        directHtml += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:4px;">' +
            '<thead><tr style="background:rgba(0,0,0,0.03);text-align:left;"><th style="padding:4px;">账户名称</th><th style="padding:4px;">账户 ID</th><th style="padding:4px;">状态</th></tr></thead><tbody>';
        m.direct_accounts.forEach(function(a){
            var c = sc[a.status] || sc["存活"];
            directHtml += '<tr><td style="padding:4px;">' + a.name + '</td><td style="padding:4px;font-family:monospace;">' + a.account_id + '</td>' +
                '<td style="padding:4px;"><span style="background:' + c.split(";")[0] + ';color:' + c.split(";")[1] + ';padding:1px 6px;border-radius:8px;font-size:10px;">' + a.status + '</span></td></tr>';
        });
        directHtml += '</tbody></table>';
    } else { directHtml += '<p style="color:#888;font-size:11px;">无直属账户</p>'; }

    var childHtml = '<strong>📦 子 MCC 贡献的账户（' + (m.total_count - m.direct_count) + '）</strong>';
    if (m.child_mccs && m.child_mccs.length) {
        childHtml += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:4px;">' +
            '<thead><tr style="background:rgba(0,0,0,0.03);text-align:left;"><th style="padding:4px;">MCC 名称</th><th style="padding:4px;">MCC ID</th><th style="padding:4px;">贡献账户数</th></tr></thead><tbody>';
        m.child_mccs.forEach(function(c){ childHtml += '<tr><td style="padding:4px;">' + c.name + '</td><td style="padding:4px;font-family:monospace;">' + c.mcc_id + '</td><td style="padding:4px;">' + (c.account_count||0) + '</td></tr>'; });
        childHtml += '</tbody></table>';
    } else { childHtml += '<p style="color:#888;font-size:11px;">无子 MCC</p>'; }

    box.innerHTML =
        '<div class="prod-modal-title">📋 MCC 详情 — ' + (m.name||"") + ' (' + (m.mcc_id||"") + ')</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
        '<span style="padding:6px 12px;background:#d1fae5;border-radius:8px;color:#065f46;font-weight:600;">总计 ' + (m.total_count||0) + ' 个账户</span>' +
        '<span style="padding:6px 12px;background:#e0f2fe;border-radius:8px;color:#0369a1;font-weight:600;">直属 ' + (m.direct_count||0) + ' 个</span>' +
        '<span style="padding:6px 12px;background:#fef3c7;border-radius:8px;color:#92400e;font-weight:600;">子 MCC 来源 ' + ((m.total_count||0)-(m.direct_count||0)) + ' 个</span>' +
        '</div>' +
        '<div style="margin-bottom:12px;">' + directHtml + '</div>' +
        '<div style="margin-bottom:12px;">' + childHtml + '</div>' +
        '<div class="prod-modal-actions"><button onclick="this.closest(\'.prod-modal-overlay\').remove()" style="background:var(--bg-elevated);color:var(--text-primary);">关闭</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// ======================== 设置页 ========================

async function loadAccountSettings() {
    var resp = await fetch(API_BASE + "/api/settings/account");
    var data = await resp.json();
    if (!data.success) return;
    acSettings = data.settings;
    _refreshGlobalDatalists();
    // 填充配置表单
    var statusEl = document.getElementById("cfgAccountStatuses");
    var agentsEl = document.getElementById("cfgAccountAgents");
    var levelsEl = document.getElementById("cfgMccLevels");
    if (statusEl) statusEl.value = (acSettings.account_statuses || []).join("\n");
    if (agentsEl) agentsEl.value = (acSettings.account_agents || []).join("\n");
    if (levelsEl) levelsEl.value = (acSettings.mcc_levels || []).join("\n");
}

async function saveAccountSettings() {
    var body = {
        account_statuses: (document.getElementById("cfgAccountStatuses").value || "").split("\n").map(function(s){return s.trim();}).filter(function(s){return s;}),
        account_agents: (document.getElementById("cfgAccountAgents").value || "").split("\n").map(function(s){return s.trim();}).filter(function(s){return s;}),
        mcc_levels: (document.getElementById("cfgMccLevels").value || "").split("\n").map(function(s){return s.trim();}).filter(function(s){return s;}),
    };
    var resp = await fetch(API_BASE + "/api/settings/account", {
        method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body),
    });
    var data = await resp.json();
    var msg = document.getElementById("acCfgMsg");
    if (data.success) {
        acSettings = body;
        _refreshGlobalDatalists();
        msg.textContent = "✅ 已保存";
        setTimeout(function(){ msg.textContent = ""; }, 2000);
    } else {
        msg.textContent = "❌ 保存失败";
    }
}

// 动态生成状态下拉选项
function _statusOptions(selected) {
    var list = acSettings.account_statuses || ["存活","死亡","验证","限额"];
    return list.map(function(s){ return '<option value="' + s + '"' + (s === selected ? " selected" : "") + '>' + s + '</option>'; }).join("");
}

// 代理 select 下拉选项（必填，无空选项；当前值不在列表中则追加）
function _agentSelectOptions(currentVal) {
    var list = acSettings.account_agents || [];
    var seen = {};
    var html = '';
    list.forEach(function(a){
        if (!a) return;
        seen[a] = true;
        var sel = (a === currentVal) ? " selected" : "";
        html += '<option value="' + _escAttr(a) + '"' + sel + '>' + _escAttr(a) + '</option>';
    });
    if (currentVal && !seen[currentVal]) {
        html += '<option value="' + _escAttr(currentVal) + '" selected>' + _escAttr(currentVal) + ' (当前)</option>';
    }
    if (!html) {
        html = '<option value="">请先在设置页配置代理</option>';
    }
    return html;
}

// MCC 等级 select 下拉选项
function _mccLevelSelectOptions(currentVal) {
    var list = acSettings.mcc_levels || [];
    var seen = {};
    var html = '<option value="">（未选择）</option>';
    list.forEach(function(l){
        if (!l) return;
        seen[l] = true;
        var sel = (l === currentVal) ? " selected" : "";
        html += '<option value="' + _escAttr(l) + '"' + sel + '>' + _escAttr(l) + '</option>';
    });
    if (currentVal && !seen[currentVal]) {
        html += '<option value="' + _escAttr(currentVal) + '" selected>' + _escAttr(currentVal) + ' (当前)</option>';
    }
    return html;
}

// 刷新全局 datalist（MCC 等级），页面级别共享，弹窗不冲突
function _refreshGlobalDatalists() {
    var agentDL = document.getElementById("globalAgentList");
    var levelDL = document.getElementById("globalMccLevelList");
    if (agentDL) {
        agentDL.innerHTML = (acSettings.account_agents || []).filter(function(a){return a;}).map(function(a){ return '<option value="' + _escAttr(a) + '">'; }).join("");
    }
    if (levelDL) {
        levelDL.innerHTML = (acSettings.mcc_levels || []).filter(function(l){return l;}).map(function(l){ return '<option value="' + _escAttr(l) + '">'; }).join("");
    }
}

// 自动保存新值到设置（去重）
async function _autoSaveSetting(key, newVal) {
    if (!newVal) return;
    var list = acSettings[key] || [];
    if (list.indexOf(newVal) >= 0) return;  // 已存在，不重复
    list.push(newVal);
    acSettings[key] = list;
    // 静默保存到后端
    var body = {};
    body[key] = list;
    await fetch(API_BASE + "/api/settings/account", {
        method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body),
    });
    _refreshGlobalDatalists();
}

// 状态颜色映射（动态，支持自定义状态）
function _statusColors() {
    var defaults = {"存活":"#d1fae5;#065f46","死亡":"#fee2e2;#991b1b","验证":"#fef3c7;#92400e","限额":"#f3f4f6;#6b7280"};
    var palette = ["#e0f2fe;#0369a1","#fce7f3;#9d174d","#ede9fe;#5b21b6","#fef9c3;#854d0e","#ecfdf5;#065f46","#fef2f2;#991b1b"];
    var i = 0;
    var map = {};
    (acSettings.account_statuses || ["存活","死亡","验证","限额"]).forEach(function(s){
        map[s] = defaults[s] || palette[i % palette.length];
        i++;
    });
    return map;
}

// 刷新所有筛选下拉（状态、代理、批量修改）
function _refreshFilterDropdowns() {
    // 账户筛选状态
    var statusSel = document.getElementById("acFilterStatus");
    if (statusSel) {
        var cur = statusSel.value;
        statusSel.innerHTML = '<option value="">全部状态</option>' + _statusOptions("");
        if (cur) statusSel.value = cur;
    }
    // 批量修改状态
    var batchSel = document.getElementById("acBatchStatus");
    if (batchSel) {
        batchSel.innerHTML = '<option value="">批量修改状态...</option>' + _statusOptions("");
    }
}

// 初始化：预加载设置 + 标签切换兼容
var _acSettingsLoaded = false;
document.addEventListener("DOMContentLoaded", function() {
    // 预加载设置（静默，不阻塞）
    fetch(API_BASE + "/api/settings/account").then(function(r){ return r.json(); }).then(function(d){
        if (d.success) { acSettings = d.settings; _acSettingsLoaded = true; _refreshGlobalDatalists(); }
    }).catch(function(){});
});
