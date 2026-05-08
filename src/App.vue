<script setup>
import { computed, onBeforeUnmount, onMounted, reactive } from "vue";
import playerImagesData from "../js/player-images.json";

const API_BASE_URL = "http://localhost:3001/api";
const APP_TIMEZONE = "America/Sao_Paulo";
const PACKS_PER_DAY = 1;
const PACK_DRAG_OPEN_DISTANCE = 180;
const DEFAULT_PLAYER_IMAGE = "/player-default.png";
const DEFAULT_TEAM_IMAGE = "/teams/default.png";
const DEFAULT_SPECIAL_IMAGE = "/specials/especial_default.png";
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

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { timeZone: APP_TIMEZONE });
}

function normalizeNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\bjr\b/g, "junior")
    .replace(/\s+/g, " ");
}

function playerImageKey(name, teamId) {
  return `${normalizeNameKey(name)}::${String(teamId || "").toLowerCase()}`;
}

const playerImageMap = new Map(
  playerImageItems
    .filter((item) => item?.found && item?.player && item?.imageUrl)
    .map((item) => [playerImageKey(item.player, item.teamId), item]),
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
  tradeSubView: "available",
  tradeUsers: [],
  tradeAvailable: [],
  tradeFilterUser: "all",
  tradeFilterGroup: "all",
  tradeIncoming: [],
  tradeOutgoing: [],
  tradeHistory: [],
  managedUsers: [],
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
  mobileMenuOpen: false,
  tradeOfferOpen: false,
  tradeTargetEntry: null,
  tradeTargetUser: null,
  tradeOfferSticker: null,
  tradeOfferChoices: [],
  tradeLoading: false,
  tradeOfferChoicesLoading: false,
  tradeUsersLoading: false,
  tradeAvailableLoading: false,
  managePanelLoading: false,
  managePanelMsg: "",
  couponPanelMsg: "",
});

const authForm = reactive({
  name: "",
  email: "",
  password: "",
});

const adminTools = reactive({
  targetUserId: "",
  packs: 1,
  search: "",
  roleFilter: "all",
  statusFilter: "all",
  page: 1,
  pageSize: 8,
  editingUserId: "",
  sortBy: "name",
  sortDir: "asc",
});

const isAuthenticated = computed(() =>
  Boolean(state.user?.id && state.accessToken),
);
const userRole = computed(() => String(state.user?.role || "jogador"));
const isAdmin = computed(() => userRole.value === "admin");
const canManageCoupons = computed(() =>
  ["admin", "professor"].includes(userRole.value),
);
const collectionViews = ["album", "missing", "duplicates", "search", "flip"];
const isCollectionView = computed(() => collectionViews.includes(state.view));
const managedBlockedUsers = computed(
  () => state.managedUsers.filter((u) => u.isBlocked).length,
);
const managedActiveUsers = computed(
  () => state.managedUsers.filter((u) => !u.isBlocked).length,
);
const filteredManagedUsers = computed(() => {
  const query = String(adminTools.search || "")
    .trim()
    .toLowerCase();
  return state.managedUsers.filter((u) => {
    if (adminTools.roleFilter !== "all" && u.role !== adminTools.roleFilter) {
      return false;
    }
    if (adminTools.statusFilter === "active" && u.isBlocked) return false;
    if (adminTools.statusFilter === "blocked" && !u.isBlocked) return false;
    if (!query) return true;
    const name = String(u.name || "").toLowerCase();
    const email = String(u.email || "").toLowerCase();
    return name.includes(query) || email.includes(query);
  });
});
const managedUsersSorted = computed(() => {
  const list = [...filteredManagedUsers.value];
  const dir = adminTools.sortDir === "desc" ? -1 : 1;
  const sortBy = adminTools.sortBy;

  list.sort((a, b) => {
    let aVal = "";
    let bVal = "";

    if (sortBy === "status") {
      aVal = a.isBlocked ? "1" : "0";
      bVal = b.isBlocked ? "1" : "0";
    } else if (sortBy === "role") {
      aVal = String(a.role || "").toLowerCase();
      bVal = String(b.role || "").toLowerCase();
    } else if (sortBy === "email") {
      aVal = String(a.email || "").toLowerCase();
      bVal = String(b.email || "").toLowerCase();
    } else {
      aVal = String(a.name || "").toLowerCase();
      bVal = String(b.name || "").toLowerCase();
    }

    if (aVal < bVal) return -1 * dir;
    if (aVal > bVal) return 1 * dir;
    return 0;
  });

  return list;
});
const managedUsersPageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(
      managedUsersSorted.value.length / Number(adminTools.pageSize || 8),
    ),
  ),
);
const managedUsersSafePage = computed(() =>
  Math.min(
    Math.max(1, Number(adminTools.page || 1)),
    managedUsersPageCount.value,
  ),
);
const managedUsersPaged = computed(() => {
  const pageSize = Number(adminTools.pageSize || 8);
  const start = (managedUsersSafePage.value - 1) * pageSize;
  return managedUsersSorted.value.slice(start, start + pageSize);
});
const managedUsersPageFrom = computed(() => {
  if (!managedUsersSorted.value.length) return 0;
  return (
    (managedUsersSafePage.value - 1) * Number(adminTools.pageSize || 8) + 1
  );
});
const managedUsersPageTo = computed(() =>
  Math.min(
    managedUsersSafePage.value * Number(adminTools.pageSize || 8),
    managedUsersSorted.value.length,
  ),
);
const editingManagedUser = computed(() => {
  const id = Number(adminTools.editingUserId || 0);
  if (!id) return null;
  return state.managedUsers.find((u) => Number(u.id) === id) || null;
});
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
        selections: new Map(),
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

      // Agrupar stickers por seleção (time)
      const selectionsMap = new Map();
      for (const sticker of orderedStickers) {
        const selectionKey = sticker.teamId || "outros";
        if (!selectionsMap.has(selectionKey)) {
          selectionsMap.set(selectionKey, {
            teamId: selectionKey,
            teamName: sticker.teamName || "Outros",
            stickers: [],
          });
        }
        selectionsMap.get(selectionKey).stickers.push(sticker);
      }

      const selections = [...selectionsMap.values()].map((sel) => {
        const collectedItems = sel.stickers.filter(
          (s) => getCount(s.id) >= 1,
        ).length;
        const pendingItems = sel.stickers.length - collectedItems;
        const pct = sel.stickers.length
          ? Math.round((collectedItems / sel.stickers.length) * 100)
          : 0;
        return {
          ...sel,
          collectedItems,
          pendingItems,
          pct,
        };
      });

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
        selections,
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
  state.managedUsers = [];
  adminTools.targetUserId = "";
  adminTools.packs = 1;
  adminTools.search = "";
  adminTools.roleFilter = "all";
  adminTools.statusFilter = "all";
  adminTools.page = 1;
  adminTools.editingUserId = "";
  ui.managePanelMsg = "";
  ui.couponPanelMsg = "";
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
    await loadManagedUsers();
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
    await loadManagedUsers();
  } catch (_err) {
    clearAuth();
  } finally {
    ui.loading = false;
  }
}

