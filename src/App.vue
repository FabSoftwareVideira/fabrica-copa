<script setup>
import { computed, onBeforeUnmount, onMounted, reactive } from "vue";
import playerImagesData from "../js/player-images.json";

const API_BASE_URL = "http://localhost:3001/api";
const PACKS_PER_DAY = 1;
const PACK_DRAG_OPEN_DISTANCE = 180;
const DEFAULT_PLAYER_IMAGE = "/player-default.png";
const DEFAULT_TEAM_IMAGE = "/teams/default.png";
const TEAM_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "svg"];
const TEAM_IMAGE_CODES = {
  usa: "us",
  mar: "ma",
  sui: "ch",
  jor: "jo",
  mex: "mx",
  ksa: "sa",
  den: "dk",
  sen: "sn",
  can: "ca",
  aus: "au",
  cro: "hr",
  per: "pe",
  bra: "br",
  kor: "kr",
  sco: "sc",
  civ: "ci",
  arg: "ar",
  jpn: "jp",
  tur: "tr",
  nga: "ng",
  fra: "fr",
  col: "co",
  aut: "at",
  irq: "iq",
  ger: "de",
  ecu: "ec",
  egy: "eg",
  rou: "ro",
  esp: "es",
  ven: "ve",
  srb: "rs",
  dza: "dz",
  eng: "gb-eng",
  irn: "ir",
  pol: "pl",
  gha: "gh",
  por: "pt",
  uru: "uy",
  ned: "nl",
  rsa: "za",
  ita: "it",
  bel: "be",
  pan: "pa",
  uzb: "uz",
  hon: "hn",
  jam: "jm",
  cmr: "cm",
  nzl: "nz",
};

const GROUP_COLORS = {
  especial: "#f59e0b",
  A: "#ef4444",
  B: "#f97316",
  C: "#facc15",
  D: "#22c55e",
  E: "#14b8a6",
  F: "#3b82f6",
  G: "#8b5cf6",
  H: "#ec4899",
  I: "#06b6d4",
  J: "#f43f5e",
  K: "#64748b",
  L: "#78716c",
};

const stickers = Array.isArray(window.ALL_STICKERS) ? window.ALL_STICKERS : [];
const stickerMap = new Map(stickers.map((item) => [item.id, item]));
const playerImageItems = Array.isArray(playerImagesData?.items)
  ? playerImagesData.items
  : [];

const playerImageMap = new Map(
  playerImageItems
    .filter((item) => item?.found && item?.player && item?.imageUrl)
    .map((item) => [
      `${item.player.toLowerCase()}::${item.teamId || ""}`,
      item,
    ]),
);

const state = reactive({
  view: "dashboard",
  flipGroup: "especial",
  filterGroup: "all",
  filterStatus: "all",
  searchQuery: "",
  collected: {},
  packsUsedDate: "",
  packsUsedToday: 0,
  extraPacks: 0,
  usedCodes: [],
  recentPacks: [],
  accessToken: localStorage.getItem("album-access-token") || "",
  refreshToken: localStorage.getItem("album-refresh-token") || "",
  user: parseUser(),
});

const ui = reactive({
  loading: false,
  openingPack: false,
  flipDirection: "next",
  toast: "",
  packOpen: false,
  packStage: "sealed",
  packDragActive: false,
  packDragProgress: 0,
  packDragStartX: 0,
  promoOpen: false,
  authOpen: false,
  authMode: "login",
  authMsg: "",
  promoMsg: "",
  promoCode: "",
  pack: [],
  wasOwned: [],
});

const authForm = reactive({
  name: "",
  email: "",
  password: "",
});

const isAuthenticated = computed(() =>
  Boolean(state.user?.id && state.accessToken),
);
const total = computed(() => stickers.length);
const collectedCount = computed(
  () =>
    Object.values(state.collected).filter((count) => Number(count) >= 1).length,
);
const duplicates = computed(() =>
  Object.values(state.collected).reduce(
    (acc, count) => acc + Math.max(0, Number(count) - 1),
    0,
  ),
);
const missing = computed(() => total.value - collectedCount.value);
const percent = computed(() =>
  total.value === 0
    ? 0
    : Math.round((collectedCount.value / total.value) * 100),
);
const progressTheme = computed(() => {
  if (percent.value >= 76) {
    return { key: "theme-finals", label: "Fase 4: Final" };
  }
  if (percent.value >= 51) {
    return { key: "theme-semifinal", label: "Fase 3: Semifinais" };
  }
  if (percent.value >= 26) {
    return { key: "theme-groups", label: "Fase 2: Grupos" };
  }
  return { key: "theme-kickoff", label: "Fase 1: Abertura" };
});
const dailyLeft = computed(() => {
  const today = todayStr();
  const used = state.packsUsedDate === today ? state.packsUsedToday : 0;
  return Math.max(0, PACKS_PER_DAY - used);
});
const packsAvailable = computed(
  () => dailyLeft.value + (state.extraPacks || 0),
);

