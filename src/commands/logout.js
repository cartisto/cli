"use strict";
/*
 * `cartisto logout` — remove a saved store profile (revokes
 * nothing server-side; to kill the token, revoke it from the dashboard).
 */
const config = require("../config");
const { c, sym } = require("../ui");

module.exports = async function logout() {
  const { current } = config.listStores();
  const alias = current;
  if (!alias) {
    console.log(c.dim("  No active store profile."));
    return 0;
  }
  if (!config.removeStore(alias)) {
    console.error(sym.err + ` No profile named "${alias}".`);
    return 1;
  }
  console.log(`  ${sym.ok} Removed profile ${c.cyan('"' + alias + '"')}.`);
  return 0;
};