async function loadManagedUsers() {
  if (!isAuthenticated.value || !canManageCoupons.value) {
    state.managedUsers = [];
    return;
  }

  ui.managePanelLoading = true;
  ui.managePanelMsg = "";
  try {
    const path = isAdmin.value ? "/admin/users" : "/coupons/targets";
    const data = await apiFetch(path);
    const users = Array.isArray(data.users) ? data.users : [];
    state.managedUsers = users
      .filter((u) => Number(u.id) !== Number(state.user?.id))
      .map((u) => ({
        ...u,
        isBlocked: Boolean(u.isBlocked),
        draftRole: String(u.role || "jogador"),
        draftBlocked: Boolean(u.isBlocked),
        draftBlockedReason: String(u.blockedReason || ""),
        newPassword: "",
      }));

    if (!adminTools.targetUserId && state.managedUsers.length > 0) {
      const firstAvailable = state.managedUsers.find((u) => !u.isBlocked);
      adminTools.targetUserId = String(
        (firstAvailable || state.managedUsers[0]).id,
      );
    }

    if (
      adminTools.editingUserId &&
      !state.managedUsers.some(
        (u) => Number(u.id) === Number(adminTools.editingUserId),
      )
    ) {
      adminTools.editingUserId = "";
    }

    adminTools.page = 1;
  } catch (err) {
    ui.managePanelMsg = err.message || "Erro ao carregar usuarios";
  } finally {
    ui.managePanelLoading = false;
  }
}

function openManagedUserEditor(user) {
  const id = Number(user?.id || 0);
  adminTools.editingUserId = id ? String(id) : "";
}

function setManagedUsersPage(nextPage) {
  const n = Number(nextPage || 1);
  adminTools.page = Math.min(
    Math.max(1, n),
    Math.max(1, managedUsersPageCount.value),
  );
}

function setManagedUsersPageSize(nextSize) {
  const n = Number(nextSize || 8);
  adminTools.pageSize = [5, 8, 10, 20].includes(n) ? n : 8;
  adminTools.page = 1;
}

function setManagedUsersSort(sortBy) {
  const allowed = ["name", "email", "role", "status"];
  if (!allowed.includes(sortBy)) return;
  if (adminTools.sortBy === sortBy) {
    adminTools.sortDir = adminTools.sortDir === "asc" ? "desc" : "asc";
  } else {
    adminTools.sortBy = sortBy;
    adminTools.sortDir = "asc";
  }
  adminTools.page = 1;
}

function openCollectionView(view) {
  if (!collectionViews.includes(view)) return;
  state.view = view;
  ui.mobileMenuOpen = false;
}

