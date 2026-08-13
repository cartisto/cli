"use strict";
/*
 * Local link between a working directory and the remote theme it was pulled
 * from, stored at <dir>/.cartisto/theme.json so `push`/`dev` need no repeated
 * --id. Also records each file's server updatedAt, which `push` sends back as
 * the optimistic-lock base (baseUpdatedAt) so it won't clobber a change made in
 * the dashboard since the pull.
 */
const fs = require("fs");
const path = require("path");

const REL = path.join(".cartisto", "theme.json");

function file(dir) {
  return path.join(dir, REL);
}

function read(dir) {
  try {
    return JSON.parse(fs.readFileSync(file(dir), "utf8"));
  } catch {
    return null;
  }
}

function write(dir, mapping) {
  const p = file(dir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(mapping, null, 2) + "\n");
}

module.exports = { REL, read, write };
