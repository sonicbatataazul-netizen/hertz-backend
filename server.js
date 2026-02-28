const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.HERTZ_API_KEY || null;

// Middleware de autenticação
app.use((req, res, next) => {
  if (!API_KEY) return next(); // sem chave configurada, libera tudo (dev local)
  const key = req.headers["x-api-key"] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: "Não autorizado" });
  next();
});

// Health check (sem auth) — necessário pro Render não dormir via ping
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Busca músicas
app.get("/search", (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Query obrigatória" });

  const args = [
    `ytsearch10:${query}`,
    "--dump-json",
    "--flat-playlist",
    "--no-warnings",
  ];

  execFile("yt-dlp", args, { timeout: 20000 }, (err, stdout) => {
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
    "-f", "bestaudio[ext=webm]/bestaudio/best",
    "--get-url",
    "--no-warnings",
  ];

  execFile("yt-dlp", args, { timeout: 25000 }, (err, stdout) => {
    if (err) {
      console.error("Erro stream-url:", err.message);
      return res.status(500).json({ error: "Erro ao obter URL de stream" });
    }
    res.json({ streamUrl: stdout.trim().split("\n")[0] });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Hertz backend rodando na porta ${PORT}`);
  if (API_KEY) console.log("🔒 Proteção por API key ativada");
  else console.log("⚠️  Sem API key — acesso livre (modo dev)");
});
