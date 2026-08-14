# @cartisto/cli

The Cartisto Theme CLI — build custom storefront themes in your own editor, validate them locally, and sync them with a Cartisto store.

> Commerce behavior belongs to the platform. Themes own presentation.

## Install

```bash
npm install -g @cartisto/cli
cartisto help
```

**Zero runtime dependencies** — one self-contained package. It includes the
Cartisto theme contract used for local validation, so it runs on any Node ≥ 18,
fully offline. `@cartisto/cli` is the only package you install.

### From source

```bash
git clone https://github.com/cartisto/cli.git
cd cli
node bin/cartisto.js help

# optional: expose it as the `cartisto` command
npm link && cartisto help
```

## Auth & stores

```bash
cartisto login                                    # authorize in the browser (OAuth)
cartisto logout                                   # remove the saved profile
cartisto store list | use <alias> | remove <alias>   # manage profiles
```

Auth uses **OAuth 2.0 Authorization Code with PKCE** over a localhost loopback
callback (like the Shopify / GitHub CLIs). `cartisto login` (no arguments) opens
Cartisto in your browser; you sign in as a **Manager** whose role has the
**Themes** permission and approve. The browser redirects a one-time code back to
the CLI, which exchanges it for a **themes-scoped token and the authorized store's
context** — you never type a store or app URL. For headless/SSH sessions,
`cartisto login --device` uses the Device Authorization Grant instead. Profiles
live in `~/.cartisto/config.json` (mode `0600`).

No endpoint configuration is needed — the CLI connects to Cartisto automatically.

Managing several stores? Run `cartisto store add --as <alias>` (an OAuth login
that saves under a new alias) and switch with `cartisto store use <alias>`.

For **CI/machine** use, skip `login` and set `CARTISTO_STORE_URL` +
`CARTISTO_API_KEY` (an `integration` key from the dashboard → API Keys).

## Theme commands

```bash
cartisto theme init  [name] [--dir <dir>]             # create a theme + pull it locally
cartisto theme list [--json]                          # themes on the active store
cartisto theme pull  [--id <id>] [--dir <dir>]        # download a theme's files
cartisto theme diff  [--id <id>] [--dir <dir>]        # preview what a push would change
cartisto theme push  [--id <id>] [--dir <dir>] [--publish]   # upload (edits → draft)
cartisto theme dev   [--id <id>] [--dir <dir>] [--open customize|storefront|none]
                                                      # watch + auto-push drafts, open the customizer
cartisto theme validate [dir]                         # run the platform contract locally

cartisto doctor                                       # check Node, CLI, endpoints, store connection
```

- **pull** writes every file into `dir` and records the dir↔theme link (+ each
  file's server `updatedAt`) in `<dir>/.cartisto/theme.json`, so `push` needs no `--id`.
- **push** uploads code files: edits land as **drafts** (preview with
  `?previewTheme=<id>`), new files are created live. Each write is optimistic-locked
  against the pulled `updatedAt`, so a file changed in the dashboard since your pull
  is flagged as a conflict instead of clobbered. `--publish` then promotes the drafts
  through the server's **quality gate** — a contract regression is surfaced and blocks.
- **dev** watches the directory and, on every save to a code file, pushes just
  that file as a draft (optimistic-locked). On start it **opens the dashboard
  customizer** for the theme — the sections/settings sidebar, whose live preview
  renders the same `?previewTheme=<id>` draft your saves push to, so you can place
  and configure the sections you're editing. Both the customizer and the raw
  storefront-preview URLs are printed. Publishing stays the explicit, gated
  `push --publish` step. Ctrl+C to stop.
    - `--open customize` (default) · `storefront` (bare preview, no login
      needed) · `none` (just print the URLs). The customizer opens in your
      browser and needs you signed in to Cartisto.
- **init** forks the platform starter into a new custom theme on the store and
  pulls it locally, ready to edit. The theme is a plain folder of Liquid /
  `theme.json` / assets / locales — no `package.json`, no `npm install`, no build
  step. **diff** shows, read-only, which local files differ from the server
  before you push.

### `cartisto theme validate [dir]`

Runs Cartisto's theme contract against a local directory (defaults to `.`). It is
the **exact mirror of the server-side publish gate** — the CLI includes the same
theme contract — so a green local validate means publish won't reject the theme on
contract grounds. It checks:

- no banned platform-behaviour patterns — themes must not call the backend API
  directly (`fetch`) or re-implement platform-owned commerce behaviour;
- the layout yields the required platform slots (`platform_head` / `platform_body` / `content`);
- `theme.json` declares a supported theme contract version (its `"sdk"` field);
- every `locales/*.json` is at key parity with the others.

```bash
cartisto theme validate ./my-theme
# ✓ PASS — theme meets the platform contract      (exit 0)
# ✗ FAIL — N problem(s): …                         (exit 1)
```

Exit codes: `0` pass · `1` contract violations · `2` usage/IO error.

### `cartisto version` · `cartisto help`

Print the version / usage.
