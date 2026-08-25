(function () {
  "use strict";
  var path = location.pathname.replace(/^\/+|\/+$/g, "");
  var canonical = new Set(["", "index.html", "all", "super-lig", "premier-league", "la-liga", "bundesliga", "serie-a"]);
  var fixture = new URLSearchParams(location.search).get("fixture");
  var isBranchRoute = !canonical.has(path) && !fixture;
  var pending = null;
  var markHubReady = null;

  if (isBranchRoute) document.documentElement.classList.add("xyz-branch-css-pending");

  window.__XYZ_FOOTBALL_HUB_READY__ = new Promise(function (resolve) {
    markHubReady = resolve;
  });
  window.__XYZ_MARK_FOOTBALL_HUB_READY__ = function () {
    if (markHubReady) markHubReady();
    markHubReady = null;
  };

  window.ensureXYZLegacyStyles = function () {
    if (document.getElementById("xyzLegacyStylesheet")) return pending || Promise.resolve();
    var template = document.getElementById("xyzLegacyStyleTemplate");
    var link = template && template.content && template.content.firstElementChild
      ? template.content.firstElementChild.cloneNode(true)
      : null;
    if (!link) return Promise.resolve();
    link.id = "xyzLegacyStylesheet";
    // Branş sayfalarında bu dosya temel yerleşimdir. `media=print` ile
    // asenkron bırakılırsa tarayıcı futbol DOM'unu kısa süre ham olarak boyar.
    link.media = "all";
    link.removeAttribute("onload");
    pending = new Promise(function (resolve) {
      link.onload = function () {
        link.onload = null;
        document.documentElement.classList.remove("xyz-branch-css-pending");
        document.documentElement.classList.add("xyz-branch-css-ready");
        resolve();
      };
      link.onerror = function () {
        document.documentElement.classList.remove("xyz-branch-css-pending");
        document.documentElement.classList.add("xyz-branch-css-failed");
        resolve();
      };
    });
    var anchor = document.getElementById("xyzFootballControlsStyle");
    document.head.insertBefore(link, anchor || null);
    return pending;
  };

  if (!canonical.has(path) || fixture) window.ensureXYZLegacyStyles();
})();
