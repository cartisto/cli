"use strict";
/*
 * `cartisto store <add|list|use|remove>` — manage saved store profiles. Freelancers
 * and agencies work across several stores (prod, staging, client A/B); each is a
 * named profile and `use` sets the default for subsequent commands.
 *
 *   cartisto store add [--as <alias>]
 *   cartisto store list
 *   cartisto store use <alias>
 *   cartisto store remove <alias>
 */
const config = require("../config");
const login = require("./login");

module.exports = async function store({ sub, positionals, values }) {
  switch (sub) {
    case "add":
      // Same verify-then-save as login.
      return login({ values });

    case "list": {
      const { current, stores } = config.listStores();
      const names = Object.keys(stores);
      if (values.json) {
        console.log(JSON.stringify({ current, stores: names }, null, 2));
        return 0;
      }
      if (names.length === 0) {
        console.log("No stores yet. Add one: cartisto login");
        return 0;
      }
      for (const name of names) {
        console.log(`${name === current ? "* " : "  "}${name}  →  ${stores[name].url}`);
      }
      return 0;
    }

    case "use": {
      const alias = positionals[0];
      if (!alias) {
        console.error("Usage: cartisto store use <alias>");
        return 2;
      }
      if (!config.useStore(alias)) {
        console.error(`No such store profile: "${alias}". See: cartisto store list`);
        return 1;
      }
      console.log(`✓ Now using "${alias}".`);
      return 0;
    }

    case "remove": {
      const alias = positionals[0];
      if (!alias) {
        console.error("Usage: cartisto store remove <alias>");
        return 2;
      }
      if (!config.removeStore(alias)) {
        console.error(`No such store profile: "${alias}".`);
        return 1;
      }
      console.log(`✓ Removed "${alias}".`);
      return 0;
    }

    default:
      console.error("Usage: cartisto store <add|list|use|remove>");
      return 2;
  }
};
