// 产品管理面板
var prodState = { page: 1, pausedMode: false, products: [], pageSize: 10 };

// ---- 分段开关 UI 同步 ----
function updatePausedToggle() {
    var btnN = document.getElementById("prodToggleNormal");
    var btnP = document.getElementById("prodTogglePaused");
    if (btnN) { btnN.classList.toggle("active", !prodState.pausedMode); }
    if (btnP) { btnP.classList.toggle("active", prodState.pausedMode); }
}

async function loadProducts(page) {
    if (page) prodState.page = parseInt(page) || 1;
    var region = document.getElementById("prodFilterRegion").value;
    var search = document.getElementById("prodSearch").value.trim();
    var params = ["page=" + prodState.page, "size=" + prodState.pageSize];
    if (region) params.push("region=" + encodeURIComponent(region));
    if (search) params.push("search=" + encodeURIComponent(search));
    params.push("status=" + (prodState.pausedMode ? "paused" : ""));

    var resp = await fetch(API_BASE + "/api/products/list?" + params.join("&"));
    var data = await resp.json();
    if (!data.success) return;
    prodState.products = data.products || [];
    prodState._total = data.total || 0;

    // 更新地区下拉
    var regionSel = document.getElementById("prodFilterRegion");
    if (regionSel && data.regions) {
        var cur = regionSel.value;
        regionSel.innerHTML = '<option value="">全部地区</option>';
        data.regions.forEach(function (r) {
            regionSel.innerHTML += '<option value="' + r + '"' + (r === cur ? " selected" : "") + '>' + r + '</option>';
        });
    }

    updatePausedToggle();
    renderProductList(data.total);
}

var _prodFilterState = {};
function filterProductPackages(prodId, mode) {
    // 切换：同模式点两次恢复全部
    if (_prodFilterState[prodId] === mode) {
        _prodFilterState[prodId] = "all";
        mode = "all";
    } else {
        _prodFilterState[prodId] = mode;
    }
    // 自动展开包列表（收起时过滤看不到）
    var body = document.querySelector(".prod-card[data-prod-id='" + prodId + "'] .prod-card-body");
    var arrow = document.querySelector(".prod-card[data-prod-id='" + prodId + "'] .prod-expand-arrow");
    if (body && !body.classList.contains("open")) {
        body.classList.add("open");
        if (arrow) { arrow.classList.add("open"); arrow.textContent = "▲"; }
    }
    var rows = document.querySelectorAll(".prod-pkg-row[data-prod-id='" + prodId + "']");
    rows.forEach(function (row) {
        if (mode === "all") {
            row.style.display = "";
        } else {
            var rs = row.getAttribute("data-status") || "";
            row.style.display = rs === mode ? "" : "none";
        }
    });
    // 高亮当前选中的徽章
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
    // 优先尝试同步 execCommand（兼容 HTTP / 非 localhost）
    try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
    } catch (e) {}
    if (ok) {
        _showCopyToast();
        return;
    }
    // 降级：异步 Clipboard API（仅 HTTPS / localhost 可用）
    navigator.clipboard.writeText(text).then(function() {
        _showCopyToast();
    }).catch(function() {});
}

function _showCopyToast() {
    var toast = document.createElement("div");
    toast.textContent = "已复制 ✓";
    toast.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--accent);color:#fff;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;z-index:9999;pointer-events:none;transition:opacity 0.3s;opacity:1;";
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = "0"; setTimeout(function() { document.body.removeChild(toast); }, 300); }, 1000);
}

