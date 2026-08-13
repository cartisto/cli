"use strict";
/*
 * `cartisto theme init [name] [--dir]` — start a new theme. Forks the platform
 * starter into a fresh custom theme on the store (the server owns the starter,
 * so themes stay consistent) and pulls it into a local directory, ready to edit.
 */
const fs = require("fs");
const path = require("path");
const api = require("../api");
const config = require("../config");
const pull = require("./pull");
const { c, sym } = require("../ui");

module.exports = async function init({ _, values }) {
  const store = config.resolveStore(values.store);
  if (!store) {
    console.error(sym.err + " No store selected. Run: cartisto login");
    return 2;
  }
  const name = (_ && _[0]) || values.name || "My Theme";

  let created;
  try {
    created = await api.post(store, "/tenant-themes/custom", { name });
  } catch (e) {
    console.error(sym.err + ` Failed to create theme: ${e.message}`);
    return 1;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "theme";
  const dir = path.resolve(values.dir || slug);
  fs.mkdirSync(dir, { recursive: true });

  console.log(
    `\n  ${sym.ok} Created custom theme ${c.bold(name)} ${c.gray("(" + created.id + ")")}. Pulling into ${dir} …`,
  );
  const code = await pull({ values: { ...values, id: created.id, dir } });

  const rel = path.relative(process.cwd(), dir) || ".";
  console.log(
    `  ${c.dim("Next:")}\n    ${c.bold("cd " + rel)}\n    ${c.bold("cartisto theme dev")}   ${c.dim("# edit + auto-push + open the customizer")}\n`,
  );
  return code;
};
