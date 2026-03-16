const express = require("express");
const { createServer } = require("http");
const path = require("path");
const fs = require("fs");
const wisp = require("wisp-server-node");
const https = require("https");
const http = require("http");

// ── Self-ping to prevent Render free tier sleep ─────────
const RENDER_URL    = process.env.RENDER_EXTERNAL_URL || null;
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

function selfPing() {
  if (!RENDER_URL) return; // skip in local dev
  const url = `${RENDER_URL}/ping`;
  const lib = url.startsWith("https") ? https : http;
  lib.get(url, (res) => {
    console.log(`[ping] ${new Date().toISOString()} -> ${res.statusCode}`);
  }).on("error", (err) => {
    console.warn(`[ping] failed: ${err.message}`);
  });
}

// ── Auto-copy Scramjet dist files on startup ────────────
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const s = path.join(src, file);
    const d = path.join(dest, file);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const nm  = path.join(__dirname, "node_modules");
const pub = path.join(__dirname, "public");

copyDir(path.join(nm, "@mercuryworkshop/scramjet/dist"),         path.join(pub, "scram"));
copyDir(path.join(nm, "@mercuryworkshop/bare-mux/dist"),          path.join(pub, "baremux"));
copyDir(path.join(nm, "@mercuryworkshop/epoxy-transport/dist"),   path.join(pub, "epoxy"));
copyDir(path.join(nm, "@mercuryworkshop/libcurl-transport/dist"), path.join(pub, "libcurl"));

// ── Server setup ────────────────────────────────────────
const app    = express();
const server = createServer(app);
const PORT   = process.env.PORT || 3000;

app.use(express.static(pub, {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".js")) res.setHeader("Service-Worker-Allowed", "/");
  }
}));

// Wisp WebSocket handler (needed by Scramjet transports)
server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/wisp/")) wisp.routeRequest(req, socket, head);
  else socket.destroy();
});

// Health check endpoint — pinged every 10 min to stay awake
app.get("/ping", (req, res) => res.status(200).send("pong"));

// Catch-all -> index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(pub, "index.html"));
});

// ── Start ───────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Maths Support running on http://localhost:${PORT}`);

  // Begin self-ping after 1 min (let server fully boot first)
  setTimeout(() => {
    selfPing();
    setInterval(selfPing, PING_INTERVAL);
  }, 60 * 1000);
});
