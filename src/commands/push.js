"use strict";
/*
 * `cartisto theme push [--id] [--dir] [--publish]`
 *
 * Uploads local code files. Edits land as DRAFTS (previewable via ?previewTheme=);
 * new files are created live. Each write carries the pulled updatedAt as an
 * optimistic-lock base, so a file changed in the dashboard since your pull is
 * flagged as a conflict instead of being clobbered. With --publish, promotes
 * the drafts through the server's quality gate (a contract regression → the gate
 * blocks with its reasons).
 */
const path = require("path");
const api = require("../api");
const config = require("../config");
const mapping = require("../mapping");
const { loadCodeFiles } = require("../files");
const { c, sym } = require("../ui");

module.exports = async function push({ values }) {
  const store = config.resolveStore(values.store);
  if (!store) {
    console.error(sym.err + " No store selected. Run: cartisto login");
    return 2;
  }
  const dir = path.resolve(values.dir || ".");
  const map = mapping.read(dir);
  const themeId = values.id || map?.themeId;
  if (!themeId) {
    console.error(sym.err + " Which theme? Pass --id, or run 'cartisto theme pull' first.");
    return 2;
  }

  const files = loadCodeFiles(dir);
  console.log(
    `\n  ${c.bold("Pushing")} ${files.length} file(s) ${sym.arrow} theme ${c.gray(themeId)} on ${c.cyan(store.url)}`,
  );

  const nextFiles = { ...(map?.files || {}) };
  let ok = 0;
  let conflicts = 0;
  for (const f of files) {
    const base = map?.files?.[f.path]?.updatedAt;
    try {
      const saved = await api.put(store, `/tenant-themes/${themeId}/files`, {
        path: f.path,
        content: f.content,
        baseUpdatedAt: base,
      });
      nextFiles[f.path] = { updatedAt: saved.updatedAt || new Date().toISOString() };
      ok++;
      process.stdout.write(`  ${sym.ok} ${c.dim(f.path)}\n`);
    } catch (e) {
      if (e.status === 409) {
        conflicts++;
        process.stdout.write(
          `  ${sym.warn} ${f.path} ${c.dim("— changed on the server since your pull; run 'cartisto theme pull' to reconcile")}\n`,
        );
      } else {
        process.stdout.write(`  ${sym.err} ${f.path} ${c.dim("— " + e.message)}\n`);
      }
    }
  }
  if (map) mapping.write(dir, { ...map, files: nextFiles, pushedAt: new Date().toISOString() });
  console.log(
    `\n  ${sym.ok} Pushed ${c.bold(ok + "/" + files.length)}${conflicts ? c.yellow(`, ${conflicts} conflict(s)`) : ""}.`,
  );

  if (values.publish) {
    if (conflicts) {
      console.error(sym.err + " Not publishing — resolve conflicts first.");
      return 1;
    }
    try {
      await api.post(store, `/tenant-themes/${themeId}/publish`, {});
      console.log(`  ${sym.ok} ${c.green("Published")} ${c.dim("(passed the platform quality gate).")}`);
      // Publishing promotes every draft and bumps its server updatedAt, which
      // would make the NEXT push see phantom conflicts. Refresh the lock
      // baselines from the server so the working copy stays in sync.
      try {
        const meta = await api.get(store, `/tenant-themes/${themeId}/files`);
        for (const f of meta.files || []) {
          if (nextFiles[f.path]) nextFiles[f.path] = { updatedAt: f.updatedAt };
        }
        if (map) {
          mapping.write(dir, {
            ...map,
            files: nextFiles,
            pushedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
          });
        }
      } catch {
        /* best-effort: a failed refresh only costs one reconciling pull later */
      }
    } catch (e) {
      console.error(`  ${sym.err} ${c.red("Publish blocked")}: ${e.message}`);
      return 1;
    }
  }
  console.log("");
  return ok === files.length && conflicts === 0 ? 0 : 1;
};
