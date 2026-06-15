// KeyTrack analysis microservice.
// POST /analyze { audioUrl, authHeader?, durationMs?, genre? }
//   → { isLikelySet, camelot, key, bpm }
// Runs separately from the main backend (it needs ffmpeg + keyfinder-cli +
// bpm-tools, which live in this service's container). The main app calls it
// over HTTP.
const express = require("express");
const { analyzeUrl } = require("./analyze");

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => res.send({ ok: true }));

app.post("/analyze", async (req, res) => {
  const { audioUrl, authHeader, durationMs, genre } = req.body || {};
  if (!audioUrl) return res.status(400).send({ error: "audioUrl required" });
  try {
    const result = await analyzeUrl(audioUrl, { authHeader, durationMs, genre });
    res.send(result);
  } catch (e) {
    console.error("analyze failed:", e.message);
    res.status(500).send({ error: "analysis_failed" });
  }
});

const PORT = process.env.PORT || 8899;
app.listen(PORT, () => console.log("analysis service listening on " + PORT));
