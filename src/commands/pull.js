"use strict";
/*
 * `cartisto theme pull [--id <themeId>] [--dir <dir>]`
 *
 * Downloads every file of a custom theme into a local directory and records the
 * dir↔theme link (+ each file's server updatedAt) in <dir>/.cartisto/theme.json
 * so later push/dev need no --id and can optimistic-lock their writes.
 */
const path = require("path");
const api = require("../api");
const config = require("../config");
const mapping = require("../mapping");
const { writeThemeFile } = require("../files");
const { c, sym } = require("../ui");

module.exports = async function pull({ values }) {
  const store = config.resolveStore(values.store);
  if (!store) {
    console.error(sym.err + " No store selected. Run: cartisto login");
    return 2;
  }
  const dir = path.resolve(values.dir || ".");
  const themeId = values.id || mapping.read(dir)?.themeId;
  if (!themeId) {
    console.error(sym.err + " Which theme? Pass --id <themeId>  (see: cartisto theme list).");
    return 2;
  }

  let meta;
  try {
    meta = await api.get(store, `/tenant-themes/${themeId}/files`);
  } catch (e) {
    console.error(sym.err + ` Failed to list files: ${e.message}`);
    return 1;
  }
  const files = meta.files || [];
  console.log(
    `\n  ${c.bold("Pulling")} ${files.length} file(s) from ${c.cyan(meta.name || themeId)} ${sym.arrow} ${dir}`,
  );

  const map = {
    store: store.url,
    storeAlias: store.alias,
    themeId,
    themeName: meta.name,
    pulledAt: new Date().toISOString(),
    files: {},
  };
  let ok = 0;
  for (const f of files) {
    try {
      const content = await api.get(store, `/tenant-themes/${themeId}/files/content`, {
        query: { path: f.path },
      });
      writeThemeFile(dir, f.path, content.content ?? "");
      map.files[f.path] = { updatedAt: content.updatedAt || f.updatedAt };
      ok++;
      process.stdout.write(`  ${sym.ok} ${c.dim(f.path)}\n`);
    } catch (e) {
      process.stdout.write(`  ${sym.err} ${f.path} ${c.dim("— " + e.message)}\n`);
    }
  }
  mapping.write(dir, map);
  console.log(
    `\n  ${sym.ok} Pulled ${c.bold(ok + "/" + files.length)}. Linked to theme ${c.gray(themeId)} ${c.dim("(" + mapping.REL + ")")}.\n`,
  );
  return ok === files.length ? 0 : 1;
};
