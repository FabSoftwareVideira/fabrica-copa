import { withBasePath } from "./env";

const APP_TIMEZONE = "America/Sao_Paulo";
const PACKS_PER_DAY = 1;
const PACK_DRAG_OPEN_DISTANCE = 180;
const SYSTEM_EVENTS_CURSOR_KEY = "album-system-events-cursor";
const NOTIFICATIONS_LIMIT = 50;
const NOTIFICATIONS_KEY_PREFIX = "album-notifications";
const NOTIFICATIONS_UNREAD_KEY_PREFIX = "album-notifications-unread";
const DEFAULT_PLAYER_IMAGE = withBasePath("/player-default.webp");
const DEFAULT_TEAM_IMAGE = withBasePath("/teams/default.webp");
const DEFAULT_SPECIAL_IMAGE = withBasePath("/specials/especial_default.webp");
const TOASTY_IMAGE = withBasePath("/ee.gif");
const TOASTY_SOUND = withBasePath("/toasty.mp3");
const TEAM_IMAGE_EXTENSIONS = ["webp", "jpg", "jpeg", "png", "svg"];

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

export {
  ADMIN_ICON_OPTIONS,
  APP_TIMEZONE,
  DEFAULT_PLAYER_IMAGE,
  DEFAULT_SPECIAL_IMAGE,
  DEFAULT_TEAM_IMAGE,
  GROUP_COLORS,
  NOTIFICATIONS_KEY_PREFIX,
  NOTIFICATIONS_LIMIT,
  NOTIFICATIONS_UNREAD_KEY_PREFIX,
  PACK_DRAG_OPEN_DISTANCE,
  PACKS_PER_DAY,
  SYSTEM_EVENTS_CURSOR_KEY,
  TEAM_IMAGE_CODES,
  TEAM_IMAGE_EXTENSIONS,
  TOASTY_IMAGE,
  TOASTY_SOUND,
};