function showAddPackageModal(prodId) {
    var prod = prodState.products.find(function(p){return p.id===prodId;});
    if (!prod) return;
    var overlay = document.createElement("div");
    overlay.className = "prod-modal-overlay";
    var box = document.createElement("div");
    box.className = "prod-modal-box";
    box.style.cssText = "max-width:750px;";
    box.innerHTML =
        '<div class="prod-modal-title">➕ 添加包 — ' + (prod.product_name||"") + '</div>' +
        '<div class="form-group"><label>系列名前缀（可选）</label><input id="addPkgPrefix" placeholder="如 P222-A" /></div>' +
        '<div class="form-group"><label>系列名后缀（可选）</label><input id="addPkgSuffix" placeholder="如 carl" /></div>' +
        '<div class="form-group"><label>粘贴内容（支持脏数据，自动提取链接和包名）</label><textarea id="addPkgText" rows="8" placeholder="直接粘贴带链接的文本，自动解析..."></textarea></div>' +
        '<button onclick="previewAddPkg(' + prodId + ')" style="margin-bottom:8px;">🔍 预览解析</button>' +
        '<div id="addPkgPreview" style="margin-bottom:8px;font-size:11px;max-height:150px;overflow-y:auto;"></div>' +
        '<div class="prod-modal-actions"><button onclick="submitAddPackage(' + prodId + ',this)">💾 添加</button><button onclick="this.closest(\'.prod-modal-overlay\').remove()" style="background:var(--bg-elevated);color:var(--text-primary);">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

var _addPkgParsed = [];
async function previewAddPkg(prodId) {
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
    // 可编辑预览
    var html = '<p style="margin-bottom:4px;">识别 <strong>' + _addPkgParsed.length + '</strong> 个包（可编辑）：</p>';
    html += '<textarea id="addPkgEdit" rows="' + Math.max(4, _addPkgParsed.length) + '" style="width:100%;font-size:11px;">';
    _addPkgParsed.forEach(function(p){
        html += (p.series_name||"") + " | " + (p.package_name||"") + " | " + (p.url||"") + "\n";
    });
    html += '</textarea>';
    preview.innerHTML = html;
}

async function submitAddPackage(prodId, btn) {
    var overlay = btn.closest(".prod-modal-overlay");
    var prefix = document.getElementById("addPkgPrefix").value.trim();
    var suffix = document.getElementById("addPkgSuffix").value.trim();
    var editArea = document.getElementById("addPkgEdit");
    var packages = [];
    if (editArea) {
        editArea.value.split("\n").filter(function(l){return l.trim();}).forEach(function(line){
            var parts = line.split("|").map(function(s){return s.trim();});
            if (parts.length >= 3) {
                var sn = parts[0];
                // 前缀/后缀已由后端在 preview 阶段处理，前端不再重复拼接
                packages.push({series_name: sn, package_name: parts[1], url: parts[2]});
            }
        });
    }
    if (packages.length === 0 && _addPkgParsed.length > 0) {
        _addPkgParsed.forEach(function(p){
            var sn = p.series_name || "";
            // 前缀/后缀已由后端在 preview 阶段处理，前端不再重复拼接
            packages.push({series_name: sn, package_name: p.package_name, url: p.url});
        });
    }
    if (packages.length === 0) { alert("没有有效的包数据"); return; }
    for (var i=0; i<packages.length; i++) {
        await fetch(API_BASE + "/api/products/" + prodId + "/packages", {
            method: "POST", headers: {"Content-Type":"application/json"},
            body: JSON.stringify(packages[i]),
        });
    }
    overlay.remove();
    loadProducts(prodState.page);
}

// ---- 展开/折叠 ----
function toggleProductExpand(bodyEl, arrowEl) {
    var isOpen = bodyEl.classList.contains("open");
    if (isOpen) {
        bodyEl.classList.remove("open");
        if (arrowEl) { arrowEl.classList.remove("open"); arrowEl.textContent = "▼"; }
    } else {
        bodyEl.classList.add("open");
        if (arrowEl) { arrowEl.classList.add("open"); arrowEl.textContent = "▲"; }
    }
}

function renderProductList(total) {
    var list = document.getElementById("prodList");
    if (!list) return;
    list.innerHTML = "";

    if (prodState.products.length === 0) {
        list.innerHTML =
            '<div class="prod-empty">' +
            '<span class="prod-empty-icon">📦</span>' +
            '<div class="prod-empty-text">' + (prodState.pausedMode ? '没有已暂停的产品' : '还没有产品') + '</div>' +
            '<div class="prod-empty-hint">' + (prodState.pausedMode ? '' : '点击「新增产品」或「复制导入」开始') + '</div>' +
            '</div>';
    }

    prodState.products.forEach(function (prod) {
        var card = document.createElement("div");
        card.className = "prod-card" + (prod.status ? " paused" : "");
        card.setAttribute("data-prod-id", prod.id);

        // ---- 头部（可点击展开） ----
        var header = document.createElement("div");
        header.className = "prod-card-header";

        // 左侧主信息
        var main = document.createElement("div");
        main.className = "prod-card-main";

        // 状态圆点
        var dot = document.createElement("span");
        dot.className = "prod-status-dot " + (prod.status ? "paused" : "active");

        // 产品名
        var title = document.createElement("span");
        title.className = "prod-card-title";
        title.textContent = prod.product_name || "";
        title.title = prod.product_name || "";

        // 徽章组
        var badges = document.createElement("span");
        badges.className = "prod-badges";
        if (prod.kpi) {
            badges.innerHTML += '<span class="prod-badge prod-badge-kpi">' + prod.kpi + '</span>';
        }
        if (prod.region) {
            badges.innerHTML += '<span class="prod-badge prod-badge-region">' + prod.region + '</span>';
        }
        var totalPkgs = (prod.packages || []).length;
                var pkgs = prod.packages || [];
        var counts = {"":0,"rejected":0,"paused":0,"dropped":0};
        pkgs.forEach(function(p){ var s = p.status || ""; counts[s] = (counts[s]||0)+1; });
        [["","正常"],["rejected","拒登"],["paused","暂停"],["dropped","掉包"]].forEach(function(kv){
            if(counts[kv[0]]||0){
                var cl = kv[0]===""?"prod-badge-count":kv[0]==="rejected"?"prod-badge-rejected":kv[0]==="paused"?"prod-badge-count-paused":"prod-badge-dropped";
                badges.innerHTML+='<span class="prod-badge '+cl+'" onclick="var e=arguments[0]||window.event;e.stopPropagation();filterProductPackages('+prod.id+',\''+kv[0]+'\')" style="cursor:pointer;" title="'+kv[1]+'">'+counts[kv[0]]+' '+kv[1]+'</span>';
            }
        });

        main.appendChild(dot);
        main.appendChild(title);
        main.appendChild(badges);

        // 右侧操作按钮
        var actions = document.createElement("div");
        actions.className = "prod-card-actions";
        actions.innerHTML =
            '<button class="prod-btn-icon warn" onclick="event.stopPropagation();toggleProductPause(' + prod.id + ',' + (prod.status ? 0 : 1) + ')" title="' + (prod.status ? '恢复' : '暂停') + '">' + (prod.status ? "▶ 恢复" : "⏸ 暂停") + '</button>' +
            '<button class="prod-btn-icon" onclick="event.stopPropagation();editProduct(' + prod.id + ')" title="编辑">✏️</button>' +
            '<button class="prod-btn-icon" onclick="event.stopPropagation();showAddPackageModal(' + prod.id + ')" title="加包" style="color:var(--accent-green);">➕包</button>' +
            '<button class="prod-btn-icon danger" onclick="event.stopPropagation();deleteProduct(' + prod.id + ')" title="删除">🗑</button>';

        // 展开箭头
        var arrow = document.createElement("span");
        arrow.className = "prod-expand-arrow";
        arrow.textContent = "▼";

        header.appendChild(main);
        header.appendChild(actions);
        header.appendChild(arrow);

        // 点击头部展开/折叠 + 重置包筛选
        var bodyRef = null;
        header.addEventListener("click", function () {
            if (bodyRef) toggleProductExpand(bodyRef, arrow);
        });

        // ---- 包列表主体 ----
        var body = document.createElement("div");
        body.className = "prod-card-body";
        bodyRef = body;

        // 包数量标题 + 批量操作栏
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

        // 排序：正常包在前（按系列名），暂停排在最后
        var sortedPkgs = (prod.packages || []).slice().sort(function (a, b) {
            var so = {"":0,"rejected":1,"paused":2,"dropped":3};
            var sa = so[a.status||""]||0; var sb = so[b.status||""]||0;
            if (sa !== sb) return sa - sb;
            var na = (a.series_name || "").toLowerCase();
            var nb = (b.series_name || "").toLowerCase();
            return na < nb ? -1 : na > nb ? 1 : 0;
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

            // 复选框
            info.innerHTML += '<input type="checkbox" class="prod-pkg-check" data-pkg-id="' + pkg.id + '" onclick="event.stopPropagation();updateBatchBar(' + prod.id + ')" style="margin-right:6px;width:auto;" />';

            if (pkg.status) {
                info.innerHTML += '<span class="prod-pkg-paused-dot">⏸</span>';
            }

            info.innerHTML +=
                '<span class="prod-pkg-series" title="' + (pkg.series_name || "") + '" onclick="event.stopPropagation();copyToClipboard(\'' + (pkg.series_name || "").replace(/'/g, "\\'") + '\')">' + (pkg.series_name || "-") + '</span>' +
                '<span class="prod-pkg-sep">│</span>' +
                '<span class="prod-pkg-name" title="点击复制" onclick="event.stopPropagation();copyToClipboard(\'' + (pkg.package_name || "").replace(/'/g, "\\'") + '\')">' + (pkg.package_name || "-") + '</span>';

            if (pkg.url) {
                info.innerHTML +=
                    '<span class="prod-pkg-sep">│</span>' +
                    '<span class="prod-pkg-url" title="点击复制链接" onclick="event.stopPropagation();copyToClipboard(\'' + (pkg.url || "").replace(/'/g, "\\'") + '\')">' + (pkg.url || "") + '</span>' +
                    ' <a href="' + pkg.url + '" target="_blank" class="prod-pkg-link-icon" onclick="event.stopPropagation()" title="打开链接">🔗</a>';
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
                '<button class="prod-btn-sm" onclick="editPackage(' + pkg.id + ')" title="编辑">✏️</button>' +
                '<button class="prod-btn-sm danger" onclick="deletePackage(' + pkg.id + ')" title="删除">✕</button>';

            row.appendChild(info);
            row.appendChild(pkgActions);
            body.appendChild(row);
        });

        card.appendChild(header);
        card.appendChild(body);
        list.appendChild(card);
    });

    // ---- 分页 ----
    var totalPages = Math.ceil(total / prodState.pageSize);
    var pagDiv = document.getElementById("prodPagination");
    if (pagDiv) {
        pagDiv.innerHTML = "";
        if (totalPages <= 1) { return; }

        // 第一页
        var first = document.createElement("span");
        first.className = "prod-page-btn" + (prodState.page === 1 ? " current" : "");
        first.textContent = "1";
        first.onclick = function () { loadProducts(1); };
        pagDiv.appendChild(first);

        if (totalPages > 7) {
            var rangeStart = Math.max(2, prodState.page - 1);
            var rangeEnd = Math.min(totalPages - 1, prodState.page + 1);

            if (rangeStart > 2) {
                var ellipsis1 = document.createElement("span");
                ellipsis1.className = "prod-page-ellipsis";
                ellipsis1.textContent = "…";
                pagDiv.appendChild(ellipsis1);
            }

            for (var p = rangeStart; p <= rangeEnd; p++) {
                var span = document.createElement("span");
                span.className = "prod-page-btn" + (p === prodState.page ? " current" : "");
                span.textContent = p;
                span.onclick = (function (pg) { return function () { loadProducts(pg); }; })(p);
                pagDiv.appendChild(span);
            }

            if (rangeEnd < totalPages - 1) {
                var ellipsis2 = document.createElement("span");
                ellipsis2.className = "prod-page-ellipsis";
                ellipsis2.textContent = "…";
                pagDiv.appendChild(ellipsis2);
            }
        } else {
            for (var p = 2; p < totalPages; p++) {
                var span = document.createElement("span");
                span.className = "prod-page-btn" + (p === prodState.page ? " current" : "");
                span.textContent = p;
                span.onclick = (function (pg) { return function () { loadProducts(pg); }; })(p);
                pagDiv.appendChild(span);
            }
        }

        // 最后一页
        if (totalPages > 1) {
            var last = document.createElement("span");
            last.className = "prod-page-btn" + (prodState.page === totalPages ? " current" : "");
            last.textContent = totalPages;
            last.onclick = function () { loadProducts(totalPages); };
            pagDiv.appendChild(last);
        }
    }
}

function copyCheckedLinks(prodId) {
    var card = document.querySelector(".prod-card[data-prod-id='" + prodId + "']");
    if (!card) return;
    var links = [];
    card.querySelectorAll(".prod-pkg-check:checked").forEach(function(cb) {
        var row = cb.closest(".prod-pkg-row");
        var urlEl = row.querySelector(".prod-pkg-url");
        if (urlEl) links.push(urlEl.textContent.trim());
    });
    if (links.length === 0) return;
    copyToClipboard(links.join("\n"));
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
    // 判断当前状态：有任意选中 → 全取消；全未选 → 全选（排除掉包）
    var anyChecked = false;
    checks.forEach(function(c) { if (c.checked) anyChecked = true; });
    checks.forEach(function(c) {
        if (anyChecked) { c.checked = false; }
        else {
            var row = c.closest(".prod-pkg-row");
            c.checked = !(row && row.classList.contains("dropped"));
        }
    });
    updateBatchBar(prodId);
    // 更新全选文字
    var againAny = false;
    card.querySelectorAll(".prod-pkg-check").forEach(function(c){if(c.checked)againAny=true;});
    span.textContent = againAny ? "☑ 取消全选" : "☑ 全选";
}
async function batchPkgAction(prodId, action) {
    var card = document.querySelector(".prod-card[data-prod-id='" + prodId + "']");
    if (!card) return;
    var checks = card.querySelectorAll(".prod-pkg-check:checked");
    if (checks.length === 0) return;
    var label = action === "pause" ? "暂停" : "恢复";
    if (!confirm("确定" + label + "选中的 " + checks.length + " 个包？")) return;
    for (var i = 0; i < checks.length; i++) {
        var pkgId = checks[i].getAttribute("data-pkg-id");
        await fetch(API_BASE + "/api/products/packages/" + pkgId, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: action === "pause" ? "paused" : "" }),
        });
        // 更新本地状态
        prodState.products.forEach(function(prod) {
            (prod.packages || []).forEach(function(pkg) {
                if (String(pkg.id) === pkgId) pkg.status = (action === "pause" ? "paused" : "");
            });
        });
    }
    // 保留展开状态
    var expanded = {};
    document.querySelectorAll(".prod-card .prod-card-body").forEach(function(el) {
        expanded[el.closest(".prod-card").getAttribute("data-prod-id")] = el.classList.contains("open");
    });
    renderProductList(prodState._total || prodState.products.length);
    // 恢复展开
    document.querySelectorAll(".prod-card .prod-card-body").forEach(function(el) {
        var pid = el.closest(".prod-card").getAttribute("data-prod-id");
        if (expanded[pid]) { el.classList.add("open"); }
    });
    // 恢复箭头
    document.querySelectorAll(".prod-card .prod-expand-arrow").forEach(function(el) {
        if (el.closest(".prod-card").querySelector(".prod-card-body.open")) {
            el.classList.add("open"); el.textContent = "收起 ▲";
        }
    });
}

// ---- 暂停/恢复 ----
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
        '<div class="form-group"><label>系列名</label><input id="' + uid + '_series" value="' + (pkg.series_name || "").replace(/"/g,'&quot;') + '" /></div>' +
        '<div class="form-group"><label>包名</label><input id="' + uid + '_name" value="' + (pkg.package_name || "").replace(/"/g,'&quot;') + '" /></div>' +
        '<div class="form-group"><label>链接</label><input id="' + uid + '_url" value="' + (pkg.url || "").replace(/"/g,'&quot;') + '" /></div>' +
        '<div class="prod-modal-actions"><button onclick="saveEditPackage(' + pkgId + ',\'' + uid + '\')">💾 保存</button><button onclick="document.getElementById(\'' + uid + '\').remove()" style="background:var(--bg-elevated);color:var(--text-primary);">取消</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return;  // 不继续执行原来的 reload
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


async function setProductStatus(id, status) {
    await fetch(API_BASE + "/api/products/" + id, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status }),
    });
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
async function setPackageStatus(pkgId, status) {
    await fetch(API_BASE + "/api/products/packages/" + pkgId, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status }),
    });
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
async function toggleProductPause(id, paused) {
    if (!confirm(paused ? "确定暂停此产品？暂停后将从正常列表隐藏" : "确定恢复此产品？")) return;
    await fetch(API_BASE + "/api/products/" + id, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: paused ? "paused" : "" }),
    });
    loadProducts();
}
async function togglePackagePause(pkgId, paused) {
    await fetch(API_BASE + "/api/products/packages/" + pkgId, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: paused ? "paused" : "" }),
    });
    // 仅更新本地状态和排序，不重新请求API
    prodState.products.forEach(function (prod) {
        (prod.packages || []).forEach(function (pkg) {
            if (pkg.id === pkgId) pkg.status = (paused ? "paused" : "");
        });
    });
    // 保存展开状态
    var expanded = {};
    document.querySelectorAll("#prodList .prod-card-body").forEach(function (el, i) {
        expanded[i] = el.classList.contains("open");
    });
    renderProductList(prodState._total || prodState.products.length);
    // 恢复展开
    document.querySelectorAll("#prodList .prod-card-body").forEach(function (el, i) {
        if (expanded[i]) el.classList.add("open");
    });
    // 恢复箭头
    document.querySelectorAll("#prodList .prod-expand-arrow").forEach(function (el, i) {
        if (expanded[i]) el.classList.add("open");
    });
}

