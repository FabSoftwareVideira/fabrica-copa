"use strict";

// Special stickers are 20× less likely than regular ones
const ESPECIAL_WEIGHT = 0.2; // Ajuste esse valor para tornar os especiais mais ou menos raros. Range de 0.1 (muito raro) a 0.5 (pouco raro) é recomendado.

function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function pickRandomWeighted(list) {
    const weights = list.map((s) => (s.section === "especial" ? ESPECIAL_WEIGHT : 1));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
        r -= weights[i];
        if (r <= 0) return list[i];
    }
    return list[list.length - 1];
}

module.exports = { pickRandom, pickRandomWeighted, ESPECIAL_WEIGHT };