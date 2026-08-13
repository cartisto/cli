"use strict";
/*
 * Thin HTTP client for the tenant theme API. Zero deps — uses the global fetch
 * built into Node ≥18. Every request carries the store's API token as a Bearer
 * credential (the same `sk_…` key a merchant issues from the dashboard).
 *
 * The store's own host (from its URL) is what identifyTenant resolves the tenant
 * from, so no extra header is needed for subdomain/custom-domain stores.
 */
const API_PREFIX = "/api/v1";

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(store, method, apiPath, { query, body } = {}) {
  const url = new URL(store.url + API_PREFIX + apiPath);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        // The OAuth device endpoints are unauthenticated (the CLI has no token
        // yet), so only send the Bearer header when a token is present.
        ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}),
        // Don't pool the socket — a CLI makes a burst then exits; keep-alive
        // just delays teardown.
        Connection: "close",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(
      `Could not reach ${store.url} — is the URL right and the store online? (${e.message})`,
      0,
    );
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg =
      json?.message ||
      (res.status === 401
        ? "Unauthorized — check your API key (and that it has the 'themes' scope)."
        : `Request failed (HTTP ${res.status}).`);
    throw new ApiError(msg, res.status, json);
  }
  // The backend wraps success as { success, message, data }.
  return json?.data !== undefined ? json.data : json;
}

const get = (store, p, opts) => request(store, "GET", p, opts);
const post = (store, p, body, opts) => request(store, "POST", p, { ...opts, body });
const put = (store, p, body, opts) => request(store, "PUT", p, { ...opts, body });
const del = (store, p, opts) => request(store, "DELETE", p, opts);

module.exports = { request, get, post, put, del, ApiError, API_PREFIX };