// ---- 删除 ----
async function deleteProduct(id) {
    if (!confirm("确定删除此产品及所有包？")) return;
    await fetch(API_BASE + "/api/products/" + id, { method: "DELETE" });
    loadProducts();
}
async function deletePackage(pkgId) {
    if (!confirm("删除此包？")) return;
    await fetch(API_BASE + "/api/products/packages/" + pkgId, { method: "DELETE" });
    loadProducts();
}

// ---- 编辑产品（模态框替代 prompt） ----
function editProduct(id) {
    var prod = prodState.products.find(function (p) { return p.id === id; });
    if (!prod) return;
    showEditProductModal(prod);
}

function showEditProductModal(prod) {
    var overlay = document.createElement("div");
    overlay.className = "prod-modal-overlay";

    var box = document.createElement("div");
    box.className = "prod-modal-box";
    box.innerHTML =
        '<div class="prod-modal-title">✏️ 编辑产品</div>' +
        '<div class="form-group"><label>产品 / 群名</label><input id="editProdName" value="' + _escAttr(prod.product_name || "") + '" /></div>' +
        '<div class="form-group"><label>KPI</label><input id="editProdKpi" value="' + _escAttr(prod.kpi || "") + '" /></div>' +
        '<div class="form-group"><label>地区</label><input id="editProdRegion" value="' + _escAttr(prod.region || "") + '" /></div>' +
        '<div class="prod-modal-actions">' +
        '<button class="prod-btn-save" onclick="submitEditProduct(' + prod.id + ', this.parentNode.parentNode.parentNode)">💾 保存</button>' +
        '<button class="prod-btn-cancel" onclick="document.body.removeChild(this.parentNode.parentNode.parentNode)">取消</button>' +
        '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    // 自动聚焦
    setTimeout(function () { var el = document.getElementById("editProdName"); if (el) el.focus(); }, 100);
}

