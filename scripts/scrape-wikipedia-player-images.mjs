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
const maxItems = argLimit ? Number(argLimit.split("=")[1]) : null;
const delayMs = argDelay ? Number(argDelay.split("=")[1]) : 350;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

function normalizeImageUrl(url) {
    if (!url) return null;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return null;
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: {
            "user-agent": "album-copa-2026-scraper/1.0 (educational project)",
            accept: "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`Falha em JSON ${response.status} para ${url}`);
    }
    return response.json();
}

async function fetchText(url) {
    const response = await fetch(url, {
        headers: {
            "user-agent": "album-copa-2026-scraper/1.0 (educational project)",
            accept: "text/html",
        },
    });
    if (!response.ok) {
        throw new Error(`Falha em HTML ${response.status} para ${url}`);
    }
    return response.text();
}

async function findWikipediaTitle(playerName, teamName, lang) {
    const query = `${playerName} ${teamName} futebol`;
    const params = new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: query,
        srlimit: "1",
        format: "json",
        origin: "*",
    });

    const url = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
    const json = await fetchJson(url);
    const results = json?.query?.search;
    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }
    return results[0].title;
}

async function extractInfoboxImage(pageTitle, lang) {
    const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/\s+/g, "_"))}`;
    const html = await fetchText(pageUrl);
    const $ = cheerio.load(html);

    const selectors = [
        ".infobox img",
        "table.infobox img",
        ".infobox.vcard img",
        ".infobox.biography.vcard img",
    ];

    for (const selector of selectors) {
        const src = $(selector).first().attr("src");
        const imageUrl = normalizeImageUrl(src);
        if (imageUrl) {
            return { imageUrl, pageUrl };
        }
    }

    return { imageUrl: null, pageUrl };
}

async function fetchPlayerImage(player) {
    const langs = ["pt", "en"];

    for (const lang of langs) {
        try {
            const title = await findWikipediaTitle(player.name, player.teamName, lang);
            if (!title) continue;

            const { imageUrl, pageUrl } = await extractInfoboxImage(title, lang);
            if (!imageUrl) continue;

            return {
                player: player.name,
                teamId: player.teamId,
                teamName: player.teamName,
                groupId: player.groupId,
                wikiLang: lang,
                wikiTitle: title,
                wikiPage: pageUrl,
                imageUrl,
                found: true,
            };
        } catch {
            // Continua tentando no proximo idioma
        }
    }

    return {
        player: player.name,
        teamId: player.teamId,
        teamName: player.teamName,
        groupId: player.groupId,
        wikiLang: null,
        wikiTitle: null,
        wikiPage: null,
        imageUrl: null,
        found: false,
    };
}

async function main() {
    const albumData = loadAlbumData();
    const players = collectPlayers(albumData);
    const selectedPlayers = Number.isFinite(maxItems) && maxItems > 0 ? players.slice(0, maxItems) : players;

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
        source: "wikipedia-infobox",
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
