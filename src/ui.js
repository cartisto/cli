"use strict";
/*
 * Terminal UI helpers — zero-dep ANSI coloring, a few formatting bits, and a
 * cross-platform browser opener. Colors auto-disable when stdout isn't a TTY,
 * when NO_COLOR is set, or when TERM=dumb, so piped / CI output stays clean.
 */
const { spawn } = require("node:child_process");

const useColor =
  !!process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";

const paint = (open, close) => (s) =>
  useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s);

const c = {
  bold: paint(1, 22),
  dim: paint(2, 22),
  underline: paint(4, 24),
  red: paint(31, 39),
  green: paint(32, 39),
  yellow: paint(33, 39),
  blue: paint(34, 39),
  magenta: paint(35, 39),
  cyan: paint(36, 39),
  gray: paint(90, 39),
};

const sym = {
  ok: c.green("✓"),
  err: c.red("✗"),
  warn: c.yellow("⚠"),
  arrow: c.cyan("→"),
  diamond: c.cyan("◆"),
  dot: c.dim("·"),
};

/** Short wall-clock time (dimmed) for streaming logs. */
const now = () => c.dim(new Date().toLocaleTimeString());

/** A clickable-looking URL. */
const link = (url) => c.underline(c.cyan(url));

/** Header line: "◆ title". */
const title = (text) => console.log(`\n  ${sym.diamond} ${c.bold(text)}`);

/** Horizontal rule. */
const hr = (width = 52) => console.log("  " + c.dim("─".repeat(width)));

/** Aligned "key   value" row. `pad` matches the widest key in a block. */
const row = (key, value, pad = 10) => console.log("  " + c.dim(key.padEnd(pad)) + " " + value);

/**
 * Open a URL in the user's default browser. Best-effort and non-blocking: a
 * failure is swallowed (the URL is always printed too, so the user can click it).
 * Returns true if the launch was dispatched.
 */
function openBrowser(url) {
  try {
    let cmd;
    let args;
    let opts = { stdio: "ignore", detached: true };
    if (process.platform === "win32") {
      // `start` is a cmd builtin; the empty "" is the window-title arg so a URL
      // is never mistaken for the title. Quote the URL ourselves (verbatim) so
      // cmd treats its `&` query separators as literal characters.
      cmd = process.env.ComSpec || "cmd.exe";
      args = ["/c", "start", '""', `"${url}"`];
      opts.windowsVerbatimArguments = true;
    } else if (process.platform === "darwin") {
      cmd = "open";
      args = [url];
    } else {
      cmd = "xdg-open";
      args = [url];
    }
    const child = spawn(cmd, args, opts);
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

module.exports = { useColor, c, sym, now, link, title, hr, row, openBrowser };
