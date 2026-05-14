<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, watch } from "vue";
import playerImagesData from "../js/player-images.json";

const FRONTEND_ENV = import.meta.env.MODE || "development";
const IS_DEV = Boolean(import.meta.env.DEV);
const BASE_URL = import.meta.env.BASE_URL || "/";
const BASE_URL_PREFIX = BASE_URL.endsWith("/")
  ? BASE_URL.slice(0, -1)
  : BASE_URL;

function withBasePath(assetPath) {
  const value = String(assetPath || "").trim();
  if (!value) return "";
  if (/^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }
  if (!value.startsWith("/")) return value;
  if (!BASE_URL_PREFIX) return value;
  return `${BASE_URL_PREFIX}${value}`;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (IS_DEV
    ? `http://${window.location.hostname || "localhost"}:3001/api`
    : `${window.location.origin}${BASE_URL_PREFIX}/api`);
const GOOGLE_CLIENT_ID = String(
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
).trim();
let googleIdentityInitialized = false;
const FRONTEND_LOG_ENDPOINT = `${API_BASE_URL}/logs/frontend-error`;
const APP_TIMEZONE = "America/Sao_Paulo";
const PACKS_PER_DAY = 1;
const PACK_DRAG_OPEN_DISTANCE = 180;
const SYSTEM_EVENTS_CURSOR_KEY = "album-system-events-cursor";
const NOTIFICATIONS_LIMIT = 50;
const NOTIFICATIONS_KEY_PREFIX = "album-notifications";
const NOTIFICATIONS_UNREAD_KEY_PREFIX = "album-notifications-unread";
const DEFAULT_PLAYER_IMAGE = withBasePath("/player-default.png");
const DEFAULT_TEAM_IMAGE = withBasePath("/teams/default.png");
const DEFAULT_SPECIAL_IMAGE = withBasePath("/specials/especial_default.png");
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

const ADMIN_ICON_OPTIONS = [
  { value: "🎟️", label: "🎟️ Figurinha" },
  { value: "⭐", label: "⭐ Estrela" },
  { value: "🏆", label: "🏆 Troféu" },
  { value: "⚽", label: "⚽ Bola" },
  { value: "🔥", label: "🔥 Destaque" },
  { value: "🧤", label: "🧤 Goleiro" },
  { value: "🛡️", label: "🛡️ Defesa" },
  { value: "🎯", label: "🎯 Ataque" },
  { value: "👑", label: "👑 Lendário" },
  { value: "💎", label: "💎 Raro" },
];

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

const stickers = reactive(
  Array.isArray(window.ALL_STICKERS) ? [...window.ALL_STICKERS] : [],
);
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
  tradeSearchAvailable: "",
  tradeSearchIncoming: "",
  tradeSearchOutgoing: "",
  tradeSearchHistory: "",
  tradeIncomingUserFilter: "all",
  tradeOutgoingUserFilter: "all",
  tradeHistoryUserFilter: "all",
  tradeHistoryDirection: "all",
  tradeAvailablePage: 1,
  tradeIncomingPage: 1,
  tradeOutgoingPage: 1,
  tradeHistoryPage: 1,
  tradePageSize: 8,
  tradeCoins: 0,
  tradeIncoming: [],
  tradeOutgoing: [],
  tradeHistory: [],
  tradeWindows: [],
  managedUsers: [],
  managedCoupons: [],
  recentCreatedStickers: [],
  newStickersUnread: 0,
  notifications: [],
  notificationsUnread: 0,
  systemLastEventId: Number(
    localStorage.getItem(SYSTEM_EVENTS_CURSOR_KEY) || 0,
  ),
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
  tradeCoinRedeemLoading: false,
  tradeUsersLoading: false,
  tradeAvailableLoading: false,
  tradeWindowClockNow: Date.now(),
  adminWindowForm: { startsAt: "", endsAt: "" },
  adminWindowMsg: "",
  adminWindowSaving: false,
  managePanelLoading: false,
  managePanelMsg: "",
  couponPanelMsg: "",
  couponPanelKind: "",
  couponPanelCode: "",
  stickerCreateMsg: "",
  recentStickersLoading: false,
  recentStickersMsg: "",
  adminTab: "stickers",
  adminCouponsLoading: false,
  adminCouponsMsg: "",
  deletingCouponId: 0,
  dashboardAnimatedPercent: 0,
  dashboardAnimatedTotal: 0,
  dashboardAnimatedCollected: 0,
  dashboardAnimatedMissing: 0,
  dashboardAnimatedDuplicates: 0,
  notificationsOpen: false,
});

restoreNotificationsFromStorage();

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
  couponSearch: "",
  couponStatusFilter: "active",
  couponUserFilter: "all",
  couponPage: 1,
  couponPageSize: 8,
  tradeWindowFilter: "all",
  hidePastTradeWindows: true,
});

const adminStickerForm = reactive({
  name: "",
  icon: "🎟️",
  image: "",
  imageFileName: "",
  teamId: "",
  type: "custom",
});

const isAuthenticated = computed(() =>
  Boolean(state.user?.id && state.accessToken),
);
const userRole = computed(() => String(state.user?.role || "jogador"));
const isAdmin = computed(() => userRole.value === "admin");
const canManageCoupons = computed(() =>
  ["admin", "servidor"].includes(userRole.value),
);
const adminSubTabs = computed(() => {
  const tabs = [];
  tabs.push({ key: "coupons", label: "Cupons" });
  if (isAdmin.value) {
    tabs.push({ key: "stickers", label: "Figurinhas" });
  }
  if (isAdmin.value) {
    tabs.push({ key: "trade-windows", label: "Transferências" });
    tabs.push({ key: "users", label: "Usuários" });
  }
  return tabs;
});

function defaultAdminTab() {
  //return isAdmin.value ? "stickers" : "coupons";
  return "coupons";
}

function selectAdminTab(tab) {
  const allowedTabs = new Set(adminSubTabs.value.map((item) => item.key));
  ui.adminTab = allowedTabs.has(tab) ? tab : defaultAdminTab();
}

const collectionViews = ["album", "missing", "duplicates", "search", "flip"];
const isCollectionView = computed(() => collectionViews.includes(state.view));
const adminTeamOptions = computed(() => {
  const map = new Map();
  for (const item of stickers) {
    if (!item?.teamId || !item?.groupId || !item?.teamName) continue;
    if (map.has(item.teamId)) continue;
    map.set(item.teamId, {
      teamId: item.teamId,
      teamName: item.teamName,
      groupId: item.groupId,
      sectionName: item.sectionName || `Grupo ${item.groupId}`,
    });
  }
  return [...map.values()].sort((a, b) => {
    const aName = String(a.teamName || "").toLowerCase();
    const bName = String(b.teamName || "").toLowerCase();
    return aName.localeCompare(bName, "pt-BR");
  });
});
const hasNewStickerAlerts = computed(
  () => Number(state.newStickersUnread || 0) > 0,
);
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
const filteredManagedCoupons = computed(() => {
  const query = String(adminTools.couponSearch || "")
    .trim()
    .toLowerCase();
  return state.managedCoupons.filter((c) => {
    if (
      adminTools.couponStatusFilter !== "all" &&
      c.status !== adminTools.couponStatusFilter
    ) {
      return false;
    }

    if (adminTools.couponUserFilter !== "all") {
      const selectedUserId = Number(adminTools.couponUserFilter || 0);
      if (
        Number(c.targetUserId || 0) !== selectedUserId &&
        Number(c.createdByUserId || 0) !== selectedUserId
      ) {
        return false;
      }
    }

    if (!query) return true;
    const code = String(c.code || "").toLowerCase();
    const target = String(c.targetUserName || "").toLowerCase();
    const createdBy = String(c.createdByUserName || "").toLowerCase();
    return (
      code.includes(query) ||
      target.includes(query) ||
      createdBy.includes(query)
    );
  });
});
const managedCouponsPageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(
      filteredManagedCoupons.value.length /
        Number(adminTools.couponPageSize || 8),
    ),
  ),
);
const managedCouponsSafePage = computed(() =>
  Math.min(
    Math.max(1, Number(adminTools.couponPage || 1)),
    managedCouponsPageCount.value,
  ),
);
const managedCouponsPaged = computed(() => {
  const pageSize = Number(adminTools.couponPageSize || 8);
  const start = (managedCouponsSafePage.value - 1) * pageSize;
  return filteredManagedCoupons.value.slice(start, start + pageSize);
});
const managedCouponsPageFrom = computed(() => {
  if (!filteredManagedCoupons.value.length) return 0;
  return (
    (managedCouponsSafePage.value - 1) *
      Number(adminTools.couponPageSize || 8) +
    1
  );
});
const managedCouponsPageTo = computed(() =>
  Math.min(
    managedCouponsSafePage.value * Number(adminTools.couponPageSize || 8),
    filteredManagedCoupons.value.length,
  ),
);
const editingManagedUser = computed(() => {
  const id = Number(adminTools.editingUserId || 0);
  if (!id) return null;
  return state.managedUsers.find((u) => Number(u.id) === id) || null;
});
const catalogStickerIds = computed(
  () => new Set(stickers.map((item) => item.id)),
);
const total = computed(() => stickers.length);
const collectedCount = computed(
  () =>
    Object.entries(state.collected).filter(
      ([stickerId, count]) =>
        Number(count) >= 1 && catalogStickerIds.value.has(String(stickerId)),
    ).length,
);
const duplicates = computed(() =>
  Object.entries(state.collected).reduce((acc, [stickerId, count]) => {
    if (!catalogStickerIds.value.has(String(stickerId))) return acc;
    return acc + Math.max(0, Number(count) - 1);
  }, 0),
);
const missing = computed(() => Math.max(0, total.value - collectedCount.value));
const percent = computed(() =>
  total.value === 0
    ? 0
    : Math.min(100, Math.round((collectedCount.value / total.value) * 100)),
);
const dashboardPercentDisplay = computed(() =>
  Math.max(
    0,
    Math.min(100, Math.round(Number(ui.dashboardAnimatedPercent || 0))),
  ),
);
const dashboardTotalDisplay = computed(() =>
  Math.max(0, Math.round(Number(ui.dashboardAnimatedTotal || 0))),
);
const dashboardCollectedDisplay = computed(() =>
  Math.max(0, Math.round(Number(ui.dashboardAnimatedCollected || 0))),
);
const dashboardMissingDisplay = computed(() =>
  Math.max(0, Math.round(Number(ui.dashboardAnimatedMissing || 0))),
);
const dashboardDuplicatesDisplay = computed(() =>
  Math.max(0, Math.round(Number(ui.dashboardAnimatedDuplicates || 0))),
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
const packsAvailable = computed(() =>
  Math.max(0, Number(state.extraPacks || 0)),
);
const tradeWindowConfigured = computed(
  () => Array.isArray(state.tradeWindows) && state.tradeWindows.length > 0,
);
const tradeWindowIsOpenNow = computed(() => {
  if (!tradeWindowConfigured.value) return false;
  return state.tradeWindows.some((w) => w && w.isOpen === true);
});
const nextTradeWindow = computed(() => {
  if (!Array.isArray(state.tradeWindows)) return null;
  const now = Date.now();
  const upcoming = state.tradeWindows.filter(
    (w) => w && w.startsAt && new Date(w.startsAt).getTime() > now,
  );
  if (upcoming.length === 0) return null;
  return upcoming.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )[0];
});
const currentOpenWindow = computed(() => {
  if (!Array.isArray(state.tradeWindows)) return null;
  return state.tradeWindows.find((w) => w && w.isOpen === true) || null;
});
const tradeWindowStatusText = computed(() => {
  if (!tradeWindowConfigured.value) return "Janela de trocas fechada";
  return tradeWindowIsOpenNow.value
    ? "Janela de trocas aberta"
    : "Janela de trocas fechada";
});
const filteredTradeWindows = computed(() => {
  if (!Array.isArray(state.tradeWindows)) return [];

  const now = Number(ui.tradeWindowClockNow || Date.now());
  const statusFilter = String(adminTools.tradeWindowFilter || "all");
  const hidePast = Boolean(adminTools.hidePastTradeWindows);

  return [...state.tradeWindows]
    .filter((w) => {
      if (!w || !w.startsAt || !w.endsAt) return false;
      const startMs = new Date(w.startsAt).getTime();
      const endMs = new Date(w.endsAt).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;

      const isOpen = w.isOpen === true;
      const isUpcoming = startMs > now;
      const isPast = endMs < now;

      if (hidePast && isPast) return false;
      if (statusFilter === "open" && !isOpen) return false;
      if (statusFilter === "upcoming" && !isUpcoming) return false;

      return true;
    })
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
});
const tradeWindowCountdownText = computed(() => {
  if (!tradeWindowConfigured.value) return "Defina no painel de administração.";
  const now = Number(ui.tradeWindowClockNow || Date.now());

  if (tradeWindowIsOpenNow.value && currentOpenWindow.value) {
    const endMs = new Date(currentOpenWindow.value.endsAt).getTime();
    if (now < endMs) {
      return `Fecha em ${formatCountdown(endMs - now)}`;
    }
  }

  if (nextTradeWindow.value) {
    const startMs = new Date(nextTradeWindow.value.startsAt).getTime();
    if (now < startMs) {
      return `Abre em ${formatCountdownLongFormat(startMs - now)}`;
    }
  }

  return "Período encerrado";
});

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

