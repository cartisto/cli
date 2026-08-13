"use strict";
/*
 * `cartisto theme dev [--id] [--dir] [--open target]`
 *
 * The fast inner loop: watch the working directory and, on every save to a code
 * file, push just that file as a DRAFT and refresh its optimistic-lock baseline.
 * On start it opens the dashboard customizer (the sections/settings sidebar, so
 * you can place and configure the sections you're editing) — its live preview
 * renders the same ?previewTheme= draft these saves push to. Publishing stays an
 * explicit, gated step (`cartisto theme push --publish`). Ctrl+C to stop.
 *
 *   --open customize (default) | storefront | none
 */
const fs = require("fs");
const path = require("path");
const api = require("../api");
const config = require("../config");
const mapping = require("../mapping");
const { isThemeCodeFile } = require("../files");
const endpoints = require("../endpoints");
const { previewUrl, customizeUrl } = require("../urls");
const { c, sym, now, link, title, hr, row, openBrowser } = require("../ui");

module.exports = async function dev({ values }) {
  const store = config.resolveStore(values.store);
  if (!store) {
    console.error(sym.err + " No store selected. Run: cartisto login");
    return 2;
  }
  const dir = path.resolve(values.dir || ".");
  const map = mapping.read(dir) || {};
  const themeId = values.id || map.themeId;
  if (!themeId) {
    console.error(sym.err + " Which theme? Pass --id, or run 'cartisto theme pull' first.");
    return 2;
  }
  map.themeId = themeId;
  map.files = map.files || {};

  // The dashboard origin is known from build/env config, not a flag.
  const appUrl = endpoints.APP_URL;
  const preview = previewUrl(store.url, themeId);
  const customize = appUrl ? customizeUrl(appUrl, themeId) : "";

  // Which URL to open. `customize` needs the merchant app + a dashboard login;
  // fall back to the storefront preview if we couldn't work out an app URL.
  let target = (values.open || "customize").toLowerCase();
  if (!["customize", "storefront", "none"].includes(target)) target = "customize";
  if (target === "customize" && !customize) target = "storefront";

  title("cartisto theme dev");
  hr();
  row("theme", c.gray(themeId));
  row("watching", dir);
  if (customize)
    row("customizer", link(customize) + (target === "customize" ? c.dim("  (opening…)") : ""));
  row("preview", link(preview) + (target === "storefront" ? c.dim("  (opening…)") : ""));
  console.log("");
  console.log(
    "  " +
      c.dim("Saves auto-push as drafts. Publish when ready:  ") +
      c.bold("cartisto theme push --publish"),
  );
  if (target === "customize")
    console.log("  " + c.dim("The customizer needs the merchant app running + a dashboard login."));
  console.log("  " + c.dim("Ctrl+C to stop.") + "\n");

  if (target !== "none") openBrowser(target === "customize" ? customize : preview);

  const pending = new Map();

  async function removeOne(rel) {
    // Only propagate deletes for files we're tracking. An untracked scratch file
    // (an editor's temp/swap file that vanishes) was never ours to delete.
    if (!map.files[rel]) {
      console.log(`  ${sym.dot} ${c.dim(rel + " — removed (untracked), skipped")}`);
      return;
    }
    try {
      await api.del(store, `/tenant-themes/${themeId}/files`, { query: { path: rel } });
      delete map.files[rel];
      mapping.write(dir, map);
      console.log(`  ${sym.ok} ${c.dim(rel + " — deleted")}  ${now()}`);
    } catch (e) {
      if (e.status === 404) {
        // Already gone on the server — stop tracking it so the map stays honest.
        delete map.files[rel];
        mapping.write(dir, map);
        console.log(`  ${sym.dot} ${c.dim(rel + " — already gone on the server")}`);
      } else {
        // 400 (essential file) / 409 (still {% render %}'d elsewhere) / other:
        // leave it tracked and surface why the server refused.
        console.log(`  ${sym.err} ${rel} ${c.dim("— " + e.message)}`);
      }
    }
  }

  async function pushOne(rel) {
    const abs = path.join(dir, rel.split("/").join(path.sep));
    let content;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      // The file is gone (deleted or renamed away) — mirror that on the server.
      return removeOne(rel);
    }
    try {
      const saved = await api.put(store, `/tenant-themes/${themeId}/files`, {
        path: rel,
        content,
        baseUpdatedAt: map.files[rel]?.updatedAt,
      });
      map.files[rel] = { updatedAt: saved.updatedAt || new Date().toISOString() };
      mapping.write(dir, map);
      console.log(`  ${sym.ok} ${rel}  ${now()}`);
    } catch (e) {
      if (e.status === 409) {
        console.log(
          `  ${sym.warn} ${rel} ${c.dim("— changed on the server; run 'cartisto theme pull' to reconcile")}`,
        );
      } else {
        console.log(`  ${sym.err} ${rel} ${c.dim("— " + e.message)}`);
      }
    }
  }

  function onChange(filename) {
    const rel = String(filename).split(path.sep).join("/");
    // Only sync authored theme code — never a local project manifest
    // (package.json/lockfile), matching what push/diff upload.
    if (!isThemeCodeFile(rel)) return;
    // Ignore the CLI's own mapping dir, deps, and any dotfile/dir.
    if (rel.split("/").some((seg) => seg.startsWith(".")) || rel.includes("node_modules/")) return;
    clearTimeout(pending.get(rel));
    pending.set(
      rel,
      setTimeout(() => {
        pending.delete(rel);
        pushOne(rel);
      }, 250),
    );
  }

  try {
    fs.watch(dir, { recursive: true }, (_evt, filename) => {
      if (filename) onChange(filename);
    });
  } catch (e) {
    console.error(`  ${sym.err} Could not watch ${dir}: ${e.message}`);
    return 1;
  }

  // Keep the process alive until Ctrl+C (fs.watch already refs the loop).
  return new Promise(() => {});
};
