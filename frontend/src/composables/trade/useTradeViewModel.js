import { computed } from "vue";

function createTradeViewModel({
  state,
  normalizeTradeQuery,
  availableLimit = 5,
  rerollCost = 1,
  coinsPerCoupon = 10,
}) {
  const tradeIncomingCount = computed(() => state.tradeIncoming.length);

  const tradeCoinsNeeded = computed(() =>
    Math.max(0, coinsPerCoupon - Number(state.tradeCoins || 0)),
  );

  const canRerollTradeAvailable = computed(
    () => Number(state.tradeCoins || 0) >= rerollCost && state.tradeAvailableHasMore,
  );

  const canRedeemTradeCoinsCoupon = computed(
    () => Number(state.tradeCoins || 0) >= coinsPerCoupon,
  );

  function setTradePage(view, value) {
    const next = Math.max(1, Number(value || 1));
    if (view === "incoming") state.tradeIncomingPage = next;
    if (view === "outgoing") state.tradeOutgoingPage = next;
    if (view === "history") state.tradeHistoryPage = next;
  }

  const filteredTradeAvailable = computed(() => {
    return Array.isArray(state.tradeAvailable) ? state.tradeAvailable : [];
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
        const offeredName = String(item?.offeredSticker?.name || "").toLowerCase();
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
        const offeredName = String(item?.offeredSticker?.name || "").toLowerCase();
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
        const offeredName = String(item?.offeredSticker?.name || "").toLowerCase();
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

  const tradeIncomingPageCount = computed(() =>
    Math.max(1, Math.ceil(filteredTradeIncoming.value.length / state.tradePageSize)),
  );
  const tradeOutgoingPageCount = computed(() =>
    Math.max(1, Math.ceil(filteredTradeOutgoing.value.length / state.tradePageSize)),
  );
  const tradeHistoryPageCount = computed(() =>
    Math.max(1, Math.ceil(filteredTradeHistory.value.length / state.tradePageSize)),
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

  return {
    TRADE_AVAILABLE_LIMIT: availableLimit,
    TRADE_AVAILABLE_REROLL_COST: rerollCost,
    TRADE_COINS_PER_COUPON: coinsPerCoupon,
    canRedeemTradeCoinsCoupon,
    canRerollTradeAvailable,
    filteredTradeAvailable,
    filteredTradeHistory,
    filteredTradeHistoryPaged,
    filteredTradeIncoming,
    filteredTradeIncomingPaged,
    filteredTradeOutgoing,
    filteredTradeOutgoingPaged,
    setTradePage,
    tradeCoinsNeeded,
    tradeHistoryPageCount,
    tradeHistorySafePage,
    tradeHistoryUsers,
    tradeIncomingCount,
    tradeIncomingPageCount,
    tradeIncomingSafePage,
    tradeIncomingUsers,
    tradeOutgoingPageCount,
    tradeOutgoingSafePage,
    tradeOutgoingUsers,
  };
}

export { createTradeViewModel };
