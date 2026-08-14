#!/usr/bin/env node
/*
 * Regenerates the bundled theme contract (src/contract.js) — the same contract
 * the Cartisto server enforces on publish, compiled into the CLI so it can
 * validate themes locally and offline.
 *
 * The authoritative contract lives in Cartisto's source repository. When that
 * source is available (internal development), its path is supplied via the
 * CARTISTO_CONTRACT_SRC environment variable; this script compiles it to
 * dependency-free CommonJS and writes src/contract.js.
 *
 * In a public checkout CARTISTO_CONTRACT_SRC is unset and src/contract.js is
 * already committed and current — the script keeps the committed file as-is.
 * It runs on `prepack` before every publish, so a release can never ship a
 * stale contract.
 */
const fs = require("fs");
const path = require("path");

const CLI_ROOT = path.resolve(__dirname, "..");
const OUT = path.join(CLI_ROOT, "src", "contract.js");
const SRC = process.env.CARTISTO_CONTRACT_SRC
  ? path.resolve(CLI_ROOT, process.env.CARTISTO_CONTRACT_SRC)
  : null;

function keepCommitted(reason) {
  if (fs.existsSync(OUT)) {
    console.log(`[bundle-contract] ${reason}; using the committed src/contract.js.`);
    process.exit(0);
  }
  console.error(`[bundle-contract] ${reason}, and no committed src/contract.js exists.`);
  process.exit(1);
}

if (!SRC) keepCommitted("no contract source configured (CARTISTO_CONTRACT_SRC unset)");
if (!fs.existsSync(SRC)) keepCommitted("configured contract source not found");

let ts;
try {
  ts = require("typescript");
} catch {
  keepCommitted("`typescript` (devDependency) is not installed");
}

const source = fs.readFileSync(SRC, "utf8");
// Single-file transpile — no type-checking or module resolution needed (the
// contract imports nothing). `removeComments` keeps internal notes out of the
// published output; the runtime code is unchanged.
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    removeComments: true,
  },
  fileName: "contract.ts",
});

const header =
  "// ─────────────────────────────────────────────────────────────────────────\n" +
  "// GENERATED — DO NOT EDIT.\n" +
  "// The Cartisto theme contract, compiled and bundled into the CLI for local\n" +
  "// validation. Regenerate with `npm run bundle:contract`.\n" +
  "// ─────────────────────────────────────────────────────────────────────────\n\n";

fs.writeFileSync(OUT, header + outputText, "utf8");
console.log(
  `[bundle-contract] compiled contract → ${path.relative(CLI_ROOT, OUT)} (${outputText.length} bytes)`,
);