function _escAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function submitEditProduct(id, overlay) {
    var name = document.getElementById("editProdName").value.trim();
    var kpi = document.getElementById("editProdKpi").value.trim();
    var region = document.getElementById("editProdRegion").value.trim();
    await fetch(API_BASE + "/api/products/" + id, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_name: name, kpi: kpi, region: region }),
    });
    document.body.removeChild(overlay);
    loadProducts();
}

// ---- 新增产品弹窗 ----
function showProductModal() {
    var overlay = document.createElement("div");
    overlay.className = "prod-modal-overlay";

    var box = document.createElement("div");
    box.className = "prod-modal-box";
    box.innerHTML =
        '<div class="prod-modal-title">➕ 新增产品</div>' +
        '<div class="form-group"><label>产品 / 群名</label><input id="modalProdName" placeholder="输入产品名称" /></div>' +
        '<div class="form-group"><label>KPI</label><input id="modalProdKpi" placeholder="如：ROAS 1.5" /></div>' +
        '<div class="form-group"><label>地区</label><input id="modalProdRegion" placeholder="如：巴西" /></div>' +
        '<div class="prod-modal-actions">' +
        '<button class="prod-btn-save" onclick="submitNewProduct(this.parentNode.parentNode.parentNode)">💾 保存</button>' +
        '<button class="prod-btn-cancel" onclick="document.body.removeChild(this.parentNode.parentNode.parentNode)">取消</button>' +
        '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    setTimeout(function () { var el = document.getElementById("modalProdName"); if (el) el.focus(); }, 100);
}