const latestNewStickers = computed(() => {
  const seenStickerIds = new Set();
  const timeline = [];

  // Adiciona figurinhas de pacotes
  const packs = Array.isArray(state.recentPacks) ? [...state.recentPacks] : [];
  for (const packEntry of packs) {
    const stickersInPack = Array.isArray(packEntry?.stickers)
      ? packEntry.stickers
      : [];
    for (const rawSticker of stickersInPack) {
      const sticker = normalizeStickerForUi(rawSticker);
      if (!sticker.id || seenStickerIds.has(sticker.id)) continue;
      seenStickerIds.add(sticker.id);
      timeline.push({
        ...sticker,
        date: packEntry?.openedAt || "",
        source: "pacote",
      });
    }
  }

  // Adiciona figurinhas recebidas em trocas
  const trades = Array.isArray(state.tradeHistory) ? state.tradeHistory : [];
  for (const trade of trades) {
    // Determina qual figurinha o usuário recebeu
    const receivedSticker = trade.iSent
      ? trade.requestedSticker
      : trade.offeredSticker;
    if (!receivedSticker) continue;

    const sticker = normalizeStickerForUi(receivedSticker);
    if (!sticker.id || seenStickerIds.has(sticker.id)) continue;
    seenStickerIds.add(sticker.id);
    timeline.push({
      ...sticker,
      date: trade.completedAt || "",
      source: "troca",
      tradedWith: trade.partnerName || "Desconhecido",
    });
  }

  // Ordena por data (mais recentes primeiro)
  timeline.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // Retorna as últimas 10
  return timeline.slice(0, 10);
});

const packDragStyle = computed(() => ({
  "--tear-progress": `${ui.packDragProgress}%`,
  "--pack-shift": `${Math.round(ui.packDragProgress * 1.2)}px`,
}));

let packRevealTimer = null;
let systemEventsTimer = null;
let dashboardRingAnimFrame = null;
let dashboardStatsAnimFrame = null;
let tradeWindowClockTimer = null;
const stickerPhotoCache = new Map();

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

function formatCountdownLongFormat(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}min`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }

  if (minutes > 0) {
    return `${minutes}min ${seconds}s`;
  }

  return `${seconds}s`;
}

function setTradeWindowStateFromPayload(payload) {
  if (Array.isArray(payload)) {
    state.tradeWindows = payload;
  } else {
    state.tradeWindows = [];
  }
}

async function loadAllTradeWindows() {
  if (!isAuthenticated.value) return;
  try {
    const data = await apiFetch("/trade/window");
    setTradeWindowStateFromPayload(data.tradeWindows || []);
  } catch (_err) {
    // non-fatal: keep latest known state
  }
}

function startTradeWindowClock() {
  if (tradeWindowClockTimer) return;
  tradeWindowClockTimer = setInterval(() => {
    ui.tradeWindowClockNow = Date.now();
  }, 1000);
}

function stopTradeWindowClock() {
  if (!tradeWindowClockTimer) return;
  clearInterval(tradeWindowClockTimer);
  tradeWindowClockTimer = null;
}

function stopDashboardRingAnimation() {
  if (!dashboardRingAnimFrame) return;
  cancelAnimationFrame(dashboardRingAnimFrame);
  dashboardRingAnimFrame = null;
}

function animateDashboardRing(targetValue) {
  const target = Math.max(0, Math.min(100, Number(targetValue || 0)));
  const start = Math.max(
    0,
    Math.min(100, Number(ui.dashboardAnimatedPercent || 0)),
  );

  stopDashboardRingAnimation();
  if (Math.abs(target - start) < 0.2) {
    ui.dashboardAnimatedPercent = target;
    return;
  }

  const durationMs = 560;
  const startAt = performance.now();

  const tick = (now) => {
    const progress = Math.min(1, (now - startAt) / durationMs);
    const eased = 1 - (1 - progress) ** 3;
    ui.dashboardAnimatedPercent = start + (target - start) * eased;

    if (progress < 1) {
      dashboardRingAnimFrame = requestAnimationFrame(tick);
      return;
    }

    ui.dashboardAnimatedPercent = target;
    dashboardRingAnimFrame = null;
  };

  dashboardRingAnimFrame = requestAnimationFrame(tick);
}

function stopDashboardStatsAnimation() {
  if (!dashboardStatsAnimFrame) return;
  cancelAnimationFrame(dashboardStatsAnimFrame);
  dashboardStatsAnimFrame = null;
}

function animateDashboardStats(targets) {
  const start = {
    total: Number(ui.dashboardAnimatedTotal || 0),
    collected: Number(ui.dashboardAnimatedCollected || 0),
    missing: Number(ui.dashboardAnimatedMissing || 0),
    duplicates: Number(ui.dashboardAnimatedDuplicates || 0),
  };
  const end = {
    total: Math.max(0, Number(targets.total || 0)),
    collected: Math.max(0, Number(targets.collected || 0)),
    missing: Math.max(0, Number(targets.missing || 0)),
    duplicates: Math.max(0, Number(targets.duplicates || 0)),
  };

  const unchanged =
    Math.abs(end.total - start.total) < 0.2 &&
    Math.abs(end.collected - start.collected) < 0.2 &&
    Math.abs(end.missing - start.missing) < 0.2 &&
    Math.abs(end.duplicates - start.duplicates) < 0.2;

  stopDashboardStatsAnimation();
  if (unchanged) {
    ui.dashboardAnimatedTotal = end.total;
    ui.dashboardAnimatedCollected = end.collected;
    ui.dashboardAnimatedMissing = end.missing;
    ui.dashboardAnimatedDuplicates = end.duplicates;
    return;
  }

  const durationMs = 620;
  const startAt = performance.now();

  const tick = (now) => {
    const progress = Math.min(1, (now - startAt) / durationMs);
    const eased = 1 - (1 - progress) ** 3;

    ui.dashboardAnimatedTotal = start.total + (end.total - start.total) * eased;
    ui.dashboardAnimatedCollected =
      start.collected + (end.collected - start.collected) * eased;
    ui.dashboardAnimatedMissing =
      start.missing + (end.missing - start.missing) * eased;
    ui.dashboardAnimatedDuplicates =
      start.duplicates + (end.duplicates - start.duplicates) * eased;

    if (progress < 1) {
      dashboardStatsAnimFrame = requestAnimationFrame(tick);
      return;
    }

    ui.dashboardAnimatedTotal = end.total;
    ui.dashboardAnimatedCollected = end.collected;
    ui.dashboardAnimatedMissing = end.missing;
    ui.dashboardAnimatedDuplicates = end.duplicates;
    dashboardStatsAnimFrame = null;
  };

  dashboardStatsAnimFrame = requestAnimationFrame(tick);
}

watch(
  [() => state.view, percent],
  ([view, nextPercent]) => {
    if (view === "dashboard") {
      animateDashboardRing(nextPercent);
      return;
    }

    stopDashboardRingAnimation();
    ui.dashboardAnimatedPercent = nextPercent;
  },
  { immediate: true },
);

watch(
  [() => state.view, total, collectedCount, missing, duplicates],
  ([view, nextTotal, nextCollected, nextMissing, nextDuplicates]) => {
    const targets = {
      total: nextTotal,
      collected: nextCollected,
      missing: nextMissing,
      duplicates: nextDuplicates,
    };

    if (view === "dashboard") {
      animateDashboardStats(targets);
      return;
    }

    stopDashboardStatsAnimation();
    ui.dashboardAnimatedTotal = targets.total;
    ui.dashboardAnimatedCollected = targets.collected;
    ui.dashboardAnimatedMissing = targets.missing;
    ui.dashboardAnimatedDuplicates = targets.duplicates;
  },
  { immediate: true },
);

function toErrorPayload(error) {
  if (!error) return { message: "Erro desconhecido" };
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || "",
    };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function reportFrontendError({
  level = "error",
  message,
  context = {},
  error,
}) {
  const details = toErrorPayload(error);
  const payload = {
    level,
    message,
    route: window.location?.pathname || "",
    timestamp: new Date().toISOString(),
    context: {
      env: FRONTEND_ENV,
      isAuthenticated: Boolean(state.user?.id),
      userId: state.user?.id || null,
      ...context,
    },
    details,
  };

  const printable = {
    message,
    context: payload.context,
    details,
  };

  if (level === "warn") {
    console.warn("[frontend-log]", printable);
  } else {
    console.error("[frontend-log]", printable);
  }

  if (IS_DEV) return;

  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(
      FRONTEND_LOG_ENDPOINT,
      new Blob([body], { type: "application/json" }),
    );
    if (ok) return;
  }

  fetch(FRONTEND_LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Swallow logging transport errors to avoid recursion loops.
  });
}

function handleGlobalWindowError(event) {
  reportFrontendError({
    message: "Erro global de janela",
    context: {
      source: "window.onerror",
      file: event.filename || "",
      line: event.lineno || 0,
      column: event.colno || 0,
    },
    error: event.error || event.message,
  });
}

function handleUnhandledRejection(event) {
  reportFrontendError({
    message: "Promise rejeitada sem tratamento",
    context: { source: "window.unhandledrejection" },
    error: event.reason,
  });
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && ui.packOpen) {
    closePackModal();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("error", handleGlobalWindowError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  console.info("[frontend-log] App inicializado", {
    env: FRONTEND_ENV,
    apiBaseUrl: API_BASE_URL,
  });

  if (isAuthenticated.value) {
    await bootstrapAuth();
  }

  startTradeWindowClock();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  window.removeEventListener("error", handleGlobalWindowError);
  window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  stopDashboardRingAnimation();
  stopDashboardStatsAnimation();
  stopTradeWindowClock();
  removePackDragListeners();
  clearPackRevealTimer();
  stopSystemEventsPolling();
});

function saveSystemEventsCursor() {
  localStorage.setItem(
    SYSTEM_EVENTS_CURSOR_KEY,
    String(state.systemLastEventId || 0),
  );
}

function notificationsStorageKey(userId = state.user?.id) {
  return `${NOTIFICATIONS_KEY_PREFIX}-${userId || "anon"}`;
}

function notificationsUnreadStorageKey(userId = state.user?.id) {
  return `${NOTIFICATIONS_UNREAD_KEY_PREFIX}-${userId || "anon"}`;
}

function saveNotificationsToStorage() {
  const userId = state.user?.id;
  if (!userId) return;

  const safeList = Array.isArray(state.notifications)
    ? state.notifications.slice(0, NOTIFICATIONS_LIMIT)
    : [];

  localStorage.setItem(
    notificationsStorageKey(userId),
    JSON.stringify(safeList),
  );
  localStorage.setItem(
    notificationsUnreadStorageKey(userId),
    String(Number(state.notificationsUnread || 0)),
  );
}

function restoreNotificationsFromStorage() {
  const userId = state.user?.id;
  if (!userId) {
    state.notifications = [];
    state.notificationsUnread = 0;
    return;
  }

  try {
    const rawNotifications = localStorage.getItem(
      notificationsStorageKey(userId),
    );
    const parsed = JSON.parse(rawNotifications || "[]");
    state.notifications = Array.isArray(parsed)
      ? parsed
          .filter((n) => n && typeof n === "object" && n.id)
          .slice(0, NOTIFICATIONS_LIMIT)
      : [];
  } catch {
    state.notifications = [];
  }

  state.notificationsUnread = Number(
    localStorage.getItem(notificationsUnreadStorageKey(userId)) || 0,
  );
}

function stopSystemEventsPolling() {
  if (!systemEventsTimer) return;
  clearInterval(systemEventsTimer);
  systemEventsTimer = null;
}

function startSystemEventsPolling() {
  stopSystemEventsPolling();
  if (!isAuthenticated.value) return;
  systemEventsTimer = setInterval(() => {
    loadSystemEvents(false);
  }, 30000);
}

function normalizeStickerForUi(raw) {
  return {
    ...raw,
    id: String(raw?.id || ""),
    num: Number(raw?.num || 0),
    name: String(raw?.name || ""),
    section:
      raw?.section || (raw?.groupId ? `grupo-${raw.groupId}` : "especial"),
    sectionName:
      raw?.sectionName || (raw?.groupId ? `Grupo ${raw.groupId}` : "Especial"),
    icon: raw?.icon || "🎟️",
    type: raw?.type || "custom",
    image: raw?.image || "",
    teamId: raw?.teamId || null,
    teamName: raw?.teamName || null,
    teamImage: raw?.teamImage || null,
    groupId: raw?.groupId || null,
  };
}

function replaceStickerCatalog(nextList) {
  const normalized = (Array.isArray(nextList) ? nextList : [])
    .map(normalizeStickerForUi)
    .filter((s) => s.id);

  normalized.sort((a, b) => Number(a.num) - Number(b.num));
  stickers.splice(0, stickers.length, ...normalized);
}

function upsertStickerIntoCatalog(rawSticker) {
  const sticker = normalizeStickerForUi(rawSticker);
  if (!sticker.id) return;
  const idx = stickers.findIndex((s) => s.id === sticker.id);
  if (idx >= 0) {
    stickers[idx] = { ...stickers[idx], ...sticker };
  } else {
    stickers.push(sticker);
  }
  stickers.sort((a, b) => Number(a.num) - Number(b.num));
}

function removeStickerFromCatalog(stickerId) {
  const idx = stickers.findIndex((s) => s.id === String(stickerId));
  if (idx >= 0) stickers.splice(idx, 1);
}

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

async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fallback below for insecure contexts / permissions
    }
  }

  try {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    document.body.appendChild(input);
    input.focus();
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return Boolean(copied);
  } catch {
    return false;
  }
}

async function copyCouponCodeFromNotification(notif) {
  const code = String(notif?.payload?.code || "").trim();
  if (!code) {
    setToast("Cupom não encontrado nesta notificação");
    return;
  }

  const ok = await copyTextToClipboard(code);
  setToast(ok ? `Cupom ${code} copiado` : "Não foi possível copiar o cupom");
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
  state.managedCoupons = [];
  state.recentCreatedStickers = [];
  state.newStickersUnread = 0;
  state.notifications = [];
  state.notificationsUnread = 0;
  state.tradeUsers = [];
  state.tradeAvailable = [];
  state.tradeIncoming = [];
  state.tradeOutgoing = [];
  state.tradeHistory = [];
  state.tradeWindowStartsAt = "";
  state.tradeWindowEndsAt = "";
  state.tradeFilterUser = "all";
  state.tradeFilterGroup = "all";
  state.tradeSearchAvailable = "";
  state.tradeSearchIncoming = "";
  state.tradeSearchOutgoing = "";
  state.tradeSearchHistory = "";
  state.tradeIncomingUserFilter = "all";
  state.tradeOutgoingUserFilter = "all";
  state.tradeHistoryUserFilter = "all";
  state.tradeHistoryDirection = "all";
  state.tradeAvailablePage = 1;
  state.tradeIncomingPage = 1;
  state.tradeOutgoingPage = 1;
  state.tradeHistoryPage = 1;
  state.tradePageSize = 8;
  state.tradeCoins = 0;
  state.tradeSubView = "available";
  adminTools.targetUserId = "";
  adminTools.packs = 1;
  adminTools.search = "";
  adminTools.roleFilter = "all";
  adminTools.statusFilter = "all";
  adminTools.page = 1;
  adminTools.editingUserId = "";
  adminTools.couponSearch = "";
  adminTools.couponStatusFilter = "all";
  adminTools.couponUserFilter = "all";
  adminTools.couponPage = 1;
  adminTools.couponPageSize = 8;
  adminTools.tradeWindowFilter = "all";
  adminTools.hidePastTradeWindows = true;
  ui.managePanelMsg = "";
  ui.couponPanelMsg = "";
  ui.couponPanelKind = "";
  ui.couponPanelCode = "";
  ui.stickerCreateMsg = "";
  ui.recentStickersMsg = "";
  ui.adminCouponsMsg = "";
  ui.adminTab = "stickers";
  ui.deletingCouponId = 0;
  ui.tradeOfferOpen = false;
  ui.tradeTargetEntry = null;
  ui.tradeTargetUser = null;
  ui.tradeOfferSticker = null;
  ui.tradeOfferChoices = [];
  ui.tradeLoading = false;
  ui.tradeWindowSaving = false;
  ui.tradeWindowMsg = "";
  ui.adminTradeWindowStartInput = "";
  ui.adminTradeWindowEndInput = "";
  ui.notificationsOpen = false;
  state.systemLastEventId = 0;
  localStorage.removeItem(SYSTEM_EVENTS_CURSOR_KEY);
  stopSystemEventsPolling();
  saveAuth();
}

async function loadStickerCatalog() {
  const data = await apiFetch("/stickers/catalog");
  replaceStickerCatalog(data.stickers || []);
}

async function loadSystemEvents(silent = false) {
  if (!isAuthenticated.value) return;
  try {
    const sinceId = Number(state.systemLastEventId || 0);
    const data = await apiFetch(`/system/events?sinceId=${sinceId}&limit=40`);
    const events = Array.isArray(data.events) ? data.events : [];

    for (const evt of events) {
      const isOwnAction =
        Number(evt.createdByUserId || 0) === Number(state.user?.id || 0);

      if (evt?.type === "sticker_created" && evt?.payload?.stickerId) {
        const groupId = evt.payload.groupId || null;
        upsertStickerIntoCatalog({
          id: evt.payload.stickerId,
          num: evt.payload.num,
          name: evt.payload.stickerName,
          section: groupId ? `grupo-${groupId}` : "especial",
          sectionName:
            evt.payload.sectionName ||
            (groupId ? `Grupo ${groupId}` : "Especial"),
          type: evt.payload.type || "custom",
          icon: evt.payload.icon || "🎟️",
          image: evt.payload.image || "",
          teamId: evt.payload.teamId || null,
          teamName: evt.payload.teamName || null,
          teamImage: evt.payload.teamImage || null,
          groupId,
        });

        if (!silent && !isOwnAction) {
          state.newStickersUnread = Number(state.newStickersUnread || 0) + 1;
          pushNotification({
            id: evt.id,
            type: "sticker_created",
            icon: "⭐",
            title: "Nova figurinha no álbum!",
            message: `#${evt.payload.num} ${evt.payload.stickerName} foi adicionada ao álbum por ${evt.payload.createdByName || "Admin"}.`,
            createdAt: evt.createdAt,
          });
        }
      }

      if (evt?.type === "sticker_deleted" && evt?.payload?.stickerId) {
        removeStickerFromCatalog(evt.payload.stickerId);
        // also remove from recent list
        const rIdx = state.recentCreatedStickers.findIndex(
          (s) => s.id === evt.payload.stickerId,
        );
        if (rIdx >= 0) state.recentCreatedStickers.splice(rIdx, 1);
      }

      // coupon_created: always notify regardless of silent (targeted to current user)
      if (evt?.type === "coupon_created") {
        pushNotification({
          id: evt.id,
          type: "coupon_created",
          icon: "🎟️",
          title: "Você recebeu um cupom!",
          message: `${evt.message}${evt.payload?.code ? ` Código: ${evt.payload.code}` : ""}`,
          payload: { code: evt.payload?.code || "" },
          createdAt: evt.createdAt,
        });
      }

      // trade events
      if (evt?.type === "trade_offer_created" && !silent) {
        pushNotification({
          id: evt.id,
          type: "trade_offer_created",
          icon: "🤝",
          title: "Oferta de troca recebida!",
          message: `${evt.payload?.fromUserName || "Usuário"} quer trocar #${evt.payload?.offeredStickerNum || "?"} ${evt.payload?.offeredStickerName || "figurinha"} pela sua #${evt.payload?.requestedStickerNum || "?"} ${evt.payload?.requestedStickerName || "figurinha"}.`,
          createdAt: evt.createdAt,
        });
      }

      if (evt?.type === "trade_accepted" && !silent) {
        pushNotification({
          id: evt.id,
          type: "trade_accepted",
          icon: "✅",
          title: "Troca aceita!",
          message: `${evt.message}`,
          createdAt: evt.createdAt,
        });
      }

      if (evt?.type === "trade_rejected" && !silent) {
        pushNotification({
          id: evt.id,
          type: "trade_rejected",
          icon: "❌",
          title: "Troca rejeitada",
          message: `${evt.message}`,
          createdAt: evt.createdAt,
        });
      }

      if (evt?.type === "trade_cancelled" && !silent) {
        pushNotification({
          id: evt.id,
          type: "trade_cancelled",
          icon: "⏹️",
          title: "Troca cancelada",
          message: `${evt.message}`,
          createdAt: evt.createdAt,
        });
      }

      if (evt?.type === "trade_window_created") {
        pushNotification({
          id: evt.id,
          type: "trade_window_created",
          icon: "📅",
          title: "Nova janela de trocas agendada",
          message: evt.message || "Uma nova janela de trocas foi criada.",
          createdAt: evt.createdAt,
        });
        await loadAllTradeWindows();
      }

      if (evt?.type === "trade_window_opened") {
        pushNotification({
          id: evt.id,
          type: "trade_window_opened",
          icon: "🟢",
          title: "Janela de trocas aberta!",
          message: evt.message || "A janela de trocas está aberta agora.",
          createdAt: evt.createdAt,
        });
        await loadAllTradeWindows();
      }

      if (evt?.type === "trade_window_closed") {
        pushNotification({
          id: evt.id,
          type: "trade_window_closed",
          icon: "🔴",
          title: "Janela de trocas encerrada",
          message: evt.message || "A janela de trocas foi encerrada.",
          createdAt: evt.createdAt,
        });
        await loadAllTradeWindows();
      }
    }

    state.systemLastEventId = Math.max(
      Number(data.lastEventId || 0),
      ...events.map((e) => Number(e.id || 0)),
      sinceId,
    );
    saveSystemEventsCursor();
  } catch (_err) {
    // poll errors are non-fatal
  }
}

