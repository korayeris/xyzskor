(function () {
  "use strict";
  var path = location.pathname.replace(/^\/+|\/+$/g, "");
  var canonical = new Set(["", "index.html", "all", "super-lig", "premier-league", "la-liga", "bundesliga", "serie-a"]);
  var fixture = new URLSearchParams(location.search).get("fixture");
  var pending = null;
  var markHubReady = null;

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
    pending = new Promise(function (resolve) {
      link.onload = function () {
        link.media = "all";
        link.onload = null;
        resolve();
      };
      link.onerror = resolve;
    });
    var anchor = document.getElementById("xyzFootballControlsStyle");
    document.head.insertBefore(link, anchor || null);
    return pending;
  };

  if (!canonical.has(path) || fixture) window.ensureXYZLegacyStyles();
})();