const duplicatesList = computed(() =>
  stickers.filter((item) => getCount(item.id) > 1),
);
const missingList = computed(() =>
  stickers.filter((item) => getCount(item.id) < 1),
);

const filteredAlbum = computed(() => {
  return stickers.filter((item) => {
    if (state.filterGroup !== "all") {
      if (state.filterGroup === "especial") {
        if (item.section !== "especial") return false;
      } else if (item.groupId !== state.filterGroup) {
        return false;
      }
    }

    if (state.filterStatus === "collected" && getCount(item.id) < 1)
      return false;
    if (state.filterStatus === "missing" && getCount(item.id) >= 1)
      return false;
    if (state.filterStatus === "duplicate" && getCount(item.id) <= 1)
      return false;

    return true;
  });
});

const albumPages = computed(() => {
  const pages = new Map();

  for (const item of stickers) {
    const key = item.section === "especial" ? "especial" : item.groupId;
    if (!key) continue;

    if (!pages.has(key)) {
      pages.set(key, {
        key,
        name: key === "especial" ? "Especial" : `Grupo ${key}`,
        color: GROUP_COLORS[key] || "#334155",
        stickers: [],
      });
    }

    pages.get(key).stickers.push(item);
  }

  const order = [
    "especial",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
  ];

  return [...pages.values()]
    .map((page) => {
      const orderedStickers = [...page.stickers].sort((a, b) => a.num - b.num);
      const collectedItems = orderedStickers.filter(
        (s) => getCount(s.id) >= 1,
      ).length;
      const pendingItems = orderedStickers.length - collectedItems;
      const pct = orderedStickers.length
        ? Math.round((collectedItems / orderedStickers.length) * 100)
        : 0;

      return {
        ...page,
        stickers: orderedStickers,
        collectedItems,
        pendingItems,
        pct,
      };
    })
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
});

const currentFlipPage = computed(() => {
  if (albumPages.value.length === 0) return null;
  return (
    albumPages.value.find((page) => page.key === state.flipGroup) ||
    albumPages.value[0]
  );
});

const searchResults = computed(() => {
  const query = state.searchQuery.trim().toLowerCase();
  if (query.length < 2) return [];
  return stickers.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      String(item.num).includes(query) ||
      String(item.teamName || "")
        .toLowerCase()
        .includes(query),
  );
});

const packNewCount = computed(
  () => ui.wasOwned.filter((owned) => !owned).length,
);

const packRepeatCount = computed(
  () => ui.wasOwned.filter((owned) => owned).length,
);

const packDragStyle = computed(() => ({
  "--tear-progress": `${ui.packDragProgress}%`,
  "--pack-shift": `${Math.round(ui.packDragProgress * 1.2)}px`,
}));

let packRevealTimer = null;
const stickerPhotoCache = new Map();

onMounted(async () => {
  if (isAuthenticated.value) {
    await bootstrapAuth();
  } else {
    ui.authOpen = true;
    ui.authMode = "login";
  }
});

onBeforeUnmount(() => {
  removePackDragListeners();
  clearPackRevealTimer();
});

