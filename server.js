const express = require("express");
const cors = require("cors");
const { execFile, exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.HERTZ_API_KEY || null;
const COOKIES_PATH = path.join(__dirname, "cookies.txt");
const HAS_COOKIES = fs.existsSync(COOKIES_PATH);

console.log(HAS_COOKIES ? "✅ cookies.txt encontrado!" : "⚠️ cookies.txt não encontrado");

// Auth
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const key = req.headers["x-api-key"] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: "Não autorizado" });
  next();
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

function cookieArgs() {
  return HAS_COOKIES ? ["--cookies", COOKIES_PATH] : [];
}

// Busca
app.get("/search", (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Query obrigatória" });

  const args = [
    `ytsearch10:${query}`,
    "--dump-json", "--flat-playlist", "--no-warnings",
    ...cookieArgs(),
  ];

  execFile("yt-dlp", args, { timeout: 25000 }, (err, stdout) => {
    if (err) { console.error("Erro busca:", err.message); return res.status(500).json({ error: "Erro ao buscar" }); }
    try {
      const results = stdout.trim().split("\n").filter(Boolean).map(line => {
        const item = JSON.parse(line);
        return {
          id: item.id, title: item.title,
          channel: item.channel || item.uploader || "Desconhecido",
          duration: item.duration,
          thumbnail: item.thumbnail || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
        };
      });
      res.json({ results });
    } catch (e) { res.status(500).json({ error: "Erro ao processar" }); }
  });
});

// Stream URL
app.get("/stream-url", (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: "ID obrigatório" });

  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    "-f", "bestaudio/best",
    "--get-url", "--no-warnings", "--no-check-certificates",
    ...cookieArgs(),
  ];

  execFile("yt-dlp", args, { timeout: 30000 }, (err, stdout) => {
    if (err) { console.error("Erro stream:", err.message); return res.status(500).json({ error: "Erro ao obter stream" }); }
    const streamUrl = stdout.trim().split("\n")[0];
    if (!streamUrl) return res.status(500).json({ error: "URL vazia" });
    res.json({ streamUrl });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Hertz backend na porta ${PORT}`);
  exec("pip install -U yt-dlp", (err) => {
    if (err) console.error("Erro ao atualizar yt-dlp:", err.message);
    else console.log("✅ yt-dlp atualizado!");
  });
});
