"use strict";
/*
 * `cartisto theme diff [--id] [--dir]` — read-only preview of what a push would
 * change: which local code files differ from the theme's current server state,
 * which are new, and which exist only on the server. Nothing is uploaded.
 */
const path = require("path");
const api = require("../api");
const config = require("../config");
const mapping = require("../mapping");
const { loadCodeFiles } = require("../files");

module.exports = async function diff({ values }) {
  const store = config.resolveStore(values.store);
  if (!store) {
    console.error("No store selected. Run: cartisto login");
    return 2;
  }
  const dir = path.resolve(values.dir || ".");
  const themeId = values.id || mapping.read(dir)?.themeId;
  if (!themeId) {
    console.error("Which theme? Pass --id, or run 'cartisto theme pull' first.");
    return 2;
  }

  let meta;
  try {
    meta = await api.get(store, `/tenant-themes/${themeId}/files`);
  } catch (e) {
    console.error(`Failed: ${e.message}`);
    return 1;
  }

  const remote = {};
  for (const f of meta.files || []) {
    try {
      const c = await api.get(store, `/tenant-themes/${themeId}/files/content`, {
        query: { path: f.path },
      });
      remote[f.path] = c.content ?? "";
    } catch {
      remote[f.path] = null; // couldn't read — treat as unknown, not equal
    }
  }
  const local = {};
  for (const f of loadCodeFiles(dir)) local[f.path] = f.content;

  const added = [];
  const modified = [];
  const removed = [];
  for (const p of Object.keys(local)) {
    if (!(p in remote)) added.push(p);
    else if (remote[p] !== local[p]) modified.push(p);
  }
  for (const p of Object.keys(remote)) if (!(p in local)) removed.push(p);

  console.log(`\n  Diff: local ${dir}\n        vs theme ${themeId} on ${store.url}`);
  const show = (label, arr, sym) => {
    if (!arr.length) return;
    console.log(`\n  ${label} (${arr.length}):`);
    arr.sort().forEach((p) => console.log(`    ${sym} ${p}`));
  };
  show("Modified", modified, "~");
  show("Added — push will create", added, "+");
  show("Only on server — push won't delete", removed, "-");

  const total = added.length + modified.length + removed.length;
  console.log(
    total === 0
      ? "\n  In sync — no differences.\n"
      : `\n  ${total} difference(s). Upload with: cartisto theme push\n`,
  );
  return 0;
};