function parseUser() {
  const raw = localStorage.getItem("album-user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getCount(id) {
  return Number(state.collected[id] || 0);
}

function groupLabel(item) {
  if (item.section === "especial") return "Especial";
  return item.sectionName || `Grupo ${item.groupId || "?"}`;
}

function groupColor(item) {
  if (item.section === "especial") return GROUP_COLORS.especial;
  return GROUP_COLORS[item.groupId] || "#1f2937";
}

function setToast(message) {
  ui.toast = message;
  if (!message) return;
  setTimeout(() => {
    if (ui.toast === message) ui.toast = "";
  }, 2200);
}

function saveAuth() {
  if (state.accessToken)
    localStorage.setItem("album-access-token", state.accessToken);
  else localStorage.removeItem("album-access-token");

  if (state.refreshToken)
    localStorage.setItem("album-refresh-token", state.refreshToken);
  else localStorage.removeItem("album-refresh-token");

  if (state.user)
    localStorage.setItem("album-user", JSON.stringify(state.user));
  else localStorage.removeItem("album-user");
}

function clearAuth() {
  state.accessToken = "";
  state.refreshToken = "";
  state.user = null;
  state.collected = {};
  state.packsUsedDate = "";
  state.packsUsedToday = 0;
  state.extraPacks = 0;
  state.usedCodes = [];
  state.recentPacks = [];
  saveAuth();
}

async function apiFetch(path, options = {}, retry = true) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && state.refreshToken) {
    const payload = await res
      .clone()
      .json()
      .catch(() => ({}));
    if (payload?.code === "TOKEN_EXPIRED") {
      const refreshed = await tryRefreshToken();
      if (refreshed) return apiFetch(path, options, false);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Erro de API");
  }
  return data;
}

async function tryRefreshToken() {
  if (!state.refreshToken) return false;
  try {
    const data = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    }).then((r) => r.json());

    if (!data?.accessToken || !data?.refreshToken || !data?.user) {
      clearAuth();
      return false;
    }

    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    saveAuth();
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

async function bootstrapAuth() {
  ui.loading = true;
  try {
    const me = await apiFetch("/auth/me");
    state.user = me.user;
    saveAuth();
    await Promise.all([loadAlbumState(), loadPackHistory()]);
  } catch (_err) {
    clearAuth();
    ui.authOpen = true;
  } finally {
    ui.loading = false;
  }
}

async function loadAlbumState() {
  const data = await apiFetch("/album/state");
  state.collected = data.collected || {};
  state.packsUsedDate = data.packsUsedDate || "";
  state.packsUsedToday = Number(data.packsUsedToday || 0);
  state.extraPacks = Number(data.extraPacks || 0);
  state.usedCodes = Array.isArray(data.usedCodes) ? data.usedCodes : [];
}

async function loadPackHistory() {
  const data = await apiFetch("/packs/history?limit=6");
  state.recentPacks = Array.isArray(data.history) ? data.history : [];
}

async function openPack() {
  if (!isAuthenticated.value) {
    ui.authMode = "login";
    ui.authOpen = true;
    return;
  }

  if (ui.openingPack) return;
  ui.openingPack = true;

  try {
    const data = await apiFetch("/packs/open", { method: "POST" });
    state.collected = data.state?.collected || state.collected;
    state.packsUsedDate = data.state?.packsUsedDate || state.packsUsedDate;
    state.packsUsedToday = Number(
      data.state?.packsUsedToday ?? state.packsUsedToday,
    );
    state.extraPacks = Number(data.state?.extraPacks ?? state.extraPacks);
    state.usedCodes = Array.isArray(data.state?.usedCodes)
      ? data.state.usedCodes
      : state.usedCodes;

    ui.pack = Array.isArray(data.pack) ? data.pack : [];
    ui.wasOwned = Array.isArray(data.wasOwned) ? data.wasOwned : [];
    resetPackOpeningState();
    ui.packOpen = true;

    await loadPackHistory();
  } catch (err) {
    setToast(err.message || "Falha ao abrir pacote");
  } finally {
    ui.openingPack = false;
  }
}

function closePackModal() {
  removePackDragListeners();
  clearPackRevealTimer();
  ui.packOpen = false;
  ui.packStage = "sealed";
  ui.packDragActive = false;
  ui.packDragProgress = 0;
  ui.packDragStartX = 0;
  ui.pack = [];
  ui.wasOwned = [];
}

function resetPackOpeningState() {
  ui.packStage = "sealed";
  ui.packDragActive = false;
  ui.packDragProgress = 0;
  ui.packDragStartX = 0;
  clearPackRevealTimer();
  removePackDragListeners();
}

function clearPackRevealTimer() {
  if (!packRevealTimer) return;
  clearTimeout(packRevealTimer);
  packRevealTimer = null;
}

function removePackDragListeners() {
  window.removeEventListener("pointermove", onPackDragMove);
  window.removeEventListener("pointerup", onPackDragEnd);
  window.removeEventListener("pointercancel", onPackDragEnd);
}

function startPackDrag(event) {
  if (ui.packStage !== "sealed") return;
  event.preventDefault();
  ui.packDragActive = true;
  ui.packDragStartX = event.clientX;

  removePackDragListeners();
  window.addEventListener("pointermove", onPackDragMove);
  window.addEventListener("pointerup", onPackDragEnd);
  window.addEventListener("pointercancel", onPackDragEnd);
}

