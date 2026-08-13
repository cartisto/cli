"use strict";
/*
 * Local theme file helpers shared by pull/push. Only the theme's authored TEXT
 * files (liquid/js/json/css) travel through the ThemeFile API; binary assets
 * (images/fonts) are handled by the assets endpoint, not here.
 */
const fs = require("fs");
const path = require("path");

const CODE = /\.(liquid|js|json|css)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);
// A theme is a plain content folder, but a dev may keep their own tooling
// manifest in it (a package.json / lockfile for local Tailwind, formatting,
// etc.). Those are NOT theme files — the server never has them — so `push`/`diff`
// must never upload them. Matched at the theme root only.
const PROJECT_FILES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

function walk(dir) {
  const out = [];
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const abs = path.join(d, e.name);
      if (e.isDirectory()) rec(abs);
      else out.push(abs);
    }
  };
  rec(dir);
  return out;
}

/**
 * A theme-relative path the CLI should sync to the server: an authored code file
 * that isn't a local project manifest. The single source of truth for "is this
 * ours to upload?", shared by push/diff (loadCodeFiles) and dev's watcher, so
 * they can never disagree about what a save means.
 */
function isThemeCodeFile(rel) {
  return CODE.test(rel) && !PROJECT_FILES.has(rel);
}

/** { path (theme-relative, forward slash), content } for every code file. */
function loadCodeFiles(root) {
  return walk(root)
    .map((abs) => ({
      path: path.relative(root, abs).split(path.sep).join("/"),
      abs,
    }))
    .filter((f) => isThemeCodeFile(f.path))
    .map((f) => ({ path: f.path, content: fs.readFileSync(f.abs, "utf8") }));
}

/** Write a theme-relative file, creating parent dirs. */
function writeThemeFile(root, relPath, content) {
  const abs = path.join(root, relPath.split("/").join(path.sep));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
}

module.exports = { CODE, PROJECT_FILES, isThemeCodeFile, walk, loadCodeFiles, writeThemeFile };