function pushNotification(notif, { toast = true } = {}) {
  // deduplicate by id
  if (state.notifications.some((n) => n.id === notif.id)) return;
  state.notifications.unshift(notif);
  if (state.notifications.length > NOTIFICATIONS_LIMIT)
    state.notifications.splice(NOTIFICATIONS_LIMIT);
  if (!ui.notificationsOpen) {
    state.notificationsUnread = Number(state.notificationsUnread || 0) + 1;
  }
  saveNotificationsToStorage();
  if (toast) setToast(notif.message);
}

function openNotifications() {
  ui.notificationsOpen = true;
  state.notificationsUnread = 0;
  state.newStickersUnread = 0;
  ui.mobileMenuOpen = false;
  saveNotificationsToStorage();
}

function closeNotifications() {
  ui.notificationsOpen = false;
}

function clearNotifications() {
  state.notifications = [];
  state.notificationsUnread = 0;
  saveNotificationsToStorage();
}

async function apiFetch(path, options = {}, retry = true) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (state.accessToken)
      headers.Authorization = `Bearer ${state.accessToken}`;

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
      const err = new Error(data.error || "Erro de API");
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data;
  } catch (err) {
    reportFrontendError({
      message: "Falha em requisicao API",
      context: {
        path,
        method: String(options?.method || "GET").toUpperCase(),
      },
      error: err,
    });
    throw err;
  }
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
  } catch (err) {
    reportFrontendError({
      level: "warn",
      message: "Falha ao renovar token",
      context: { path: "/auth/refresh" },
      error: err,
    });
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
    restoreNotificationsFromStorage();
    await Promise.all([
      loadStickerCatalog(),
      loadAlbumState(),
      loadPackHistory(),
      loadTradeHistory(),
    ]);
    await loadManagedUsers();
    await loadSystemEvents(true);
    startSystemEventsPolling();
  } catch (err) {
    reportFrontendError({
      level: "warn",
      message: "Falha no bootstrap de autenticacao",
      error: err,
    });
    clearAuth();
  } finally {
    ui.loading = false;
  }
}

