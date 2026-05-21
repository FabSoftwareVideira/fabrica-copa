/*
Browser race-condition tests for development environment.

How to use:
1) Open the app in the browser and login.
2) Open DevTools Console.
3) Paste this whole file and press Enter.
4) Run one of these:
   - await runRerollRaceTest();
  - await runRedeemPacksRaceTest();
  - await runAcceptOfferCoinsRaceTest({ offerId: 123 });
   - await runTradeOfferRaceTest();
   - await runAllRaceTests();

Notes:
- These tests send concurrent requests on purpose.
- Run only in development/test environment.
*/

(function attachRaceTests(globalObj) {
  const DEFAULT_API_BASE = "https://sci.videira.ifc.edu.br/api";

  function getAccessToken() {
    return localStorage.getItem("album-access-token");
  }

  function getStoredUserId() {
    try {
      const raw = localStorage.getItem("album-user");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const userId = Number(parsed && parsed.id);
      return userId > 0 ? userId : null;
    } catch (_err) {
      return null;
    }
  }

  function getApiBaseUrl() {
    const envBase = globalObj.__APP_API_BASE_URL;
    if (typeof envBase === "string" && envBase.trim()) return envBase.trim();
    return DEFAULT_API_BASE;
  }

  async function api(path, options) {
    const token = getAccessToken();
    if (!token) {
      throw new Error("No access token found. Login first.");
    }

    const res = await fetch(getApiBaseUrl() + path, {
      ...(options || {}),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...((options && options.headers) || {}),
      },
    });

    const body = await res.json().catch(function onInvalidJson() {
      return {};
    });

    return { status: res.status, body: body };
  }

  async function runRerollRaceTest(config) {
    const opts = config || {};
    const concurrency = Number(opts.concurrency || 8);

    const before = await api("/album/state");
    const available = await api("/trade/available");

    const excludeStickerIds = (available.body.available || [])
      .map(function mapEntry(entry) {
        return String((entry && entry.sticker && entry.sticker.id) || "");
      })
      .filter(Boolean);

    const calls = Array.from({ length: concurrency }, function buildCall() {
      return api("/trade/available/reroll", {
        method: "POST",
        body: JSON.stringify({ excludeStickerIds: excludeStickerIds }),
      });
    });

    const results = await Promise.all(calls);
    const success201 = results.filter(function countSuccess(r) {
      return r.status === 201;
    }).length;

    const after = await api("/album/state");
    const coinsBefore = Number(before.body.tradeCoins || 0);
    const coinsAfter = Number(after.body.tradeCoins || 0);
    const expectedSpent = success201;
    const actualSpent = coinsBefore - coinsAfter;
    const raceDetected = success201 > 1 && actualSpent < expectedSpent;

    const summary = {
      test: "reroll",
      concurrency: concurrency,
      success201: success201,
      coinsBefore: coinsBefore,
      coinsAfter: coinsAfter,
      expectedSpent: expectedSpent,
      actualSpent: actualSpent,
      raceDetected: raceDetected,
    };

    console.table(summary);
    console.log("[reroll] results", results);

    return { summary: summary, results: results };
  }

  async function runRedeemPacksRaceTest(config) {
    const opts = config || {};
    const concurrency = Number(opts.concurrency || 8);
    const coinsPerCoupon = Number(opts.coinsPerCoupon || 10);

    const before = await api("/album/state");
    const coinsBefore = Number(before.body.tradeCoins || 0);
    const packsBefore = Number(before.body.extraPacks || 0);

    const calls = Array.from({ length: concurrency }, function buildCall() {
      return api("/trade/coins/redeem", {
        method: "POST",
      });
    });

    const results = await Promise.all(calls);
    const success201 = results.filter(function countSuccess(r) {
      return r.status === 201;
    }).length;
    const insufficient400 = results.filter(function countInsufficient(r) {
      return r.status === 400;
    }).length;

    const after = await api("/album/state");
    const coinsAfter = Number(after.body.tradeCoins || 0);
    const packsAfter = Number(after.body.extraPacks || 0);

    const expectedSpent = success201 * coinsPerCoupon;
    const actualSpent = coinsBefore - coinsAfter;
    const expectedPacksGained = success201;
    const actualPacksGained = packsAfter - packsBefore;

    const raceDetected =
      (success201 > 0 && actualSpent < expectedSpent) ||
      actualPacksGained > expectedPacksGained;

    const summary = {
      test: "redeem-packs",
      concurrency: concurrency,
      coinsPerCoupon: coinsPerCoupon,
      success201: success201,
      insufficient400: insufficient400,
      coinsBefore: coinsBefore,
      coinsAfter: coinsAfter,
      packsBefore: packsBefore,
      packsAfter: packsAfter,
      expectedSpent: expectedSpent,
      actualSpent: actualSpent,
      expectedPacksGained: expectedPacksGained,
      actualPacksGained: actualPacksGained,
      raceDetected: raceDetected,
    };

    console.table(summary);
    console.log("[redeem-packs] results", results);

    return { summary: summary, results: results };
  }

  async function runTradeOfferRaceTest(config) {
    const opts = config || {};
    const concurrency = Number(opts.concurrency || 10);
    const loggedUserId = getStoredUserId();
    const explicitTargetUserId = Number(opts.targetUserId || 0);

    if (!explicitTargetUserId) {
      throw new Error("Provide targetUserId explicitly. Example: runTradeOfferRaceTest({ targetUserId: 22, concurrency: 10 })");
    }

    const targetUserId = explicitTargetUserId;

    if (loggedUserId && Number(targetUserId) === Number(loggedUserId)) {
      throw new Error("targetUserId cannot be the logged-in user. Choose another user.");
    }

    const windowRes = await api("/trade/window");
    const tradeWindows = windowRes.body.tradeWindows || [];
    const hasOpenWindow = tradeWindows.some(function isOpen(w) {
      return String(w && w.status) === "open";
    });
    if (!hasOpenWindow) {
      throw new Error("Trade window is closed. Open a trade window before running this test.");
    }

    const offerChoicesRes = await api("/trade/users/" + targetUserId + "/wanted-from-me");
    const offerChoices = offerChoicesRes.body.stickers || [];

    const offered =
      offerChoices.find(function findCountOne(s) {
        return Number(s.count) === 1;
      }) || offerChoices[0];

    if (!offered || !offered.id) {
      throw new Error("No sticker available to offer for selected target user.");
    }

    const dupRes = await api("/trade/users/" + targetUserId + "/duplicates");
    const requested = (dupRes.body.duplicates || [])[0];

    if (!requested || !requested.id) {
      throw new Error("Target user has no duplicate stickers to request.");
    }

    const payload = {
      toUserId: targetUserId,
      offeredStickerId: offered.id,
      requestedStickerId: requested.id,
    };

    const calls = Array.from({ length: concurrency }, function buildCall() {
      return api("/trade/offers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    });

    const results = await Promise.all(calls);
    const success201 = results.filter(function countCreated(r) {
      return r.status === 201;
    }).length;
    const conflicts409 = results.filter(function countConflict(r) {
      return r.status === 409;
    }).length;
    const statusCounts = results.reduce(function buildStatusMap(acc, r) {
      const key = String(r.status);
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    }, {});
    const firstErrorResult = results.find(function findFirstError(r) {
      return r.status >= 400;
    });
    const firstErrorMessage =
      (firstErrorResult && firstErrorResult.body && firstErrorResult.body.error) || "";

    const offersRes = await api("/trade/offers");
    const outgoing = offersRes.body.outgoing || [];

    const matchingPending = outgoing.filter(function matchOffer(o) {
      const sameUser = Number(o.toUserId) === Number(payload.toUserId);
      const sameOffered = String(o.offeredSticker && o.offeredSticker.id) === String(payload.offeredStickerId);
      const sameRequested =
        String(o.requestedSticker && o.requestedSticker.id) === String(payload.requestedStickerId);
      return sameUser && sameOffered && sameRequested;
    });

    const raceDetected = Number(offered.count) === 1 && matchingPending.length > 1;

    const summary = {
      test: "trade-offers",
      concurrency: concurrency,
      loggedUserId: loggedUserId,
      targetUserId: targetUserId,
      offeredStickerId: payload.offeredStickerId,
      offeredCountAtStart: Number(offered.count || 0),
      requestedStickerId: payload.requestedStickerId,
      success201: success201,
      conflicts409: conflicts409,
      statusCounts: JSON.stringify(statusCounts),
      firstErrorMessage: firstErrorMessage,
      pendingMatchingOffers: matchingPending.length,
      raceDetected: raceDetected,
    };

    console.table(summary);
    console.log("[trade-offers] payload", payload);
    console.log("[trade-offers] results", results);
    console.log("[trade-offers] statusCounts", statusCounts);
    if (firstErrorMessage) {
      console.log("[trade-offers] firstErrorMessage", firstErrorMessage);
    }
    console.log("[trade-offers] pending matching offers", matchingPending);

    return {
      summary: summary,
      payload: payload,
      results: results,
      statusCounts: statusCounts,
      firstErrorMessage: firstErrorMessage,
      matchingPending: matchingPending,
    };
  }

  async function runAcceptOfferCoinsRaceTest(config) {
    const opts = config || {};
    const concurrency = Number(opts.concurrency || 8);
    const coinsPerTrade = Number(opts.coinsPerTrade || 3);
    const loggedUserId = getStoredUserId();
    const explicitOfferId = Number(opts.offerId || 0);

    if (!explicitOfferId) {
      throw new Error("Provide offerId explicitly. Example: runAcceptOfferCoinsRaceTest({ offerId: 123, concurrency: 8 })");
    }

    const before = await api("/album/state");
    const coinsBefore = Number(before.body.tradeCoins || 0);

    const offerId = explicitOfferId;

    const calls = Array.from({ length: concurrency }, function buildCall() {
      return api("/trade/offers/" + offerId + "/accept", {
        method: "POST",
      });
    });

    const results = await Promise.all(calls);
    const success200 = results.filter(function countSuccess(r) {
      return r.status === 200;
    }).length;
    const processed409 = results.filter(function countProcessed(r) {
      return r.status === 409;
    }).length;
    const notFound404 = results.filter(function countNotFound(r) {
      return r.status === 404;
    }).length;

    const after = await api("/album/state");
    const coinsAfter = Number(after.body.tradeCoins || 0);

    const expectedGain = success200 * coinsPerTrade;
    const actualGain = coinsAfter - coinsBefore;
    const raceDetected = success200 > 1 || actualGain > expectedGain;

    const summary = {
      test: "accept-offer-coins",
      loggedUserId: loggedUserId,
      offerId: offerId,
      concurrency: concurrency,
      coinsPerTrade: coinsPerTrade,
      success200: success200,
      processed409: processed409,
      notFound404: notFound404,
      coinsBefore: coinsBefore,
      coinsAfter: coinsAfter,
      expectedGain: expectedGain,
      actualGain: actualGain,
      raceDetected: raceDetected,
    };

    console.table(summary);
    console.log("[accept-offer-coins] results", results);

    return { summary: summary, results: results };
  }

  async function runAllRaceTests(config) {
    const opts = config || {};
    const rerollConfig = opts.reroll || {};
    const redeemConfig = opts.redeem || {};
    const acceptConfig = opts.accept || {};
    const tradeConfig = opts.trade || {};

    const reroll = await runRerollRaceTest(rerollConfig);
    const redeem = await runRedeemPacksRaceTest(redeemConfig);
    const accept = await runAcceptOfferCoinsRaceTest(acceptConfig);
    const trade = await runTradeOfferRaceTest(tradeConfig);

    return {
      reroll: reroll.summary,
      redeem: redeem.summary,
      accept: accept.summary,
      trade: trade.summary,
    };
  }

  globalObj.runRerollRaceTest = runRerollRaceTest;
  globalObj.runRedeemPacksRaceTest = runRedeemPacksRaceTest;
  globalObj.runAcceptOfferCoinsRaceTest = runAcceptOfferCoinsRaceTest;
  globalObj.runTradeOfferRaceTest = runTradeOfferRaceTest;
  globalObj.runAllRaceTests = runAllRaceTests;

  console.info("Race test helpers loaded: runRerollRaceTest, runRedeemPacksRaceTest, runAcceptOfferCoinsRaceTest, runTradeOfferRaceTest, runAllRaceTests");
})(window);
