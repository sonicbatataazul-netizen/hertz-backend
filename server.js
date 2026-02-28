const express = require("express");
const cors = require("cors");
const { execFile, exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.HERTZ_API_KEY || null;

// Escreve cookies do env para arquivo temporário
let COOKIES_FILE = null;
if (process.env.YT_COOKIES_B64) {
  try {
    const content = Buffer.from(process.env.YT_COOKIES_B64, "base64").toString("utf-8");
    COOKIES_FILE = path.join(os.tmpdir(), "yt_cookies.txt");
    fs.writeFileSync(COOKIES_FILE, content);
    console.log("✅ Cookies do YouTube carregados!");
  } catch (e) {
    console.error("Erro ao carregar cookies:", e.message);
  }
}

// Middleware de autenticação
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const key = req.headers["x-api-key"] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: "Não autorizado" });
  next();
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

function getCookiesArgs() {
  return COOKIES_FILE ? ["--cookies", COOKIES_FILE] : [];
}

// Busca músicas
app.get("/search", (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Query obrigatória" });

  const args = [
    `ytsearch10:${query}`,
    "--dump-json",
    "--flat-playlist",
    "--no-warnings",
    ...getCookiesArgs(),
  ];

  execFile("yt-dlp", args, { timeout: 25000 }, (err, stdout) => {
    if (err) {
      console.error("Erro na busca:", err.message);
      return res.status(500).json({ error: "Erro ao buscar músicas" });
    }
    try {
      const results = stdout.trim().split("\n").filter(Boolean).map(line => {
        const item = JSON.parse(line);
        return {
          id: item.id,
          title: item.title,
          channel: item.channel || item.uploader || "Desconhecido",
          duration: item.duration,
          thumbnail: item.thumbnail || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
        };
      });
      res.json({ results });
    } catch (e) {
      res.status(500).json({ error: "Erro ao processar resultados" });
    }
  });
});

// Stream URL
app.get("/stream-url", (req, res) => {
  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: "ID obrigatório" });

  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    "-f", "bestaudio/best",
    "--get-url",
    "--no-warnings",
    "--no-check-certificates",
    ...getCookiesArgs(),
  ];

  execFile("yt-dlp", args, { timeout: 30000 }, (err, stdout) => {
    if (err) {
      console.error("Erro stream-url:", err.message);
      return res.status(500).json({ error: "Erro ao obter URL de stream" });
    }
    const streamUrl = stdout.trim().split("\n")[0];
    if (!streamUrl) return res.status(500).json({ error: "URL vazia" });
    res.json({ streamUrl });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Hertz backend rodando na porta ${PORT}`);
  exec("pip install -U yt-dlp", (err) => {
    if (err) console.error("Erro ao atualizar yt-dlp:", err.message);
    else console.log("✅ yt-dlp atualizado!");
  });
});