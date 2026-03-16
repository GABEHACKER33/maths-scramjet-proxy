const express = require("express");
const { createServer } = require("http");
const path = require("path");
const wisp = require("wisp-server-node");
const { execSync } = require("child_process");
const fs = require("fs");

// ── Auto-copy Scramjet dist files on first run ──────────
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

const nm = path.join(__dirname, "node_modules");
const pub = path.join(__dirname, "public");

copyDir(path.join(nm, "@mercuryworkshop/scramjet/dist"),       path.join(pub, "scram"));
copyDir(path.join(nm, "@mercuryworkshop/bare-mux/dist"),        path.join(pub, "baremux"));
copyDir(path.join(nm, "@mercuryworkshop/epoxy-transport/dist"), path.join(pub, "epoxy"));
copyDir(path.join(nm, "@mercuryworkshop/libcurl-transport/dist"),path.join(pub, "libcurl"));

// ── Server ──────────────────────────────────────────────
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static(pub, {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".js")) res.setHeader("Service-Worker-Allowed", "/");
  }
}));

server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/wisp/")) wisp.routeRequest(req, socket, head);
  else socket.destroy();
});

app.get("*", (req, res) => {
  res.sendFile(path.join(pub, "index.html"));
});

server.listen(PORT, () => {
  console.log(`Maths Support running on http://localhost:${PORT}`);
});
