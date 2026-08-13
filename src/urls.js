"use strict";
/*
 * URL construction for the storefront preview and the dashboard customizer.
 * The store origin comes from the OAuth-resolved profile; the app origin comes
 * from build/env config (src/endpoints.js) — never from a CLI flag.
 */

const trim = (u) => String(u).replace(/\/+$/, "");

/** Storefront URL that renders a specific (possibly unpublished) draft theme. */
function previewUrl(storeUrl, themeId, pagePath = "/") {
  const p = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  return `${trim(storeUrl)}${p}?preview=1&previewTheme=${themeId}`;
}

/** Dashboard customizer (the sections/settings sidebar) for a theme. */
function customizeUrl(appUrl, themeId) {
  return `${trim(appUrl)}/dashboard/themes/${themeId}/customize`;
}

module.exports = { previewUrl, customizeUrl };
