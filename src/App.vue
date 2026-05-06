<script setup>
import { computed, onMounted, reactive } from "vue";

const API_BASE_URL = "http://localhost:3001/api";
const PACKS_PER_DAY = 1;

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

const state = reactive({
  view: "dashboard",
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
  toast: "",
  packOpen: false,
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

onMounted(async () => {
  if (isAuthenticated.value) {
    await bootstrapAuth();
  } else {
    ui.authOpen = true;
    ui.authMode = "login";
  }
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
    ui.packOpen = true;

    await loadPackHistory();
  } catch (err) {
    setToast(err.message || "Falha ao abrir pacote");
  } finally {
    ui.openingPack = false;
  }
}

function closePackModal() {
  ui.packOpen = false;
  ui.pack = [];
  ui.wasOwned = [];
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
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div>
        <h1>Album Copa 2026</h1>
        <p>EUA, Canada e Mexico</p>
      </div>
      <div class="top-actions">
        <button class="promo-btn" type="button" @click="ui.promoOpen = true">
          Codigo
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
        :class="{ active: state.view === 'search' }"
        @click="state.view = 'search'"
      >
        Buscar
      </button>
    </nav>

    <main class="content">
      <section v-if="state.view === 'dashboard'" class="panel">
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
        <p class="read-only-hint">
          As figurinhas sao atualizadas apenas ao abrir pacotinhos.
        </p>
        <div class="cards">
          <article
            v-for="item in filteredAlbum"
            :key="item.id"
            class="card"
            :style="stickerBorder(item)"
          >
            <span class="num">#{{ item.num }}</span>
            <span class="icon">{{ item.icon }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ groupLabel(item) }}</small>
            <small>{{ stickerStatus(item) }}</small>
          </article>
        </div>
      </section>

      <section v-if="state.view === 'missing'" class="panel">
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
        <h3>Figurinhas repetidas ({{ duplicatesList.length }})</h3>
        <div class="list">
          <article v-for="item in duplicatesList" :key="item.id">
            <span>#{{ item.num }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ getCount(item.id) }}x</small>
          </article>
        </div>
      </section>

      <section v-if="state.view === 'search'" class="panel">
        <input
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
            <span class="icon">{{ item.icon }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.teamName || groupLabel(item) }}</small>
            <small>{{ stickerStatus(item) }}</small>
          </article>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div v-if="isAuthenticated" class="user-row">
        <span>Logado como {{ state.user.name }}</span>
        <button type="button" @click="logout">Sair</button>
      </div>
      <div v-else class="user-row">
        <button type="button" @click="openAuth('login')">Entrar</button>
        <button type="button" @click="openAuth('register')">Cadastrar</button>
      </div>
    </footer>

    <div v-if="ui.packOpen" class="modal">
      <div class="modal-box">
        <h2>Novo Pacotinho</h2>
        <div class="pack-grid">
          <article
            v-for="(item, index) in ui.pack"
            :key="`${item.id}-${index}`"
            class="pack-card"
            :class="{ owned: ui.wasOwned[index] }"
          >
            <span>#{{ item.num }}</span>
            <strong>{{ item.name }}</strong>
            <small>{{ ui.wasOwned[index] ? "Repetida" : "Nova" }}</small>
          </article>
        </div>
        <button type="button" @click="closePackModal">Fechar</button>
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
