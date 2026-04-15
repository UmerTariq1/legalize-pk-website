/**
 * Local dev server (static + GitHub proxy) so the site can use real data locally
 * without putting your token in browser JS.
 *
 * Usage (PowerShell):
 *   $env:GITHUB_TOKEN="ghp_..."
 *   node .\local-dev-server.mjs
 *   # open http://localhost:8888/index.html
 *
 * Also set repo in js/config.js:
 *   REPO_OWNER="UmerTariq1", REPO_NAME="legalize-pk"
 */

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 8888;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

function guessType(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...headers });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
}

function normalizeEndpoint(endpointRaw) {
  if (!endpointRaw || typeof endpointRaw !== "string") return null;
  const endpoint = endpointRaw.trim();
  if (!endpoint) return null;
  if (endpoint.includes("://")) return null;
  const withLeadingSlash = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  // Block path traversal like "/../" but allow GitHub compare syntax "before...after".
  if (/(^|\/)\.\.(\/|$)/.test(withLeadingSlash)) return null;
  return withLeadingSlash;
}

async function handleGithubProxy(req, res, url) {
  if (req.method === "OPTIONS") {
    send(res, 204, "", {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, OPTIONS",
    });
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const endpoint = normalizeEndpoint(url.searchParams.get("endpoint"));
  if (!endpoint) {
    // eslint-disable-next-line no-console
    console.warn("[legalize-pk][proxy] invalid endpoint", {
      raw: url.searchParams.get("endpoint"),
      url: url.toString(),
    });
    sendJson(res, 400, { error: "Missing or invalid 'endpoint' query parameter", raw: url.searchParams.get("endpoint") });
    return;
  }

  if (!GITHUB_TOKEN) {
    sendJson(res, 500, { error: "Missing GITHUB_TOKEN env var. Set it before starting the server." });
    return;
  }

  const upstream = `https://api.github.com${endpoint}`;
  const t0 = Date.now();
  try {
    const upstreamRes = await fetch(upstream, {
      method: "GET",
      headers: {
        authorization: `Bearer ${GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "user-agent": "legalize-pk-website-local-proxy",
        "x-github-api-version": "2022-11-28",
      },
    });

    const text = await upstreamRes.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    // eslint-disable-next-line no-console
    console.log(`[legalize-pk][proxy] ${upstreamRes.status} ${endpoint} (${Date.now() - t0}ms)`);

    send(res, upstreamRes.status, JSON.stringify(payload ?? {}), {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[legalize-pk][proxy] FAIL ${endpoint}`, err);
    sendJson(res, 502, { error: "Proxy request failed", message: String(err?.message || err) });
  }
}

async function handleStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  // Prevent path traversal
  const fsPath = path.join(__dirname, pathname);
  const rel = path.relative(__dirname, fsPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    send(res, 403, "Forbidden", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  try {
    const st = await stat(fsPath);
    if (st.isDirectory()) {
      send(res, 302, "", { location: `${pathname.replace(/\/+$/g, "")}/index.html` });
      return;
    }
    const buf = await readFile(fsPath);
    send(res, 200, buf, { "content-type": guessType(fsPath) });
  } catch {
    send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/github") {
    await handleGithubProxy(req, res, url);
    return;
  }

  await handleStatic(req, res, url);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Local server running at http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Proxy endpoint: http://localhost:${PORT}/api/github?endpoint=/repos/...`);
});