async function submitNewProduct(overlay) {
    var resp = await fetch(API_BASE + "/api/products/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            product_name: document.getElementById("modalProdName").value.trim(),
            kpi: document.getElementById("modalProdKpi").value.trim(),
            region: document.getElementById("modalProdRegion").value.trim(),
        }),
    });
    var data = await resp.json();
    if (data.success) {
        document.body.removeChild(overlay);
        prodState.pausedMode = false; updatePausedToggle();
        try { await loadProducts(1); } catch(e) { console.error(e); loadProducts(1); }
    } else { alert(data.error || "创建失败"); }
}

// ---- 复制导入弹窗 ----
async function showCopyImportModal() {
    var overlay = document.createElement("div");
    overlay.className = "prod-modal-overlay";

    var box = document.createElement("div");
    box.className = "prod-modal-box";
    box.style.maxWidth = "600px";

    // 先展示弹窗（含加载中），避免 fetch 阻塞导致点击无反应
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
        '<div class="prod-modal-actions">' +
        '<button class="prod-btn-save" onclick="submitCopyImport(this.parentNode.parentNode.parentNode)">💾 导入</button>' +
        '<button class="prod-btn-cancel" onclick="document.body.removeChild(this.parentNode.parentNode.parentNode)">取消</button>' +
        '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 异步加载已有产品列表
    try {
        var r = await fetch(API_BASE + "/api/products/list?size=200");
        var d = await r.json();
        if (d.success) {
            var sel = document.getElementById("copyProdName");
            if (sel) {
                sel.innerHTML = '<option value="">（输入新产品名）</option>';
                d.products.forEach(function (p) {
                    sel.innerHTML += '<option value="' + _escAttr(p.product_name) + '" data-kpi="' + _escAttr(p.kpi || "") + '" data-region="' + _escAttr(p.region || "") + '">' + p.product_name + '</option>';
                });
            }
        }
    } catch (e) { }
}

