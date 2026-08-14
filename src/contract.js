// ─────────────────────────────────────────────────────────────────────────
// GENERATED — DO NOT EDIT.
// The Cartisto theme contract, compiled and bundled into the CLI for local
// validation. Regenerate with `npm run bundle:contract`.
// ─────────────────────────────────────────────────────────────────────────

"use strict";
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
exports.REQUIRED_LAYOUT_TAGS = ["platform_head", "platform_body", "content"];
exports.KNOWN_SDK_VERSIONS = ["1.0"];
const SCANNABLE = /\.(liquid|js)$/;
function stripInertLiquid(src) {
    return src
        .replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, "")
        .replace(/<!--[\s\S]*?-->/g, "");
}
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
function parseSemver(v) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? "").trim());
    if (!m)
        return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
function minorLine(v) {
    const s = parseSemver(v);
    return s ? `${s.major}.${s.minor}` : null;
}
function parseMinorLine(s) {
    const m = /^(\d+)\.(\d+)$/.exec(String(s ?? "").trim());
    if (!m)
        return null;
    return { major: Number(m[1]), minor: Number(m[2]) };
}
function sameMinorLine(a, b) {
    const la = minorLine(a);
    const lb = minorLine(b);
    return la !== null && la === lb;
}
function compareMinorLine(a, b) {
    if (a.major !== b.major)
        return a.major < b.major ? -1 : 1;
    if (a.minor !== b.minor)
        return a.minor < b.minor ? -1 : 1;
    return 0;
}
function checkReleaseIntegrity(currentVersion, releases) {
    const problems = [];
    const cur = parseSemver(currentVersion);
    if (!cur) {
        problems.push(`theme.json "version" (${currentVersion ?? "missing"}) is not semver MAJOR.MINOR.PATCH`);
        return problems;
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
const SECTION_DIR = "views/sections";
const BARE_PARTIAL_NAME = /^[a-z0-9][a-z0-9_-]*$/i;
function checkSectionCatalog(manifestJson, availablePartialPaths) {
    if (!manifestJson)
        return [];
    let m;
    try {
        m = JSON.parse(manifestJson);
    }
    catch {
        return [];
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
