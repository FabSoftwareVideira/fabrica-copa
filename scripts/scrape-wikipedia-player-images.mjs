import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataFilePath = path.join(rootDir, "js", "data.js");
const outputFilePath = path.join(rootDir, "js", "player-images.json");

const argLimit = process.argv.find((arg) => arg.startsWith("--limit="));
const argDelay = process.argv.find((arg) => arg.startsWith("--delay="));
const argPlayer = process.argv.find((arg) => arg.startsWith("--player="));
const argCookie = process.argv.find((arg) => arg.startsWith("--cookie="));

const maxItems = argLimit ? Number(argLimit.split("=")[1]) : null;
const delayMs = argDelay ? Number(argDelay.split("=")[1]) : 350;
const playerFilter = argPlayer ? normalizePlayerName(argPlayer.split("=")[1]) : "";
const cookieHeader = argCookie ? argCookie.slice("--cookie=".length) : "";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePlayerName(name) {
    return String(name || "").trim().replace(/\s+/g, " ");
}

function resolveUrl(url, base) {
    if (!url) return null;
    try {
        return new URL(url, base).toString();
    } catch {
        return null;
    }
}

function normalizeImageUrl(url) {
    if (!url) return null;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return null;
}

function loadAlbumData() {
    const code = fs.readFileSync(dataFilePath, "utf8");
    const albumData = vm.runInNewContext(`${code}\nALBUM_DATA;`, {});
    if (!albumData || !Array.isArray(albumData.groups)) {
        throw new Error("Nao foi possivel carregar ALBUM_DATA de js/data.js");
    }
    return albumData;
}

function collectPlayers(albumData) {
    const players = [];
    albumData.groups.forEach((group) => {
        group.teams.forEach((team) => {
            team.players.forEach((playerName) => {
                players.push({
                    name: playerName,
                    teamId: team.id,
                    teamName: team.name,
                    groupId: group.id,
                });
            });
        });
    });
    return players;
}

function buildTransfermarktSearchUrl(query) {
    const params = new URLSearchParams({ query: normalizePlayerName(query) });
    return `https://www.transfermarkt.com.br/schnellsuche/ergebnis/schnellsuche?${params.toString()}`;
}

async function fetchText(url) {
    const headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    };

    if (cookieHeader) {
        headers.cookie = cookieHeader;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`Falha em HTML ${response.status} para ${url}`);
    }

    const html = await response.text();
    if (response.status === 202 || !html.trim()) {
        throw new Error(
            `Transfermarkt bloqueou a requisicao (${response.status}). Tente executar com --cookie=\"SEU_COOKIE\"`,
        );
    }

    return html;
}

function extractPlayerProfileUrl(searchHtml) {
    const $ = cheerio.load(searchHtml);

    const href = $("a[href*='/profil/spieler/']").first().attr("href");
    return resolveUrl(href, "https://www.transfermarkt.com.br");
}

function pickImageFromProfileHtml(profileHtml, pageUrl) {
    const $ = cheerio.load(profileHtml);

    const selectors = [
        ".modal-trigger img",
        "img.modal-trigger",
        ".data-header__profile-container img",
        ".data-header__profile-image img",
    ];

    for (const selector of selectors) {
        const node = $(selector).first();
        if (!node || node.length === 0) continue;

        const src = node.attr("src") || node.attr("data-src") || node.attr("data-lazy");
        const absolute = resolveUrl(src, pageUrl);
        const imageUrl = normalizeImageUrl(absolute);
        if (imageUrl) return imageUrl;
    }

    return null;
}

async function fetchTransfermarktPlayer(playerName, teamName) {
    const searchTerms = [
        `${normalizePlayerName(playerName)} ${teamName}`,
        normalizePlayerName(playerName),
    ];

    for (const term of searchTerms) {
        const searchUrl = buildTransfermarktSearchUrl(term);
        const searchHtml = await fetchText(searchUrl);
        const profileUrl = extractPlayerProfileUrl(searchHtml);
        if (!profileUrl) continue;

        const profileHtml = await fetchText(profileUrl);
        const imageUrl = pickImageFromProfileHtml(profileHtml, profileUrl);
        if (!imageUrl) continue;

        return {
            profileUrl,
            imageUrl,
            searchUrl,
        };
    }

    return null;
}

async function fetchPlayerImage(player) {
    try {
        const transfermarkt = await fetchTransfermarktPlayer(player.name, player.teamName);
        if (!transfermarkt) {
            return {
                player: player.name,
                teamId: player.teamId,
                teamName: player.teamName,
                groupId: player.groupId,
                source: "transfermarkt",
                sourceMethod: "transfermarkt-search+modal-trigger",
                transfermarktPage: null,
                searchPage: null,
                error: "Perfil ou imagem nao encontrado",
                imageUrl: null,
                found: false,
            };
        }

        return {
            player: player.name,
            teamId: player.teamId,
            teamName: player.teamName,
            groupId: player.groupId,
            source: "transfermarkt",
            sourceMethod: "transfermarkt-search+modal-trigger",
            transfermarktPage: transfermarkt.profileUrl,
            searchPage: transfermarkt.searchUrl,
            error: null,
            imageUrl: transfermarkt.imageUrl,
            found: true,
        };
    } catch (err) {
        return {
            player: player.name,
            teamId: player.teamId,
            teamName: player.teamName,
            groupId: player.groupId,
            source: "transfermarkt",
            sourceMethod: "transfermarkt-search+modal-trigger",
            transfermarktPage: null,
            searchPage: null,
            error: err?.message || "Falha inesperada no scraping",
            imageUrl: null,
            found: false,
        };
    }
}

async function main() {
    const albumData = loadAlbumData();
    const players = collectPlayers(albumData);

    const filteredPlayers = playerFilter
        ? players.filter(
            (p) => normalizePlayerName(p.name).toLowerCase() === playerFilter.toLowerCase(),
        )
        : players;

    const selectedPlayers =
        Number.isFinite(maxItems) && maxItems > 0
            ? filteredPlayers.slice(0, maxItems)
            : filteredPlayers;

    console.log(`Jogadores para processar: ${selectedPlayers.length}`);

    const results = [];
    let foundCount = 0;

    for (let i = 0; i < selectedPlayers.length; i += 1) {
        const player = selectedPlayers[i];
        const result = await fetchPlayerImage(player);
        if (result.found) foundCount += 1;
        results.push(result);

        const status = result.found ? "OK" : "SEM_IMAGEM";
        console.log(`[${i + 1}/${selectedPlayers.length}] ${status} - ${player.name}`);

        if (i < selectedPlayers.length - 1 && delayMs > 0) {
            await sleep(delayMs);
        }
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        source: "transfermarkt-modal-trigger",
        totalPlayers: selectedPlayers.length,
        foundImages: foundCount,
        notFoundImages: selectedPlayers.length - foundCount,
        items: results,
    };

    fs.writeFileSync(outputFilePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    console.log(`Concluido. Arquivo salvo em: ${outputFilePath}`);
    console.log(`Com imagem: ${foundCount} | Sem imagem: ${selectedPlayers.length - foundCount}`);
}

main().catch((error) => {
    console.error("Erro no scraping:", error.message);
    process.exit(1);
});
