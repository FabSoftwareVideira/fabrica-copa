"use strict";

function normalizePrestigeLevel(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
}

function getPrestigeBonusMultiplier(prestigeLevel) {
    const level = normalizePrestigeLevel(prestigeLevel);
    const multiplier = Number((1 + level * 0.25).toFixed(2));
    console.log(`Prestige Level: ${level}, Bonus Multiplier: ${multiplier}`);

    return multiplier;
}

module.exports = {
    normalizePrestigeLevel,
    getPrestigeBonusMultiplier,
};