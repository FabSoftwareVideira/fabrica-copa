// Parte 1, colar no navegador, recupera o catálogo em uma variável global para uso posterior

(async () => {
  const url = `${location.origin}/copa/api/stickers/catalog`; // ajuste se necessário
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" }
  });

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao buscar catálogo`);
  }
  if (contentType.includes("text/html")) {
    throw new Error("A resposta veio como HTML (rota incorreta, redirect ou login), não JSON");
  }

  const data = JSON.parse(text);

  // catálogo completo
  window.CATALOGO_COMPLETO = data;

  // só array de figurinhas
  window.STICKERS = Array.isArray(data?.stickers) ? data.stickers : [];

  console.log("Catalogo salvo em window.CATALOGO_COMPLETO");
  console.log("Stickers salvos em window.STICKERS");
  console.log("Total:", window.STICKERS.length);
})();


// Parte 2, usar a variável global para acessar os dados do catálogo

(async () => {
  // SEGURANCA: bloqueia execucao fora de ambiente esperado
  const allowedHosts = ["localhost", "127.0.0.1", "fabrica.videira.ifc.edu.br"];
  if (!allowedHosts.includes(location.hostname)) {
    throw new Error("Host nao permitido para este teste.");
  }

  const proceed = confirm(
    "Teste de seguranca: isso vai tentar atualizar o album da sua conta atual. Continuar?"
  );
  if (!proceed) return;

  function getTokenFromStorage() {
    const keys = [
      ...Object.keys(localStorage),
      ...Object.keys(sessionStorage)
    ];
    const tokenKey = keys.find((k) => /token|jwt|access/i.test(k));
    if (!tokenKey) return null;

    const localVal = localStorage.getItem(tokenKey);
    const sessionVal = sessionStorage.getItem(tokenKey);
    const raw = localVal || sessionVal;

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return parsed?.accessToken || parsed?.token || parsed?.jwt || raw;
    } catch {
      return raw;
    }
  }

  const token = getTokenFromStorage();

  async function apiFetch(url, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
      credentials: "include",
      ...options,
      headers
    });
  }

  const baseCandidates = [
    `${location.origin}/copa/api`,
    `${location.origin}/api`,
    "/copa/api",
    "/api"
  ];

  let apiBase = null;
  let catalog = null;

  for (const base of baseCandidates) {
    try {
      const r = await apiFetch(`${base}/stickers/catalog`);
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const txt = await r.text();
      if (!r.ok || ct.includes("text/html")) continue;
      const data = JSON.parse(txt);
      if (Array.isArray(data?.stickers)) {
        apiBase = base;
        catalog = data;
        break;
      }
    } catch {}
  }

  if (!apiBase || !catalog) {
    throw new Error("Nao foi possivel localizar endpoint JSON do catalogo.");
  }

  const stateRes = await apiFetch(`${apiBase}/album/state`);
  const stateText = await stateRes.text();
  if (!stateRes.ok) {
    throw new Error(`Falha ao ler estado atual: HTTP ${stateRes.status} ${stateText}`);
  }
  const currentState = JSON.parse(stateText);

  const stickers = catalog.stickers || [];
  const beforeCollected = currentState?.collected || {};
  const beforeOwned = stickers.filter((s) => (beforeCollected[s.id] || 0) >= 1).length;

  // "forja" controlada para teste: 1 de cada figurinha
  const forgedCollected = {};
  for (const s of stickers) forgedCollected[s.id] = 1;

  const putRes = await apiFetch(`${apiBase}/album/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collected: forgedCollected })
  });

  const putBody = await putRes.text();

  const stateResAfter = await apiFetch(`${apiBase}/album/state`);
  const stateAfterText = await stateResAfter.text();
  const stateAfter = stateResAfter.ok ? JSON.parse(stateAfterText) : null;

  const afterCollected = stateAfter?.collected || {};
  const afterOwned = stickers.filter((s) => (afterCollected[s.id] || 0) >= 1).length;

  console.log("API base usada:", apiBase);
  console.log("Total catalogo:", stickers.length);
  console.log("Antes (possuidas):", beforeOwned);
  console.log("Depois (possuidas):", afterOwned);
  console.log("PUT status:", putRes.status, "PUT body:", putBody);

  if (afterOwned === stickers.length && stickers.length > 0) {
    console.warn("VULNERABILIDADE CONFIRMADA: servidor aceitou estado completo vindo do cliente.");
  } else {
    console.log("Nao confirmou vulnerabilidade por este vetor (ou houve bloqueio parcial).");
  }

  window.__SEC_TEST__ = {
    apiBase,
    total: stickers.length,
    beforeOwned,
    afterOwned,
    putStatus: putRes.status,
    putBody
  };
  console.log("Resultado salvo em window.__SEC_TEST__");
})();