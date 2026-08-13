#!/usr/bin/env node
/*
 * Vendors the theme contract INTO the CLI so `@cartisto/cli` is the single,
 * self-contained public package (Shopify/Salla model — one install).
 *
 * The contract's source of truth is the backend: a dependency-free, single
 * TypeScript file (themeContract.ts). This script reads it, strips the types
 * with the TypeScript compiler (dev-only — end users never need it), and writes
 * the runtime CommonJS to `src/contract.js`, which ships in the CLI tarball and
 * is what `src/sdk.js` requires. No separate SDK package, no tsconfig: the file
 * has no imports, so a single-string transpile is all it takes.
 *
 * Runs on `prepack` (before `npm pack`/`npm publish`), so the published CLI can
 * never carry a stale contract. The output is also committed, so the CLI works
 * from a fresh checkout — and if the backend or `typescript` is absent (a
 * standalone public checkout), the committed copy is kept as-is.
 */
const fs = require("fs");
const path = require("path");

const CLI_ROOT = path.resolve(__dirname, "..");
const OUT = path.join(CLI_ROOT, "src", "contract.js");
// In the monorepo the backend sits alongside this folder (../Multi_Tenancy_…).
// In the standalone public repo it is absent — keepCommitted() handles that.
const CONTRACT_TS = path.resolve(
  CLI_ROOT,
  "..",
  "Multi_Tenancy_Ecomemrce_Backend",
  "src",
  "utils",
  "themeContract.ts",
);

function keepCommitted(reason) {
  if (fs.existsSync(OUT)) {
    console.warn(`[bundle-contract] ${reason}; keeping committed src/contract.js.`);
    process.exit(0);
  }
  console.error(`[bundle-contract] ${reason}, and no committed src/contract.js exists.`);
  process.exit(1);
}

if (!fs.existsSync(CONTRACT_TS)) {
  keepCommitted(`backend contract not found at ${CONTRACT_TS}`);
}

let ts;
try {
  ts = require("typescript");
} catch {
  keepCommitted("`typescript` (devDependency) is not installed");
}

const source = fs.readFileSync(CONTRACT_TS, "utf8");
// Single-file transpile — no type-checking, no module resolution needed (the
// contract imports nothing). Options mirror the compile this replaced.
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: "themeContract.ts",
});

const header =
  "// ─────────────────────────────────────────────────────────────────────────\n" +
  "// VENDORED — DO NOT EDIT.\n" +
  "// Compiled from Multi_Tenancy_Ecomemrce_Backend/src/utils/themeContract.ts\n" +
  "// (the platform's single source of truth). Regenerate: `npm run bundle:contract`.\n" +
  "// ─────────────────────────────────────────────────────────────────────────\n\n";

fs.writeFileSync(OUT, header + outputText, "utf8");
console.log(
  `[bundle-contract] compiled contract → ${path.relative(CLI_ROOT, OUT)} (${outputText.length} bytes)`,
);