async function createCustomSticker() {
  if (!isAdmin.value) return;
  ui.stickerCreateMsg = "";
  const name = String(adminStickerForm.name || "").trim();
  if (name.length < 2) {
    ui.stickerCreateMsg = "Nome da figurinha deve ter pelo menos 2 caracteres.";
    return;
  }

  try {
    const payload = {
      name,
      icon: String(adminStickerForm.icon || "🎟️").trim() || "🎟️",
      image: String(adminStickerForm.image || "").trim(),
      teamId: String(adminStickerForm.teamId || "").trim() || undefined,
      type: String(adminStickerForm.type || "custom"),
    };
    const data = await apiFetch("/admin/stickers", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (data.sticker) {
      upsertStickerIntoCatalog(data.sticker);
    }
    if (data.event?.id) {
      state.systemLastEventId = Math.max(
        state.systemLastEventId,
        Number(data.event.id),
      );
      saveSystemEventsCursor();
    }

    // notify the admin immediately (poll skips own actions)
    if (data.sticker) {
      pushNotification({
        id: data.event?.id ? `se-${data.event.id}` : `sticker-${Date.now()}`,
        type: "sticker_created",
        icon: "⭐",
        title: "Nova figurinha publicada!",
        message: `#${data.sticker.num} ${data.sticker.name} foi adicionada ao álbum para todos.`,
        createdAt: new Date().toISOString(),
      });
    }

    ui.stickerCreateMsg = `Figurinha #${data.sticker?.num || "?"} criada com sucesso.`;
    setToast("Nova figurinha criada e publicada");
    resetAdminStickerForm();
    await loadRecentCreatedStickers();
  } catch (err) {
    ui.stickerCreateMsg = err.message || "Erro ao criar figurinha";
  }
}

function resetAdminStickerForm() {
  adminStickerForm.name = "";
  adminStickerForm.icon = "🎟️";
  adminStickerForm.image = "";
  adminStickerForm.imageFileName = "";
  adminStickerForm.teamId = "";
}

function clearAdminStickerImage() {
  adminStickerForm.image = "";
  adminStickerForm.imageFileName = "";
}

function handleAdminStickerImageUpload(event) {
  const file = event?.target?.files?.[0];
  if (!file) {
    clearAdminStickerImage();
    return;
  }

  if (!String(file.type || "").startsWith("image/")) {
    ui.stickerCreateMsg = "Selecione um arquivo de imagem válido.";
    clearAdminStickerImage();
    event.target.value = "";
    return;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (Number(file.size || 0) > maxBytes) {
    ui.stickerCreateMsg = "A imagem deve ter no máximo 5MB.";
    clearAdminStickerImage();
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || "");
    if (!result.startsWith("data:image/")) {
      ui.stickerCreateMsg = "Não foi possível processar a imagem selecionada.";
      clearAdminStickerImage();
      return;
    }
    adminStickerForm.image = result;
    adminStickerForm.imageFileName = file.name;
    ui.stickerCreateMsg = "";
  };
  reader.onerror = () => {
    ui.stickerCreateMsg = "Falha ao ler o arquivo de imagem.";
    clearAdminStickerImage();
  };
  reader.readAsDataURL(file);
}

async function loadRecentCreatedStickers() {
  if (!isAuthenticated.value || !isAdmin.value) {
    state.recentCreatedStickers = [];
    return;
  }

  ui.recentStickersLoading = true;
  ui.recentStickersMsg = "";
  try {
    const data = await apiFetch("/admin/stickers/recent?limit=10");
    state.recentCreatedStickers = Array.isArray(data.stickers)
      ? data.stickers
      : [];
  } catch (err) {
    ui.recentStickersMsg =
      err.message || "Erro ao carregar figurinhas recentes";
  } finally {
    ui.recentStickersLoading = false;
  }
}

async function deleteCustomSticker(stickerId, stickerName) {
  if (!isAdmin.value) return;
  if (
    !confirm(
      `Excluir a figurinha "${stickerName}"? Essa ação não pode ser desfeita.`,
    )
  )
    return;
  try {
    const data = await apiFetch(
      `/admin/stickers/${encodeURIComponent(stickerId)}`,
      {
        method: "DELETE",
      },
    );
    if (data.ok) {
      removeStickerFromCatalog(stickerId);
      state.recentCreatedStickers = state.recentCreatedStickers.filter(
        (s) => s.id !== stickerId,
      );
      if (data.event?.id) {
        state.systemLastEventId = Math.max(
          state.systemLastEventId,
          Number(data.event.id),
        );
        saveSystemEventsCursor();
      }
      setToast(`Figurinha "${stickerName}" excluída.`);
    }
  } catch (err) {
    setToast(err.message || "Erro ao excluir figurinha");
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
    ui.managePanelMsg = err.message || "Erro ao carregar usuários";
  } finally {
    ui.managePanelLoading = false;
  }
}

async function loadAdminCoupons() {
  if (!isAuthenticated.value || !canManageCoupons.value) {
    state.managedCoupons = [];
    return;
  }

  ui.adminCouponsLoading = true;
  ui.adminCouponsMsg = "";
  try {
    const data = await apiFetch("/admin/coupons");
    state.managedCoupons = Array.isArray(data.coupons) ? data.coupons : [];
    adminTools.couponPage = 1;
  } catch (err) {
    ui.adminCouponsMsg = err.message || "Erro ao carregar cupons";
  } finally {
    ui.adminCouponsLoading = false;
  }
}

async function deleteManagedCoupon(coupon) {
  if (!isAdmin.value || !coupon?.id) return;
  if (
    !confirm(`Excluir o cupom ${coupon.code}? Essa ação não pode ser desfeita.`)
  ) {
    return;
  }

  ui.deletingCouponId = Number(coupon.id);
  ui.adminCouponsMsg = "";
  try {
    await apiFetch(`/admin/coupons/${coupon.id}`, { method: "DELETE" });
    state.managedCoupons = state.managedCoupons.filter(
      (item) => Number(item.id) !== Number(coupon.id),
    );
    setToast(`Cupom ${coupon.code} excluído`);
  } catch (err) {
    ui.adminCouponsMsg = err.message || "Erro ao excluir cupom";
  } finally {
    ui.deletingCouponId = 0;
  }
}

function openManagedUserEditor(user) {
  const id = Number(user?.id || 0);
  adminTools.editingUserId = id ? String(id) : "";
}

async function openCouponsForUser(user) {
  const userId = Number(user?.id || 0);
  if (!userId) return;
  adminTools.couponUserFilter = String(userId);
  adminTools.couponPage = 1;
  selectAdminTab("coupons");
  if (canManageCoupons.value && state.managedCoupons.length === 0) {
    await loadAdminCoupons();
  }
}

function setManagedCouponsPage(nextPage) {
  const n = Number(nextPage || 1);
  adminTools.couponPage = Math.min(
    Math.max(1, n),
    Math.max(1, managedCouponsPageCount.value),
  );
}

function setManagedCouponsPageSize(nextSize) {
  const n = Number(nextSize || 8);
  adminTools.couponPageSize = [5, 8, 10, 20].includes(n) ? n : 8;
  adminTools.couponPage = 1;
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
  const allowed = ["name", "email", "role", "status", "createdAt"];
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
  state.newStickersUnread = 0;
}

function openDashboardView() {
  state.view = "dashboard";
  ui.mobileMenuOpen = false;
  loadTradeHistory();
}

async function generateManagedCoupon() {
  if (!canManageCoupons.value) return;
  ui.couponPanelMsg = "";
  ui.couponPanelKind = "";
  ui.couponPanelCode = "";

  const targetUserId = Number(adminTools.targetUserId || 0);
  if (!isAdmin.value && targetUserId <= 0) {
    ui.couponPanelMsg = "Selecione um usuário para gerar o cupom.";
    ui.couponPanelKind = "error";
    return;
  }
  const payload = {};
  if (targetUserId > 0) {
    payload.targetUserId = targetUserId;
  }
  payload.packs = isAdmin.value
    ? Math.max(1, Number(adminTools.packs || 1))
    : Math.max(1, Math.min(3, Number(adminTools.packs || 1)));

  try {
    const data = await apiFetch("/coupons/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const coupon = data.coupon || {};
    ui.couponPanelCode = String(coupon.code || "");
    ui.couponPanelMsg = coupon.isGeneric
      ? `Cupom ${coupon.code} gerado para uso livre (${coupon.packs || 1} pacote).`
      : `Cupom ${coupon.code} gerado para ${
          coupon.targetUserName || "usuário"
        } (${coupon.packs || 1} pacote).`;
    ui.couponPanelKind = coupon.isGeneric ? "generic" : "targeted";
    if (canManageCoupons.value) {
      await loadAdminCoupons();
    }
  } catch (err) {
    ui.couponPanelMsg = err.message || "Erro ao gerar cupom";
    ui.couponPanelKind = "error";
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
  state.tradeCoins = Number(data.tradeCoins || 0);
  state.usedCodes = Array.isArray(data.usedCodes) ? data.usedCodes : [];
  setTradeWindowStateFromPayload(data.tradeWindows || []);
}

async function loadTradeWindowConfig() {
  if (!isAuthenticated.value) return;
  try {
    const data = await apiFetch("/trade/window");
    setTradeWindowStateFromPayload(data.tradeWindow || {});
  } catch (_err) {
    // non-fatal: keep latest known state
  }
}

async function createTradeWindow() {
  if (!isAdmin.value) return;

  const startsAtRaw = String(ui.adminWindowForm.startsAt || "").trim();
  const endsAtRaw = String(ui.adminWindowForm.endsAt || "").trim();

  if (!startsAtRaw || !endsAtRaw) {
    ui.adminWindowMsg = "Informe data/hora inicial e final válidas.";
    return;
  }

  const startsAtDate = new Date(startsAtRaw);
  const endsAtDate = new Date(endsAtRaw);
  if (
    Number.isNaN(startsAtDate.getTime()) ||
    Number.isNaN(endsAtDate.getTime())
  ) {
    ui.adminWindowMsg = "Data/hora inválida.";
    return;
  }

  const startsAt = startsAtDate.toISOString();
  const endsAt = endsAtDate.toISOString();
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    ui.adminWindowMsg = "A data final deve ser maior que a inicial.";
    return;
  }

  ui.adminWindowSaving = true;
  ui.adminWindowMsg = "";
  try {
    const data = await apiFetch("/admin/trade/windows", {
      method: "POST",
      body: JSON.stringify({ startsAt, endsAt }),
    });
    setTradeWindowStateFromPayload(data.tradeWindows || []);
    ui.adminWindowForm = { startsAt: "", endsAt: "" };
    ui.adminWindowMsg = data.message || "Janela criada com sucesso.";
    setToast(ui.adminWindowMsg);
  } catch (err) {
    ui.adminWindowMsg = err.message || "Erro ao criar janela";
  } finally {
    ui.adminWindowSaving = false;
  }
}

async function deleteTradeWindow(windowId) {
  if (!isAdmin.value) return;

  const confirm = window.confirm(
    "Tem certeza que deseja deletar esta janela? Essa ação não pode ser desfeita.",
  );
  if (!confirm) return;

  ui.adminWindowSaving = true;
  try {
    const data = await apiFetch(`/admin/trade/windows/${windowId}`, {
      method: "DELETE",
    });
    setTradeWindowStateFromPayload(data.tradeWindows || []);
    ui.adminWindowMsg = data.message || "Janela removida com sucesso.";
    setToast(ui.adminWindowMsg);
  } catch (err) {
    ui.adminWindowMsg = err.message || "Erro ao remover janela";
  } finally {
    ui.adminWindowSaving = false;
  }
}

async function loadPackHistory() {
  const data = await apiFetch("/packs/history?limit=50");
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

      // notify user about the stickers received
      const pack = ui.pack;
      const wasOwned = ui.wasOwned;
      const novas = pack.filter((_, i) => !wasOwned[i]);
      const repetidas = pack.filter((_, i) => wasOwned[i]);
      const partes = [];
      if (novas.length > 0)
        partes.push(
          `${novas.length} nova${novas.length > 1 ? "s" : ""}: ${novas.map((s) => `#${s.num} ${s.name}`).join(", ")}`,
        );
      if (repetidas.length > 0)
        partes.push(
          `${repetidas.length} repetida${repetidas.length > 1 ? "s" : ""}`,
        );
      pushNotification(
        {
          id: `pack-${Date.now()}`,
          type: "pack_opened",
          icon: "📦",
          title: "Pacote aberto!",
          message: partes.length
            ? partes.join(" · ")
            : `${pack.length} figurinha(s) recebida(s).`,
          createdAt: new Date().toISOString(),
        },
        { toast: false },
      );

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
    setToast("Código aplicado com sucesso");
  } catch (err) {
    ui.promoMsg = err.message || "Código inválido";
  }
}

function openAuth(mode) {
  ui.authMode = mode;
  ui.authMsg = "";
  ui.authOpen = true;
  setTimeout(() => {
    renderGoogleSignInButton();
  }, 0);
}

function initializeGoogleIdentity() {
  if (!GOOGLE_CLIENT_ID) {
    ui.authMsg = "Google OAuth não configurado no frontend.";
    return false;
  }

  if (!window.google?.accounts?.id) {
    return false;
  }

  if (!googleIdentityInitialized) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (!response?.credential) {
          ui.authMsg = "Falha ao autenticar com Google.";
          return;
        }
        submitGoogleAuth(response.credential);
      },
      ux_mode: "popup",
    });
    googleIdentityInitialized = true;
  }

  return true;
}

function renderGoogleSignInButton(attempt = 0) {
  if (!ui.authOpen) return;

  const container = document.getElementById("google-signin-button");
  if (!container) return;

  if (!initializeGoogleIdentity()) {
    if (attempt < 12) {
      setTimeout(() => renderGoogleSignInButton(attempt + 1), 250);
    } else if (!GOOGLE_CLIENT_ID) {
      ui.authMsg = "Configure VITE_GOOGLE_CLIENT_ID para entrar com Google.";
    } else {
      ui.authMsg = "Não foi possível carregar o botão do Google.";
    }
    return;
  }

  container.innerHTML = "";
  window.google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
  });
}

function promptGoogleSignIn() {
  ui.authMsg = "";
  if (!initializeGoogleIdentity()) {
    renderGoogleSignInButton();
    return;
  }
  window.google.accounts.id.prompt();
}

async function submitGoogleAuth(idToken) {
  ui.authMsg = "";

  try {
    const data = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Falha na autenticacao");
      return body;
    });

    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    saveAuth();
    restoreNotificationsFromStorage();

    ui.authOpen = false;
    await Promise.all([
      loadStickerCatalog(),
      loadAlbumState(),
      loadPackHistory(),
    ]);
    await loadManagedUsers();
    await loadSystemEvents(true);
    startSystemEventsPolling();
    setToast("Login realizado com Google");
  } catch (err) {
    reportFrontendError({
      message: "Falha no fluxo de autenticacao Google",
      context: { mode: "google" },
      error: err,
    });
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
  } catch (err) {
    reportFrontendError({
      level: "warn",
      message: "Falha ao notificar logout no backend",
      error: err,
    });
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
  if (value.startsWith("public/")) return withBasePath(`/${value.slice(7)}`);
  if (value.startsWith("/public/")) return withBasePath(value.slice(7));
  return withBasePath(value);
}

