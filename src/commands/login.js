"use strict";
/*
 * `cartisto login` — no arguments.
 *
 * Default: OAuth 2.0 Authorization Code + PKCE with a 127.0.0.1 loopback redirect
 * (RFC 8252/7636), like the Shopify / GitHub CLIs. The CLI opens Cartisto, you
 * sign in and approve, and the browser redirects a one-time code straight back to
 * a local port — no code to type. `--device` uses the Device Authorization Grant
 * for headless/SSH sessions that can't receive a loopback redirect.
 *
 * The store is resolved by OAuth; endpoints come from build/env config
 * (src/endpoints.js). CI/machine use skips login: CARTISTO_STORE_URL + _API_KEY.
 */
const http = require("http");
const { randomBytes, createHash } = require("crypto");
const endpoints = require("../endpoints");
const api = require("../api");
const config = require("../config");
const { c, sym, link, openBrowser } = require("../ui");

const b64url = (buf) => buf.toString("base64url");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function closePage(title, ok) {
  const color = ok ? "#34d399" : "#f87171";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cartisto CLI</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0b1020;color:#e6eaf2}
.b{text-align:center;max-width:440px;padding:24px}h1{font-size:19px;margin:0 0 8px;color:${color}}p{color:#9aa4b2;margin:0}</style></head>
<body><div class="b"><h1>${title}</h1><p>You can close this tab and return to your terminal.</p></div></body></html>`;
}

function saveAndReport(values, tok) {
  const store = tok.store || {};
  if (!store.apiBase) {
    console.error(sym.err + " Cartisto didn't return a store context. Try again.");
    return 1;
  }
  const alias = config.addStore(store.apiBase, tok.access_token, values.as, store.name);
  console.log(`  ${sym.ok} ${c.green("Authorized")} for ${c.bold(store.name || alias)} — profile ${c.cyan('"' + alias + '"')}.`);
  console.log(`  ${c.dim("Saved to " + config.FILE)}\n`);
  return 0;
}

// ── Loopback: Authorization Code + PKCE (default) ────────────────────────────
async function loopbackLogin(values) {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = randomBytes(16).toString("hex");

  const server = http.createServer();
  const gotCode = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for approval")), 5 * 60 * 1000);
    server.on("request", (req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const err = u.searchParams.get("error");
      const code = u.searchParams.get("code");
      const gotState = u.searchParams.get("state");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(closePage(err ? "Authorization denied" : "✓ Authorized", !err));
      clearTimeout(timer);
      if (err) return reject(new Error(err === "access_denied" ? "authorization was denied" : err));
      if (gotState !== state) return reject(new Error("state mismatch — aborting for safety"));
      if (!code) return reject(new Error("no authorization code returned"));
      resolve(code);
    });
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const authorizeUrl =
    `${endpoints.APP_URL}/dashboard/cli-authorize?` +
    new URLSearchParams({ client: "cartisto-cli", scope: "themes", code_challenge: challenge, state, redirect_uri: redirectUri }).toString();

  console.log(`\n  ${sym.diamond} ${c.bold("Authorize the Cartisto CLI")}`);
  console.log(`  ${c.dim("Opening:")}  ${link(authorizeUrl)}`);
  console.log(`  ${c.dim("Sign in if asked, then approve. Waiting…")}\n`);
  openBrowser(authorizeUrl);

  let code;
  try {
    code = await gotCode;
  } catch (e) {
    server.close();
    console.error(sym.err + ` ${e.message}`);
    return 1;
  }
  server.close();

  let tok;
  try {
    tok = await api.post({ url: endpoints.API_URL }, "/oauth/token", {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });
  } catch (e) {
    console.error(sym.err + ` Token exchange failed: ${e.message}`);
    return 1;
  }
  return saveAndReport(values, tok);
}

// ── Device Authorization Grant (`--device`, headless/SSH) ────────────────────
async function deviceLogin(values) {
  const platform = { url: endpoints.API_URL };
  let dev;
  try {
    dev = await api.post(platform, "/oauth/device/code", { client_name: "cartisto-cli" });
  } catch (e) {
    console.error(sym.err + ` Couldn't reach Cartisto at ${endpoints.API_URL}: ${e.message}`);
    return 1;
  }

  const approveUrl = `${endpoints.APP_URL}/dashboard/cli-authorize?code=${encodeURIComponent(dev.user_code)}`;
  console.log(`\n  ${sym.diamond} ${c.bold("Authorize the Cartisto CLI")}`);
  console.log(`  ${c.dim("Confirm this code in Cartisto:")}  ${c.bold(dev.user_code)}`);
  console.log(`  ${c.dim("Open:")}  ${link(approveUrl)}`);
  console.log(`  ${c.dim("Sign in if asked, then approve. Waiting…")}\n`);
  openBrowser(approveUrl);

  const startedAt = Date.now();
  const expiresMs = (dev.expires_in || 600) * 1000;
  let intervalMs = (dev.interval || 5) * 1000;
  while (Date.now() - startedAt < expiresMs) {
    await sleep(intervalMs);
    let r;
    try {
      r = await api.post(platform, "/oauth/device/token", { device_code: dev.device_code });
    } catch (e) {
      console.error(sym.err + ` ${e.message}`);
      return 1;
    }
    switch (r.status) {
      case "complete":
        return saveAndReport(values, r);
      case "authorization_pending":
        break;
      case "slow_down":
        intervalMs += 5000;
        break;
      case "access_denied":
        console.error(sym.err + " Authorization was denied.");
        return 1;
      case "expired_token":
        console.error(sym.err + " The request expired. Run `cartisto login` again.");
        return 1;
      default:
        console.error(sym.err + " Invalid or already-used request. Run `cartisto login` again.");
        return 1;
    }
  }
  console.error(sym.err + " Timed out waiting for approval. Run `cartisto login` again.");
  return 1;
}

module.exports = async function login({ values }) {
  return values.device ? deviceLogin(values) : loopbackLogin(values);
};
