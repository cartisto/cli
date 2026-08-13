"use strict";
/*
 * `cartisto doctor` — quick health check so a developer knows
 * why something isn't working before they file a ticket: Node version, CLI
 * version, an active store profile, and whether the API key actually
 * authenticates with the `themes` scope.
 */
const api = require("../api");
const config = require("../config");
const pkg = require("../../package.json");
const endpoints = require("../endpoints");
const { c, sym, title, hr } = require("../ui");

function line(ok, label, detail) {
  console.log(`  ${ok ? sym.ok : sym.err} ${label}${detail ? c.dim(" — " + detail) : ""}`);
  return ok;
}

module.exports = async function doctor({ values }) {
  title("cartisto doctor");
  hr();
  let ok = true;

  const major = parseInt(process.versions.node, 10);
  ok = line(major >= 18, `Node ${process.versions.node}`, major >= 18 ? "" : "need ≥ 18") && ok;
  line(true, `CLI v${pkg.version}`);
  line(true, "Cartisto app", endpoints.APP_URL);
  line(true, "Cartisto API", endpoints.API_URL);

  const store = config.resolveStore();
  if (!store) {
    line(false, "Store profile", "none — run: cartisto login");
    console.log(c.dim("\n  Not connected. Run `cartisto login` to authorize.\n"));
    return 1;
  }
  line(true, "Store profile", `${store.name || store.alias} (${store.url})`);

  try {
    await api.get(store, "/tenant-themes");
    line(true, "Connection + API key", "authenticated, 'themes' scope OK");
  } catch (e) {
    ok = false;
    if (e.status === 401) line(false, "Credential", "invalid or expired — run `cartisto login` again");
    else if (e.status === 403) line(false, "API key scope", "missing the 'themes' scope");
    else if (e.status === 0) line(false, "Connection", e.message);
    else line(false, "API", e.message);
  }

  console.log(
    ok ? `\n  ${sym.ok} ${c.green("All checks passed.")}\n` : `\n  ${sym.err} ${c.red("Some checks failed")} — see above.\n`,
  );
  return ok ? 0 : 1;
};