function getTeamImageCandidates(item) {
  const candidates = [];

  if (item?.teamImage) {
    candidates.push(...buildImageVariants(item.teamImage));
  }

  if (item?.teamId) {
    candidates.push(
      ...buildImageVariants(withBasePath(`/teams/${item.teamId}`)),
    );
    const shortCode = TEAM_IMAGE_CODES[item.teamId];
    if (shortCode) {
      candidates.push(
        ...buildImageVariants(withBasePath(`/teams/${shortCode}`)),
      );
    }
  }

  candidates.push(DEFAULT_TEAM_IMAGE);

  return [...new Set(candidates.filter(Boolean))];
}

function stickerPhotoCandidates(item) {
  if (!item) return [];

  if (item.section === "especial" || item.type === "custom") {
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

  return [DEFAULT_SPECIAL_IMAGE];
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
    if (item.section === "especial" || item.type === "custom") {
      return DEFAULT_SPECIAL_IMAGE;
    }
    if (item.type === "player") {
      return DEFAULT_PLAYER_IMAGE;
    } else if (item.type === "badge") {
      return DEFAULT_TEAM_IMAGE;
    }
    return DEFAULT_SPECIAL_IMAGE;
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

function handleAdminRefresh() {
  if (!canManageCoupons.value) return;
  loadManagedUsers();
  loadAdminCoupons();
  if (isAdmin.value) {
    loadRecentCreatedStickers();
    loadAllTradeWindows();
  }
}

function openAdminPanelView() {
  state.view = "admin";
  ui.mobileMenuOpen = false;
  ui.adminTab = defaultAdminTab();
  handleAdminRefresh();
}

// ─── Trade functions ─────────────────────────────────────────────────────────

async function loadTradeUsers() {
  ui.tradeUsersLoading = true;
  try {
    const data = await apiFetch("/trade/users");
    state.tradeUsers = Array.isArray(data.users) ? data.users : [];
  } catch (err) {
    setToast(err.message || "Erro ao carregar usuários");
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
  if (!tradeWindowIsOpenNow.value) {
    setToast("A janela de trocas está fechada no momento");
    return;
  }
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
  if (!tradeWindowIsOpenNow.value) {
    setToast("A janela de trocas está fechada no momento");
    return;
  }
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
  if (!tradeWindowIsOpenNow.value) {
    setToast("A janela de trocas está fechada no momento");
    return;
  }
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
      state.tradeCoins = Number(data.state.tradeCoins ?? state.tradeCoins);
      state.usedCodes = Array.isArray(data.state.usedCodes)
        ? data.state.usedCodes
        : state.usedCodes;
    }
    setToast("Troca realizada com sucesso!");
    await Promise.all([loadTradeOffers(), loadSystemEvents(false)]);
  } catch (err) {
    setToast(err.message || "Erro ao aceitar troca");
    await loadTradeOffers();
  } finally {
    ui.tradeLoading = false;
  }
}

async function rejectTradeOffer(offer) {
  if (!tradeWindowIsOpenNow.value) {
    setToast("A janela de trocas está fechada no momento");
    return;
  }
  ui.tradeLoading = true;
  try {
    await apiFetch(`/trade/offers/${offer.id}/reject`, { method: "POST" });
    // Push notification immediately
    pushNotification({
      id: `trade-reject-${Date.now()}`,
      type: "trade_rejected_self",
      icon: "❌",
      title: "Oferta rejeitada",
      message: `Você rejeitou a oferta de troca de #${offer.offeredSticker?.num} ${offer.offeredSticker?.name}.`,
      createdAt: new Date().toISOString(),
    });
    setToast("Oferta rejeitada");
    await Promise.all([loadTradeOffers(), loadSystemEvents(false)]);
  } catch (err) {
    setToast(err.message || "Erro ao recusar oferta");
  } finally {
    ui.tradeLoading = false;
  }
}

async function cancelTradeOffer(offer) {
  if (!tradeWindowIsOpenNow.value) {
    setToast("A janela de trocas está fechada no momento");
    return;
  }
  ui.tradeLoading = true;
  try {
    await apiFetch(`/trade/offers/${offer.id}/reject`, { method: "POST" });
    // Push notification immediately
    pushNotification({
      id: `trade-cancel-${Date.now()}`,
      type: "trade_cancelled_self",
      icon: "⏹️",
      title: "Proposta cancelada",
      message: `Você cancelou a oferta de #${offer.offeredSticker?.num} ${offer.offeredSticker?.name}.`,
      createdAt: new Date().toISOString(),
    });
    setToast("Proposta cancelada");
    await Promise.all([loadTradeOffers(), loadSystemEvents(false)]);
  } catch (err) {
    setToast(err.message || "Erro ao cancelar proposta");
  } finally {
    ui.tradeLoading = false;
  }
}

async function redeemTradeCoinsCoupon() {
  if (ui.tradeCoinRedeemLoading) return;
  ui.tradeCoinRedeemLoading = true;
  try {
    const data = await apiFetch("/trade/coins/redeem", { method: "POST" });
    state.tradeCoins = Number(data.tradeCoins ?? state.tradeCoins);
    if (data.extraPacks != null) state.extraPacks = Number(data.extraPacks);
    setToast(
      "🎉 Pacotinho liberado! Abra seus pacotes para colar as figurinhas.",
    );
    await loadSystemEvents(false).catch(() => null);
  } catch (err) {
    setToast(err.message || "Erro ao resgatar moedas");
  } finally {
    ui.tradeCoinRedeemLoading = false;
  }
}

async function openTradeView() {
  state.view = "trade";
  state.tradeSubView = "available";
  ui.mobileMenuOpen = false;
  if (isAuthenticated.value) {
    await Promise.all([
      loadAllTradeWindows(),
      loadTradeAvailable(),
      loadTradeUsers(),
      loadTradeOffers(),
    ]);
  }
}

const myDuplicatesForOffer = computed(() =>
  stickers.filter((item) => getCount(item.id) > 1),
);

const myTradableDuplicatesForOffer = computed(() => {
  const reservedBySticker = new Map();
  for (const offer of state.tradeOutgoing) {
    const stickerId = String(offer?.offeredSticker?.id || "");
    if (!stickerId) continue;
    reservedBySticker.set(
      stickerId,
      (reservedBySticker.get(stickerId) || 0) + 1,
    );
  }

  return stickers.filter((item) => {
    const ownedCount = Number(getCount(item.id) || 0);
    const reservedCount = Number(reservedBySticker.get(String(item.id)) || 0);
    const tradableCount = Math.max(0, ownedCount - 1 - reservedCount);
    return tradableCount > 0;
  });
});

const tradeIncomingCount = computed(() => state.tradeIncoming.length);
const TRADE_COINS_PER_COUPON = 10;
const tradeCoinsNeeded = computed(() =>
  Math.max(0, TRADE_COINS_PER_COUPON - Number(state.tradeCoins || 0)),
);
const canRedeemTradeCoinsCoupon = computed(
  () => Number(state.tradeCoins || 0) >= TRADE_COINS_PER_COUPON,
);

function normalizeTradeQuery(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function setTradePage(view, value) {
  const next = Math.max(1, Number(value || 1));
  if (view === "available") state.tradeAvailablePage = next;
  if (view === "incoming") state.tradeIncomingPage = next;
  if (view === "outgoing") state.tradeOutgoingPage = next;
  if (view === "history") state.tradeHistoryPage = next;
}

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
  const query = normalizeTradeQuery(state.tradeSearchAvailable);
  if (query) {
    list = list.filter((entry) => {
      const stickerName = String(entry?.sticker?.name || "").toLowerCase();
      const stickerNum = String(entry?.sticker?.num || "");
      const offeredBy = Array.isArray(entry?.offeredBy)
        ? entry.offeredBy
            .map((u) => String(u?.userName || "").toLowerCase())
            .join(" ")
        : "";
      return (
        stickerName.includes(query) ||
        stickerNum.includes(query) ||
        offeredBy.includes(query)
      );
    });
  }
  return list;
});

const tradeIncomingUsers = computed(() => {
  const map = new Map();
  for (const item of state.tradeIncoming) {
    const id = Number(item?.fromUserId || 0);
    const name = String(item?.fromUserName || "").trim();
    if (!id || !name || map.has(id)) continue;
    map.set(id, { id, name });
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
});

const tradeOutgoingUsers = computed(() => {
  const map = new Map();
  for (const item of state.tradeOutgoing) {
    const id = Number(item?.toUserId || 0);
    const name = String(item?.toUserName || "").trim();
    if (!id || !name || map.has(id)) continue;
    map.set(id, { id, name });
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
});

const tradeHistoryUsers = computed(() => {
  const map = new Map();
  for (const item of state.tradeHistory) {
    const id = Number(item?.partnerUserId || 0);
    const name = String(item?.partnerName || "").trim();
    if (!id || !name || map.has(id)) continue;
    map.set(id, { id, name });
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
});

const filteredTradeIncoming = computed(() => {
  let list = state.tradeIncoming;
  if (state.tradeIncomingUserFilter !== "all") {
    const id = Number(state.tradeIncomingUserFilter);
    list = list.filter((item) => Number(item?.fromUserId || 0) === id);
  }
  const query = normalizeTradeQuery(state.tradeSearchIncoming);
  if (query) {
    list = list.filter((item) => {
      const fromUser = String(item?.fromUserName || "").toLowerCase();
      const offeredName = String(
        item?.offeredSticker?.name || "",
      ).toLowerCase();
      const offeredNum = String(item?.offeredSticker?.num || "");
      const requestedName = String(
        item?.requestedSticker?.name || "",
      ).toLowerCase();
      const requestedNum = String(item?.requestedSticker?.num || "");
      return (
        fromUser.includes(query) ||
        offeredName.includes(query) ||
        offeredNum.includes(query) ||
        requestedName.includes(query) ||
        requestedNum.includes(query)
      );
    });
  }
  return list;
});

const filteredTradeOutgoing = computed(() => {
  let list = state.tradeOutgoing;
  if (state.tradeOutgoingUserFilter !== "all") {
    const id = Number(state.tradeOutgoingUserFilter);
    list = list.filter((item) => Number(item?.toUserId || 0) === id);
  }
  const query = normalizeTradeQuery(state.tradeSearchOutgoing);
  if (query) {
    list = list.filter((item) => {
      const toUser = String(item?.toUserName || "").toLowerCase();
      const offeredName = String(
        item?.offeredSticker?.name || "",
      ).toLowerCase();
      const offeredNum = String(item?.offeredSticker?.num || "");
      const requestedName = String(
        item?.requestedSticker?.name || "",
      ).toLowerCase();
      const requestedNum = String(item?.requestedSticker?.num || "");
      return (
        toUser.includes(query) ||
        offeredName.includes(query) ||
        offeredNum.includes(query) ||
        requestedName.includes(query) ||
        requestedNum.includes(query)
      );
    });
  }
  return list;
});

const filteredTradeHistory = computed(() => {
  let list = state.tradeHistory;
  if (state.tradeHistoryUserFilter !== "all") {
    const id = Number(state.tradeHistoryUserFilter);
    list = list.filter((item) => Number(item?.partnerUserId || 0) === id);
  }
  if (state.tradeHistoryDirection === "sent") {
    list = list.filter((item) => Boolean(item?.iSent));
  }
  if (state.tradeHistoryDirection === "received") {
    list = list.filter((item) => !item?.iSent);
  }
  const query = normalizeTradeQuery(state.tradeSearchHistory);
  if (query) {
    list = list.filter((item) => {
      const partner = String(item?.partnerName || "").toLowerCase();
      const offeredName = String(
        item?.offeredSticker?.name || "",
      ).toLowerCase();
      const offeredNum = String(item?.offeredSticker?.num || "");
      const requestedName = String(
        item?.requestedSticker?.name || "",
      ).toLowerCase();
      const requestedNum = String(item?.requestedSticker?.num || "");
      return (
        partner.includes(query) ||
        offeredName.includes(query) ||
        offeredNum.includes(query) ||
        requestedName.includes(query) ||
        requestedNum.includes(query)
      );
    });
  }
  return list;
});

const tradeAvailablePageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(filteredTradeAvailable.value.length / state.tradePageSize),
  ),
);
const tradeIncomingPageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(filteredTradeIncoming.value.length / state.tradePageSize),
  ),
);
const tradeOutgoingPageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(filteredTradeOutgoing.value.length / state.tradePageSize),
  ),
);
const tradeHistoryPageCount = computed(() =>
  Math.max(
    1,
    Math.ceil(filteredTradeHistory.value.length / state.tradePageSize),
  ),
);

