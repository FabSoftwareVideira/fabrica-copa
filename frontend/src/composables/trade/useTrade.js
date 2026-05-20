function createTradeHandlers({
  state,
  ui,
  apiFetch,
  setToast,
  setTradePage,
  rerollCost,
}) {
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
      state.tradeAvailableTotal = Number(
        data.totalAvailable ?? state.tradeAvailable.length,
      );
      state.tradeAvailableHasMore = Boolean(
        data.hasMore ?? state.tradeAvailableTotal > state.tradeAvailable.length,
      );
      if (data.tradeCoins != null) {
        state.tradeCoins = Number(data.tradeCoins);
      }
      setTradePage("available", 1);
    } catch (err) {
      setToast(err.message || "Erro ao carregar figurinhas disponíveis");
    } finally {
      ui.tradeAvailableLoading = false;
    }
  }

  async function rerollTradeAvailable() {
    if (ui.tradeAvailableRerollLoading || ui.tradeAvailableLoading) return;
    if (Number(state.tradeCoins || 0) < rerollCost) {
      setToast("Você precisa de 1 coin para ver outras figurinhas");
      return;
    }
    if (!state.tradeAvailableHasMore) {
      setToast("Não há outras figurinhas disponíveis para sortear agora");
      return;
    }

    ui.tradeAvailableRerollLoading = true;
    try {
      const data = await apiFetch("/trade/available/reroll", {
        method: "POST",
        body: JSON.stringify({
          excludeStickerIds: state.tradeAvailable
            .map((entry) => String(entry?.sticker?.id || ""))
            .filter(Boolean),
        }),
      });

      state.tradeAvailable = Array.isArray(data.available) ? data.available : [];
      state.tradeAvailableTotal = Number(
        data.totalAvailable ?? state.tradeAvailable.length,
      );
      state.tradeAvailableHasMore = Boolean(
        data.hasMore ?? state.tradeAvailableTotal > state.tradeAvailable.length,
      );
      state.tradeCoins = Number(data.tradeCoins ?? state.tradeCoins);
      setTradePage("available", 1);
      setToast("Você gastou 1 coin para ver outras figurinhas");
    } catch (err) {
      setToast(err.message || "Erro ao sortear novas figurinhas");
    } finally {
      ui.tradeAvailableRerollLoading = false;
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

  return {
    loadTradeAvailable,
    loadTradeHistory,
    loadTradeOfferChoices,
    loadTradeOffers,
    loadTradeUsers,
    rerollTradeAvailable,
    selectTradeTargetUser,
  };
}

export { createTradeHandlers };