async function generateManagedCoupon() {
  if (!canManageCoupons.value) return;
  ui.couponPanelMsg = "";

  const targetUserId = Number(adminTools.targetUserId || 0);
  if (!targetUserId) {
    ui.couponPanelMsg = "Selecione um usuário.";
    return;
  }

  const payload = { targetUserId };
  if (isAdmin.value) {
    payload.packs = Math.max(1, Number(adminTools.packs || 1));
  }

  try {
    const data = await apiFetch("/coupons/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const coupon = data.coupon || {};
    ui.couponPanelMsg = `Cupom ${coupon.code} gerado para ${
      coupon.targetUserName || "usuário"
    } (${coupon.packs || 1} pacote).`;
  } catch (err) {
    ui.couponPanelMsg = err.message || "Erro ao gerar cupom";
  }
}

async function saveManagedUser(user) {
  if (!isAdmin.value || !user?.id) return;
  ui.managePanelMsg = "";
  try {
    const payload = {
      role: user.draftRole,
      isBlocked: Boolean(user.draftBlocked),
      blockedReason: user.draftBlocked ? user.draftBlockedReason : "",
    };
    const data = await apiFetch(`/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const updated = data.user || {};
    user.role = updated.role;
    user.isBlocked = Boolean(updated.isBlocked);
    user.blockedReason = updated.blockedReason || "";
    user.draftRole = user.role;
    user.draftBlocked = user.isBlocked;
    user.draftBlockedReason = user.blockedReason;
    ui.managePanelMsg = `Usuário ${user.name} atualizado.`;
  } catch (err) {
    ui.managePanelMsg = err.message || "Erro ao atualizar usuário";
  }
}

async function changeManagedUserPassword(user) {
  if (!isAdmin.value || !user?.id) return;
  const password = String(user.newPassword || "");
  if (password.length < 6) {
    ui.managePanelMsg = "Nova senha deve ter ao menos 6 caracteres.";
    return;
  }
  try {
    await apiFetch(`/admin/users/${user.id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    });
    user.newPassword = "";
    ui.managePanelMsg = `Senha do usuário ${user.name} alterada.`;
  } catch (err) {
    ui.managePanelMsg = err.message || "Erro ao alterar senha";
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

function openPack() {
  if (!isAuthenticated.value) {
    ui.authMode = "login";
    ui.authOpen = true;
    return;
  }

  if (ui.openingPack || ui.packOpen) return;

  resetPackOpeningState();
  ui.pack = [];
  ui.wasOwned = [];
  ui.packOpen = true;
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
  ui.openingPack = true;
  removePackDragListeners();
  clearPackRevealTimer();

  apiFetch("/packs/open", { method: "POST" })
    .then((data) => {
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
      return loadPackHistory();
    })
    .catch((err) => {
      setToast(err.message || "Falha ao abrir pacote");
      closePackModal();
    })
    .finally(() => {
      ui.openingPack = false;
    });

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
    await loadManagedUsers();
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

  setToast("Sessao encerrada");
  clearAuth();
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

function normalizePublicAssetPath(path) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (value.startsWith("public/")) return `/${value.slice(7)}`;
  if (value.startsWith("/public/")) return value.slice(7);
  return value;
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

  if (item.section === "especial") {
    const specialImage = normalizePublicAssetPath(item.image);
    return specialImage
      ? [specialImage, DEFAULT_SPECIAL_IMAGE]
      : [DEFAULT_SPECIAL_IMAGE];
  }

  if (item.type === "badge") {
    return getTeamImageCandidates(item);
  }

  if (item.type === "player") {
    const lookupKey = playerImageKey(item.name, item.teamId);
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

function getStickerPhotoForDisplay(item) {
  const isCollected = getCount(item.id) >= 1;
  if (!isCollected) {
    if (item.section === "especial") {
      return DEFAULT_SPECIAL_IMAGE;
    }
    if (item.type === "player") {
      return DEFAULT_PLAYER_IMAGE;
    } else if (item.type === "badge") {
      return DEFAULT_TEAM_IMAGE;
    }
    return "";
  }
  return stickerPhoto(item);
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

function openAdminPanelView() {
  state.view = "admin";
  ui.mobileMenuOpen = false;
  if (canManageCoupons.value) {
    loadManagedUsers();
  }
}

// ─── Trade functions ─────────────────────────────────────────────────────────

async function loadTradeUsers() {
  ui.tradeUsersLoading = true;
  try {
    const data = await apiFetch("/trade/users");
    state.tradeUsers = Array.isArray(data.users) ? data.users : [];
  } catch (err) {
    setToast(err.message || "Erro ao carregar usuarios");
  } finally {
    ui.tradeUsersLoading = false;
  }
}

async function loadTradeOffers() {
  ui.tradeLoading = true;
  try {
    const data = await apiFetch("/trade/offers");
    state.tradeIncoming = Array.isArray(data.incoming) ? data.incoming : [];
    state.tradeOutgoing = Array.isArray(data.outgoing) ? data.outgoing : [];
  } catch (err) {
    setToast(err.message || "Erro ao carregar ofertas");
  } finally {
    ui.tradeLoading = false;
  }
}

async function loadTradeAvailable() {
  ui.tradeAvailableLoading = true;
  try {
    const data = await apiFetch("/trade/available");
    state.tradeAvailable = Array.isArray(data.available) ? data.available : [];
  } catch (err) {
    setToast(err.message || "Erro ao carregar figurinhas disponíveis");
  } finally {
    ui.tradeAvailableLoading = false;
  }
}

async function loadTradeHistory() {
  ui.tradeLoading = true;
  try {
    const data = await apiFetch("/trade/history");
    state.tradeHistory = Array.isArray(data.history) ? data.history : [];
  } catch (err) {
    setToast(err.message || "Erro ao carregar histórico");
  } finally {
    ui.tradeLoading = false;
  }
}

async function loadTradeOfferChoices(userId) {
  if (!userId) {
    ui.tradeOfferChoices = [];
    return;
  }

  ui.tradeOfferChoicesLoading = true;
  try {
    const data = await apiFetch(`/trade/users/${userId}/wanted-from-me`);
    ui.tradeOfferChoices = Array.isArray(data.stickers) ? data.stickers : [];
  } catch (err) {
    ui.tradeOfferChoices = [];
    setToast(err.message || "Erro ao carregar opções para oferta");
  } finally {
    ui.tradeOfferChoicesLoading = false;
  }
}

async function selectTradeTargetUser(user) {
  ui.tradeTargetUser = user;
  ui.tradeOfferSticker = null;
  await loadTradeOfferChoices(user?.userId);
}

function openTradeOffer(entry) {
  ui.tradeTargetEntry = entry;
  ui.tradeTargetUser = entry.offeredBy.length === 1 ? entry.offeredBy[0] : null;
  ui.tradeOfferSticker = null;
  ui.tradeOfferChoices = [];
  ui.tradeOfferOpen = true;
  if (ui.tradeTargetUser?.userId) {
    loadTradeOfferChoices(ui.tradeTargetUser.userId);
  }
}

function closeTradeOffer() {
  ui.tradeOfferOpen = false;
  ui.tradeTargetEntry = null;
  ui.tradeTargetUser = null;
  ui.tradeOfferSticker = null;
  ui.tradeOfferChoices = [];
}

async function confirmTradeOffer() {
  if (!ui.tradeTargetEntry || !ui.tradeTargetUser || !ui.tradeOfferSticker)
    return;
  ui.tradeLoading = true;
  try {
    await apiFetch("/trade/offers", {
      method: "POST",
      body: JSON.stringify({
        toUserId: ui.tradeTargetUser.userId,
        offeredStickerId: ui.tradeOfferSticker.id,
        requestedStickerId: ui.tradeTargetEntry.sticker.id,
      }),
    });
    closeTradeOffer();
    setToast("Proposta de troca enviada!");
    await Promise.all([loadTradeOffers(), loadTradeAvailable()]);
    state.tradeSubView = "outgoing";
  } catch (err) {
    setToast(err.message || "Erro ao enviar proposta");
  } finally {
    ui.tradeLoading = false;
  }
}

async function acceptTradeOffer(offer) {
  ui.tradeLoading = true;
  try {
    const data = await apiFetch(`/trade/offers/${offer.id}/accept`, {
      method: "POST",
    });
    if (data.state) {
      state.collected = data.state.collected || state.collected;
      state.packsUsedDate = data.state.packsUsedDate || state.packsUsedDate;
      state.packsUsedToday = Number(
        data.state.packsUsedToday ?? state.packsUsedToday,
      );
      state.extraPacks = Number(data.state.extraPacks ?? state.extraPacks);
      state.usedCodes = Array.isArray(data.state.usedCodes)
        ? data.state.usedCodes
        : state.usedCodes;
    }
    setToast("Troca realizada com sucesso!");
    await loadTradeOffers();
  } catch (err) {
    setToast(err.message || "Erro ao aceitar troca");
    await loadTradeOffers();
  } finally {
    ui.tradeLoading = false;
  }
}

async function rejectTradeOffer(offer) {
  ui.tradeLoading = true;
  try {
    await apiFetch(`/trade/offers/${offer.id}/reject`, { method: "POST" });
    setToast("Oferta recusada");
    await loadTradeOffers();
  } catch (err) {
    setToast(err.message || "Erro ao recusar oferta");
  } finally {
    ui.tradeLoading = false;
  }
}

async function cancelTradeOffer(offer) {
  ui.tradeLoading = true;
  try {
    await apiFetch(`/trade/offers/${offer.id}/reject`, { method: "POST" });
    setToast("Proposta cancelada");
    await loadTradeOffers();
  } catch (err) {
    setToast(err.message || "Erro ao cancelar proposta");
  } finally {
    ui.tradeLoading = false;
  }
}

async function openTradeView() {
  state.view = "trade";
  state.tradeSubView = "available";
  ui.mobileMenuOpen = false;
  if (isAuthenticated.value) {
    await Promise.all([
      loadTradeAvailable(),
      loadTradeUsers(),
      loadTradeOffers(),
    ]);
  }
}

const myDuplicatesForOffer = computed(() =>
  stickers.filter((item) => getCount(item.id) > 1),
);

const tradeIncomingCount = computed(() => state.tradeIncoming.length);

const filteredTradeAvailable = computed(() => {
  let list = state.tradeAvailable;
  if (state.tradeFilterUser !== "all") {
    const uid = Number(state.tradeFilterUser);
    list = list.filter((entry) =>
      entry.offeredBy.some((u) => u.userId === uid),
    );
  }
  if (state.tradeFilterGroup !== "all") {
    list = list.filter((entry) => {
      if (state.tradeFilterGroup === "especial")
        return entry.sticker.section === "especial";
      return entry.sticker.groupId === state.tradeFilterGroup;
    });
  }
  return list;
});
</script>

<template>
  <!-- ── Unauthenticated: Landing / Auth page ── -->
  <div v-if="!isAuthenticated" class="auth-root">
    <!-- Landing page -->
    <div v-if="!ui.authOpen" class="landing">
      <div class="landing-hero">
        <div class="landing-hero-inner">
          <div class="landing-tournament">
            <span class="landing-event-label">FIFA World Cup 2026™</span>
            <span class="landing-flags">🇺🇸 🇨🇦 🇲🇽</span>
          </div>
          <h1 class="landing-title">Album de Figurinhas</h1>
          <p class="landing-subtitle">
            Colecione, complete e troque figurinhas com outros fãs da Copa do
            Mundo 2026. Abra pacotinhos diários e construa seu álbum!
          </p>
          <div class="landing-actions">
            <button
              type="button"
              class="landing-btn-primary"
              @click="openAuth('login')"
            >
              Entrar na Conta
            </button>
            <button
              type="button"
              class="landing-btn-secondary"
              @click="openAuth('register')"
            >
              Criar Conta Grátis
            </button>
          </div>
        </div>
      </div>
      <div class="landing-features">
        <div class="landing-feature">
          <span class="landing-feature-icon">📒</span>
          <strong>Colecione</strong>
          <p>
            Abra pacotinhos diários e colecione {{ total }} figurinhas únicas
            das 48 seleções
          </p>
        </div>
        <div class="landing-feature">
          <span class="landing-feature-icon">🔄</span>
          <strong>Troque</strong>
          <p>
            Negocie figurinhas repetidas com outros colecionadores da plataforma
          </p>
        </div>
        <div class="landing-feature">
          <span class="landing-feature-icon">📊</span>
          <strong>Acompanhe</strong>
          <p>
            Monitore seu progresso e descubra o que falta para completar o álbum
          </p>
        </div>
      </div>
      <footer class="landing-footer">
        <p>
          Album Copa 2026 · {{ total }} figurinhas · EUA, Canadá e México · FIFA
          World Cup 2026™
        </p>
        <p>
          Projeto educacional desenvolvido pela
          <a
            href="https://fabrica.videira.ifc.edu.br"
            target="_blank"
            rel="noreferrer"
          >
            Fábrica de Software - IFC Videira
          </a>
        </p>
      </footer>
    </div>

    <!-- Auth form page -->
    <div v-else class="auth-page">
      <div class="auth-page-inner">
        <div class="auth-page-brand">
          <span class="auth-brand-flags">🇺🇸 🇨🇦 🇲🇽</span>
          <h1>Album Copa 2026</h1>
          <p>FIFA World Cup 2026™</p>
        </div>
        <div class="auth-card">
          <div class="auth-card-tabs">
            <button
              type="button"
              class="auth-tab"
              :class="{ active: ui.authMode === 'login' }"
              @click="
                ui.authMode = 'login';
                ui.authMsg = '';
              "
            >
              Entrar
            </button>
            <button
              type="button"
              class="auth-tab"
              :class="{ active: ui.authMode === 'register' }"
              @click="
                ui.authMode = 'register';
                ui.authMsg = '';
              "
            >
              Criar Conta
            </button>
          </div>
          <form class="auth-form" @submit.prevent="submitAuth">
            <div v-if="ui.authMode === 'register'" class="auth-field">
              <label for="auth-name">Nome</label>
              <input
                id="auth-name"
                v-model="authForm.name"
                type="text"
                placeholder="Seu nome completo"
                autocomplete="name"
                required
              />
            </div>
            <div class="auth-field">
              <label for="auth-email">Email</label>
              <input
                id="auth-email"
                v-model="authForm.email"
                type="email"
                placeholder="seu@email.com"
                autocomplete="email"
                required
              />
            </div>
            <div class="auth-field">
              <label for="auth-password">Senha</label>
              <input
                id="auth-password"
                v-model="authForm.password"
                type="password"
                placeholder="••••••••"
                :autocomplete="
                  ui.authMode === 'register'
                    ? 'new-password'
                    : 'current-password'
                "
                required
              />
            </div>
            <p v-if="ui.authMsg" class="auth-error">{{ ui.authMsg }}</p>
            <button type="submit" class="auth-submit-btn">
              {{ ui.authMode === "register" ? "Criar Conta" : "Entrar" }}
            </button>
          </form>
          <div class="auth-card-footer">
            <button
              type="button"
              class="auth-back-link"
              @click="
                ui.authOpen = false;
                ui.authMsg = '';
              "
            >
              ← Voltar ao início
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Authenticated app ── -->
  <div v-else class="layout" :class="progressTheme.key">
    <div class="ambient-orb ambient-orb-a" aria-hidden="true" />
    <div class="ambient-orb ambient-orb-b" aria-hidden="true" />

    <header class="topbar">
      <div class="topbar-brand">
        <p class="eyebrow">World Cup Sticker Album</p>
        <h1>Album Copa 2026</h1>
        <small class="eyebrow">EUA, Canadá e México</small>
      </div>
      <button
        class="topbar-menu-toggle"
        type="button"
        aria-label="Toggle menu"
        :class="{ open: ui.mobileMenuOpen }"
        @click="ui.mobileMenuOpen = !ui.mobileMenuOpen"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="topbar-actions" :class="{ open: ui.mobileMenuOpen }">
        <button
          class="promo-btn"
          type="button"
          @click="
            ui.promoOpen = true;
            ui.mobileMenuOpen = false;
          "
        >
          Resgatar Código
        </button>
        <button
          class="pack-btn"
          type="button"
          :disabled="ui.openingPack || packsAvailable <= 0"
          @click="
            openPack();
            ui.mobileMenuOpen = false;
          "
        >
          {{
            ui.openingPack
              ? "Abrindo..."
              : `Abrir Pacotinho (${packsAvailable})`
          }}
        </button>
      </div>
    </header>

    <nav class="tabs" :class="{ open: ui.mobileMenuOpen }">
      <button
        type="button"
        :class="{ active: state.view === 'dashboard' }"
        @click="
          state.view = 'dashboard';
          ui.mobileMenuOpen = false;
        "
      >
        Inicio
      </button>
      <button
        type="button"
        :class="{ active: isCollectionView }"
        @click="openCollectionView('flip')"
      >
        Album & Folhear
      </button>
      <button
        type="button"
        :class="{ active: state.view === 'trade' }"
        class="tab-trade"
        @click="openTradeView"
      >
        Trocar
        <span v-if="tradeIncomingCount > 0" class="tab-badge">{{
          tradeIncomingCount
        }}</span>
      </button>
      <button
        v-if="canManageCoupons"
        type="button"
        :class="{ active: state.view === 'admin' }"
        class="tab-admin"
        @click="openAdminPanelView"
      >
        Administração
      </button>
    </nav>

    <main class="content">
      <div v-if="isCollectionView" class="collection-tabs-wrap">
        <div class="collection-tabs">
          <button
            type="button"
            :class="{ active: state.view === 'flip' }"
            @click="openCollectionView('flip')"
          >
            Folhear
          </button>
          <button
            type="button"
            :class="{ active: state.view === 'album' }"
            @click="openCollectionView('album')"
          >
            Catálogo
          </button>
          <button
            type="button"
            :class="{ active: state.view === 'missing' }"
            @click="openCollectionView('missing')"
          >
            Faltando
          </button>
          <button
            type="button"
            :class="{ active: state.view === 'duplicates' }"
            @click="openCollectionView('duplicates')"
          >
            Repetidas
          </button>
          <button
            type="button"
            :class="{ active: state.view === 'search' }"
            @click="openCollectionView('search')"
          >
            Buscar
          </button>
        </div>
      </div>

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
              <span>{{ formatDateTime(item.openedAt) }}</span>
              <span>{{ item.source === "bonus" ? "Bonus" : "Diario" }}</span>
              <span>{{ item.newCount }} novas</span>
              <span>{{ item.repeatCount }} repetidas</span>
            </li>
          </ul>
        </div>
      </section>

      <section
        v-if="state.view === 'admin' && canManageCoupons"
        class="panel panel-admin"
      >
        <div class="admin-hero">
          <div>
            <p class="admin-kicker">
              {{ isAdmin ? "Controle total" : "Gestão de turma" }}
            </p>
            <h2>Painel de Administração</h2>
            <p class="admin-subtitle">
              Gere cupons, acompanhe usuários e mantenha o ambiente organizado.
            </p>
          </div>
          <button
            type="button"
            class="admin-refresh-btn"
            @click="loadManagedUsers"
          >
            Atualizar dados
          </button>
        </div>

        <div class="admin-stats-grid">
          <article>
            <small>Gerenciáveis</small>
            <strong>{{ state.managedUsers.length }}</strong>
          </article>
          <article>
            <small>Ativos</small>
            <strong>{{ managedActiveUsers }}</strong>
          </article>
          <article>
            <small>Bloqueados</small>
            <strong>{{ managedBlockedUsers }}</strong>
          </article>
          <article>
            <small>Seu perfil</small>
            <strong>{{ userRole }}</strong>
          </article>
        </div>

        <div class="manage-panel admin-panel-shell">
          <p v-if="ui.managePanelLoading" class="read-only-hint">
            Carregando usuários...
          </p>
          <p v-if="ui.managePanelMsg" class="read-only-hint">
            {{ ui.managePanelMsg }}
          </p>

          <div class="manage-coupon-box">
            <h4>Gerar cupom para pacote</h4>
            <div class="manage-coupon-form">
              <select v-model="adminTools.targetUserId">
                <option value="">Selecione um usuário</option>
                <option
                  v-for="u in state.managedUsers.filter((x) => !x.isBlocked)"
                  :key="u.id"
                  :value="String(u.id)"
                >
                  {{ u.name }} ({{ u.role }})
                </option>
              </select>
              <input
                v-if="isAdmin"
                v-model.number="adminTools.packs"
                type="number"
                min="1"
                max="20"
                placeholder="Pacotes"
              />
              <button type="button" @click="generateManagedCoupon">
                Gerar Cupom
              </button>
            </div>
            <p v-if="ui.couponPanelMsg" class="read-only-hint">
              {{ ui.couponPanelMsg }}
            </p>
          </div>

          <div v-if="isAdmin" class="manage-users-box">
            <h4>Gerenciar usuários</h4>
            <div class="manage-users-toolbar">
              <input
                v-model.trim="adminTools.search"
                type="search"
                placeholder="Buscar por nome ou email"
                @input="setManagedUsersPage(1)"
              />
              <select
                v-model="adminTools.roleFilter"
                @change="setManagedUsersPage(1)"
              >
                <option value="all">Todos os perfis</option>
                <option value="admin">admin</option>
                <option value="professor">professor</option>
                <option value="jogador">jogador</option>
              </select>
              <select
                v-model="adminTools.statusFilter"
                @change="setManagedUsersPage(1)"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="blocked">Bloqueados</option>
              </select>
            </div>

            <div class="admin-users-table-wrap">
              <table class="admin-users-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        type="button"
                        @click="setManagedUsersSort('name')"
                      >
                        Usuário
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        @click="setManagedUsersSort('role')"
                      >
                        Perfil
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        @click="setManagedUsersSort('status')"
                      >
                        Status
                      </button>
                    </th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="managedUsersPaged.length === 0">
                    <td colspan="4">Nenhum usuário encontrado.</td>
                  </tr>
                  <tr
                    v-for="u in managedUsersPaged"
                    :key="u.id"
                    :class="{
                      selected:
                        Number(adminTools.editingUserId) === Number(u.id),
                    }"
                  >
                    <td>
                      <strong>{{ u.name }}</strong>
                      <small>{{ u.email }}</small>
                    </td>
                    <td>
                      <span class="table-pill">{{ u.role }}</span>
                    </td>
                    <td>
                      <span
                        class="table-pill"
                        :class="u.isBlocked ? 'blocked' : 'active'"
                      >
                        {{ u.isBlocked ? "bloqueado" : "ativo" }}
                      </span>
                    </td>
                    <td>
                      <button type="button" @click="openManagedUserEditor(u)">
                        Editar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="admin-pagination">
              <div>
                <small>
                  Exibindo {{ managedUsersPageFrom }}-{{ managedUsersPageTo }}
                  de
                  {{ managedUsersSorted.length }}
                </small>
                <label class="page-size-label">
                  Itens por página
                  <select
                    :value="adminTools.pageSize"
                    @change="setManagedUsersPageSize($event.target.value)"
                  >
                    <option :value="5">5</option>
                    <option :value="8">8</option>
                    <option :value="10">10</option>
                    <option :value="20">20</option>
                  </select>
                </label>
              </div>
              <div class="admin-pagination-actions">
                <button
                  type="button"
                  :disabled="managedUsersSafePage <= 1"
                  @click="setManagedUsersPage(managedUsersSafePage - 1)"
                >
                  Anterior
                </button>
                <span>
                  Página {{ managedUsersSafePage }} de
                  {{ managedUsersPageCount }}
                </span>
                <button
                  type="button"
                  :disabled="managedUsersSafePage >= managedUsersPageCount"
                  @click="setManagedUsersPage(managedUsersSafePage + 1)"
                >
                  Próxima
                </button>
              </div>
            </div>

            <article v-if="editingManagedUser" class="manage-user-card">
              <header>
                <strong>{{ editingManagedUser.name }}</strong>
                <small>{{ editingManagedUser.email }}</small>
              </header>
              <div class="manage-user-grid">
                <label>
                  Perfil
                  <select v-model="editingManagedUser.draftRole">
                    <option value="admin">admin</option>
                    <option value="professor">professor</option>
                    <option value="jogador">jogador</option>
                  </select>
                </label>
                <label class="manage-user-check">
                  <input
                    v-model="editingManagedUser.draftBlocked"
                    type="checkbox"
                  />
                  Bloquear acesso
                </label>
              </div>
              <input
                v-if="editingManagedUser.draftBlocked"
                v-model="editingManagedUser.draftBlockedReason"
                type="text"
                placeholder="Motivo do bloqueio"
              />
              <div class="manage-user-actions">
                <button
                  type="button"
                  @click="saveManagedUser(editingManagedUser)"
                >
                  Salvar perfil
                </button>
              </div>
              <div class="manage-user-password">
                <input
                  v-model="editingManagedUser.newPassword"
                  type="password"
                  placeholder="Nova senha (min. 6)"
                />
                <button
                  type="button"
                  @click="changeManagedUserPassword(editingManagedUser)"
                >
                  Alterar senha
                </button>
              </div>
            </article>
          </div>
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
              v-if="getStickerPhotoForDisplay(item)"
              class="sticker-photo-wrap"
              :style="packGroupStyle(item)"
            >
              <img
                class="sticker-photo"
                :src="getStickerPhotoForDisplay(item)"
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

            <div
              v-for="selection in currentFlipPage.selections"
              :key="selection.teamId"
              class="flip-selection"
            >
              <div class="flip-selection-header">
                <h4>{{ selection.teamName }}</h4>
                <span class="selection-stat"
                  >{{ selection.collectedItems }}/{{
                    selection.stickers.length
                  }}</span
                >
              </div>
              <div class="flip-sheet-grid">
                <article
                  v-for="item in selection.stickers"
                  :key="item.id"
                  class="flip-card"
                  :class="{
                    stuck: getCount(item.id) >= 1,
                    pending: getCount(item.id) < 1,
                  }"
                >
                  <span class="num">#{{ item.num }}</span>
                  <div
                    v-if="getStickerPhotoForDisplay(item)"
                    class="sticker-photo-wrap"
                    :style="packGroupStyle(item)"
                  >
                    <img
                      class="sticker-photo"
                      :src="getStickerPhotoForDisplay(item)"
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

    <!-- ─── Trade view ──────────────────────────────────────────────────── -->
    <section v-if="state.view === 'trade'" class="panel">
      <div class="panel-head">
        <h2>Trocar Figurinhas</h2>
        <span class="badge-chip"
          >{{ myDuplicatesForOffer.length }} repetidas suas</span
        >
      </div>

      <div v-if="!isAuthenticated" class="trade-login-prompt">
        <p>Faça login para trocar figurinhas com outros colecionadores.</p>
        <button type="button" @click="openAuth('login')">Entrar</button>
      </div>

      <template v-else>
        <div class="trade-tabs">
          <button
            type="button"
            :class="{ active: state.tradeSubView === 'available' }"
            @click="state.tradeSubView = 'available'"
          >
            Disponíveis
          </button>
          <button
            type="button"
            :class="{ active: state.tradeSubView === 'incoming' }"
            @click="
              state.tradeSubView = 'incoming';
              loadTradeOffers();
            "
          >
            Recebidas
            <span
              v-if="tradeIncomingCount > 0"
              class="tab-badge inline-badge"
              >{{ tradeIncomingCount }}</span
            >
          </button>
          <button
            type="button"
            :class="{ active: state.tradeSubView === 'outgoing' }"
            @click="
              state.tradeSubView = 'outgoing';
              loadTradeOffers();
            "
          >
            Enviadas
          </button>
          <button
            type="button"
            :class="{ active: state.tradeSubView === 'history' }"
            @click="
              state.tradeSubView = 'history';
              loadTradeHistory();
            "
          >
            Histórico
          </button>
        </div>

        <!-- Available stickers -->
        <div v-if="state.tradeSubView === 'available'">
          <div class="trade-filters">
            <select v-model="state.tradeFilterUser">
              <option value="all">Todos os usuários</option>
              <option
                v-for="user in state.tradeUsers"
                :key="user.id"
                :value="String(user.id)"
              >
                {{ user.name }}
              </option>
            </select>
            <select v-model="state.tradeFilterGroup">
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
          </div>
          <p v-if="ui.tradeAvailableLoading" class="trade-hint">
            Carregando...
          </p>
          <p v-else-if="filteredTradeAvailable.length === 0" class="trade-hint">
            Nenhuma figurinha disponível com os filtros selecionados.
          </p>
          <div v-else class="trade-available-list">
            <article
              v-for="entry in filteredTradeAvailable"
              :key="entry.sticker.id"
              class="trade-available-row"
              :style="{
                borderLeftColor: stickerBorder(entry.sticker).backgroundColor,
              }"
            >
              <div class="trade-row-main">
                <span class="trade-row-num">#{{ entry.sticker.num }}</span>
                <div class="trade-row-info">
                  <strong>{{ entry.sticker.name }}</strong>
                  <small>{{ groupLabel(entry.sticker) }}</small>
                </div>
              </div>
              <div class="trade-row-offered">
                <span
                  v-for="u in entry.offeredBy"
                  :key="u.userId"
                  class="trade-user-chip"
                  >{{ u.userName }}</span
                >
              </div>
              <button
                type="button"
                class="trade-request-btn"
                :disabled="myDuplicatesForOffer.length === 0"
                @click="openTradeOffer(entry)"
              >
                {{
                  myDuplicatesForOffer.length === 0
                    ? "Sem repetidas"
                    : "Pedir troca"
                }}
              </button>
            </article>
          </div>
        </div>

        <!-- Incoming offers -->
        <div v-if="state.tradeSubView === 'incoming'">
          <p v-if="ui.tradeLoading" class="trade-hint">Carregando...</p>
          <p v-else-if="state.tradeIncoming.length === 0" class="trade-hint">
            Nenhuma proposta de troca recebida.
          </p>
          <div v-else class="trade-offer-list">
            <article
              v-for="offer in state.tradeIncoming"
              :key="offer.id"
              class="trade-offer-card"
            >
              <div class="trade-offer-header">
                <strong>{{ offer.fromUserName }}</strong>
                <small>{{ formatDateTime(offer.createdAt) }}</small>
              </div>
              <div class="trade-offer-stickers">
                <div class="trade-offer-sticker">
                  <span class="trade-offer-label">Eles oferecem</span>
                  <div
                    class="trade-offer-sticker-info"
                    :style="stickerBorder(offer.offeredSticker)"
                  >
                    <span class="num">#{{ offer.offeredSticker.num }}</span>
                    <strong>{{ offer.offeredSticker.name }}</strong>
                    <small>{{
                      offer.offeredSticker.teamName ||
                      groupLabel(offer.offeredSticker)
                    }}</small>
                  </div>
                </div>
                <div class="trade-offer-arrow">⇄</div>
                <div class="trade-offer-sticker">
                  <span class="trade-offer-label">Eles querem sua</span>
                  <div
                    class="trade-offer-sticker-info"
                    :style="stickerBorder(offer.requestedSticker)"
                  >
                    <span class="num">#{{ offer.requestedSticker.num }}</span>
                    <strong>{{ offer.requestedSticker.name }}</strong>
                    <small>{{
                      offer.requestedSticker.teamName ||
                      groupLabel(offer.requestedSticker)
                    }}</small>
                  </div>
                </div>
              </div>
              <div class="trade-offer-actions">
                <button
                  type="button"
                  class="trade-accept-btn"
                  @click="acceptTradeOffer(offer)"
                >
                  Aceitar
                </button>
                <button
                  type="button"
                  class="trade-reject-btn"
                  @click="rejectTradeOffer(offer)"
                >
                  Recusar
                </button>
              </div>
            </article>
          </div>
        </div>

        <!-- Outgoing offers -->
        <div v-if="state.tradeSubView === 'outgoing'">
          <p v-if="ui.tradeLoading" class="trade-hint">Carregando...</p>
          <p v-else-if="state.tradeOutgoing.length === 0" class="trade-hint">
            Nenhuma proposta enviada aguardando resposta.
          </p>
          <div v-else class="trade-offer-list">
            <article
              v-for="offer in state.tradeOutgoing"
              :key="offer.id"
              class="trade-offer-card"
            >
              <div class="trade-offer-header">
                <strong>Para: {{ offer.toUserName }}</strong>
                <small>{{ formatDateTime(offer.createdAt) }}</small>
              </div>
              <div class="trade-offer-stickers">
                <div class="trade-offer-sticker">
                  <span class="trade-offer-label">Você oferece</span>
                  <div
                    class="trade-offer-sticker-info"
                    :style="stickerBorder(offer.offeredSticker)"
                  >
                    <span class="num">#{{ offer.offeredSticker.num }}</span>
                    <strong>{{ offer.offeredSticker.name }}</strong>
                    <small>{{
                      offer.offeredSticker.teamName ||
                      groupLabel(offer.offeredSticker)
                    }}</small>
                  </div>
                </div>
                <div class="trade-offer-arrow">⇄</div>
                <div class="trade-offer-sticker">
                  <span class="trade-offer-label">Você quer</span>
                  <div
                    class="trade-offer-sticker-info"
                    :style="stickerBorder(offer.requestedSticker)"
                  >
                    <span class="num">#{{ offer.requestedSticker.num }}</span>
                    <strong>{{ offer.requestedSticker.name }}</strong>
                    <small>{{
                      offer.requestedSticker.teamName ||
                      groupLabel(offer.requestedSticker)
                    }}</small>
                  </div>
                </div>
              </div>
              <div class="trade-offer-actions">
                <button
                  type="button"
                  class="trade-reject-btn"
                  @click="cancelTradeOffer(offer)"
                >
                  Cancelar proposta
                </button>
              </div>
            </article>
          </div>
        </div>

        <!-- Trade history -->
        <div v-if="state.tradeSubView === 'history'">
          <p v-if="ui.tradeLoading" class="trade-hint">Carregando...</p>
          <p v-else-if="state.tradeHistory.length === 0" class="trade-hint">
            Nenhuma troca realizada ainda.
          </p>
          <div v-else class="trade-history-list">
            <article
              v-for="entry in state.tradeHistory"
              :key="entry.id"
              class="trade-history-row"
            >
              <div class="trade-history-main">
                <div class="trade-history-stickers">
                  <div class="trade-history-sticker">
                    <small
                      >Você {{ entry.iSent ? "ofereceu" : "recebeu" }}</small
                    >
                    <div
                      class="trade-history-sticker-info"
                      :style="stickerBorder(entry.offeredSticker)"
                    >
                      <span class="num">#{{ entry.offeredSticker.num }}</span>
                      <strong>{{ entry.offeredSticker.name }}</strong>
                    </div>
                  </div>
                  <span class="trade-history-arrow">
                    {{ entry.iSent ? "→" : "←" }}
                  </span>
                  <div class="trade-history-sticker">
                    <small>Você {{ entry.iSent ? "pediu" : "deu" }}</small>
                    <div
                      class="trade-history-sticker-info"
                      :style="stickerBorder(entry.requestedSticker)"
                    >
                      <span class="num">#{{ entry.requestedSticker.num }}</span>
                      <strong>{{ entry.requestedSticker.name }}</strong>
                    </div>
                  </div>
                </div>
                <div class="trade-history-details">
                  <small class="trade-history-partner">
                    {{ entry.iSent ? "para" : "de" }}
                    <strong>{{ entry.partnerName }}</strong>
                  </small>
                  <small class="trade-history-date">
                    {{ formatDateTime(entry.completedAt) }}
                  </small>
                </div>
              </div>
            </article>
          </div>
        </div>
      </template>
    </section>

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

    <!-- Trade offer modal -->
    <div v-if="ui.tradeOfferOpen" class="modal" @click.self="closeTradeOffer">
      <div class="modal-box trade-offer-modal">
        <h2>Propor Troca</h2>
        <p class="trade-modal-subtitle">Você quer:</p>
        <div
          v-if="ui.tradeTargetEntry"
          class="trade-modal-target"
          :style="stickerBorder(ui.tradeTargetEntry.sticker)"
        >
          <span class="num">#{{ ui.tradeTargetEntry.sticker.num }}</span>
          <strong>{{ ui.tradeTargetEntry.sticker.name }}</strong>
          <small>{{
            ui.tradeTargetEntry.sticker.teamName ||
            groupLabel(ui.tradeTargetEntry.sticker)
          }}</small>
        </div>
        <div v-if="ui.tradeTargetEntry?.offeredBy.length > 1">
          <p class="trade-modal-subtitle">Com quem quer trocar?</p>
          <div class="trade-user-selector">
            <button
              v-for="u in ui.tradeTargetEntry.offeredBy"
              :key="u.userId"
              type="button"
              class="trade-user-select-btn"
              :class="{ selected: ui.tradeTargetUser?.userId === u.userId }"
              @click="selectTradeTargetUser(u)"
            >
              {{ u.userName }}
              <span class="trade-count-badge">{{ u.count }}x</span>
            </button>
          </div>
        </div>
        <p class="trade-modal-subtitle">
          Escolha uma repetida sua que
          {{ ui.tradeTargetUser?.userName || "o usuário" }} ainda não tem:
        </p>
        <p v-if="ui.tradeOfferChoicesLoading" class="trade-hint">
          Carregando opções...
        </p>
        <p
          v-else-if="ui.tradeTargetUser && ui.tradeOfferChoices.length === 0"
          class="trade-hint"
        >
          Você não tem repetidas que {{ ui.tradeTargetUser.userName }} precise
          no momento.
        </p>
        <div class="trade-offer-picker">
          <article
            v-for="item in ui.tradeOfferChoices"
            :key="item.id"
            class="trade-picker-card"
            :class="{ selected: ui.tradeOfferSticker?.id === item.id }"
            :style="stickerBorder(item)"
            @click="ui.tradeOfferSticker = item"
          >
            <span class="num">#{{ item.num }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ groupLabel(item) }}</small>
            <small class="trade-count-badge">{{ item.count }}x</small>
          </article>
        </div>
        <div class="trade-modal-actions">
          <button
            type="button"
            class="trade-accept-btn"
            :disabled="
              !ui.tradeTargetUser || !ui.tradeOfferSticker || ui.tradeLoading
            "
            @click="confirmTradeOffer"
          >
            {{ ui.tradeLoading ? "Enviando..." : "Enviar Proposta" }}
          </button>
          <button type="button" @click="closeTradeOffer">Cancelar</button>
        </div>
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

    <footer class="landing-footer app-footer">
      <div class="app-footer-session">
        <span class="user-pill"
          >Conectado como {{ state.user?.name }} · {{ userRole }}</span
        >
        <button
          type="button"
          class="logout-btn app-footer-logout"
          @click="logout"
        >
          Sair
        </button>
      </div>
      <p>
        Album Copa 2026 · {{ total }} figurinhas · EUA, Canadá e México · FIFA
        World Cup 2026™
      </p>
      <p>
        Projeto educacional desenvolvido pela
        <a
          href="https://fabrica.videira.ifc.edu.br"
          target="_blank"
          rel="noreferrer"
        >
          Fábrica de Software - IFC Videira
        </a>
      </p>
    </footer>
  </div>

  <!-- Toast global (visível em qualquer estado) -->
  <Teleport to="body">
    <div v-if="ui.toast" class="toast toast-teleport">{{ ui.toast }}</div>
  </Teleport>
</template>