var _copyParsed = [];

function _getCopyProdName() {
    return document.getElementById("copyProdName").value || document.getElementById("copyProdNameNew").value.trim();
}

async function previewCopyImport() {
    var resp = await fetch(API_BASE + "/api/products/import-text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: document.getElementById("copyText").value,
            product_name: _getCopyProdName(),
            kpi: document.getElementById("copyProdKpi").value,
            region: document.getElementById("copyProdRegion").value,
            prefix: document.getElementById("copyPrefix").value,
            suffix: document.getElementById("copySuffix").value,
        }),
    });
    var data = await resp.json();
    if (!data.success) { alert(data.error); return; }
    _copyParsed = data.parsed || [];
    var preview = document.getElementById("copyPreview");
    preview.style.display = "block";
    var html = '<p style="margin-bottom:8px;">识别 <strong>' + _copyParsed.length + '</strong> 个包（可直接编辑）：</p>';
    html += '<div class="prod-preview-table-wrap"><table class="prod-preview-table"><thead><tr>' +
        '<th style="width:28%;">系列名</th><th style="width:28%;">包名</th><th style="width:36%;">链接</th><th style="width:8%;"></th>' +
        '</tr></thead><tbody>';
    _copyParsed.forEach(function (p, i) {
        html += '<tr>' +
            '<td><input class="prod-preview-input" data-row="' + i + '" data-field="series_name" value="' + _escAttr(p.series_name || "") + '" /></td>' +
            '<td><input class="prod-preview-input" data-row="' + i + '" data-field="package_name" value="' + _escAttr(p.package_name || "") + '" /></td>' +
            '<td><input class="prod-preview-input" data-row="' + i + '" data-field="url" value="' + _escAttr(p.url || "") + '" /></td>' +
            '<td style="text-align:center;"><button class="prod-btn-sm danger" onclick="var tr=this.closest(\'tr\');tr.parentNode.removeChild(tr);" title="移除">✕</button></td>' +
            '</tr>';
    });
    html += '</tbody></table></div>';
    preview.innerHTML = html;
}

