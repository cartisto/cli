"use strict";
/*
 * `cartisto theme validate [dir]` — run the platform's Tier-1 theme contract
 * locally, against a working directory, BEFORE pushing. It is the exact mirror
 * of the server-side publish gate (same contract compiled from the backend), so a green
 * local validate means publish won't reject on contract grounds.
 *
 * Exit codes: 0 = pass, 1 = contract violations, 2 = usage/IO error.
 */
const fs = require("fs");
const path = require("path");
const sdk = require("../sdk");

// Only these are the theme's authored text; images/fonts/compiled css are not
// scanned for contract violations (matches the backend gate).
const TEXT = /\.(liquid|js|json)$/;

function walk(dir) {
  const out = [];
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      // Skip VCS/build/dependency noise and the CLI's own mapping dir.
      if (
        e.name === "node_modules" ||
        e.name === "dist" ||
        e.name.startsWith(".")
      ) {
        continue;
      }
      const abs = path.join(d, e.name);
      if (e.isDirectory()) rec(abs);
      else out.push(abs);
    }
  };
  rec(dir);
  return out;
}

function loadThemeFiles(root) {
  return walk(root)
    .filter((abs) => TEXT.test(abs))
    .map((abs) => ({
      // theme-relative, forward-slash paths so the SDK's path checks
      // (locales/*.json, views/pages/layout.liquid) match on every OS.
      path: path.relative(root, abs).split(path.sep).join("/"),
      content: fs.readFileSync(abs, "utf8"),
    }));
}

function validate(args) {
  const dir = path.resolve(args._[0] || ".");
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`Not a directory: ${dir}`);
    return 2;
  }

  const files = loadThemeFiles(dir);
  const problems = [];

  problems.push(...sdk.scanBannedPatterns(files));

  const layout = files.find(
    (f) => f.path === "views/pages/layout.liquid" || f.path.endsWith("/layout.liquid"),
  );
  if (layout) problems.push(...sdk.checkRequiredLayoutTags(layout.content, layout.path));

  const manifest = files.find((f) => f.path === "theme.json");
  if (manifest) problems.push(...sdk.checkSdkManifest(manifest.content, sdk.KNOWN_SDK_VERSIONS));

  const locales = files
    .filter((f) => /(^|\/)locales\/[^/]+\.json$/.test(f.path))
    .map((f) => ({ name: f.path.split("/").pop(), content: f.content }));
  problems.push(...sdk.checkLocaleParity(locales));

  console.log(`\n  cartisto theme validate — ${dir}`);
  console.log(`  scanned ${files.length} file(s)`);
  console.log("  " + "─".repeat(50));
  if (problems.length === 0) {
    console.log("  ✓ PASS — theme meets the platform contract\n");
    return 0;
  }
  console.log(`  ✗ FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log(`      • ${p}`);
  console.log("");
  return 1;
}

module.exports = validate;
