"use strict";
/*
 * Profile store for the CLI: ~/.cartisto/config.json holds named stores, each
 * with a base URL and a paste-once API token, plus which one is "current".
 *
 *   { "current": "acme", "stores": { "acme": { "url": "...", "token": "sk_…" } } }
 *
 * CI / automation overrides everything via env (no config file needed):
 *   CARTISTO_STORE_URL + CARTISTO_API_KEY  → an ephemeral "env" store.
 *
 * The token is a secret, so the file is written 0600.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const DIR = path.join(os.homedir(), ".cartisto");
const FILE = path.join(DIR, "config.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { current: null, stores: {} };
  }
}

function save(cfg) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

/** Alias derived from a URL host, e.g. https://acme.cartisto.com → "acme". */
function aliasFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0] || "store";
  } catch {
    return "store";
  }
}

function addStore(url, token, alias, storeName) {
  const cfg = load();
  const name = alias || aliasFromUrl(url);
  cfg.stores[name] = {
    url: url.replace(/\/+$/, ""),
    token,
    ...(storeName ? { name: storeName } : {}),
  };
  cfg.current = name;
  save(cfg);
  return name;
}

function useStore(alias) {
  const cfg = load();
  if (!cfg.stores[alias]) return false;
  cfg.current = alias;
  save(cfg);
  return true;
}

function removeStore(alias) {
  const cfg = load();
  if (!cfg.stores[alias]) return false;
  delete cfg.stores[alias];
  if (cfg.current === alias) cfg.current = Object.keys(cfg.stores)[0] || null;
  save(cfg);
  return true;
}

function listStores() {
  const cfg = load();
  return { current: cfg.current, stores: cfg.stores };
}

/**
 * The store the next command should act on. Env wins (CI); otherwise the
 * --store alias, otherwise the "current" profile. Returns null if none.
 */
function resolveStore(preferredAlias) {
  if (process.env.CARTISTO_STORE_URL && process.env.CARTISTO_API_KEY) {
    return {
      alias: "env",
      url: process.env.CARTISTO_STORE_URL.replace(/\/+$/, ""),
      token: process.env.CARTISTO_API_KEY,
    };
  }
  const cfg = load();
  const alias = preferredAlias || cfg.current;
  if (!alias || !cfg.stores[alias]) return null;
  return { alias, ...cfg.stores[alias] };
}

module.exports = {
  FILE,
  load,
  save,
  aliasFromUrl,
  addStore,
  useStore,
  removeStore,
  listStores,
  resolveStore,
};