function onPackDragMove(event) {
  if (!ui.packDragActive || ui.packStage !== "sealed") return;
  const delta = Math.max(0, event.clientX - ui.packDragStartX);
  const progress = Math.min(
    100,
    Math.round((delta / PACK_DRAG_OPEN_DISTANCE) * 100),
  );
  ui.packDragProgress = progress;

  if (progress >= 100) {
    revealPackFromDrag();
  }
}

function onPackDragEnd() {
  if (!ui.packDragActive) return;
  ui.packDragActive = false;
  removePackDragListeners();

  if (ui.packStage === "sealed" && ui.packDragProgress < 100) {
    ui.packDragProgress = 0;
  }
}

function revealPackFromDrag() {
  if (ui.packStage !== "sealed") return;
  ui.packStage = "opening";
  ui.packDragActive = false;
  ui.packDragProgress = 100;
  removePackDragListeners();
  clearPackRevealTimer();

  packRevealTimer = setTimeout(() => {
    ui.packStage = "opened";
    packRevealTimer = null;
  }, 360);
}

async function redeemPromo() {
  if (!isAuthenticated.value) {
    ui.authOpen = true;
    ui.authMode = "login";
    return;
  }

  const code = ui.promoCode.trim().toUpperCase();
  if (!code) {
    ui.promoMsg = "Digite um codigo valido";
    return;
  }

  try {
    const data = await apiFetch("/promo/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });

    state.extraPacks = Number(data.extraPacks || state.extraPacks);
    state.usedCodes = Array.isArray(data.usedCodes)
      ? data.usedCodes
      : state.usedCodes;
    ui.promoMsg = `${data.label}: +${data.packs} pacote(s)`;
    ui.promoCode = "";
    setToast("Codigo aplicado com sucesso");
  } catch (err) {
    ui.promoMsg = err.message || "Codigo invalido";
  }
}

function openAuth(mode) {
  ui.authMode = mode;
  ui.authMsg = "";
  authForm.name = "";
  authForm.email = "";
  authForm.password = "";
  ui.authOpen = true;
}

async function submitAuth() {
  ui.authMsg = "";

  const payload = {
    email: authForm.email.trim(),
    password: authForm.password,
  };

  if (ui.authMode === "register") payload.name = authForm.name.trim();

  try {
    const data = await fetch(`${API_BASE_URL}/auth/${ui.authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Falha na autenticacao");
      return body;
    });

    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    saveAuth();

    ui.authOpen = false;
    await Promise.all([loadAlbumState(), loadPackHistory()]);
    setToast(ui.authMode === "register" ? "Conta criada" : "Login realizado");
  } catch (err) {
    ui.authMsg = err.message || "Erro de autenticacao";
  }
}

async function logout() {
  try {
    if (state.refreshToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: state.refreshToken }),
      });
    }
  } catch {
    // logout local ainda deve ocorrer
  }

  clearAuth();
  ui.authOpen = true;
  ui.authMode = "login";
  setToast("Sessao encerrada");
}

function stickerBorder(item) {
  return {
    borderColor: groupColor(item),
  };
}

function stickerStatus(item) {
  const count = getCount(item.id);
  if (count > 1) return `Repetida (${count}x)`;
  if (count === 1) return "Colada";
  return "Faltando";
}

function packGroupStyle(item) {
  return {
    "--group-color": groupColor(item),
  };
}

function buildImageVariants(basePath) {
  if (!basePath) return [];

  const trimmed = String(basePath).trim();
  if (!trimmed) return [];

  if (/\.(png|jpe?g|webp|svg)$/i.test(trimmed)) {
    const withoutExt = trimmed.replace(/\.(png|jpe?g|webp|svg)$/i, "");
    return [
      trimmed,
      ...TEAM_IMAGE_EXTENSIONS.map((ext) => `${withoutExt}.${ext}`),
    ];
  }

  return TEAM_IMAGE_EXTENSIONS.map((ext) => `${trimmed}.${ext}`);
}

function getTeamImageCandidates(item) {
  const candidates = [];

  if (item?.teamImage) {
    candidates.push(...buildImageVariants(item.teamImage));
  }

  if (item?.teamId) {
    candidates.push(...buildImageVariants(`/teams/${item.teamId}`));
    const shortCode = TEAM_IMAGE_CODES[item.teamId];
    if (shortCode) {
      candidates.push(...buildImageVariants(`/teams/${shortCode}`));
    }
  }

  candidates.push(DEFAULT_TEAM_IMAGE);

  return [...new Set(candidates.filter(Boolean))];
}

function stickerPhotoCandidates(item) {
  if (!item) return [];

  if (item.type === "badge") {
    return getTeamImageCandidates(item);
  }

  if (item.type === "player") {
    const lookupKey = `${String(item.name || "").toLowerCase()}::${item.teamId || ""}`;
    const record = playerImageMap.get(lookupKey);
    return record?.imageUrl
      ? [record.imageUrl, DEFAULT_PLAYER_IMAGE]
      : [DEFAULT_PLAYER_IMAGE];
  }

  return [];
}

function stickerPhoto(item) {
  const key = item?.id || "";
  if (!key) return "";
  if (stickerPhotoCache.has(key)) return stickerPhotoCache.get(key);

  const [photo = ""] = stickerPhotoCandidates(item);
  stickerPhotoCache.set(key, photo);
  return photo;
}

function onStickerPhotoError(event, item) {
  const target = event?.target;
  if (!(target instanceof HTMLImageElement)) return;

  const candidates = stickerPhotoCandidates(item);
  const currentIndex = Number(target.dataset.photoIndex || "0");
  const nextIndex = currentIndex + 1;

  if (nextIndex >= candidates.length) return;

  target.dataset.photoIndex = String(nextIndex);
  target.src = candidates[nextIndex];
}

function selectFlipGroup(groupKey) {
  if (!currentFlipPage.value || groupKey === currentFlipPage.value.key) return;
  const currentIdx = albumPages.value.findIndex(
    (page) => page.key === currentFlipPage.value.key,
  );
  const targetIdx = albumPages.value.findIndex((page) => page.key === groupKey);
  if (targetIdx < 0) return;

  ui.flipDirection = targetIdx >= currentIdx ? "next" : "prev";
  state.flipGroup = groupKey;
}

function goToPreviousFlipPage() {
  if (!currentFlipPage.value) return;
  const idx = albumPages.value.findIndex(
    (page) => page.key === currentFlipPage.value.key,
  );
  if (idx <= 0) return;
  ui.flipDirection = "prev";
  state.flipGroup = albumPages.value[idx - 1].key;
}

function goToNextFlipPage() {
  if (!currentFlipPage.value) return;
  const idx = albumPages.value.findIndex(
    (page) => page.key === currentFlipPage.value.key,
  );
  if (idx < 0 || idx >= albumPages.value.length - 1) return;
  ui.flipDirection = "next";
  state.flipGroup = albumPages.value[idx + 1].key;
}
</script>

<template>
  <div class="layout" :class="progressTheme.key">
    <div class="ambient-orb ambient-orb-a" aria-hidden="true" />
    <div class="ambient-orb ambient-orb-b" aria-hidden="true" />

    <header class="topbar">
      <div class="topbar-brand">
        <p class="eyebrow">World Cup Sticker Album</p>
        <h1>Album Copa 2026</h1>
        <p>EUA, Canada e Mexico · {{ progressTheme.label }}</p>
      </div>
      <div class="top-actions">
        <button class="promo-btn" type="button" @click="ui.promoOpen = true">
          Codigo Promocional
        </button>
        <button
          class="pack-btn"
          type="button"
          :disabled="ui.openingPack || packsAvailable <= 0"
          @click="openPack"
        >
          {{
            ui.openingPack
              ? "Abrindo..."
              : `Abrir Pacotinho (${packsAvailable})`
          }}
        </button>
      </div>
    </header>

    <nav class="tabs">
      <button
        type="button"
        :class="{ active: state.view === 'dashboard' }"
        @click="state.view = 'dashboard'"
      >
        Inicio
      </button>
      <button
        type="button"
        :class="{ active: state.view === 'album' }"
        @click="state.view = 'album'"
      >
        Album
      </button>
      <button
        type="button"
        :class="{ active: state.view === 'missing' }"
        @click="state.view = 'missing'"
      >
        Faltando
      </button>
      <button
        type="button"
        :class="{ active: state.view === 'duplicates' }"
        @click="state.view = 'duplicates'"
      >
        Repetidas
      </button>
      <button
        type="button"
        :class="{ active: state.view === 'flip' }"
        @click="state.view = 'flip'"
      >
        Folhear
      </button>
      <button
        type="button"
        :class="{ active: state.view === 'search' }"
        @click="state.view = 'search'"
      >
        Buscar
      </button>
    </nav>

    <main class="content">
      <section v-if="state.view === 'dashboard'" class="panel">
        <div class="panel-head">
          <h2>Visao Geral</h2>
          <span class="badge-chip">{{ percent }}% completo</span>
        </div>
        <div class="stats">
          <article>
            <strong>{{ total }}</strong>
            <span>Total</span>
          </article>
          <article>
            <strong>{{ collectedCount }}</strong>
            <span>Coladas</span>
          </article>
          <article>
            <strong>{{ missing }}</strong>
            <span>Faltando</span>
          </article>
          <article>
            <strong>{{ duplicates }}</strong>
            <span>Repetidas</span>
          </article>
        </div>
        <div class="progress-wrap">
          <div class="progress-label">Album {{ percent }}% completo</div>
          <div class="progress"><div :style="{ width: `${percent}%` }" /></div>
        </div>
        <div v-if="isAuthenticated" class="history">
          <h3>Historico de pacotinhos</h3>
          <p v-if="state.recentPacks.length === 0">
            Nenhum pacote aberto ainda.
          </p>
          <ul v-else>
            <li v-for="item in state.recentPacks" :key="item.id">
              <span>{{ new Date(item.openedAt).toLocaleString("pt-BR") }}</span>
              <span>{{ item.source === "bonus" ? "Bonus" : "Diario" }}</span>
              <span>{{ item.newCount }} novas</span>
              <span>{{ item.repeatCount }} repetidas</span>
            </li>
          </ul>
        </div>
      </section>

      <section v-if="state.view === 'album'" class="panel">
        <div class="panel-head">
          <h2>Catalogo Completo</h2>
          <span class="badge-chip">{{ filteredAlbum.length }} exibidas</span>
        </div>
        <div class="filters">
          <select v-model="state.filterGroup">
            <option value="all">Todos os grupos</option>
            <option value="especial">Especial</option>
            <option
              v-for="group in Object.keys(GROUP_COLORS).filter(
                (x) => x !== 'especial',
              )"
              :key="group"
              :value="group"
            >
              Grupo {{ group }}
            </option>
          </select>
          <select v-model="state.filterStatus">
            <option value="all">Todos</option>
            <option value="collected">Coladas</option>
            <option value="missing">Faltando</option>
            <option value="duplicate">Repetidas</option>
          </select>
        </div>
        <div class="cards">
          <article
            v-for="item in filteredAlbum"
            :key="item.id"
            class="card album-card"
            :style="stickerBorder(item)"
          >
            <span class="num">#{{ item.num }}</span>
            <div
              v-if="stickerPhoto(item)"
              class="sticker-photo-wrap"
              :style="packGroupStyle(item)"
            >
              <img
                class="sticker-photo"
                :src="stickerPhoto(item)"
                :alt="`Foto de ${item.name}`"
                data-photo-index="0"
                loading="lazy"
                @error="onStickerPhotoError($event, item)"
              />
              <span class="sticker-flag">{{ item.icon }}</span>
            </div>
            <strong>{{ item.name }}</strong>
            <small>{{ groupLabel(item) }}</small>
            <small>{{ stickerStatus(item) }}</small>
          </article>
        </div>
      </section>

      <section v-if="state.view === 'missing'" class="panel">
        <div class="panel-head">
          <h2>Figurinhas Faltando</h2>
          <span class="badge-chip">{{ missingList.length }} itens</span>
        </div>
        <h3>Figurinhas faltando ({{ missingList.length }})</h3>
        <div class="list">
          <article v-for="item in missingList" :key="item.id">
            <span>#{{ item.num }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.teamName || groupLabel(item) }}</small>
          </article>
        </div>
      </section>

      <section v-if="state.view === 'duplicates'" class="panel">
        <div class="panel-head">
          <h2>Figurinhas Repetidas</h2>
          <span class="badge-chip">{{ duplicatesList.length }} itens</span>
        </div>
        <h3>Figurinhas repetidas ({{ duplicatesList.length }})</h3>
        <div class="list">
          <article v-for="item in duplicatesList" :key="item.id">
            <span>#{{ item.num }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ getCount(item.id) }}x</small>
          </article>
        </div>
      </section>

      <section v-if="state.view === 'flip'" class="panel panel-flip">
        <div class="panel-head">
          <h2>Folhear Album</h2>
          <span class="badge-chip">1 folha por grupo</span>
        </div>

        <div class="flip-nav">
          <button
            type="button"
            class="flip-arrow"
            :disabled="
              !currentFlipPage ||
              albumPages.findIndex((p) => p.key === currentFlipPage.key) === 0
            "
            @click="goToPreviousFlipPage"
          >
            ◀
          </button>

          <div class="flip-tabs">
            <button
              v-for="page in albumPages"
              :key="page.key"
              type="button"
              class="flip-tab"
              :class="{
                active: currentFlipPage && currentFlipPage.key === page.key,
              }"
              @click="selectFlipGroup(page.key)"
            >
              {{ page.name }}
            </button>
          </div>

          <button
            type="button"
            class="flip-arrow"
            :disabled="
              !currentFlipPage ||
              albumPages.findIndex((p) => p.key === currentFlipPage.key) ===
                albumPages.length - 1
            "
            @click="goToNextFlipPage"
          >
            ▶
          </button>
        </div>

        <transition :name="`sheet-turn-${ui.flipDirection}`" mode="out-in">
          <article
            v-if="currentFlipPage"
            :key="currentFlipPage.key"
            class="flip-sheet"
            :style="{ '--sheet-color': currentFlipPage.color }"
          >
            <header class="flip-sheet-head">
              <div>
                <h3>{{ currentFlipPage.name }}</h3>
                <p>
                  Coladas: {{ currentFlipPage.collectedItems }} · Pendentes:
                  {{ currentFlipPage.pendingItems }}
                </p>
              </div>
              <span class="badge-chip">{{ currentFlipPage.pct }}%</span>
            </header>

            <div class="flip-sheet-grid">
              <article
                v-for="item in currentFlipPage.stickers"
                :key="item.id"
                class="flip-card"
                :class="{
                  stuck: getCount(item.id) >= 1,
                  pending: getCount(item.id) < 1,
                }"
              >
                <span class="num">#{{ item.num }}</span>
                <div
                  v-if="stickerPhoto(item)"
                  class="sticker-photo-wrap"
                  :style="packGroupStyle(item)"
                >
                  <img
                    class="sticker-photo"
                    :src="stickerPhoto(item)"
                    :alt="`Foto de ${item.name}`"
                    data-photo-index="0"
                    loading="lazy"
                    @error="onStickerPhotoError($event, item)"
                  />
                  <span class="sticker-flag">{{ item.icon }}</span>
                </div>
                <strong>{{ item.name }}</strong>
                <small>
                  {{ getCount(item.id) >= 1 ? "Colada" : "Pendente" }}
                </small>
              </article>
            </div>
          </article>
        </transition>
      </section>

      <section v-if="state.view === 'search'" class="panel">
        <div class="panel-head">
          <h2>Busca de Figurinhas</h2>
          <span class="badge-chip">{{ searchResults.length }} resultados</span>
        </div>
        <input
          class="search-input"
          v-model="state.searchQuery"
          type="search"
          placeholder="Buscar por nome, time ou numero"
        />
        <p v-if="state.searchQuery.trim().length < 2">
          Digite pelo menos 2 caracteres.
        </p>
        <div v-else class="cards">
          <article
            v-for="item in searchResults"
            :key="item.id"
            class="card"
            :style="stickerBorder(item)"
          >
            <span class="num">#{{ item.num }}</span>
            <div
              v-if="stickerPhoto(item)"
              class="sticker-photo-wrap"
              :style="packGroupStyle(item)"
            >
              <img
                class="sticker-photo"
                :src="stickerPhoto(item)"
                :alt="`Foto de ${item.name}`"
                data-photo-index="0"
                loading="lazy"
                @error="onStickerPhotoError($event, item)"
              />
              <span class="sticker-flag">{{ item.icon }}</span>
            </div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.teamName || groupLabel(item) }}</small>
            <small>{{ stickerStatus(item) }}</small>
          </article>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div v-if="isAuthenticated" class="user-row">
        <span class="user-pill">Logado como {{ state.user.name }}</span>
        <button type="button" @click="logout">Sair</button>
      </div>
      <div v-else class="user-row">
        <button type="button" @click="openAuth('login')">Entrar</button>
        <button type="button" @click="openAuth('register')">Cadastrar</button>
      </div>
    </footer>

    <div v-if="ui.packOpen" class="modal">
      <div
        class="modal-box pack-modal-box"
        :class="`pack-stage-${ui.packStage}`"
      >
        <template v-if="ui.packStage !== 'opened'">
          <h2>Pacotinho Lacrado</h2>
          <p class="pack-instruction">
            Arraste o pacotinho para a direita para rasgar e revelar as
            figurinhas.
          </p>

          <div class="pack-opening-zone">
            <div
              class="sticker-pack"
              :class="{ dragging: ui.packDragActive }"
              :style="packDragStyle"
              @pointerdown="startPackDrag"
            >
              <div class="pack-shine" />
              <div class="pack-rip" />
              <span class="pack-brand">FIFA World Cup 2026</span>
              <span class="pack-tear-handle">ARRASTE ➜</span>
            </div>
          </div>

          <div class="pack-progress-track">
            <div
              class="pack-progress-fill"
              :style="{ width: `${ui.packDragProgress}%` }"
            />
          </div>

          <small class="pack-progress-label">
            {{
              ui.packStage === "opening"
                ? "Abrindo pacotinho..."
                : `Rasgo: ${ui.packDragProgress}%`
            }}
          </small>

          <button type="button" @click="closePackModal">Cancelar</button>
        </template>

        <template v-else>
          <div class="pack-reveal-head">
            <h2>Figurinhas Reveladas</h2>
            <p>Confira o resultado deste pacotinho</p>
          </div>

          <div class="pack-summary">
            <span class="pack-summary-chip new">Novas: {{ packNewCount }}</span>
            <span class="pack-summary-chip repeat"
              >Repetidas: {{ packRepeatCount }}</span
            >
          </div>

          <div class="pack-grid pack-grid-revealed">
            <article
              v-for="(item, index) in ui.pack"
              :key="`${item.id}-${index}`"
              class="pack-card reveal-card"
              :class="{ owned: ui.wasOwned[index] }"
              :style="packGroupStyle(item)"
            >
              <div class="pack-card-top">
                <span class="num">#{{ item.num }}</span>
                <span
                  class="pack-result-badge"
                  :class="ui.wasOwned[index] ? 'repeat' : 'new'"
                >
                  {{ ui.wasOwned[index] ? "Repetida" : "Nova" }}
                </span>
              </div>
              <div
                v-if="stickerPhoto(item)"
                class="sticker-photo-wrap"
                :style="packGroupStyle(item)"
              >
                <img
                  class="sticker-photo"
                  :src="stickerPhoto(item)"
                  :alt="`Foto de ${item.name}`"
                  data-photo-index="0"
                  loading="lazy"
                  @error="onStickerPhotoError($event, item)"
                />
                <span class="sticker-flag">{{ item.icon }}</span>
              </div>
              <strong>{{ item.name }}</strong>
              <div class="pack-meta">
                <small class="pack-group-chip">{{ groupLabel(item) }}</small>
                <small v-if="item.teamName" class="pack-team-chip">{{
                  item.teamName
                }}</small>
              </div>
            </article>
          </div>
          <button type="button" @click="closePackModal">Colar no Album</button>
        </template>
      </div>
    </div>

    <div v-if="ui.promoOpen" class="modal" @click.self="ui.promoOpen = false">
      <div class="modal-box">
        <h2>Codigo Promocional</h2>
        <input
          v-model="ui.promoCode"
          type="text"
          placeholder="Ex: COPA2026"
          @input="ui.promoCode = ui.promoCode.toUpperCase()"
        />
        <p>{{ ui.promoMsg }}</p>
        <button type="button" @click="redeemPromo">Resgatar</button>
      </div>
    </div>

    <div v-if="ui.authOpen" class="modal" @click.self="ui.authOpen = false">
      <div class="modal-box">
        <h2>{{ ui.authMode === "register" ? "Criar Conta" : "Entrar" }}</h2>
        <input
          v-if="ui.authMode === 'register'"
          v-model="authForm.name"
          type="text"
          placeholder="Nome"
        />
        <input v-model="authForm.email" type="email" placeholder="Email" />
        <input
          v-model="authForm.password"
          type="password"
          placeholder="Senha"
        />
        <p>{{ ui.authMsg }}</p>
        <button type="button" @click="submitAuth">
          {{ ui.authMode === "register" ? "Criar" : "Entrar" }}
        </button>
        <button
          type="button"
          @click="
            ui.authMode = ui.authMode === 'register' ? 'login' : 'register'
          "
        >
          {{ ui.authMode === "register" ? "Ja tenho conta" : "Criar conta" }}
        </button>
      </div>
    </div>

    <div v-if="ui.toast" class="toast">{{ ui.toast }}</div>
  </div>
</template>