const tradeAvailableSafePage = computed(() =>
  Math.min(state.tradeAvailablePage, tradeAvailablePageCount.value),
);
const tradeIncomingSafePage = computed(() =>
  Math.min(state.tradeIncomingPage, tradeIncomingPageCount.value),
);
const tradeOutgoingSafePage = computed(() =>
  Math.min(state.tradeOutgoingPage, tradeOutgoingPageCount.value),
);
const tradeHistorySafePage = computed(() =>
  Math.min(state.tradeHistoryPage, tradeHistoryPageCount.value),
);

const filteredTradeAvailablePaged = computed(() => {
  const start = (tradeAvailableSafePage.value - 1) * state.tradePageSize;
  return filteredTradeAvailable.value.slice(start, start + state.tradePageSize);
});
const filteredTradeIncomingPaged = computed(() => {
  const start = (tradeIncomingSafePage.value - 1) * state.tradePageSize;
  return filteredTradeIncoming.value.slice(start, start + state.tradePageSize);
});
const filteredTradeOutgoingPaged = computed(() => {
  const start = (tradeOutgoingSafePage.value - 1) * state.tradePageSize;
  return filteredTradeOutgoing.value.slice(start, start + state.tradePageSize);
});
const filteredTradeHistoryPaged = computed(() => {
  const start = (tradeHistorySafePage.value - 1) * state.tradePageSize;
  return filteredTradeHistory.value.slice(start, start + state.tradePageSize);
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
          <h1 class="landing-title">Álbum de Figurinhas</h1>
          <p class="landing-subtitle">
            Colecione, complete e troque figurinhas com outros fãs da Copa do
            Mundo 2026. Ganhe moedas nas trocas aceitas, resgate pacotinhos e
            acompanhe tudo por notificações.
          </p>
          <div class="landing-actions">
            <button
              type="button"
              class="landing-btn-primary landing-btn-google"
              @click="openAuth('login')"
            >
              <svg
                class="google-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Entrar com Google
            </button>
          </div>
        </div>
      </div>
      <div class="landing-features">
        <div class="landing-feature">
          <span class="landing-feature-icon">📒</span>
          <strong>Colecione</strong>
          <p>
            Abra pacotinhos com seus cupons e monte sua coleção com
            {{ total }} figurinhas das 48 seleções.
          </p>
        </div>
        <div class="landing-feature">
          <span class="landing-feature-icon">🔄</span>
          <strong>Transferências</strong>
          <p>
            Envie e receba propostas de troca durante as janelas de
            transferências abertas.
          </p>
        </div>
        <div class="landing-feature">
          <span class="landing-feature-icon">🪙</span>
          <strong>Moedas de troca</strong>
          <p>
            Cada troca aceita gera moedas para os dois usuários. Troque moedas
            por novos pacotinhos.
          </p>
        </div>
        <div class="landing-feature">
          <span class="landing-feature-icon">🔔</span>
          <strong>Notificações</strong>
          <p>
            Acompanhe cupons recebidos, ofertas de troca e confirmações em tempo
            real.
          </p>
        </div>
        <div class="landing-feature">
          <span class="landing-feature-icon">🎟️</span>
          <strong>Cupons</strong>
          <p>
            Resgate códigos promocionais e cupons gerados pela administração
            para liberar pacotes.
          </p>
        </div>
        <div class="landing-feature">
          <span class="landing-feature-icon">📊</span>
          <strong>Progresso completo</strong>
          <p>
            Veja total colado, faltantes e repetidas para completar seu álbum
            com estratégia.
          </p>
        </div>
      </div>
      <footer class="landing-footer">
        <p>
          Álbum Copa 2026 · {{ total }} figurinhas · EUA, Canadá e México · FIFA
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
          <h1>Álbum Copa 2026</h1>
          <p>FIFA World Cup 2026™</p>
        </div>
        <div class="auth-card">
          <div class="auth-card-tabs">
            <button type="button" class="auth-tab active">
              <svg
                class="google-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Entrar com Google
            </button>
          </div>
          <div class="auth-form auth-google-form">
            <p class="auth-google-hint">
              Use sua conta Google para entrar. Se o email for
              <strong>@ifc.edu.br</strong>, o perfil será
              <strong>servidor</strong>.
            </p>
            <div id="google-signin-button" class="google-signin-button"></div>
            <button
              type="button"
              class="auth-submit-btn"
              @click="promptGoogleSignIn"
            >
              Continuar com Google
            </button>
            <p v-if="ui.authMsg" class="auth-error">{{ ui.authMsg }}</p>
          </div>
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
        <h1>Álbum Copa 2026</h1>
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
      <button
        class="notif-bell-btn topbar-notif-bell"
        type="button"
        :class="{ active: ui.notificationsOpen }"
        :aria-label="`Notificações${state.notificationsUnread > 0 ? ` (${state.notificationsUnread} não lidas)` : ''}`"
        @click="openNotifications"
      >
        🔔
        <span v-if="state.notificationsUnread > 0" class="notif-badge">
          {{ state.notificationsUnread > 9 ? "9+" : state.notificationsUnread }}
        </span>
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

    <!-- ── Notifications panel ── -->
    <Teleport to="body">
      <div
        v-if="ui.notificationsOpen"
        class="notif-overlay"
        @click.self="closeNotifications"
      >
        <div class="notif-panel">
          <div class="notif-panel-head">
            <h3>Notificações</h3>
            <button
              type="button"
              class="notif-close-btn"
              @click="closeNotifications"
            >
              ✕
            </button>
          </div>
          <div class="notif-panel-body">
            <p v-if="state.notifications.length === 0" class="notif-empty">
              Nenhuma notificação ainda.
            </p>
            <ul v-else class="notif-list">
              <li
                v-for="notif in state.notifications"
                :key="notif.id"
                class="notif-item"
                :class="`notif-type-${notif.type}`"
              >
                <span class="notif-icon">
                  {{ notif.icon || "🔔" }}
                </span>
                <div class="notif-content">
                  <strong>{{ notif.title }}</strong>
                  <p>{{ notif.message }}</p>
                  <div class="notif-meta-row">
                    <small>{{ formatDateTime(notif.createdAt) }}</small>
                    <button
                      v-if="
                        notif.type === 'coupon_created' && notif.payload?.code
                      "
                      type="button"
                      class="notif-copy-btn"
                      :aria-label="`Copiar cupom ${notif.payload.code}`"
                      @click="copyCouponCodeFromNotification(notif)"
                    >
                      📋
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </div>
          <div v-if="state.notifications.length > 0" class="notif-panel-foot">
            <button
              type="button"
              class="notif-clear-btn"
              @click="clearNotifications"
            >
              Limpar tudo
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <nav class="tabs" :class="{ open: ui.mobileMenuOpen }">
      <button
        type="button"
        :class="{ active: state.view === 'dashboard' }"
        @click="openDashboardView()"
      >
        Início
      </button>
      <button
        type="button"
        :class="{ active: isCollectionView }"
        @click="openCollectionView('flip')"
      >
        Meu Álbum
        <span v-if="hasNewStickerAlerts" class="tab-badge">{{
          state.newStickersUnread
        }}</span>
      </button>
      <button
        type="button"
        :class="{ active: state.view === 'trade' }"
        class="tab-trade"
        @click="openTradeView"
      >
        Transferências
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
        <div v-if="tradeWindowConfigured" class="dashboard-trade-window-status">
          <div class="dashboard-trade-top-row">
            <div
              :class="[
                'trade-status-indicator',
                { open: tradeWindowIsOpenNow },
              ]"
            >
              <span class="status-emoji">{{
                tradeWindowIsOpenNow ? "🟢" : "🔴"
              }}</span>
              <div class="status-text">
                <small>Janela de trocas</small>
                <strong>{{ tradeWindowStatusText }}</strong>
              </div>
              <div
                class="dashboard-coins-chip"
                title="Moedas de troca acumuladas"
              >
                <span>🪙</span>
                <strong>{{ state.tradeCoins }}</strong>
                <small>moedas</small>
              </div>
            </div>
          </div>
        </div>
        <div class="panel-head">
          <h2>Visão Geral</h2>
          <span class="badge-chip"
            >{{ dashboardPercentDisplay }}% completo</span
          >
        </div>
        <div class="dashboard-overview">
          <div
            class="dashboard-ring"
            :style="{
              background: `conic-gradient(var(--progress-a) 0%, var(--progress-b) ${dashboardPercentDisplay}%, rgba(148, 163, 184, 0.22) ${dashboardPercentDisplay}% 100%)`,
              '--fill-pct': `${dashboardPercentDisplay}%`,
              '--fill-raw': dashboardPercentDisplay,
            }"
          >
            <div class="dashboard-ring-img" aria-hidden="true">
              <img src="/ring.webp" alt="" />
            </div>
            <div class="dashboard-ring-core" aria-hidden="true"></div>
            <div class="dashboard-ring-orbit orbit-total">
              <small>Total</small>
              <strong>{{ dashboardTotalDisplay }}</strong>
            </div>
            <div class="dashboard-ring-orbit orbit-new">
              <small>Coladas</small>
              <strong>{{ dashboardCollectedDisplay }}</strong>
            </div>
            <div class="dashboard-ring-orbit orbit-missing">
              <small>Faltando</small>
              <strong>{{ dashboardMissingDisplay }}</strong>
            </div>
            <div class="dashboard-ring-orbit orbit-dup">
              <small>Repetidas</small>
              <strong>{{ dashboardDuplicatesDisplay }}</strong>
            </div>
          </div>

          <div class="dashboard-legend">
            <article>
              <span class="dot dot-collected" />
              <div>
                <strong>{{ dashboardCollectedDisplay }}</strong>
                <small>Figurinhas coladas</small>
              </div>
            </article>
            <article>
              <span class="dot dot-missing" />
              <div>
                <strong>{{ dashboardMissingDisplay }}</strong>
                <small>Ainda faltando</small>
              </div>
            </article>
            <article>
              <span class="dot dot-duplicates" />
              <div>
                <strong>{{ dashboardDuplicatesDisplay }}</strong>
                <small>Repetidas para troca</small>
              </div>
            </article>
          </div>
        </div>
        <div v-if="isAuthenticated" class="history">
          <h3>Últimas figurinhas</h3>
          <p v-if="latestNewStickers.length === 0">
            Nenhuma figurinha nova ainda.
          </p>
          <div v-else class="history-new-strip">
            <article
              v-for="item in latestNewStickers"
              :key="`new-${item.date}-${item.id}`"
              class="history-new-card"
              :style="stickerBorder(item)"
            >
              <div
                v-if="getStickerPhotoForDisplay(item)"
                class="sticker-photo-wrap history-new-photo"
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
              <span class="num">#{{ item.num }}</span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.teamName || groupLabel(item) }}</small>
              <small v-if="item.source === 'troca'" class="history-new-trade">
                com {{ item.tradedWith }}
              </small>
              <small class="history-new-date">
                {{ formatDateTime(item.date) }}
              </small>
            </article>
          </div>
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
            @click="handleAdminRefresh"
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

        <div v-if="adminSubTabs.length > 0" class="admin-subtabs">
          <button
            v-for="tab in adminSubTabs"
            :key="tab.key"
            type="button"
            class="admin-subtab-btn"
            :class="{ active: ui.adminTab === tab.key }"
            @click="selectAdminTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="manage-panel admin-panel-shell">
          <p v-if="ui.managePanelLoading" class="read-only-hint">
            Carregando usuários...
          </p>
          <p v-if="ui.managePanelMsg" class="read-only-hint">
            {{ ui.managePanelMsg }}
          </p>

          <div
            v-if="ui.adminTab === 'stickers' && isAdmin"
            class="manage-create-sticker-box"
          >
            <h4>Criar nova figurinha</h4>
            <div class="manage-create-sticker-form">
              <input
                v-model.trim="adminStickerForm.name"
                type="text"
                placeholder="Nome da figurinha"
              />
              <select v-model="adminStickerForm.icon">
                <option
                  v-for="opt in ADMIN_ICON_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
              <select v-model="adminStickerForm.teamId">
                <option value="">Especial (sem time)</option>
                <option
                  v-for="team in adminTeamOptions"
                  :key="team.teamId"
                  :value="team.teamId"
                >
                  {{ team.teamName }} ({{ team.sectionName }})
                </option>
              </select>
              <input
                type="file"
                accept="image/*"
                @change="handleAdminStickerImageUpload"
              />
              <button type="button" @click="createCustomSticker">
                Criar Figurinha
              </button>
            </div>
            <div
              v-if="adminStickerForm.image"
              class="manage-sticker-upload-preview"
            >
              <img
                :src="adminStickerForm.image"
                alt="Preview da figurinha"
                class="manage-sticker-upload-thumb"
              />
              <small>
                {{ adminStickerForm.imageFileName || "Imagem selecionada" }}
              </small>
              <button type="button" @click="clearAdminStickerImage">
                Remover imagem
              </button>
            </div>
            <p v-if="ui.stickerCreateMsg" class="read-only-hint">
              {{ ui.stickerCreateMsg }}
            </p>
          </div>

          <div
            v-if="ui.adminTab === 'stickers' && isAdmin"
            class="manage-created-stickers-box"
          >
            <h4>Últimas figurinhas criadas</h4>
            <p v-if="ui.recentStickersLoading" class="read-only-hint">
              Carregando histórico de figurinhas...
            </p>
            <p v-else-if="ui.recentStickersMsg" class="read-only-hint">
              {{ ui.recentStickersMsg }}
            </p>
            <ul
              v-else-if="state.recentCreatedStickers.length > 0"
              class="recent-stickers-list"
            >
              <li
                v-for="item in state.recentCreatedStickers"
                :key="item.id"
                class="recent-sticker-item"
              >
                <span class="recent-sticker-main">
                  #{{ item.num }} {{ item.icon || "🎟️" }} {{ item.name }}
                </span>
                <small>
                  {{ item.teamName || "Especial" }} •
                  {{ item.createdByUserName || "Admin" }} •
                  {{ formatDateTime(item.createdAt) }}
                </small>
                <button
                  type="button"
                  class="recent-sticker-delete-btn"
                  title="Excluir figurinha"
                  @click="deleteCustomSticker(item.id, item.name)"
                >
                  🗑️
                </button>
              </li>
            </ul>
            <p v-else class="read-only-hint">Nenhuma figurinha criada ainda.</p>
          </div>

          <div
            v-if="ui.adminTab === 'coupons' && canManageCoupons"
            class="manage-coupon-box"
          >
            <h4>Gerar cupom para pacote</h4>
            <p v-if="!isAdmin" class="read-only-hint">
              Como servidor, o limite é 1 cupom por dia para o mesmo usuário,
              com 1 a 3 pacotes por cupom.
            </p>
            <div class="manage-coupon-form">
              <select v-model="adminTools.targetUserId">
                <option v-if="isAdmin" value="">
                  Cupom livre (qualquer usuário)
                </option>
                <option
                  v-for="u in state.managedUsers.filter((x) => !x.isBlocked)"
                  :key="u.id"
                  :value="String(u.id)"
                >
                  {{ u.name }} ({{ u.role }})
                </option>
              </select>
              <input
                v-if="canManageCoupons"
                v-model.number="adminTools.packs"
                type="number"
                min="1"
                :max="isAdmin ? 100 : 3"
                placeholder="Pacotes"
              />
              <button type="button" @click="generateManagedCoupon">
                Gerar Cupom
              </button>
            </div>
            <div v-if="ui.couponPanelKind" class="coupon-feedback-row">
              <span class="coupon-kind-badge" :class="ui.couponPanelKind">
                {{
                  ui.couponPanelKind === "generic"
                    ? "Cupom livre"
                    : ui.couponPanelKind === "targeted"
                      ? "Cupom direcionado"
                      : "Erro"
                }}
              </span>
              <span v-if="ui.couponPanelCode" class="coupon-code-chip">
                {{ ui.couponPanelCode }}
              </span>
            </div>
            <p v-if="ui.couponPanelMsg" class="read-only-hint">
              {{ ui.couponPanelMsg }}
            </p>
          </div>

          <div
            v-if="ui.adminTab === 'users' && isAdmin"
            class="manage-users-box"
          >
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
                <option value="servidor">servidor</option>
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
                    <th>
                      <button
                        type="button"
                        @click="setManagedUsersSort('createdAt')"
                      >
                        Criado em
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
                      <small>{{ formatDateTime(u.createdAt) }}</small>
                    </td>
                    <td>
                      <div class="admin-user-actions-inline">
                        <button type="button" @click="openManagedUserEditor(u)">
                          Editar
                        </button>
                        <button type="button" @click="openCouponsForUser(u)">
                          Ver cupons
                        </button>
                      </div>
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
                    <option value="servidor">servidor</option>
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

          <div
            v-if="canManageCoupons && ui.adminTab === 'coupons'"
            class="manage-users-box"
          >
            <h4>
              {{
                isAdmin ? "Todos os cupons gerados" : "Cupons gerados por você"
              }}
            </h4>
            <div class="manage-users-toolbar">
              <input
                v-model.trim="adminTools.couponSearch"
                type="search"
                placeholder="Buscar por código, usuário alvo ou criador"
                @input="setManagedCouponsPage(1)"
              />
              <select
                v-model="adminTools.couponStatusFilter"
                @change="setManagedCouponsPage(1)"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="redeemed">Resgatados</option>
              </select>
              <select
                v-model="adminTools.couponUserFilter"
                @change="setManagedCouponsPage(1)"
              >
                <option value="all">Todos os usuários</option>
                <option
                  v-for="u in state.managedUsers"
                  :key="`coupon-filter-${u.id}`"
                  :value="String(u.id)"
                >
                  {{ u.name }}
                </option>
              </select>
            </div>

            <p v-if="ui.adminCouponsLoading" class="read-only-hint">
              Carregando cupons...
            </p>
            <p v-else-if="ui.adminCouponsMsg" class="read-only-hint">
              {{ ui.adminCouponsMsg }}
            </p>

            <div v-else class="admin-users-table-wrap">
              <table class="admin-users-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Pacotes</th>
                    <th>Alvo</th>
                    <th>Criado por</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="managedCouponsPaged.length === 0">
                    <td colspan="8">Nenhum cupom encontrado.</td>
                  </tr>
                  <tr v-for="coupon in managedCouponsPaged" :key="coupon.id">
                    <td>
                      <strong>{{ coupon.code }}</strong>
                    </td>
                    <td>
                      <span class="table-pill">
                        {{ coupon.isGeneric ? "livre" : "direcionado" }}
                      </span>
                    </td>
                    <td>{{ coupon.packs }}</td>
                    <td>{{ coupon.targetUserName || "-" }}</td>
                    <td>{{ coupon.createdByUserName || "-" }}</td>
                    <td>
                      <span
                        class="table-pill"
                        :class="
                          coupon.status === 'active' ? 'active' : 'blocked'
                        "
                      >
                        {{ coupon.status === "active" ? "ativo" : "resgatado" }}
                      </span>
                    </td>
                    <td>{{ formatDateTime(coupon.createdAt) }}</td>
                    <td>
                      <button
                        v-if="isAdmin"
                        type="button"
                        :disabled="ui.deletingCouponId === Number(coupon.id)"
                        @click="deleteManagedCoupon(coupon)"
                      >
                        {{
                          ui.deletingCouponId === Number(coupon.id)
                            ? "Excluindo..."
                            : "Excluir"
                        }}
                      </button>
                      <span v-else>-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="admin-pagination">
              <div>
                <small>
                  Exibindo {{ managedCouponsPageFrom }}-{{
                    managedCouponsPageTo
                  }}
                  de
                  {{ filteredManagedCoupons.length }}
                </small>
                <label class="page-size-label">
                  Itens por página
                  <select
                    :value="adminTools.couponPageSize"
                    @change="setManagedCouponsPageSize($event.target.value)"
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
                  :disabled="managedCouponsSafePage <= 1"
                  @click="setManagedCouponsPage(managedCouponsSafePage - 1)"
                >
                  Anterior
                </button>
                <span>
                  Página {{ managedCouponsSafePage }} de
                  {{ managedCouponsPageCount }}
                </span>
                <button
                  type="button"
                  :disabled="managedCouponsSafePage >= managedCouponsPageCount"
                  @click="setManagedCouponsPage(managedCouponsSafePage + 1)"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="ui.adminTab === 'trade-windows' && isAdmin"
            class="manage-users-box manage-trade-window-box"
          >
            <h3 style="margin-bottom: 1.5rem; color: #1f2937">
              Gerenciar Janelas de Trocas
            </h3>

            <div class="trade-windows-toolbar">
              <select v-model="adminTools.tradeWindowFilter">
                <option value="all">Todas as janelas atuais/futuras</option>
                <option value="open">Somente abertas</option>
                <option value="upcoming">Somente próximas</option>
              </select>
              <label class="trade-windows-checkbox">
                <input
                  v-model="adminTools.hidePastTradeWindows"
                  type="checkbox"
                />
                Ocultar janelas antigas
              </label>
            </div>

            <div class="trade-windows-form">
              <h4 style="margin: 0 0 0.8rem 0; color: #10a3ae">
                Criar Nova Janela
              </h4>
              <div class="trade-windows-form-row">
                <label>
                  Início
                  <input
                    v-model="ui.adminWindowForm.startsAt"
                    type="datetime-local"
                    placeholder="Data e hora de início"
                  />
                </label>
                <label>
                  Fim
                  <input
                    v-model="ui.adminWindowForm.endsAt"
                    type="datetime-local"
                    placeholder="Data e hora de término"
                  />
                </label>
                <button
                  type="button"
                  :disabled="ui.adminWindowSaving"
                  @click="createTradeWindow"
                >
                  {{ ui.adminWindowSaving ? "Criando..." : "Criar Janela" }}
                </button>
              </div>
              <p v-if="ui.adminWindowMsg" class="read-only-hint">
                {{ ui.adminWindowMsg }}
              </p>
            </div>

            <div v-if="filteredTradeWindows.length > 0">
              <h4 style="margin: 1.5rem 0 1rem 0; color: #1f2937">
                Janelas listadas ({{ filteredTradeWindows.length }})
              </h4>
              <div class="trade-windows-list">
                <div
                  v-for="window in filteredTradeWindows"
                  :key="window.id"
                  class="trade-window-item"
                  :class="{ open: window.isOpen }"
                >
                  <div class="trade-window-item-content">
                    <div class="trade-window-item-times">
                      <div class="trade-window-item-time">
                        📅 {{ formatDateTime(window.startsAt) }}
                      </div>
                      <div class="trade-window-item-time">
                        ⏱️ {{ formatDateTime(window.endsAt) }}
                      </div>
                    </div>
                    <div class="trade-window-item-meta">
                      <span v-if="window.isOpen">
                        <span class="trade-window-status-badge">🟢 Aberta</span>
                      </span>
                      <span>👤 {{ window.createdByUserName }}</span>
                      <span>📆 {{ formatDateTime(window.createdAt) }}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="trade-window-delete-btn"
                    :disabled="ui.adminWindowSaving"
                    @click="deleteTradeWindow(window.id)"
                    title="Deletar esta janela"
                  >
                    {{ ui.adminWindowSaving ? "..." : "Deletar" }}
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="read-only-hint">
              ℹ️ Nenhuma janela encontrada com os filtros atuais.
            </div>
          </div>
        </div>
      </section>

      <section v-if="state.view === 'album'" class="panel">
        <div class="panel-head">
          <h2>Catálogo Completo</h2>
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
          <article
            v-for="item in missingList"
            :key="item.id"
            class="detail-list-item"
            :style="stickerBorder(item)"
          >
            <div class="detail-list-main">
              <span class="num">#{{ item.num }}</span>
              <strong>{{ item.name }}</strong>
              <p>{{ item.teamName || groupLabel(item) }}</p>
            </div>
            <div class="detail-list-meta">
              <span class="detail-chip">{{ item.sectionName }}</span>
              <span class="detail-chip detail-chip-muted">{{ item.type }}</span>
              <span class="detail-chip detail-chip-alert">Faltando</span>
            </div>
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
          <article
            v-for="item in duplicatesList"
            :key="item.id"
            class="detail-list-item"
            :style="stickerBorder(item)"
          >
            <div class="detail-list-main">
              <span class="num">#{{ item.num }}</span>
              <strong>{{ item.name }}</strong>
              <p>{{ item.teamName || groupLabel(item) }}</p>
            </div>
            <div class="detail-list-meta">
              <span class="detail-chip">{{ item.sectionName }}</span>
              <span class="detail-chip detail-chip-muted">{{ item.type }}</span>
              <span class="detail-chip detail-chip-success">
                {{ getCount(item.id) }}x coladas
              </span>
              <span class="detail-chip detail-chip-alert">
                +{{ Math.max(0, getCount(item.id) - 1) }} repetidas
              </span>
            </div>
          </article>
        </div>
      </section>

      <section v-if="state.view === 'flip'" class="panel panel-flip">
        <div class="panel-head">
          <h2>Folhear Álbum</h2>
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
          placeholder="Buscar por nome, time ou número"
        />
        <p v-if="state.searchQuery.trim().length < 2">
          Digite pelo menos 2 caracteres.
        </p>
        <div v-else class="list search-list">
          <article
            v-for="item in searchResults"
            :key="item.id"
            class="detail-list-item"
            :style="stickerBorder(item)"
          >
            <div class="detail-list-main">
              <span class="num">#{{ item.num }}</span>
              <strong>{{ item.name }}</strong>
              <p>{{ item.teamName || groupLabel(item) }}</p>
            </div>
            <div class="detail-list-meta">
              <span class="detail-chip">{{ item.sectionName }}</span>
              <span class="detail-chip detail-chip-muted">{{ item.type }}</span>
              <span class="detail-chip detail-chip-status">
                {{ stickerStatus(item) }}
              </span>
              <span class="detail-chip detail-chip-muted">
                {{ getCount(item.id) }} no álbum
              </span>
            </div>
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
        <div class="trade-coins-bar">
          <span class="trade-coins-bar-info">
            🪙
            <strong>{{ state.tradeCoins }}/{{ TRADE_COINS_PER_COUPON }}</strong>
            moedas
            <span class="trade-coins-bar-hint">(+1 por troca aceita)</span>
          </span>
          <button
            type="button"
            class="trade-coins-bar-btn"
            :disabled="!canRedeemTradeCoinsCoupon || ui.tradeCoinRedeemLoading"
            @click="redeemTradeCoinsCoupon"
          >
            {{
              ui.tradeCoinRedeemLoading
                ? "Resgatando..."
                : canRedeemTradeCoinsCoupon
                  ? "Trocar por 1 pacote"
                  : `Faltam ${tradeCoinsNeeded}`
            }}
          </button>
        </div>

        <div
          v-if="!tradeWindowIsOpenNow && nextTradeWindow"
          class="trade-window-countdown-box"
        >
          <p class="read-only-hint">
            <strong>🕒 Próxima janela de trocas abre em:</strong><br />
            {{
              formatCountdownLongFormat(
                new Date(nextTradeWindow.startsAt).getTime() -
                  ui.tradeWindowClockNow,
              )
            }}
          </p>
        </div>
        <p
          v-else
          class="read-only-hint"
          :class="{ 'trade-window-open': tradeWindowIsOpenNow }"
        >
          {{ tradeWindowStatusText }}. {{ tradeWindowCountdownText }}
        </p>

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
            <input
              v-model.trim="state.tradeSearchAvailable"
              type="search"
              placeholder="Buscar por figurinha, número ou usuário"
              @input="setTradePage('available', 1)"
            />
            <select
              v-model="state.tradeFilterUser"
              @change="setTradePage('available', 1)"
            >
              <option value="all">Todos os usuários</option>
              <option
                v-for="user in state.tradeUsers"
                :key="user.id"
                :value="String(user.id)"
              >
                {{ user.name }}
              </option>
            </select>
            <select
              v-model="state.tradeFilterGroup"
              @change="setTradePage('available', 1)"
            >
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
            <label class="page-size-label trade-page-size-label">
              Itens por página
              <select
                v-model.number="state.tradePageSize"
                @change="setTradePage('available', 1)"
              >
                <option :value="5">5</option>
                <option :value="8">8</option>
                <option :value="12">12</option>
              </select>
            </label>
          </div>
          <p v-if="ui.tradeAvailableLoading" class="trade-hint">
            Carregando...
          </p>
          <p v-else-if="filteredTradeAvailable.length === 0" class="trade-hint">
            Nenhuma figurinha disponível com os filtros selecionados.
          </p>
          <div v-else class="trade-available-list">
            <article
              v-for="entry in filteredTradeAvailablePaged"
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
                :disabled="
                  myTradableDuplicatesForOffer.length === 0 ||
                  !tradeWindowIsOpenNow
                "
                @click="openTradeOffer(entry)"
              >
                {{
                  !tradeWindowIsOpenNow
                    ? "Janela fechada"
                    : myTradableDuplicatesForOffer.length === 0
                      ? "Sem repetidas"
                      : "Pedir troca"
                }}
              </button>
            </article>
          </div>
          <div
            v-if="filteredTradeAvailable.length > 0"
            class="admin-pagination trade-pagination"
          >
            <small>
              Página {{ tradeAvailableSafePage }} de
              {{ tradeAvailablePageCount }} ({{ filteredTradeAvailable.length }}
              itens)
            </small>
            <div class="admin-pagination-actions">
              <button
                type="button"
                :disabled="tradeAvailableSafePage <= 1"
                @click="setTradePage('available', tradeAvailableSafePage - 1)"
              >
                Anterior
              </button>
              <span
                >{{ tradeAvailableSafePage }}/{{
                  tradeAvailablePageCount
                }}</span
              >
              <button
                type="button"
                :disabled="tradeAvailableSafePage >= tradeAvailablePageCount"
                @click="setTradePage('available', tradeAvailableSafePage + 1)"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        <!-- Incoming offers -->
        <div v-if="state.tradeSubView === 'incoming'">
          <div class="trade-filters">
            <input
              v-model.trim="state.tradeSearchIncoming"
              type="search"
              placeholder="Buscar por usuário ou figurinha"
              @input="setTradePage('incoming', 1)"
            />
            <select
              v-model="state.tradeIncomingUserFilter"
              @change="setTradePage('incoming', 1)"
            >
              <option value="all">Todos os remetentes</option>
              <option
                v-for="user in tradeIncomingUsers"
                :key="`in-${user.id}`"
                :value="String(user.id)"
              >
                {{ user.name }}
              </option>
            </select>
          </div>
          <p v-if="ui.tradeLoading" class="trade-hint">Carregando...</p>
          <p v-else-if="filteredTradeIncoming.length === 0" class="trade-hint">
            Nenhuma proposta de troca recebida.
          </p>
          <div v-else class="trade-offer-list">
            <article
              v-for="offer in filteredTradeIncomingPaged"
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
                <template v-if="offer.status === 'pending'">
                  <button
                    type="button"
                    class="trade-accept-btn"
                    :disabled="!tradeWindowIsOpenNow"
                    @click="acceptTradeOffer(offer)"
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    class="trade-reject-btn"
                    :disabled="!tradeWindowIsOpenNow"
                    @click="rejectTradeOffer(offer)"
                  >
                    Recusar
                  </button>
                </template>
                <span
                  v-else
                  class="trade-status-badge"
                  :data-status="offer.status"
                >
                  {{
                    offer.status === "accepted"
                      ? "Aceita"
                      : offer.status === "rejected"
                        ? "Rejeitada"
                        : "Cancelada"
                  }}
                </span>
              </div>
            </article>
          </div>
          <div
            v-if="filteredTradeIncoming.length > 0"
            class="admin-pagination trade-pagination"
          >
            <small>
              Página {{ tradeIncomingSafePage }} de
              {{ tradeIncomingPageCount }} ({{ filteredTradeIncoming.length }}
              itens)
            </small>
            <div class="admin-pagination-actions">
              <button
                type="button"
                :disabled="tradeIncomingSafePage <= 1"
                @click="setTradePage('incoming', tradeIncomingSafePage - 1)"
              >
                Anterior
              </button>
              <span
                >{{ tradeIncomingSafePage }}/{{ tradeIncomingPageCount }}</span
              >
              <button
                type="button"
                :disabled="tradeIncomingSafePage >= tradeIncomingPageCount"
                @click="setTradePage('incoming', tradeIncomingSafePage + 1)"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        <!-- Outgoing offers -->
        <div v-if="state.tradeSubView === 'outgoing'">
          <div class="trade-filters">
            <input
              v-model.trim="state.tradeSearchOutgoing"
              type="search"
              placeholder="Buscar por usuário ou figurinha"
              @input="setTradePage('outgoing', 1)"
            />
            <select
              v-model="state.tradeOutgoingUserFilter"
              @change="setTradePage('outgoing', 1)"
            >
              <option value="all">Todos os destinatários</option>
              <option
                v-for="user in tradeOutgoingUsers"
                :key="`out-${user.id}`"
                :value="String(user.id)"
              >
                {{ user.name }}
              </option>
            </select>
          </div>
          <p v-if="ui.tradeLoading" class="trade-hint">Carregando...</p>
          <p v-else-if="filteredTradeOutgoing.length === 0" class="trade-hint">
            Nenhuma proposta enviada aguardando resposta.
          </p>
          <div v-else class="trade-offer-list">
            <article
              v-for="offer in filteredTradeOutgoingPaged"
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
                <template v-if="offer.status === 'pending'">
                  <button
                    type="button"
                    class="trade-reject-btn"
                    :disabled="!tradeWindowIsOpenNow"
                    @click="cancelTradeOffer(offer)"
                  >
                    Cancelar proposta
                  </button>
                </template>
                <span
                  v-else
                  class="trade-status-badge"
                  :data-status="offer.status"
                >
                  {{
                    offer.status === "accepted"
                      ? "Aceita"
                      : offer.status === "rejected"
                        ? "Rejeitada"
                        : "Cancelada"
                  }}
                </span>
              </div>
            </article>
          </div>
          <div
            v-if="filteredTradeOutgoing.length > 0"
            class="admin-pagination trade-pagination"
          >
            <small>
              Página {{ tradeOutgoingSafePage }} de
              {{ tradeOutgoingPageCount }} ({{ filteredTradeOutgoing.length }}
              itens)
            </small>
            <div class="admin-pagination-actions">
              <button
                type="button"
                :disabled="tradeOutgoingSafePage <= 1"
                @click="setTradePage('outgoing', tradeOutgoingSafePage - 1)"
              >
                Anterior
              </button>
              <span
                >{{ tradeOutgoingSafePage }}/{{ tradeOutgoingPageCount }}</span
              >
              <button
                type="button"
                :disabled="tradeOutgoingSafePage >= tradeOutgoingPageCount"
                @click="setTradePage('outgoing', tradeOutgoingSafePage + 1)"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        <!-- Trade history -->
        <div v-if="state.tradeSubView === 'history'">
          <div class="trade-filters">
            <input
              v-model.trim="state.tradeSearchHistory"
              type="search"
              placeholder="Buscar por parceiro ou figurinha"
              @input="setTradePage('history', 1)"
            />
            <select
              v-model="state.tradeHistoryUserFilter"
              @change="setTradePage('history', 1)"
            >
              <option value="all">Todos os parceiros</option>
              <option
                v-for="user in tradeHistoryUsers"
                :key="`hist-${user.id}`"
                :value="String(user.id)"
              >
                {{ user.name }}
              </option>
            </select>
            <select
              v-model="state.tradeHistoryDirection"
              @change="setTradePage('history', 1)"
            >
              <option value="all">Enviadas e recebidas</option>
              <option value="sent">Somente enviadas</option>
              <option value="received">Somente recebidas</option>
            </select>
          </div>
          <p v-if="ui.tradeLoading" class="trade-hint">Carregando...</p>
          <p v-else-if="filteredTradeHistory.length === 0" class="trade-hint">
            Nenhuma troca realizada ainda.
          </p>
          <div v-else class="trade-history-list">
            <article
              v-for="entry in filteredTradeHistoryPaged"
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
          <div
            v-if="filteredTradeHistory.length > 0"
            class="admin-pagination trade-pagination"
          >
            <small>
              Página {{ tradeHistorySafePage }} de
              {{ tradeHistoryPageCount }} ({{ filteredTradeHistory.length }}
              itens)
            </small>
            <div class="admin-pagination-actions">
              <button
                type="button"
                :disabled="tradeHistorySafePage <= 1"
                @click="setTradePage('history', tradeHistorySafePage - 1)"
              >
                Anterior
              </button>
              <span
                >{{ tradeHistorySafePage }}/{{ tradeHistoryPageCount }}</span
              >
              <button
                type="button"
                :disabled="tradeHistorySafePage >= tradeHistoryPageCount"
                @click="setTradePage('history', tradeHistorySafePage + 1)"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </template>
    </section>

    <div
      v-if="ui.packOpen"
      class="modal"
      @click.self="ui.packStage === 'opened' && closePackModal()"
    >
      <div
        class="modal-box pack-modal-box"
        :class="`pack-stage-${ui.packStage}`"
      >
        <template v-if="ui.packStage !== 'opened'">
          <div class="pack-modal-head">
            <div>
              <h2>Pacotinho Lacrado</h2>
            </div>
            <button
              type="button"
              class="pack-close-btn"
              aria-label="Fechar modal"
              @click="closePackModal"
            >
              ✕
            </button>
          </div>
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
          <div class="pack-modal-head">
            <div class="pack-reveal-head">
              <h2>Figurinhas Reveladas</h2>
              <p>Confira o resultado deste pacotinho</p>
            </div>
            <button
              type="button"
              class="pack-close-btn"
              aria-label="Fechar modal"
              @click="closePackModal"
            >
              ✕
            </button>
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
          no momento (ou já estão reservadas em trocas pendentes).
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
              !tradeWindowIsOpenNow ||
              !ui.tradeTargetUser ||
              !ui.tradeOfferSticker ||
              ui.tradeLoading
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
        <h2>Código Promocional</h2>
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
      <div class="app-footer-cols">
        <div class="app-footer-left">
          <p>
            Álbum Copa 2026 · {{ total }} figurinhas · EUA, Canadá e México ·
            FIFA World Cup 2026™
          </p>
          <p>
            Projeto educacional desenvolvido pela
            <a
              href="https://fabrica.videira.ifc.edu.br"
              target="_blank"
              rel="noreferrer"
              >Fábrica de Software - IFC Videira</a
            >
          </p>
          <a
            class="app-footer-github"
            href="https://github.com/FabSoftwareVideira/fabrica-copa/"
            target="_blank"
            rel="noreferrer"
            aria-label="Repositório no GitHub"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"
              />
            </svg>
            <span>Código-fonte no GitHub</span>
          </a>
        </div>
        <div class="app-footer-right">
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
        </div>
      </div>
    </footer>
  </div>

  <!-- Toast global (visível em qualquer estado) -->
  <Teleport to="body">
    <div v-if="ui.toast" class="toast toast-teleport">{{ ui.toast }}</div>
  </Teleport>
</template>
