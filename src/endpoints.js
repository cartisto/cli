"use strict";
/*
 * Where the CLI talks to Cartisto. Known from build/env configuration — NEVER
 * from CLI flags. A developer never provides a store or app URL: `cartisto login`
 * opens Cartisto, and the OAuth flow resolves the authorized store.
 *
 *   APP_URL — the Cartisto dashboard, opened in the browser for login/approval.
 *   API_URL — the Cartisto backend API base, for the device-grant endpoints.
 *
 * Prod defaults are baked in; local development overrides them with env vars:
 *   CARTISTO_APP_URL=http://app.lvh.me:3000   (dashboard, browser)
 *   CARTISTO_API_URL=http://localhost:8000    (backend API base)
 */
const DEFAULT_APP_URL = "https://app.cartisto.com";
const DEFAULT_API_URL = "https://api.cartisto.com";

const trim = (u) => String(u).replace(/\/+$/, "");

const APP_URL = trim(process.env.CARTISTO_APP_URL || DEFAULT_APP_URL);
const API_URL = trim(process.env.CARTISTO_API_URL || DEFAULT_API_URL);

module.exports = { APP_URL, API_URL };
