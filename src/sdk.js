"use strict";
/*
 * The shared theme contract, vendored INTO the CLI (src/contract.js) so
 * `@cartisto/cli` is fully self-contained — no separate npm package to install.
 * It is compiled from the backend's themeContract.ts (see scripts/bundle-contract.js),
 * the SAME rules the server's publish gate enforces, so `cartisto theme validate`
 * and publish can never disagree.
 */
module.exports = require("./contract");
