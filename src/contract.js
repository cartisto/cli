// ─────────────────────────────────────────────────────────────────────────
// VENDORED — DO NOT EDIT.
// Compiled from Multi_Tenancy_Ecomemrce_Backend/src/utils/themeContract.ts
// (the platform's single source of truth). Regenerate: `npm run bundle:contract`.
// ─────────────────────────────────────────────────────────────────────────

"use strict";
/**
 * themeContract.ts — the ONE source of truth for the Tier-1 theme contract
 * (Quality Gate, ADR-0002). It is deterministic, dependency-free, and operates
 * on in-memory files so the same rules run in three places without drifting:
 *
 *   1. scripts/theme-validate.js  — the CLI/CI gate over the on-disk themes/.
 *   2. tests/unit/themes/theme-hygiene.test.ts — the unit guardrail.
 *   3. src/app/TenantTheme/themeDraft.service.ts — the PUBLISH gate for a
 *      merchant's custom theme (files live in the DB, not on disk). This is the
 *      point of the gate: a contract regression blocks publish.
 *
 * The rules encode the storefront refactor's one law — "a feature fix must
 * never require editing every theme" — by banning the reintroduction of
 * platform behaviour a theme is not allowed to own (direct API calls, the
 * extracted listing engine, deleted globals, renamed events, hardcoded platform
 * <script> tags, pre-namespace element names).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_SDK_VERSIONS = exports.REQUIRED_LAYOUT_TAGS = exports.CONTRACT_RULES = void 0;
exports.stripInertLiquid = stripInertLiquid;
exports.scanBannedPatterns = scanBannedPatterns;
exports.checkRequiredLayoutTags = checkRequiredLayoutTags;
exports.checkLocaleParity = checkLocaleParity;
exports.parseSemver = parseSemver;
exports.minorLine = minorLine;
exports.parseMinorLine = parseMinorLine;
exports.sameMinorLine = sameMinorLine;
exports.checkReleaseIntegrity = checkReleaseIntegrity;
exports.checkSectionCatalog = checkSectionCatalog;
exports.checkSdkManifest = checkSdkManifest;
/**
 * Banned patterns. Matched against raw .liquid/.js source (NOT comment-stripped)
 * — identical to the historical behaviour of both prior consumers, so moving to
 * this shared module changes no result.
 */
