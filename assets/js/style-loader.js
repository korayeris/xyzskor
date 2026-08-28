(function () {
  "use strict";
  var path = location.pathname.replace(/^\/+|\/+$/g, "");
  var canonical = new Set(["", "index.html", "futbol", "all", "super-lig", "premier-league", "la-liga", "bundesliga", "serie-a"]);
  var fixture = new URLSearchParams(location.search).get("fixture");
  var isBranchRoute = !canonical.has(path) && !fixture;
  var isGeneralHome = path === "" || path === "index.html";
  var pending = null;
  var corePending = null;
  var productStylePending = Object.create(null);
  var branchStylePending = Object.create(null);
  var activeBranchStyleGates = Object.create(null);
  var legacyStyleFailed = false;
  var productStyleFailed = Object.create(null);
  var markHubReady = null;
  var productStyles = {
    voleybol: ["xyzVolleyballCenterStyleTemplate", "xyzVolleyballCenterStylesheet"],
    ufc: ["xyzUfcCenterStyleTemplate", "xyzUfcCenterStylesheet"],
    motorsports: ["xyzMotorsportsCenterStyleTemplate", "xyzMotorsportsCenterStylesheet"]
  };

  if (isBranchRoute) document.documentElement.classList.add("xyz-branch-css-pending");

  window.__XYZ_FOOTBALL_HUB_READY__ = new Promise(function (resolve) {
    markHubReady = resolve;
  });
  window.__XYZ_MARK_FOOTBALL_HUB_READY__ = function () {
    if (markHubReady) markHubReady();
    markHubReady = null;
  };

  window.ensureXYZCoreStyles = function (eager) {
    if (document.getElementById("xyzCoreStylesheet")) return corePending || Promise.resolve();
    var template = document.getElementById("xyzCoreStyleTemplate");
    var link = template && template.content && template.content.firstElementChild
      ? template.content.firstElementChild.cloneNode(true)
      : null;
    if (!link) return Promise.resolve();
    link.id = "xyzCoreStylesheet";
    if (eager) link.media = "all";
    corePending = new Promise(function (resolve) {
      link.onload = function () {
        link.media = "all";
        link.onload = null;
        resolve();
      };
      link.onerror = function () { resolve(); };
    });
    var anchor = document.getElementById("xyzLegacyStyleTemplate") || document.getElementById("xyzFootballControlsStyle");
    document.head.insertBefore(link, anchor || null);
    return corePending;
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
    var legacyPending = new Promise(function (resolve) {
      link.onload = function () {
        link.onload = null;
        resolve();
      };
      link.onerror = function () {
        legacyStyleFailed = true;
        resolve();
      };
    });
    var anchor = document.getElementById("xyzFootballControlsStyle");
    document.head.insertBefore(link, anchor || null);
    pending = Promise.all([window.ensureXYZCoreStyles(true), legacyPending]).then(function () {});
    return pending;
  };

  window.ensureXYZProductStyles = function (productOrPath) {
    var product = String(productOrPath || "").replace(/^\/+/, "").split("/")[0];
    var config = productStyles[product];
    if (!config) return Promise.resolve();
    if (document.getElementById(config[1])) return productStylePending[product] || Promise.resolve();
    var template = document.getElementById(config[0]);
    var link = template && template.content && template.content.firstElementChild
      ? template.content.firstElementChild.cloneNode(true)
      : null;
    if (!link) return Promise.resolve();
    link.id = config[1];
    link.media = "all";
    productStylePending[product] = new Promise(function (resolve) {
      link.onload = function () { link.onload = null; resolve(); };
      link.onerror = function () {
        productStyleFailed[product] = true;
        resolve();
      };
    });
    function attachProductStyle() {
      var anchor = document.getElementById("xyzFootballHubStyle");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(link, anchor.nextSibling);
      else document.head.appendChild(link);
    }
    // İlk parse sırasında futbol katmanı henüz script etiketinin altında olabilir.
    // Ürün CSS'ini bir sonraki görevde ekleyerek cascade'de ortak katmanların
    // arkasında tutarız; istemci geçişlerinde anchor zaten hazırdır.
    if (document.readyState === "loading" && !document.getElementById("xyzFootballHubStyle")) {
      setTimeout(attachProductStyle, 0);
    } else {
      attachProductStyle();
    }
    return productStylePending[product];
  };

  window.ensureXYZBranchStyles = function (productOrPath) {
    var product = String(productOrPath || "").replace(/^\/+/, "").split("/")[0];
    var key = product || "__legacy__";
    if (branchStylePending[key]) return branchStylePending[key];

    activeBranchStyleGates[key] = true;
    document.documentElement.classList.add("xyz-branch-css-pending");
    document.documentElement.classList.remove("xyz-branch-css-ready");

    function settle(loader) {
      return Promise.resolve().then(loader).then(function () { return false; }, function () { return true; });
    }
    var styles = [
      settle(function () { return window.ensureXYZLegacyStyles(); }),
      settle(function () { return window.ensureXYZProductStyles(product); })
    ];

    function finish(failed) {
      delete activeBranchStyleGates[key];
      if (failed) document.documentElement.classList.add("xyz-branch-css-failed");
      if (Object.keys(activeBranchStyleGates).length) return;
      document.documentElement.classList.remove("xyz-branch-css-pending");
      if (!document.documentElement.classList.contains("xyz-branch-css-failed")) {
        document.documentElement.classList.add("xyz-branch-css-ready");
      }
    }

    branchStylePending[key] = Promise.all(styles).then(function (loadFailures) {
      finish(legacyStyleFailed || Boolean(productStyleFailed[product]) || loadFailures.some(Boolean));
    });
    return branchStylePending[key];
  };

  if (!canonical.has(path) || fixture) window.ensureXYZBranchStyles(path);
  else if (!isGeneralHome) window.ensureXYZCoreStyles(false);
})();
