"use strict";
/*
 * `cartisto theme list [--json]` — the tenant's themes on the active store.
 */
const api = require("../api");
const config = require("../config");
const { c, sym } = require("../ui");

module.exports = async function list({ values }) {
  const store = config.resolveStore(values.store);
  if (!store) {
    console.error(sym.err + " No store selected. Run: cartisto login");
    return 2;
  }
  let themes;
  try {
    themes = await api.get(store, "/tenant-themes");
  } catch (e) {
    console.error(sym.err + ` Failed: ${e.message}`);
    return 1;
  }
  const rows = Array.isArray(themes) ? themes : themes?.themes || [];
  if (values.json) {
    console.log(JSON.stringify(rows, null, 2));
    return 0;
  }
  if (rows.length === 0) {
    console.log(c.dim("  No themes found."));
    return 0;
  }
  console.log(`\n  ${c.bold("Themes on")} ${c.cyan(store.url)}:`);
  for (const t of rows) {
    const active = t.isActive || t.active;
    // Custom themes carry their name at the top level; platform installs carry
    // it on the linked master `theme` row.
    const name = t.name || t.theme?.name || c.dim("(unnamed)");
    const flags = [active ? c.green("active") : null, t.kind === "custom" ? c.magenta("custom") : c.dim(t.kind)]
      .filter(Boolean)
      .join(c.dim(", "));
    const star = active ? c.green("●") : c.dim("○");
    console.log(
      `  ${star} ${c.gray(t.id)}  ${c.bold(name)}${flags ? "  " + c.dim("[") + flags + c.dim("]") : ""}`,
    );
  }
  console.log("");
  return 0;
};