exports.CONTRACT_RULES = [
    {
        re: /\bsalla\./,
        why: "salla.* is the pre-rebrand SDK global — call window.cartisto.* instead",
    },
    {
        re: /\bfetch\s*\(/,
        why: "themes must not call the API directly — use a cartisto.* SDK method",
    },
    {
        re: /function\s+applyFilters\b|\bINITIAL_CATEGORY_ID\b/,
        why: "the products-listing engine now ships as the platform page-listing bundle",
    },
    {
        re: /\baddToWishlist\b/,
        why: "wishlist behavior belongs to the <cartisto-wishlist> component",
    },
    {
        re: /\bchangeMainImage\b/,
        why: "the platform PDP controller binds gallery thumbnails; no window global",
    },
    {
        re: /["']cartUpdated["']/,
        why: "the cart event was renamed to cartisto:cart:updated",
    },
    {
        re: /<script[^>]+src=["'][^"']*\/js\/(store-|components\/store-)[^"']+["']/,
        why: "platform scripts are injected by platformChrome — never hardcode a <script> tag",
    },
    {
        re: /<\/?(add-to-cart-button|wishlist-button|store-auth-modal|cartisto-add-product-button|cartisto-wishlist-button)\b/,
        why: "platform elements are namespaced: use <cartisto-add-to-cart> / <cartisto-wishlist> / <cartisto-auth-modal>",
    },
    {
        re: /on(?:click|change|submit)="(?:cancelOrder|openInvoice|openRefundModal|closeRefundModal|handleRefundModalOverlayClick|handleRefundItemCheck|submitRefundFromModal)\(/,
        why: "order-detail actions are namespaced — call cartistoOrder.<fn>() (like cartistoListing.*)",
    },
    {
        re: /\bwindow\.(productData|storeTheme)\b/,
        why: "seed globals follow __NAME__: use window.__PRODUCT__ / window.__STORE_THEME__",
    },
];
/** The layout must yield these three platform slots or the storefront breaks. */
exports.REQUIRED_LAYOUT_TAGS = ["platform_head", "platform_body", "content"];
/**
 * The Theme Contract (SDK) versions this platform build understands (ADR-0001).
 * A theme declares its target via theme.json `"sdk"`; publishing an unknown one
 * is blocked. This is a compatibility contract, not a budget, so it lives here
 * (not in quality-budgets.json). Add a version when a new contract ships.
 */
exports.KNOWN_SDK_VERSIONS = ["1.0"];
const SCANNABLE = /\.(liquid|js)$/;
/** Strip Liquid `{% comment %}` and HTML `<!-- -->` blocks (presence checks only). */
function stripInertLiquid(src) {
    return src
        .replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, "")
        .replace(/<!--[\s\S]*?-->/g, "");
}
/**
 * Scan a set of in-memory theme files for banned platform-behaviour patterns.
 * Returns one problem string per hit (`path:line  «match» — why`), empty if clean.
 */
function scanBannedPatterns(files) {
    const problems = [];
    for (const file of files) {
        if (!SCANNABLE.test(file.path))
            continue;
        for (const rule of exports.CONTRACT_RULES) {
            const m = file.content.match(rule.re);
            if (m) {
                const line = file.content.slice(0, m.index).split("\n").length;
                problems.push(`${file.path}:${line}  «${m[0]}» — ${rule.why}`);
            }
        }
    }
    return problems;
}
/** Returns a problem per required layout tag the layout omits (comment-stripped). */
function checkRequiredLayoutTags(layoutContent, layoutPath = "layout.liquid") {
    const stripped = stripInertLiquid(layoutContent);
    return exports.REQUIRED_LAYOUT_TAGS.filter((t) => !stripped.includes(t)).map((t) => `${layoutPath}: missing {{ ${t} }}`);
}
function flattenKeys(obj, prefix, out) {
    for (const k of Object.keys(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        const v = obj[k];
        if (v && typeof v === "object" && !Array.isArray(v)) {
            flattenKeys(v, key, out);
        }
        else {
            out.add(key);
        }
    }
    return out;
}
/**
 * Every locale must expose the same key set as the union of all locales — a key
 * one language has and another lacks is a missing translation. Returns a problem
 * per locale that is short keys, empty if all locales are at parity (or <2 exist).
 */
function checkLocaleParity(locales) {
    const problems = [];
    const keysets = {};
    for (const f of locales) {
        try {
            keysets[f.name] = flattenKeys(JSON.parse(f.content), "", new Set());
        }
        catch {
            problems.push(`locales/${f.name}: invalid JSON`);
        }
    }
    const names = Object.keys(keysets);
    if (names.length < 2)
        return problems;
    const union = new Set();
    names.forEach((f) => keysets[f].forEach((k) => union.add(k)));
    for (const f of names) {
        const missing = [...union].filter((k) => !keysets[f].has(k));
        if (missing.length) {
            problems.push(`locales/${f}: missing ${missing.length} key(s) other locales have` +
                (missing.length <= 5
                    ? ` — ${missing.join(", ")}`
                    : ` (e.g. ${missing.slice(0, 5).join(", ")}…)`));
        }
    }
    return problems;
}
/** Parse a strict `MAJOR.MINOR.PATCH` string; null if it isn't one. */
function parseSemver(v) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? "").trim());
    if (!m)
        return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
/** The release/pin key: `"MAJOR.MINOR"`. Null when the version isn't semver. */
function minorLine(v) {
    const s = parseSemver(v);
    return s ? `${s.major}.${s.minor}` : null;
}
/** Parse a `"MAJOR.MINOR"` minor-line token (a release folder name). */
function parseMinorLine(s) {
    const m = /^(\d+)\.(\d+)$/.exec(String(s ?? "").trim());
    if (!m)
        return null;
    return { major: Number(m[1]), minor: Number(m[2]) };
}
/** True when two versions share a minor line (a patch-only difference). */
function sameMinorLine(a, b) {
    const la = minorLine(a);
    const lb = minorLine(b);
    return la !== null && la === lb;
}
/** -1 / 0 / 1 ordering of two minor lines (major first, then minor). */
function compareMinorLine(a, b) {
    if (a.major !== b.major)
        return a.major < b.major ? -1 : 1;
    if (a.minor !== b.minor)
        return a.minor < b.minor ? -1 : 1;
    return 0;
}
/**
 * Validate that a theme's release snapshots are trustworthy relative to the
 * current theme.json version. Pure (no disk) — the CI gate reads the dirs and
 * calls this. Returns one problem string per issue, empty when clean:
 *
 *   • current `version` must be semver;
 *   • every release folder must be a `MAJOR.MINOR` token;
 *   • every snapshot must be well-formed (has a layout);
 *   • a snapshot's own version must sit on the folder's minor line;
 *   • a release must archive a PAST minor line (strictly below current) — you
 *     can't archive the current minor line (bump first) or a future one;
 *   • no two folders may claim the same minor line.
 */
function checkReleaseIntegrity(currentVersion, releases) {
    const problems = [];
    const cur = parseSemver(currentVersion);
    if (!cur) {
        problems.push(`theme.json "version" (${currentVersion ?? "missing"}) is not semver MAJOR.MINOR.PATCH`);
        return problems; // can't reason about releases without a current version
    }
    const curLine = { major: cur.major, minor: cur.minor };
    const seen = new Set();
    for (const r of releases) {
        const line = parseMinorLine(r.dir);
        if (!line) {
            problems.push(`releases/${r.dir}: not a MAJOR.MINOR release folder (releases are keyed by minor line)`);
            continue;
        }
        if (seen.has(r.dir)) {
            problems.push(`releases/${r.dir}: duplicate release folder for one minor line`);
        }
        seen.add(r.dir);
        if (!r.hasLayout) {
            problems.push(`releases/${r.dir}: snapshot missing views/pages/layout.liquid`);
        }
        if (r.hasThemeCss === false) {
            problems.push(`releases/${r.dir}: snapshot missing assets/css/theme.css — re-cut with theme-release.js so a pinned install's CSS matches its pinned markup (P0.3/W3)`);
        }
        if (r.manifestVersion != null) {
            const snapLine = minorLine(r.manifestVersion);
            if (snapLine !== r.dir) {
                problems.push(`releases/${r.dir}: snapshot theme.json version "${r.manifestVersion}" is not on minor line ${r.dir}`);
            }
        }
        const cmp = compareMinorLine(line, curLine);
        if (cmp === 0) {
            problems.push(`releases/${r.dir}: archives the CURRENT minor line — bump theme.json to a higher minor/major before cutting a release`);
        }
        else if (cmp > 0) {
            problems.push(`releases/${r.dir}: newer than the current theme version ${currentVersion} — releases archive PAST minor lines`);
        }
    }
    return problems;
}
// ─── Section catalog ↔ partial integrity (ADR-0004, W2) ─────────────────────
// A section a theme's manifest declares MUST have a partial at
// views/sections/<path>.liquid, or placing that section 500s the page at render
// (the customizer offers it from the catalog; the renderer resolves its
// `partial` and hits ENOENT). The gate makes a theme self-contained: every
// declared section ships its file. Pure/in-memory so the same rule runs in the
// publish gate (fork files) and the on-disk CLI/CI gate.
const SECTION_DIR = "views/sections";
// Bare partial name (kept in sync with templateSections.SAFE_PARTIAL_NAME; this
// module is compiled and vendored into @cartisto/cli, so it stays standalone).
const BARE_PARTIAL_NAME = /^[a-z0-9][a-z0-9_-]*$/i;
/**
 * Every `sections[].path` in a theme.json manifest must resolve to a real
 * partial in `availablePartialPaths` (the theme's own `.liquid` files). Returns
 * a problem per section whose partial is missing or whose `path` is unusable as
 * a partial name; empty when the catalog is fully backed by files.
 */
function checkSectionCatalog(manifestJson, availablePartialPaths) {
    if (!manifestJson)
        return [];
    let m;
    try {
        m = JSON.parse(manifestJson);
    }
    catch {
        return []; // JSON validity is checkSdkManifest's job — don't double-report
    }
    if (!Array.isArray(m.sections))
        return [];
    const problems = [];
    for (const entry of m.sections) {
        if (!entry || typeof entry.path !== "string" || entry.path === "")
            continue;
        const p = entry.path;
        if (!BARE_PARTIAL_NAME.test(p)) {
            problems.push(`theme.json: section "${p}" has an invalid path — a section path must be a bare name (letters, digits, "-", "_") mapping to ${SECTION_DIR}/<path>.liquid`);
            continue;
        }
        const partial = `${SECTION_DIR}/${p}.liquid`;
        if (!availablePartialPaths.has(partial)) {
            problems.push(`theme.json: section "${p}" declares no template — create ${partial} (the renderer resolves each section to that path)`);
        }
    }
    return problems;
}
/** theme.json must declare a known `"sdk"` contract version (ADR-0001). */
function checkSdkManifest(manifestJson, knownVersions) {
    if (!manifestJson)
        return [];
    let m;
    try {
        m = JSON.parse(manifestJson);
    }
    catch {
        return [`theme.json is not valid JSON`];
    }
    if (!m.sdk)
        return [`theme.json missing "sdk"`];
    if (!knownVersions.includes(String(m.sdk))) {
        return [`unknown sdk version "${m.sdk}" (known: ${knownVersions.join(", ")})`];
    }
    return [];
}