function _collectPreviewRows() {
    var parsed = [];
    document.querySelectorAll("#copyPreview .prod-preview-table tbody tr").forEach(function (tr) {
        var inputs = tr.querySelectorAll("input");
        if (inputs.length >= 3) {
            var sn = inputs[0].value.trim();
            var pn = inputs[1].value.trim();
            var url = inputs[2].value.trim();
            if (sn || pn || url) {
                parsed.push({ series_name: sn, package_name: pn, url: url });
            }
        }
    });
    return parsed;
}

async function submitCopyImport(overlay) {
    var parsed = _collectPreviewRows();
    if (parsed.length === 0) { alert("没有有效的包数据"); return; }

    var resp = await fetch(API_BASE + "/api/products/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            product_name: _getCopyProdName(),
            kpi: document.getElementById("copyProdKpi").value.trim(),
            region: document.getElementById("copyProdRegion").value.trim(),
            packages: parsed,
        }),
    });
    var data = await resp.json();
    if (data.success) {
        document.body.removeChild(overlay);
        prodState.pausedMode = false; updatePausedToggle();
        try { await loadProducts(1); } catch(e) { console.error(e); loadProducts(1); }
    } else { alert(data.error || "导入失败"); }
}

// 初始化
document.addEventListener("DOMContentLoaded", function () {
    // Lazy load on tab switch
});
