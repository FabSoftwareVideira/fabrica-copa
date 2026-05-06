// =====================================================
// APP - Álbum Copa do Mundo FIFA 2026
// =====================================================

const STORAGE_KEY = "album-copa-2026";
const TOKEN_KEY = "album-copa-2026-token";
const REFRESH_TOKEN_KEY = "album-copa-2026-refresh-token";
const PACKS_PER_DAY = 1;
const API_BASE = "http://localhost:3001/api";

// Estado da aplicação
let state = {
    collected: {},      // { stickerId: count }  (0 = não tem, 1+ = tem)
    view: "dashboard",
    searchQuery: "",
    filterGroup: "all",
    filterStatus: "all",
    // Controle de pacotes
    packsUsedDate: "",  // "YYYY-MM-DD" do último dia que abriu pacote
    packsUsedToday: 0,  // quantos pacotes abriu hoje
    extraPacks: 0,      // pacotes bônus acumulados por código promo
    usedCodes: [],      // códigos já resgatados
    user: null,
    token: "",
    refreshToken: "",
    authMode: "login",
    recentPacks: [],
    modals: {
        packOpen: false,
        pendingRender: false,
        promoOpen: false,
        authOpen: false,
        lastPack: [],
        lastWasOwned: [],
    },
};

let saveSyncTimer = null;

async function apiFetch(path, options = {}, allowRefresh = true) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    if (response.status === 401 && allowRefresh && state.refreshToken) {
        let payload = null;
        try {
            payload = await response.clone().json();
        } catch (_err) {
            payload = null;
        }

        if (payload?.code === "TOKEN_EXPIRED") {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                return apiFetch(path, options, false);
            }
        }
    }

    return response;
}

function isAuthenticated() {
    return Boolean(state.user && state.token);
}

function requireAuth() {
    if (isAuthenticated()) return true;
    showToast("Faça login para gerenciar seu álbum");
    showAuthModal("login");
    return false;
}

async function refreshAccessToken() {
    if (!state.refreshToken) return false;

    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: state.refreshToken }),
        });

        if (!res.ok) {
            clearAuthState();
            return false;
        }

        const data = await res.json();
        state.token = data.accessToken;
        state.refreshToken = data.refreshToken;
        state.user = data.user;
        localStorage.setItem(TOKEN_KEY, state.token);
        localStorage.setItem(REFRESH_TOKEN_KEY, state.refreshToken);
        return true;
    } catch (_err) {
        clearAuthState();
        return false;
    }
}

function clearAuthState() {
    state.user = null;
    state.token = "";
    state.refreshToken = "";
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Persistência ────────────────────────────────────
async function loadState() {
    try {
        const savedToken = localStorage.getItem(TOKEN_KEY) || "";
        const savedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || "";
        state.token = savedToken;
        state.refreshToken = savedRefreshToken;

        if (savedToken) {
            const meRes = await apiFetch("/auth/me");
            if (meRes.ok) {
                const meData = await meRes.json();
                state.user = meData.user;

                const stateRes = await apiFetch("/album/state");
                if (stateRes.ok) {
                    const remote = await stateRes.json();
                    state.collected = remote.collected || {};
                    state.packsUsedDate = remote.packsUsedDate || "";
                    state.packsUsedToday = remote.packsUsedToday || 0;
                    state.extraPacks = remote.extraPacks || 0;
                    state.usedCodes = remote.usedCodes || [];
                    await loadPackHistory();
                    return;
                }
            } else {
                clearAuthState();
            }
        }

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state.collected = parsed.collected || {};
            state.packsUsedDate = parsed.packsUsedDate || "";
            state.packsUsedToday = parsed.packsUsedToday || 0;
            state.extraPacks = parsed.extraPacks || 0;
            state.usedCodes = parsed.usedCodes || [];
        }
    } catch (e) {
        console.warn("Erro ao carregar estado:", e);
    }
}

function saveState() {
    try {
        if (saveSyncTimer) {
            clearTimeout(saveSyncTimer);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            collected: state.collected,
            packsUsedDate: state.packsUsedDate,
            packsUsedToday: state.packsUsedToday,
            extraPacks: state.extraPacks,
            usedCodes: state.usedCodes,
        }));

        if (isAuthenticated()) {
            saveSyncTimer = setTimeout(async () => {
                try {
                    await apiFetch("/album/state", {
                        method: "PUT",
                        body: JSON.stringify({
                            collected: state.collected,
                        }),
                    });
                } catch (err) {
                    console.warn("Erro ao sincronizar estado no backend:", err);
                }
            }, 250);
        }
    } catch (e) {
        console.warn("Erro ao salvar estado:", e);
    }
}

async function loadPackHistory() {
    if (!isAuthenticated()) {
        state.recentPacks = [];
        return;
    }
    try {
        const res = await apiFetch("/packs/history?limit=8");
        if (!res.ok) {
            state.recentPacks = [];
            return;
        }
        const data = await res.json();
        state.recentPacks = data.history || [];
    } catch (_err) {
        state.recentPacks = [];
    }
}

