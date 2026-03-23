#!/usr/bin/env node
/**
 * Household Hub — Pixoo64 Proxy
 *
 * Bridges your HTTPS Netlify app to the Pixoo64 on your local network,
 * using a Cloudflare Tunnel to create a secure public HTTPS URL.
 *
 * First-time setup — install cloudflared:
 *   Mac:     brew install cloudflared
 *   Windows: winget install --id Cloudflare.cloudflared
 *   Linux:   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
 *
 * Usage:
 *   node pixoo-proxy.js 192.168.1.42
 */

import http from "http";
import { spawn } from "child_process";

const PIXOO_IP = process.argv[2];
const PORT = 8080;

if (!PIXOO_IP) {
  console.error("\n❌  Usage: node pixoo-proxy.js <pixoo-ip>");
  console.error("    Example: node pixoo-proxy.js 192.168.1.42\n");
  process.exit(1);
}

// ─── PROXY SERVER ─────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }

  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", () => {
    const fwd = {
      hostname: PIXOO_IP, port: 80, path: "/post", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };

    const pixooReq = http.request(fwd, pixooRes => {
      let data = "";
      pixooRes.on("data", c => (data += c));
      pixooRes.on("end", () => {
        res.writeHead(pixooRes.statusCode, { "Content-Type": "application/json" });
        res.end(data);
        try { console.log("  ✓", JSON.parse(body).Command); } catch { console.log("  ✓ sent"); }
      });
    });

    pixooReq.on("error", err => {
      console.error("  ✗ Pixoo unreachable:", err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: "Pixoo unreachable", detail: err.message }));
    });

    pixooReq.write(body);
    pixooReq.end();
  });
});

// ─── START PROXY + CLOUDFLARE TUNNEL ─────────────────────────────────────────
server.listen(PORT, "127.0.0.1", () => {
  console.log("\n🏠  Household Hub — Pixoo64 Proxy");
  console.log("─────────────────────────────────────");
  console.log("   Pixoo IP  :", PIXOO_IP);
  console.log("   Proxy     : http://localhost:" + PORT);
  console.log("\n🌐  Starting Cloudflare Tunnel...\n");

  const cf = spawn("cloudflared", ["tunnel", "--url", "http://localhost:" + PORT], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let shown = false;
  const check = (text) => {
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !shown) {
      shown = true;
      const url = match[0];
      const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
      console.log("╔══════════════════════════════════════════════════════╗");
      console.log("║  ✅  Tunnel is LIVE — copy this URL into the app     ║");
      console.log("╠══════════════════════════════════════════════════════╣");
      console.log("║  " + pad(url, 52) + "║");
      console.log("╠══════════════════════════════════════════════════════╣");
      console.log("║  1. Open Household Hub → PIXOO64 tab                 ║");
      console.log("║  2. Paste the URL above as the Proxy URL             ║");
      console.log("║  3. Click Test                                        ║");
      console.log("╚══════════════════════════════════════════════════════╝");
      console.log("\n  Press Ctrl+C to stop\n");
    }
  };

  cf.stdout.on("data", d => check(d.toString()));
  cf.stderr.on("data", d => {
    check(d.toString());
    if (d.toString().toLowerCase().includes("error")) {
      process.stdout.write("  [cf] " + d);
    }
  });

  cf.on("error", err => {
    if (err.code === "ENOENT") {
      console.error("❌  cloudflared not installed.\n");
      console.error("   Mac:     brew install cloudflared");
      console.error("   Windows: winget install --id Cloudflare.cloudflared");
      console.error("   Linux:   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n");
    } else {
      console.error("❌  cloudflared error:", err.message);
    }
    process.exit(1);
  });

  process.on("SIGINT", () => { console.log("\n  Stopping..."); cf.kill(); process.exit(0); });
});
