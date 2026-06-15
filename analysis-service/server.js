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

// Shared secret: when ANALYSIS_SECRET is set (prod), /analyze requires a
// matching x-analysis-secret header so only our backend can call it. Left open
// when unset (local dev). /health stays open for uptime checks.
const ANALYSIS_SECRET = process.env.ANALYSIS_SECRET || "";

app.get("/health", (_req, res) => res.send({ ok: true }));

app.post("/analyze", async (req, res) => {
  if (ANALYSIS_SECRET && req.headers["x-analysis-secret"] !== ANALYSIS_SECRET) {
    return res.status(401).send({ error: "unauthorized" });
  }
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
