"use strict";
/*
 * The Cartisto theme contract, bundled into the CLI (src/contract.js) so
 * `@cartisto/cli` is fully self-contained. These are the SAME rules the server's
 * publish gate enforces, so `cartisto theme validate` and publish can never
 * disagree.
 */
module.exports = require("./contract");