async function submitAuth() {
    const nameInput = document.getElementById("auth-name");
    const emailInput = document.getElementById("auth-email");
    const passInput = document.getElementById("auth-password");
    const msg = document.getElementById("auth-msg");

    if (!emailInput || !passInput || !msg) return;

    const payload = {
        email: (emailInput.value || "").trim(),
        password: (passInput.value || "").trim(),
    };

    if (state.authMode === "register") {
        payload.name = (nameInput?.value || "").trim();
    }

    msg.className = "auth-msg";
    msg.textContent = "Enviando...";

    try {
        const path = state.authMode === "register" ? "/auth/register" : "/auth/login";
        const res = await apiFetch(path, {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
            msg.classList.add("auth-msg-error");
            msg.textContent = data.error || "Falha ao autenticar";
            return;
        }

        state.token = data.accessToken;
        state.refreshToken = data.refreshToken;
        state.user = data.user;
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);

        await loadState();
        closeAuthModal();
        render();
        showToast(`Bem-vindo(a), ${state.user.name}!`);
    } catch (_err) {
        msg.classList.add("auth-msg-error");
        msg.textContent = "Não foi possível conectar ao backend";
    }
}

async function logout() {
    try {
        if (state.refreshToken) {
            await fetch(`${API_BASE}/auth/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: state.refreshToken }),
            });
        }
    } catch (_err) {
        // ignora erro de rede no logout
    }
    clearAuthState();
    render();
    showToast("Sessão encerrada");
    showAuthModal("login");
}

function showAuthModal(mode = "login") {
    state.authMode = mode;
    state.modals.authOpen = true;
    render();
    const modal = document.getElementById("auth-modal");
    if (!modal) return;
    modal.classList.add("open");
}

function closeAuthModal() {
    state.modals.authOpen = false;
    const modal = document.getElementById("auth-modal");
    if (modal) modal.classList.remove("open");
}

// ─── Controle de Pacotes ──────────────────────────────
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function packsAvailableToday() {
    const today = todayStr();
    const usedToday = state.packsUsedDate === today ? state.packsUsedToday : 0;
    return Math.max(0, PACKS_PER_DAY - usedToday) + state.extraPacks;
}

function consumePack() {
    const today = todayStr();
    if (state.packsUsedDate !== today) {
        state.packsUsedDate = today;
        state.packsUsedToday = 0;
    }
    if (state.packsUsedToday < PACKS_PER_DAY) {
        state.packsUsedToday++;
    } else if (state.extraPacks > 0) {
        state.extraPacks--;
    }
    saveState();
}

// ─── Utilitários ─────────────────────────────────────
function hasSticker(id) { return (state.collected[id] || 0) >= 1; }
function isDuplicate(id) { return (state.collected[id] || 0) > 1; }
function getCount(id) { return state.collected[id] || 0; }

function toggleCollected(id) {
    const count = state.collected[id] || 0;
    if (count === 0) {
        showToast("Abra pacotinhos para conseguir novas figurinhas 🎁");
    } else {
        removeCollected(id);
        return;
    }
    saveState();
    refreshView();
}

function removeCollected(id, removeAll = false) {
    const count = state.collected[id] || 0;
    if (count <= 0) {
        showToast("Você não tem essa figurinha no álbum");
        return;
    }

    if (removeAll || count === 1) {
        state.collected[id] = 0;
        showToast("Figurinha removida");
    } else {
        state.collected[id] = count - 1;
        showToast(`Uma cópia removida (${state.collected[id]}x restante)`);
    }

    saveState();
    refreshView();
}

function addDuplicate(id) {
    if (!requireAuth()) return;

    if (!hasSticker(id)) {
        state.collected[id] = 1;
        showToast("Figurinha colada! ✅");
    } else {
        state.collected[id] = (state.collected[id] || 1) + 1;
        showToast(`Repetida adicionada (${state.collected[id]}x) 🔁`);
    }
    saveState();
    refreshView();
}

function getStats() {
    const total = ALL_STICKERS.length;
    const collected = ALL_STICKERS.filter(s => hasSticker(s.id)).length;
    const duplicates = ALL_STICKERS.filter(s => isDuplicate(s.id)).length;
    const missing = total - collected;
    const pct = total > 0 ? Math.round((collected / total) * 100) : 0;
    return { total, collected, duplicates, missing, pct };
}

function getGroupStats(groupId) {
    const groupStickers = ALL_STICKERS.filter(s => s.groupId === groupId || s.id === `grp-${groupId}`);
    const total = groupStickers.length;
    const collected = groupStickers.filter(s => hasSticker(s.id)).length;
    return { total, collected, pct: total > 0 ? Math.round((collected / total) * 100) : 0 };
}

// ─── Toast ────────────────────────────────────────────
function showToast(msg) {
    const existing = document.getElementById("toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast show";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove("show"), 2200);
    setTimeout(() => toast.remove(), 2600);
}

// ─── Navegação ────────────────────────────────────────
function navigate(view, extra = {}) {
    state.view = view;
    if (extra.filterGroup !== undefined) state.filterGroup = extra.filterGroup;
    if (extra.filterStatus !== undefined) state.filterStatus = extra.filterStatus;
    if (extra.searchQuery !== undefined) state.searchQuery = extra.searchQuery;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function refreshView() {
    // Atualiza apenas os cards sem re-renderizar tudo (otimização)
    if (state.view === "album") renderAlbumStickers();
    else if (state.view === "dashboard") renderDashboard();
    else render();
}

// ─── Pacotinhos ──────────────────────────────────────
async function openPack(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!requireAuth()) return;

    try {
        const res = await apiFetch("/packs/open", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
            if (String(data.error || "").toLowerCase().includes("limite")) {
                showPromoModal();
            } else {
                showToast(data.error || "Não foi possível abrir o pacote");
            }
            return;
        }

        state.collected = data.state.collected || state.collected;
        state.packsUsedDate = data.state.packsUsedDate || "";
        state.packsUsedToday = data.state.packsUsedToday || 0;
        state.extraPacks = data.state.extraPacks || 0;
        state.usedCodes = data.state.usedCodes || [];
        saveState();

        await loadPackHistory();
        showPackModal(data.pack || [], data.wasOwned || []);
    } catch (_err) {
        showToast("Erro de conexão ao abrir pacote");
    }
}

function showPackModal(pack, wasOwned = []) {
    const modal = document.getElementById("pack-modal");
    const container = document.getElementById("pack-stickers");
    if (!modal || !container) return;

    const signature = JSON.stringify({
        ids: pack.map((s) => s.id),
        owned: wasOwned,
    });

    // 🔒 Guard ANTES de qualquer efeito colateral
    if (modal.classList.contains("open") && modal.dataset.packSignature === signature) {
        return;
    }

    state.modals.packOpen = true;
    state.modals.lastPack = Array.isArray(pack) ? pack : [];
    state.modals.lastWasOwned = Array.isArray(wasOwned) ? wasOwned : [];

    modal.dataset.packSignature = signature;

    renderPackCards(container, state.modals.lastPack, state.modals.lastWasOwned);

    modal.classList.add("open");

    // ✅ Só salva depois que decidiu abrir
    try {
        sessionStorage.setItem("album-open-pack", JSON.stringify({
            pack: state.modals.lastPack,
            wasOwned: state.modals.lastWasOwned,
            ts: Date.now(),
        }));
    } catch { }
}

function renderPackCards(container, pack, wasOwned) {
    container.innerHTML = "";

    pack.forEach((sticker, i) => {
        const isNew = !Boolean(wasOwned[i]);
        const card = document.createElement("div");
        card.className = `pack-card ${isNew ? "pack-new" : "pack-repeat"}`;
        card.style.animationDelay = `${i * 0.12}s`;
        card.innerHTML = `
      <span class="pack-icon">${sticker.icon}</span>
      <span class="pack-num">#${sticker.num}</span>
      <span class="pack-name">${sticker.name}</span>
      <span class="pack-team">${sticker.teamName || sticker.sectionName}</span>
      <span class="pack-badge">${isNew ? "✨ Nova!" : "🔁 Repetida"}</span>
    `;
        container.appendChild(card);
    });
}

function closePack() {
    state.modals.packOpen = false;
    try {
        sessionStorage.removeItem("album-open-pack");
    } catch (_err) {
        // ignora falhas de sessionStorage
    }
    const modal = document.getElementById("pack-modal");
    if (modal) modal.classList.remove("open");

    if (state.modals.pendingRender) {
        state.modals.pendingRender = false;
    }
    render(true);
}

// ─── Códigos Promocionais ─────────────────────────────
function showPromoModal() {
    if (!requireAuth()) return;
    state.modals.promoOpen = true;
    const modal = document.getElementById("promo-modal");
    if (modal) modal.classList.add("open");
    setTimeout(() => {
        const input = document.getElementById("promo-input");
        if (input) input.focus();
    }, 50);
}

function closePromoModal() {
    state.modals.promoOpen = false;
    const modal = document.getElementById("promo-modal");
    if (modal) modal.classList.remove("open");
    const input = document.getElementById("promo-input");
    if (input) { input.value = ""; input.classList.remove("input-error", "input-ok"); }
    const msg = document.getElementById("promo-msg");
    if (msg) msg.textContent = "";
}

async function redeemCode() {
    const input = document.getElementById("promo-input");
    const msg = document.getElementById("promo-msg");
    const code = (input.value || "").trim().toUpperCase();

    input.classList.remove("input-error", "input-ok");
    msg.className = "promo-msg";

    if (!code) {
        msg.textContent = "Digite um código.";
        msg.classList.add("promo-msg-error");
        input.classList.add("input-error");
        return;
    }
    try {
        const res = await apiFetch("/promo/redeem", {
            method: "POST",
            body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!res.ok) {
            msg.textContent = data.error || "Código inválido ou expirado.";
            msg.classList.add("promo-msg-error");
            input.classList.add("input-error");
            return;
        }

        state.extraPacks = data.extraPacks || state.extraPacks;
        state.usedCodes = data.usedCodes || state.usedCodes;
        saveState();

        input.classList.add("input-ok");
        msg.textContent = `✅ ${data.label}: +${data.packs} pacote${data.packs > 1 ? "s" : ""} adicionado${data.packs > 1 ? "s" : ""}!`;
        msg.classList.add("promo-msg-ok");
        input.value = "";

        setTimeout(() => {
            closePromoModal();
            render();
            showToast(`🎁 +${data.packs} pacote${data.packs > 1 ? "s" : ""} desbloqueado${data.packs > 1 ? "s" : ""}!`);
        }, 1200);
    } catch (_err) {
        msg.textContent = "Não foi possível validar o código agora.";
        msg.classList.add("promo-msg-error");
        input.classList.add("input-error");
    }
}

async function scanCode() {
    const btn = document.getElementById("scan-btn");
    const msg = document.getElementById("promo-msg");

    if (!('BarcodeDetector' in window)) {
        msg.textContent = "Câmera não suportada neste navegador. Digite o código manualmente.";
        msg.className = "promo-msg promo-msg-error";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = document.createElement("video");
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();

        const detector = new BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
        const scanArea = document.getElementById("scan-area");
        scanArea.innerHTML = "";
        scanArea.appendChild(video);
        scanArea.style.display = "block";
        btn.disabled = true;
        msg.textContent = "Aponte para o código...";
        msg.className = "promo-msg";

        let found = false;
        const interval = setInterval(async () => {
            if (found) return;
            try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) {
                    found = true;
                    clearInterval(interval);
                    stream.getTracks().forEach(t => t.stop());
                    scanArea.style.display = "none";
                    btn.disabled = false;
                    document.getElementById("promo-input").value = barcodes[0].rawValue;
                    redeemCode();
                }
            } catch (_) { }
        }, 300);

        // Timeout de 15s
        setTimeout(() => {
            if (!found) {
                clearInterval(interval);
                stream.getTracks().forEach(t => t.stop());
                scanArea.style.display = "none";
                btn.disabled = false;
                msg.textContent = "Nenhum código detectado. Tente digitar manualmente.";
                msg.className = "promo-msg promo-msg-error";
            }
        }, 15000);
    } catch (err) {
        msg.textContent = "Sem acesso à câmera. Digite o código manualmente.";
        msg.className = "promo-msg promo-msg-error";
    }
}

// ─── Exportar / Importar ─────────────────────────────
function exportData() {
    if (!requireAuth()) return;

    const data = JSON.stringify({ collected: state.collected }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "album-copa-2026.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Dados exportados! 💾");
}

function importData() {
    if (!requireAuth()) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (parsed.collected) {
                    state.collected = parsed.collected;
                    saveState();
                    showToast("Dados importados com sucesso! ✅");
                    render();
                } else {
                    showToast("Arquivo inválido ❌");
                }
            } catch {
                showToast("Erro ao ler arquivo ❌");
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function resetAlbum() {
    if (!requireAuth()) return;

    if (!confirm("Tem certeza que deseja resetar todo o álbum? Esta ação não pode ser desfeita.")) return;
    state.collected = {};
    saveState();
    showToast("Álbum resetado 🗑️");
    render();
}

// ─── Renderização Principal ───────────────────────────
function render(force = false) {
    if (state.modals.packOpen && !force) {
        state.modals.pendingRender = true;
        return;
    }

    const app = document.getElementById("app");

    const navHTML = renderNav();
    let contentHTML = "";

    switch (state.view) {
        case "dashboard": contentHTML = buildDashboard(); break;
        case "album": contentHTML = buildAlbum(); break;
        case "missing": contentHTML = buildMissing(); break;
        case "duplicates": contentHTML = buildDuplicates(); break;
        case "search": contentHTML = buildSearch(); break;
        default: contentHTML = buildDashboard();
    }

    app.innerHTML = navHTML + `<main class="main-content">${contentHTML}</main>` + renderPackModal();
    attachEvents();
    restoreModalState();
    state.modals.pendingRender = false;
}

function restoreModalState() {
    if (state.modals.packOpen) {
        const modal = document.getElementById("pack-modal");
        const container = document.getElementById("pack-stickers");
        if (modal && container) {
            if (!container.children.length && state.modals.lastPack.length > 0) {
                renderPackCards(container, state.modals.lastPack, state.modals.lastWasOwned);
            }
            modal.classList.add("open");
        }
    }
    if (state.modals.promoOpen) {
        const promoModal = document.getElementById("promo-modal");
        if (promoModal) promoModal.classList.add("open");
    }
    if (state.modals.authOpen) {
        const authModal = document.getElementById("auth-modal");
        if (authModal) authModal.classList.add("open");
    }
}

function renderNav() {
    const views = [
        { id: "dashboard", label: "Início", icon: "🏠" },
        { id: "album", label: "Álbum", icon: "📖" },
        { id: "missing", label: "Faltando", icon: "❓" },
        { id: "duplicates", label: "Repetidas", icon: "🔁" },
        { id: "search", label: "Buscar", icon: "🔍" },
    ];

    const links = views.map(v => `
    <button class="nav-btn ${state.view === v.id ? "active" : ""}" onclick="navigate('${v.id}')">
      <span class="nav-icon">${v.icon}</span>
      <span class="nav-label">${v.label}</span>
    </button>
  `).join("");

    const available = packsAvailableToday();
    const packLabel = available > 0
        ? `🎁 Abrir Pacotinho <span class="pack-count">${available}</span>`
        : `🔒 Sem Pacotes <span class="pack-count">0</span>`;

    const authControls = isAuthenticated()
        ? `
          <div class="auth-user">👤 ${escapeHtml(state.user.name)}</div>
          <button type="button" class="btn-auth" onclick="logout()">Sair</button>
        `
        : `
          <button type="button" class="btn-auth" onclick="showAuthModal('login')">Entrar</button>
          <button type="button" class="btn-auth" onclick="showAuthModal('register')">Cadastrar</button>
        `;

    return `
    <header class="header">
      <div class="header-inner">
        <div class="header-logo">
          <span class="logo-icon">⚽</span>
          <div>
            <h1 class="logo-title">Copa do Mundo 2026</h1>
            <p class="logo-sub">Álbum de Figurinhas</p>
          </div>
        </div>
        <div class="header-actions">
          ${authControls}
          <button type="button" class="btn-promo" onclick="showPromoModal()" title="Resgatar código promocional">🎟️</button>
          <button type="button" class="btn-pack ${available === 0 ? 'btn-pack-locked' : ''}" onclick="openPack(event)">
            ${packLabel}
          </button>
        </div>
      </div>
      <nav class="nav">${links}</nav>
    </header>
  `;
}

// ─── Dashboard ────────────────────────────────────────
function buildDashboard() {
    return `<div id="dashboard-view">${getDashboardContent()}</div>`;
}

function getDashboardContent() {
    const stats = getStats();

    const groupCards = ALBUM_DATA.groups.map(group => {
        const gs = getGroupStats(group.id);
        const complete = gs.pct === 100;
        return `
      <div class="group-stat-card ${complete ? "complete" : ""}" onclick="navigate('album', {filterGroup: '${group.id}'})">
        <div class="group-stat-header" style="background:${group.color}">
          <span class="group-stat-name">${group.name}</span>
          <span class="group-stat-pct">${gs.pct}%</span>
        </div>
        <div class="group-stat-body">
          <div class="group-prog-bar">
            <div class="group-prog-fill" style="width:${gs.pct}%;background:${group.color}"></div>
          </div>
          <div class="group-stat-nums">${gs.collected} / ${gs.total}</div>
          ${complete ? '<div class="complete-badge">✅ Completo!</div>' : ""}
        </div>
      </div>
    `;
    }).join("");

    return `
    <section class="section">
      <h2 class="section-title">Meu Progresso</h2>
      <div class="stats-grid">
        <div class="stat-card stat-total">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card stat-collected" onclick="navigate('album')">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${stats.collected}</div>
          <div class="stat-label">Coladas</div>
        </div>
        <div class="stat-card stat-missing" onclick="navigate('missing')">
          <div class="stat-icon">❓</div>
          <div class="stat-value">${stats.missing}</div>
          <div class="stat-label">Faltando</div>
        </div>
        <div class="stat-card stat-dup" onclick="navigate('duplicates')">
          <div class="stat-icon">🔁</div>
          <div class="stat-value">${stats.duplicates}</div>
          <div class="stat-label">Repetidas</div>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-header">
          <span>Álbum ${stats.pct}% completo</span>
          <span class="progress-frac">${stats.collected} / ${stats.total}</span>
        </div>
        <div class="main-progress-bar">
          <div class="main-progress-fill" style="width:${stats.pct}%">
            ${stats.pct > 5 ? stats.pct + "%" : ""}
          </div>
        </div>
      </div>

      <div class="pack-cta">
        ${buildPackCta()}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Progresso por Grupo</h2>
      <div class="groups-grid">${groupCards}</div>
    </section>

    ${buildPackHistorySection()}

    <section class="section">
      <h2 class="section-title">Ferramentas</h2>
      <div class="tools-grid">
        <button class="tool-btn" onclick="exportData()">💾 Exportar Dados</button>
        <button class="tool-btn" onclick="importData()">📂 Importar Dados</button>
        <button class="tool-btn tool-danger" onclick="resetAlbum()">🗑️ Resetar Álbum</button>
      </div>
    </section>
  `;
}

function buildPackHistorySection() {
    if (!isAuthenticated()) return "";

    const items = (state.recentPacks || []).slice(0, 6);
    if (items.length === 0) {
        return `
        <section class="section">
          <h2 class="section-title">Histórico de Pacotinhos</h2>
          <p class="search-hint">Abra seu primeiro pacotinho para começar o histórico.</p>
        </section>
      `;
    }

    return `
      <section class="section">
        <h2 class="section-title">Histórico de Pacotinhos</h2>
        <div class="sticker-list">
          ${items.map((item) => `
            <div class="sticker-list-item dup-item">
              <span class="list-icon">🎁</span>
              <span class="list-name">${new Date(item.openedAt).toLocaleString("pt-BR")}</span>
              <span class="list-team">${item.source === "bonus" ? "Bônus" : "Diário"}</span>
              <span class="dup-count-badge">${item.newCount} nova(s)</span>
              <span class="dup-count-badge">${item.repeatCount} repetida(s)</span>
            </div>
          `).join("")}
        </div>
      </section>
    `;
}

function buildPackCta() {
    if (!isAuthenticated()) {
        return `
          <button type="button" class="btn-pack-big" onclick="showAuthModal('login')">
            🔐 Entrar para abrir pacotinhos
          </button>
          <div class="pack-hint">Cada conta tem seu próprio álbum e progresso.</div>
        `;
    }

    const available = packsAvailableToday();
    const today = todayStr();
    const usedToday = state.packsUsedDate === today ? state.packsUsedToday : 0;
    const dailyLeft = Math.max(0, PACKS_PER_DAY - usedToday);

    if (available > 0) {
        return `
          <button type="button" class="btn-pack-big" onclick="openPack(event)">
            🎁 Abrir Pacotinho de Figurinhas
          </button>
          <div class="pack-hint">
            ${dailyLeft > 0 ? `${dailyLeft} pacote${dailyLeft > 1 ? "s" : ""} diário${dailyLeft > 1 ? "s" : ""}` : ""}
            ${state.extraPacks > 0 ? ` + ${state.extraPacks} bônus` : ""}
            disponível${available > 1 ? "is" : ""}
          </div>
        `;
    }
    return `
      <button type="button" class="btn-pack-big btn-pack-locked" disabled>
        🔒 Volte amanhã para mais pacotes
      </button>
      <div class="pack-hint">
        <button type="button" class="link-btn" onclick="showPromoModal()">🎟️ Tem um código promocional? Clique aqui</button>
      </div>
    `;
}

function renderDashboard() {
    const dv = document.getElementById("dashboard-view");
    if (dv) dv.innerHTML = getDashboardContent();
}

// ─── Álbum ────────────────────────────────────────────
function buildAlbum() {
    const groupOptions = ALBUM_DATA.groups.map(g =>
        `<option value="${g.id}" ${state.filterGroup === g.id ? "selected" : ""}>${g.name}</option>`
    ).join("");

    return `
    <section class="section">
      <h2 class="section-title">Álbum de Figurinhas</h2>
      <div class="album-filters">
        <div class="filter-group">
          <label>Grupo:</label>
          <select id="filter-group" onchange="applyGroupFilter(this.value)">
            <option value="all" ${state.filterGroup === "all" ? "selected" : ""}>Todos os Grupos</option>
            <option value="especial" ${state.filterGroup === "especial" ? "selected" : ""}>Especial</option>
            ${groupOptions}
          </select>
        </div>
        <div class="filter-group">
          <label>Status:</label>
          <select id="filter-status" onchange="applyStatusFilter(this.value)">
            <option value="all"       ${state.filterStatus === "all" ? "selected" : ""}>Todas</option>
            <option value="collected" ${state.filterStatus === "collected" ? "selected" : ""}>Coladas</option>
            <option value="missing"   ${state.filterStatus === "missing" ? "selected" : ""}>Faltando</option>
            <option value="duplicate" ${state.filterStatus === "duplicate" ? "selected" : ""}>Repetidas</option>
          </select>
        </div>
      </div>
      <div id="album-stickers-container"></div>
    </section>
  `;
}

function renderAlbumStickers() {
    const container = document.getElementById("album-stickers-container");
    if (!container) return;
    container.innerHTML = getAlbumContent();
}

function applyGroupFilter(val) {
    state.filterGroup = val;
    renderAlbumStickers();
}

function applyStatusFilter(val) {
    state.filterStatus = val;
    renderAlbumStickers();
}

function getAlbumContent() {
    // Determina quais seções mostrar
    let sections = [];

    if (state.filterGroup === "all" || state.filterGroup === "especial") {
        sections.push({ id: "especial", name: "Especial", color: "#FFD700", stickers: ALL_STICKERS.filter(s => s.section === "especial") });
    }

    ALBUM_DATA.groups.forEach(group => {
        if (state.filterGroup === "all" || state.filterGroup === group.id) {
            sections.push({
                id: group.id, name: group.name, color: group.color,
                stickers: ALL_STICKERS.filter(s => s.groupId === group.id || s.id === `grp-${group.id}`)
            });
        }
    });

    return sections.map(sec => {
        let stickers = sec.stickers;

        // Filtro de status
        if (state.filterStatus === "collected") stickers = stickers.filter(s => hasSticker(s.id));
        if (state.filterStatus === "missing") stickers = stickers.filter(s => !hasSticker(s.id));
        if (state.filterStatus === "duplicate") stickers = stickers.filter(s => isDuplicate(s.id));

        if (stickers.length === 0) return "";

        const stats = { total: sec.stickers.length, collected: sec.stickers.filter(s => hasSticker(s.id)).length };
        const pct = Math.round((stats.collected / stats.total) * 100);

        const cards = stickers.map(s => buildStickerCard(s)).join("");

        return `
      <div class="album-section">
        <div class="album-section-header" style="border-left-color:${sec.color}">
          <h3 class="album-section-title">${sec.name}</h3>
          <div class="album-section-stats">
            <span>${stats.collected}/${stats.total}</span>
            <div class="mini-progress">
              <div class="mini-progress-fill" style="width:${pct}%;background:${sec.color}"></div>
            </div>
          </div>
        </div>
        <div class="stickers-grid">${cards}</div>
      </div>
    `;
    }).join("");
}

function buildStickerCard(sticker) {
    const collected = hasSticker(sticker.id);
    const count = getCount(sticker.id);
    const dup = count > 1;
    const typeBadge = sticker.type === "badge" ? "🛡️" : sticker.type === "group" ? "📋" : "";

    return `
    <div class="sticker-card ${collected ? "collected" : "missing"} ${dup ? "duplicate" : ""} type-${sticker.type}"
      data-id="${sticker.id}"
      onclick="toggleCollected('${sticker.id}')"
      oncontextmenu="ctxMenu(event,'${sticker.id}')"
      title="${sticker.name}&#10;${collected ? "✅ Colada" + (dup ? " (" + count + "x)" : "") : "❓ Faltando"}&#10;Clique para colar/remover&#10;Clique direito para adicionar repetida">
      <div class="sticker-num">#${sticker.num}</div>
      <div class="sticker-icon">${sticker.icon}</div>
      <div class="sticker-name">${sticker.name}</div>
      ${dup ? `<div class="dup-badge">${count}x</div>` : ""}
      ${typeBadge ? `<div class="type-badge">${typeBadge}</div>` : ""}
      ${collected ? '<div class="check-mark">✓</div>' : ""}
    </div>
  `;
}

// ─── Faltando ────────────────────────────────────────
function buildMissing() {
    const missing = ALL_STICKERS.filter(s => !hasSticker(s.id));
    const byGroup = groupBySection(missing);

    if (missing.length === 0) {
        return `
      <section class="section">
        <h2 class="section-title">Figurinhas Faltando</h2>
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <h3>Parabéns! Álbum Completo!</h3>
          <p>Você colou todas as ${ALL_STICKERS.length} figurinhas!</p>
        </div>
      </section>
    `;
    }

    return `
    <section class="section">
      <h2 class="section-title">Figurinhas Faltando (${missing.length})</h2>
      ${byGroup.map(sec => `
        <div class="list-section">
          <h4 class="list-section-title">${sec.name} — faltam ${sec.stickers.length}</h4>
          <div class="sticker-list">
            ${sec.stickers.map(s => `
              <div class="sticker-list-item" onclick="toggleCollected('${s.id}')">
                <span class="list-icon">${s.icon}</span>
                <span class="list-num">#${s.num}</span>
                <span class="list-name">${s.name}</span>
                ${s.teamName ? `<span class="list-team">${s.teamName}</span>` : ""}
                <button class="list-btn" onclick="event.stopPropagation();toggleCollected('${s.id}')">Colar ✅</button>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </section>
  `;
}

// ─── Repetidas ────────────────────────────────────────
function buildDuplicates() {
    const dups = ALL_STICKERS.filter(s => isDuplicate(s.id));

    if (dups.length === 0) {
        return `
      <section class="section">
        <h2 class="section-title">Figurinhas Repetidas</h2>
        <div class="empty-state">
          <div class="empty-icon">🔁</div>
          <h3>Nenhuma repetida ainda</h3>
          <p>Abra mais pacotinhos para conseguir repetidas!</p>
        </div>
      </section>
    `;
    }

    return `
    <section class="section">
      <h2 class="section-title">Figurinhas Repetidas (${dups.length})</h2>
      <div class="sticker-list">
        ${dups.map(s => `
          <div class="sticker-list-item dup-item" oncontextmenu="ctxMenu(event,'${s.id}')">
            <span class="list-icon">${s.icon}</span>
            <span class="list-num">#${s.num}</span>
            <span class="list-name">${s.name}</span>
            ${s.teamName ? `<span class="list-team">${s.teamName}</span>` : ""}
            <span class="dup-count-badge">${getCount(s.id)}x</span>
            <button class="list-btn" onclick="event.stopPropagation();removeCollected('${s.id}')">Remover 1</button>
            <button class="list-btn" onclick="event.stopPropagation();removeCollected('${s.id}', true)">Remover tudo</button>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

// ─── Busca ────────────────────────────────────────────
function buildSearch() {
    const q = state.searchQuery.toLowerCase().trim();
    const results = q.length >= 2
        ? ALL_STICKERS.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.teamName && s.teamName.toLowerCase().includes(q)) ||
            String(s.num).includes(q)
        )
        : [];

    return `
    <section class="section">
      <h2 class="section-title">Buscar Figurinhas</h2>
      <div class="search-box">
        <input id="search-input" type="text" placeholder="Nome do jogador, time ou número..."
          value="${escapeHtml(state.searchQuery)}"
          oninput="doSearch(this.value)"
          autofocus />
        <span class="search-icon">🔍</span>
      </div>
      <div id="search-results">
        ${q.length < 2
            ? '<p class="search-hint">Digite ao menos 2 caracteres para buscar</p>'
            : results.length === 0
                ? `<p class="search-hint">Nenhum resultado para "<strong>${escapeHtml(state.searchQuery)}</strong>"</p>`
                : `
              <p class="search-count">${results.length} resultado(s) para "${escapeHtml(state.searchQuery)}"</p>
              <div class="stickers-grid">
                ${results.map(s => buildStickerCard(s)).join("")}
              </div>
            `
        }
      </div>
    </section>
  `;
}

function doSearch(val) {
    state.searchQuery = val;
    const q = val.toLowerCase().trim();
    const results = q.length >= 2
        ? ALL_STICKERS.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.teamName && s.teamName.toLowerCase().includes(q)) ||
            String(s.num).includes(q)
        )
        : [];

    const container = document.getElementById("search-results");
    if (!container) return;

    if (q.length < 2) {
        container.innerHTML = '<p class="search-hint">Digite ao menos 2 caracteres para buscar</p>';
        return;
    }
    if (results.length === 0) {
        container.innerHTML = `<p class="search-hint">Nenhum resultado para "<strong>${escapeHtml(val)}</strong>"</p>`;
        return;
    }
    container.innerHTML = `
    <p class="search-count">${results.length} resultado(s) para "${escapeHtml(val)}"</p>
    <div class="stickers-grid">${results.map(s => buildStickerCard(s)).join("")}</div>
  `;
    attachCardEvents();
}

// ─── Modais ───────────────────────────────────────────
function renderPackModal() {
    return `
    <div id="pack-modal" class="modal-overlay">
      <div class="modal-box">
        <h2 class="modal-title">🎁 Novo Pacotinho!</h2>
        <div id="pack-stickers" class="pack-grid"></div>
        <button type="button" class="btn-close-modal" onclick="closePack()">Colar no Álbum ✅</button>
      </div>
    </div>

    <div id="promo-modal" class="modal-overlay">
      <div class="modal-box promo-box">
        <button type="button" class="modal-close-x" onclick="closePromoModal()">✕</button>
        <h2 class="modal-title">🎟️ Código Promocional</h2>
        <p class="promo-desc">Digite o código do seu pacotinho ou escaneie o QR code da embalagem para desbloquear pacotes extras.</p>
        <div class="promo-input-row">
          <input id="promo-input" type="text" placeholder="Ex: COPA2026"
            maxlength="20"
            oninput="this.value=this.value.toUpperCase()"
            onkeydown="if(event.key==='Enter')redeemCode()" />
          <button type="button" id="scan-btn" class="btn-scan" onclick="scanCode()" title="Escanear código com câmera">📷</button>
        </div>
        <div id="scan-area" class="scan-area" style="display:none"></div>
        <div id="promo-msg" class="promo-msg"></div>
        <button type="button" class="btn-redeem" onclick="redeemCode()">Resgatar Código</button>
        ${state.extraPacks > 0 ? `<p class="promo-extra">Você tem <strong>${state.extraPacks}</strong> pacote${state.extraPacks > 1 ? "s" : ""} bônus disponível${state.extraPacks > 1 ? "is" : ""}.</p>` : ""}
        <div class="promo-hint">Códigos são válidos para uso único por conta.</div>
      </div>
    </div>

    <div id="auth-modal" class="modal-overlay">
      <div class="modal-box promo-box auth-box">
        <button type="button" class="modal-close-x" onclick="closeAuthModal()">✕</button>
        <h2 class="modal-title">${state.authMode === "register" ? "Criar Conta" : "Entrar"}</h2>
        <p class="promo-desc">Cada usuário possui um álbum separado com suas próprias figurinhas.</p>
        ${state.authMode === "register" ? `<input id="auth-name" class="auth-input" type="text" placeholder="Nome" />` : ""}
        <input id="auth-email" class="auth-input" type="email" placeholder="Email" />
        <input id="auth-password" class="auth-input" type="password" placeholder="Senha (mín. 6 caracteres)" />
        <div id="auth-msg" class="auth-msg"></div>
        <button type="button" class="btn-redeem" onclick="submitAuth()">${state.authMode === "register" ? "Criar Conta" : "Entrar"}</button>
        <div class="promo-hint">
          ${state.authMode === "register"
            ? `Já tem conta? <button type="button" class="link-btn" onclick="showAuthModal('login')">Entrar</button>`
            : `Ainda não tem conta? <button type="button" class="link-btn" onclick="showAuthModal('register')">Cadastrar</button>`
        }
        </div>
      </div>
    </div>
  `;
}

// ─── Menu Contextual ─────────────────────────────────
function ctxMenu(e, id) {
    e.preventDefault();
    const existing = document.getElementById("ctx-menu");
    if (existing) existing.remove();

    const sticker = ALL_STICKERS.find(s => s.id === id);
    const count = getCount(id);

    const menu = document.createElement("div");
    menu.id = "ctx-menu";
    menu.className = "ctx-menu";
    menu.style.top = e.pageY + "px";
    menu.style.left = e.pageX + "px";
    menu.innerHTML = `
    <div class="ctx-header">#${sticker.num} ${sticker.name}</div>
    <button onclick="toggleCollected('${id}');closeCtx()">${hasSticker(id) ? "❌ Remover 1 cópia" : "🚫 Só via pacotinho"}</button>
    ${hasSticker(id) ? `<button onclick="removeCollected('${id}', true);closeCtx()">🗑️ Remover todas</button>` : ""}
    <button onclick="addDuplicate('${id}');closeCtx()">🔁 Adicionar repetida ${count > 0 ? "(" + count + "x)" : ""}</button>
    <button onclick="closeCtx()">✖ Cancelar</button>
  `;
    document.body.appendChild(menu);
    document.addEventListener("click", closeCtx, { once: true });
}

function closeCtx() {
    const m = document.getElementById("ctx-menu");
    if (m) m.remove();
}

// ─── Helpers ─────────────────────────────────────────
function groupBySection(stickers) {
    const map = {};
    stickers.forEach(s => {
        if (!map[s.sectionName]) map[s.sectionName] = { name: s.sectionName, stickers: [] };
        map[s.sectionName].stickers.push(s);
    });
    return Object.values(map);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ─── Event Listeners ─────────────────────────────────
function attachEvents() {
    if (state.view === "album") renderAlbumStickers();
    attachCardEvents();
}

function attachCardEvents() {
    // Eventos já inline via onclick no HTML gerado
}

// ─── Inicialização ────────────────────────────────────
// document.addEventListener("DOMContentLoaded", () => {
//     document.addEventListener("submit", (event) => {
//         event.preventDefault();
//     });

//     loadState().finally(() => {
//         render();

//         try {
//             const raw = sessionStorage.getItem("album-open-pack");
//             if (raw) {
//                 const saved = JSON.parse(raw);
//                 const isFresh = saved && saved.ts && (Date.now() - saved.ts < 5 * 60 * 1000);
//                 if (isFresh && Array.isArray(saved.pack) && saved.pack.length > 0) {
//                     if (!state.modals.packOpen) {
//                         showPackModal(saved.pack, saved.wasOwned || []);
//                     }
//                 }
//             }
//         } catch (_err) {
//             // ignora falhas de sessionStorage
//         }

//         if (!isAuthenticated()) {
//             showAuthModal("login");
//         }
//     });
// });
document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("submit", (event) => {
        event.preventDefault();
    });

    loadState().finally(() => {
        mountModalsOnce(); // ✅ monta modais UMA vez
        render();

        if (!isAuthenticated()) {
            showAuthModal("login");
        }
    });
});

function mountModalsOnce() {
    if (document.getElementById("pack-modal")) return;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderPackModal();
    document.body.appendChild(wrapper);
}