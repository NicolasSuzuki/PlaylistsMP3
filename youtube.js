import ytdlp from "yt-dlp-exec";
import sanitize from "sanitize-filename";
import path from "path";

export async function searchAndDownload(track, outputDir) {
  const query = `${track.name} ${track.artists || ""}`.trim();
  const search = await ytdlp("ytsearch1:" + query, {
    dumpSingleJson: true,
    noCheckCertificates: true,
    addHeader: ["referer:youtube.com", "user-agent:googlebot"],
  });

  const first = search?.entries?.[0];
  if (!first?.webpage_url) throw new Error(`Nada encontrado para ${query}`);

  const baseName = sanitize(`${track.name} - ${track.artists || "Artista desconhecido"}`) || "video";
  const outTemplate = path.join(outputDir, `${baseName}.%(ext)s`); // ytdlp preenche a extensao final (mp3)
  const finalPath = path.join(outputDir, `${baseName}.mp3`);

  await ytdlp(first.webpage_url, {
    output: outTemplate,
    // Baixa o melhor audio e converte para MP3.
    format: "bestaudio/best",
    extractAudio: true,
    audioFormat: "mp3",
    audioQuality: "0",
    noCheckCertificates: true,
  });

  return { file: finalPath, title: first.title, url: first.webpage_url };
}
