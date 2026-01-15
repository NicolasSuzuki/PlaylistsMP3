
import express from "express";
import axios from "axios";
import qs from "querystring";
import "dotenv/config";
import readline from "readline";
import path from "path";
import fs from "fs/promises";
import { searchAndDownload } from "./youtube.js";

const app = express();
const PORT = 8888;

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  REDIRECT_URI,
  SPOTIFY_REFRESH_TOKEN,
} = process.env;

let targetResource = null; // { type: "playlist" | "album", id: string }
let tracks = [];
const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

function basicAuthHeader() {
  const token = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

function parseSpotifyUrl(input) {
  if (!input) throw new Error("URL vazia.");

  let url;
  try {
    url = new URL(input);
  } catch (err) {
    throw new Error("URL invalida.");
  }

  if (!url.hostname.includes("spotify.com")) {
    throw new Error("URL nao eh do Spotify.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex(p => p === "playlist" || p === "album");
  if (idx === -1) throw new Error("Link precisa conter /playlist/ ou /album/.");

  const id = parts[idx + 1];
  if (!id) throw new Error("ID nao encontrado no link.");

  return { type: parts[idx], id };
}

async function refreshAccessToken() {
  if (!SPOTIFY_REFRESH_TOKEN) throw new Error("SPOTIFY_REFRESH_TOKEN nao configurado.");

  const tokenResp = await axios.post(
    "https://accounts.spotify.com/api/token",
    qs.stringify({
      grant_type: "refresh_token",
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
    {
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return tokenResp.data.access_token;
}

async function loadTracks(accessToken) {
  tracks = [];
  const mapTrack = t => ({
    name: t.name,
    artists: t.artists?.map(a => a.name).join(", "),
    album: t.album?.name,
  });

  if (targetResource.type === "playlist") {
    let url = `https://api.spotify.com/v1/playlists/${targetResource.id}/tracks?limit=100`;

    while (url) {
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      for (const item of resp.data.items) {
        const t = item.track;
        if (!t) continue;
        tracks.push(mapTrack(t));
      }

      url = resp.data.next; // proxima pagina (ou null)
    }
  } else if (targetResource.type === "album") {
    let url = `https://api.spotify.com/v1/albums/${targetResource.id}/tracks?limit=50`;

    while (url) {
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      for (const t of resp.data.items) {
        tracks.push(mapTrack(t));
      }

      url = resp.data.next; // proxima pagina (ou null)
    }
  } else {
    throw new Error("Tipo de recurso invalido.");
  }

  const names = tracks.map(t => t.name);
  const namesWithArtists = tracks.map(t => `${t.name} - ${t.artists || "Artista desconhecido"}`);
  return {
    type: targetResource.type,
    id: targetResource.id,
    total: tracks.length,
    names,
    names_with_artists: namesWithArtists,
    tracks,
  };
}

async function askForSpotifyResource() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question("Cole a URL da playlist ou album do Spotify: ", answer => {
      rl.close();
      try {
        targetResource = parseSpotifyUrl(answer.trim());
        console.log(targetResource)
        console.log(`Selecionado: ${targetResource.type} ${targetResource.id}`);
        resolve();
      } catch (err) {
        console.error(`URL invalida: ${err.message}`);
        resolve(askForSpotifyResource());
      }
    });
  });
}

app.get("/login", (req, res) => {
  const scope = [
    "playlist-read-private",
    "playlist-read-collaborative",
  ].join(" ");

  const authUrl =
    "https://accounts.spotify.com/authorize?" +
    qs.stringify({
      response_type: "code",
      client_id: SPOTIFY_CLIENT_ID,
      scope,
      redirect_uri: REDIRECT_URI,
    });

  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("Sem code no callback.");
    if (!targetResource) return res.status(400).send("Nenhuma playlist/album selecionado.");

    // troca code por access_token
    const tokenResp = await axios.post(
      "https://accounts.spotify.com/api/token",
      qs.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Authorization: basicAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResp.data.access_token;
    const payload = await loadTracks(accessToken);
    res.json(payload);
  } catch (err) {
    console.error(err?.response?.data || err);
    res.status(500).send("Erro ao pegar musicas da playlist/album.");
  }
});

app.post("/fetch", async (_req, res) => {
  try {
    if (!targetResource) return res.status(400).send("Nenhuma playlist/album selecionado.");
    const accessToken = await refreshAccessToken();
    const payload = await loadTracks(accessToken);
    res.json(payload);
  } catch (err) {
    console.error(err?.response?.data || err);
    res.status(500).send(err.message || "Erro ao pegar musicas com refresh_token.");
  }
});

app.post("/download", async (_req, res) => {
  if (!targetResource) return res.status(400).send("Nenhuma playlist/album selecionado.");
  if (!tracks.length) return res.status(400).send("Nenhuma lista carregada para baixar.");

  try {
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
    const results = [];
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const label = `${t.name} - ${t.artists || "Artista desconhecido"}`;
      console.log(`[${i + 1}/${tracks.length}] Baixando ${label}...`);
      try {
        const r = await searchAndDownload(t, DOWNLOAD_DIR);
        results.push({ track: label, ...r });
        console.log(`[${i + 1}/${tracks.length}] OK -> ${r.file}`);
      } catch (err) {
        results.push({ track: label, error: err.message });
        console.error(`[${i + 1}/${tracks.length}] ERRO -> ${err.message}`);
      }
    }

    res.json({
      type: targetResource.type,
      id: targetResource.id,
      total: tracks.length,
      downloaded: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao baixar as musicas.");
  }
});

function askYesNo(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith("s"));
    });
  });
}

async function downloadAll(tracksToDownload, baseDir) {
  await fs.mkdir(baseDir, { recursive: true });
  const results = [];
  for (let i = 0; i < tracksToDownload.length; i++) {
    const t = tracksToDownload[i];
    const label = `${t.name} - ${t.artists || "Artista desconhecido"}`;
    console.log(`[${i + 1}/${tracksToDownload.length}] Baixando ${label}...`);
    try {
      const r = await searchAndDownload(t, baseDir);
      results.push({ track: label, ...r });
      console.log(`[${i + 1}/${tracksToDownload.length}] OK -> ${r.file}`);
    } catch (err) {
      results.push({ track: label, error: err.message });
      console.error(`[${i + 1}/${tracksToDownload.length}] ERRO -> ${err.message}`);
    }
  }
  return results;
}

async function mainLoop() {
  if (!SPOTIFY_REFRESH_TOKEN) {
    console.error("SPOTIFY_REFRESH_TOKEN nao configurado. Coloque no .env para evitar abrir navegador.");
    process.exit(1);
  }

  console.log("=== Downloader Spotify -> YouTube MP3 ===");
  while (true) {
    await askForSpotifyResource();
    try {
      const accessToken = await refreshAccessToken();
      const payload = await loadTracks(accessToken);
      const subDir = path.join(DOWNLOAD_DIR, `${payload.type}-${payload.id}`);
      console.log(`Encontradas ${payload.total} musicas. Baixando para ${subDir}`);
      await downloadAll(payload.tracks, subDir);
      console.log(`Concluido! Arquivos salvos em: ${subDir}`);
    } catch (err) {
      console.error("Falha no fluxo:", err?.message || err);
    }

    const again = await askYesNo("Inserir outra playlist/album? (s/N): ");
    if (!again) {
      console.log("Saindo.");
      break;
    }
  }
}

mainLoop();
