#!/usr/bin/env node
"use strict";
/*
 * cartisto — Cartisto Theme CLI entry point.
 *
 * Zero external dependencies (Node built-ins only) so it runs anywhere Node ≥18
 * does, offline, with no toolchain. Commands live in ../src/commands/*.
 */
const { parseArgs } = require("node:util");
const pkg = require("../package.json");

const OPTIONS = {
  as: { type: "string" },
  store: { type: "string" }, // act on a saved profile without switching the default
  id: { type: "string" },
  dir: { type: "string" },
  open: { type: "string" },
  device: { type: "boolean" },
  publish: { type: "boolean" },
  yes: { type: "boolean" },
  json: { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
};

function help() {
  console.log(`
cartisto — Cartisto Theme CLI (v${pkg.version})

Auth & stores
  cartisto login [--device]                   Authorize in the browser (OAuth; --device = headless)
  cartisto logout                             Remove the saved profile
  cartisto store list|use <alias>|remove <alias>   Manage profiles
  (CI: set CARTISTO_STORE_URL + CARTISTO_API_KEY instead)

Themes
  cartisto theme init  [name] [--dir d]       Create a theme + pull it locally
  cartisto theme list [--json]                Themes on the active store
  cartisto theme pull  [--id <id>] [--dir d]  Download a theme's files
  cartisto theme diff  [--id <id>] [--dir d]  Preview what a push would change
  cartisto theme push  [--id <id>] [--dir d] [--publish]   Upload (edits→draft)
  cartisto theme dev   [--id <id>] [--dir d] [--open customize|storefront|none]
                                              Watch + auto-push drafts, open the customizer
  cartisto theme validate [dir]               Run the platform contract locally

  cartisto doctor                             Check env + store connection
  cartisto version | help
`);
}

async function run() {
  let parsed;
  try {
    parsed = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: OPTIONS });
  } catch (e) {
    console.error(`${e.message}\nTry: cartisto help`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [group, sub, ...rest] = positionals;

  if (values.version) {
    console.log(pkg.version);
    return 0;
  }
  if (!group || group === "help" || values.help) {
    help();
    return 0;
  }
  if (group === "version") {
    console.log(pkg.version);
    return 0;
  }
  if (group === "login") return require("../src/commands/login")({ values });
  if (group === "logout") return require("../src/commands/logout")({ values });
  if (group === "doctor") return require("../src/commands/doctor")({ values });
  if (group === "store") {
    return require("../src/commands/store")({ sub, positionals: rest, values });
  }
  if (group === "theme") {
    switch (sub) {
      case "init":
        return require("../src/commands/init")({ _: rest, values });
      case "validate":
        return require("../src/commands/validate")({ _: rest, values });
      case "list":
        return require("../src/commands/list")({ values });
      case "pull":
        return require("../src/commands/pull")({ values });
      case "diff":
        return require("../src/commands/diff")({ values });
      case "push":
        return require("../src/commands/push")({ values });
      case "dev":
        return require("../src/commands/dev")({ values });
      default:
        console.error(`Unknown theme command: ${sub ?? "(none)"}\nTry: cartisto help`);
        return 2;
    }
  }
  console.error(`Unknown command: ${group}\nTry: cartisto help`);
  return 2;
}

// Set exitCode and let the event loop drain rather than calling process.exit():
// an abrupt exit while fetch's (undici) sockets are mid-close trips a libuv
// assertion on Windows. Node exits on its own once the idle keep-alive sockets
// time out (they're unref'd).
run()
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((e) => {
    console.error(e?.stack || String(e));
    process.exitCode = 1;
  });
