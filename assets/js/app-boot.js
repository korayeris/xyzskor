(function () {
  "use strict";
  var path = location.pathname.replace(/^\/+|\/+$/g, "");
  var generalHomePath = path === "" || path === "index.html";
  var canonical = new Set(["", "index.html", "futbol", "all", "super-lig", "premier-league", "la-liga", "bundesliga", "serie-a"]);
  var fixture = new URLSearchParams(location.search).get("fixture");
  var generalHome = generalHomePath && !fixture;
  var bootScriptSource = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  var assetVersion = new URL(bootScriptSource, location.href).searchParams.get("v") || "";
  var extrasPromise = null;
  var fragmentPromises = Object.create(null);
  var productionCoreChunks = [
    ["xyzDataTemplate", "__XYZ_DATA_READY__", "__XYZ_DATA_PROMISE__", "xyzDataScript", "data"],
    ["xyzAnalyticsTemplate", "__XYZ_ANALYTICS_READY__", "__XYZ_ANALYTICS_PROMISE__", "xyzAnalyticsScript", "analytics"],
    ["xyzLiveTemplate", "__XYZ_LIVE_READY__", "__XYZ_LIVE_PROMISE__", "xyzLiveScript", "live"],
    ["xyzMatchCenterTemplate", "__XYZ_MATCH_CENTER_READY__", "__XYZ_MATCH_CENTER_PROMISE__", "xyzMatchCenterScript", "match-center"],
    ["xyzMatchdayTemplate", "__XYZ_MATCHDAY_READY__", "__XYZ_MATCHDAY_PROMISE__", "xyzMatchdayScript", "matchday"],
    ["xyzPredictGameTemplate", "__XYZ_PREDICT_GAME_READY__", "__XYZ_PREDICT_GAME_PROMISE__", "xyzPredictGameScript", "predict-game"],
    ["xyzUiCoreTemplate", "__XYZ_UI_CORE_READY__", "__XYZ_UI_CORE_PROMISE__", "xyzUiCoreScript", "core"]
  ];
  var productionPostChunks = [
    ["xyzChatTemplate", "__XYZ_CHAT_READY__", "__XYZ_CHAT_PROMISE__", "xyzChatScript", "chat"],
    ["xyzMultisportTemplate", "__XYZ_MULTISPORT_READY__", "__XYZ_MULTISPORT_PROMISE__", "xyzMultisportScript", "multisport"],
    ["xyzSportBranchesTemplate", "__XYZ_SPORT_BRANCHES_READY__", "__XYZ_SPORT_BRANCHES_PROMISE__", "xyzSportBranchesScript", "sport-branches"],
    ["xyzMotorsportsTemplate", "__XYZ_MOTORSPORTS_READY__", "__XYZ_MOTORSPORTS_PROMISE__", "xyzMotorsportsScript", "motorsports"],
    ["xyzUfcHubTemplate", "__XYZ_UFC_HUB_READY__", "__XYZ_UFC_HUB_PROMISE__", "xyzUfcHubScript", "ufc-hub"]
  ];
  var canonicalFragmentSpecs = [
    ["account-auth.html", "accountOverlay", "body", true],
    ["news-match.html", "newsOverlay", "body", true],
    ["mobile.html", "mobileBottomNav", "body", false],
    ["chat.html", "chatLauncher", "body", false]
  ];
  if (fixture) canonicalFragmentSpecs.unshift(["matchday.html", "matchdayCommand", "before-wrap", true]);

  function nextTask() {
    return new Promise(function (resolve) { setTimeout(resolve, 0); });
  }

  function templateScriptSource(templateId) {
    var template = document.getElementById(templateId);
    var script = template && template.content && template.content.firstElementChild;
    return script && script.src ? script.src : "";
  }

  function primeChunkDownloads(chunks) {
    chunks.forEach(function (chunk) {
      var src = templateScriptSource(chunk[0]);
      if (!src || document.querySelector('link[data-xyz-chunk-preload="' + chunk[0] + '"]')) return;
      var link = document.createElement("link");
      link.rel = "preload";
      link.as = "script";
      link.href = src;
      link.fetchPriority = "low";
      link.dataset.xyzChunkPreload = chunk[0];
      document.head.append(link);
    });
  }

  function fragmentUrl(file) {
    return "/assets/fragments/" + encodeURIComponent(file) + (assetVersion ? "?v=" + encodeURIComponent(assetVersion) : "");
  }

  function fetchFragment(spec) {
    var file = spec[0];
    var requiredId = spec[1];
    if (document.getElementById(requiredId)) return Promise.resolve(null);
    if (fragmentPromises[file]) return fragmentPromises[file];
    fragmentPromises[file] = fetch(fragmentUrl(file), { credentials:"same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("UI fragmenti yuklenemedi: " + file + " (" + response.status + ")");
        return response.text();
      })
      .then(function (html) { return { spec:spec, html:html }; });
    return fragmentPromises[file];
  }

  function insertFragment(result) {
    if (!result) return;
    var spec = result.spec;
    if (document.getElementById(spec[1])) return;
    var template = document.createElement("template");
    template.innerHTML = result.html.trim();
    if (!template.content.firstElementChild) throw new Error("UI fragmenti bos: " + spec[0]);
    if (spec[2] === "before-wrap") {
      var wrap = document.querySelector(".wrap");
      if (!wrap || !wrap.parentNode) throw new Error("Mac merkezi yerlesim hedefi bulunamadi.");
      wrap.parentNode.insertBefore(template.content, wrap);
    } else {
      document.body.append(template.content);
    }
    if (!document.getElementById(spec[1])) throw new Error("UI fragment hedefi eklenemedi: " + spec[1]);
  }

  function prepareCanonicalFragments() {
    return Promise.all(canonicalFragmentSpecs.map(function (spec) {
      return fetchFragment(spec).catch(function (error) {
        if (spec[3]) throw error;
        console.warn("[XYZSkor] Ikincil UI parcasi devre disi:", spec[0], error);
        return null;
      });
    }));
  }

  function hydrateCanonicalFragments(results) {
    return results.filter(Boolean).reduce(function (chain, result) {
      return chain.then(nextTask).then(function () { insertFragment(result); });
    }, Promise.resolve()).then(function () {
      window.__XYZ_CANONICAL_FRAGMENTS_READY__ = true;
    });
  }

  window.ensureXYZUiExtras = function () {
    if (window.__XYZ_UI_EXTRAS_READY__) return Promise.resolve();
    if (extrasPromise) return extrasPromise;
    var template = document.getElementById("xyzUiExtrasTemplate");
    var script = template && template.content && template.content.firstElementChild
      ? template.content.firstElementChild.cloneNode(true)
      : null;
    if (!script) return Promise.resolve();
    script.id = "xyzUiExtrasScript";
    extrasPromise = new Promise(function (resolve, reject) {
      script.onload = function () {
        window.__XYZ_UI_EXTRAS_READY__ = true;
        resolve();
      };
      script.onerror = function () { reject(new Error("UI extras chunk yuklenemedi.")); };
    });
    document.body.append(script);
    return extrasPromise;
  };

  function start() {
    if (typeof boot !== "function") return Promise.reject(new Error("UI boot fonksiyonu yuklenemedi."));
    return Promise.resolve(boot());
  }

  function loadProductionChunk(templateId, readyKey, promiseKey, scriptId, label, required) {
    if (window[readyKey]) return Promise.resolve();
    if (window[promiseKey]) return window[promiseKey];
    var template = document.getElementById(templateId);
    var script = template && template.content && template.content.firstElementChild
      ? template.content.firstElementChild.cloneNode(true)
      : null;
    if (!script) return required
      ? Promise.reject(new Error("UI " + label + " chunk sablonu bulunamadi."))
      : Promise.resolve();
    script.id = scriptId;
    window[promiseKey] = new Promise(function (resolve, reject) {
      script.onload = function () {
        window[readyKey] = true;
        resolve();
      };
      script.onerror = function () { reject(new Error("UI " + label + " chunk yuklenemedi.")); };
    });
    document.body.append(script);
    return window[promiseKey];
  }

  function loadSequence(chunks, required) {
    return chunks.reduce(function (chain, chunk) {
      return chain
        .then(nextTask)
        .then(function () { return loadProductionChunk.apply(null, chunk.concat(required)); });
    }, Promise.resolve());
  }

  function postChunksForRoute() {
    var chatChunk = productionPostChunks[0];
    var multisportChunk = productionPostChunks[1];
    var branchChunk = productionPostChunks[2];
    var motorsportsChunk = productionPostChunks[3];
    var ufcChunk = productionPostChunks[4];
    var product = path.split("/")[0];
    if (product === "basketbol" || product === "voleybol") return [chatChunk, multisportChunk, branchChunk];
    if (product === "motorsports") return [chatChunk, branchChunk, motorsportsChunk];
    if (product === "ufc") return [chatChunk, branchChunk, ufcChunk];
    // Football/Predict only need the lightweight global chat and branch nav.
    // Loading every sport renderer here created avoidable long tasks exactly
    // while users were switching from the five-league board to a league.
    return [chatChunk, branchChunk];
  }

  // Route-aware geçiş için talep anında branş paketi yükleyici.
  //
  // Genel ana sayfa ve futbol rotaları bütün spor renderer'larını önden
  // yüklemez (bu, ilk boyamayı gereksiz yere uzatıyordu). Router bir branşa
  // geçmeden önce bu fonksiyonu çağırır; modül hazır olduğunda geçiş belge
  // yenilemeden istemcide yapılabilir. Modül yoksa router denetimli
  // navigasyona düşer. Bu fonksiyon hiçbir spor API'sini çağırmaz; yalnız
  // JS paketini indirir.
  function chunksForProduct(product) {
    var chatChunk = productionPostChunks[0];
    var multisportChunk = productionPostChunks[1];
    var branchChunk = productionPostChunks[2];
    var motorsportsChunk = productionPostChunks[3];
    var ufcChunk = productionPostChunks[4];
    if (product === "basketbol" || product === "voleybol") return [chatChunk, branchChunk, multisportChunk];
    if (product === "motorsports") return [chatChunk, branchChunk, motorsportsChunk];
    if (product === "ufc") return [chatChunk, branchChunk, ufcChunk];
    return [chatChunk, branchChunk];
  }

  function branchStylesForProduct(productOrPath) {
    var product = String(productOrPath || "").replace(/^\/+|\/+$/g, "").split("/")[0].toLowerCase();
    if (!["basketbol", "voleybol", "motorsports", "ufc"].includes(product)) return Promise.resolve();
    if (typeof window.ensureXYZBranchStyles === "function") return window.ensureXYZBranchStyles(product);
    if (typeof window.ensureXYZLegacyStyles === "function") return window.ensureXYZLegacyStyles();
    return Promise.resolve();
  }

  window.ensureXYZBranchModule = function (product) {
    var key = String(product || "").replace(/^\/+|\/+$/g, "").split("/")[0].toLowerCase();
    // Geliştirme sunucusu tüm zinciri statik olarak sunar; template yoksa
    // modüller zaten yüklüdür.
    if (!document.getElementById("xyzChatTemplate")) return Promise.resolve(true);
    var chunks = chunksForProduct(key);
    primeChunkDownloads(chunks);
    var stylesReady = branchStylesForProduct(key);
    return Promise.resolve(stylesReady)
      .then(function () { return loadSequence(chunks, false); })
      .then(function () { return true; })
      .catch(function () { return false; });
  };

  function ensureProductionRuntime() {
    var hasCore = Boolean(document.getElementById("xyzDataTemplate"));
    var hasStage = Boolean(document.getElementById("xyzUiStageTemplate"));
    var hasRuntime = Boolean(document.getElementById("xyzUiRuntimeTemplate"));
    // Development serves the complete, unsplit static script chain.
    if (!hasCore && !hasStage && !hasRuntime) return Promise.resolve(false);
    var stageChunk = ["xyzUiStageTemplate", "__XYZ_UI_STAGE_READY__", "__XYZ_UI_STAGE_PROMISE__", "xyzUiStageScript", "stage"];
    var runtimeChunk = ["xyzUiRuntimeTemplate", "__XYZ_UI_RUNTIME_READY__", "__XYZ_UI_RUNTIME_PROMISE__", "xyzUiRuntimeScript", "runtime"];
    var fragmentsPrepared = prepareCanonicalFragments();
    // initial-route has already started the compact football request. Only now
    // warm the heavier app chunks in parallel; evaluation still happens in
    // explicit task-separated dependency order below.
    primeChunkDownloads(productionCoreChunks.concat([stageChunk, runtimeChunk]));
    return loadSequence(productionCoreChunks.slice(0, 2), true)
      .then(function () { return fragmentsPrepared; })
      .then(hydrateCanonicalFragments)
      .then(function () { return loadSequence(productionCoreChunks.slice(2), true); })
      .then(nextTask)
      .then(function () { return loadProductionChunk.apply(null, stageChunk.concat(true)); })
      .then(nextTask)
      .then(function () { return loadProductionChunk.apply(null, runtimeChunk.concat(true)); })
      .then(function () { return true; });
  }

  function showFatalBootError(error) {
    console.error("[XYZSkor] Uygulama kabugu yuklenemedi:", error);
    var target = document.body.classList.contains("football-league-overview-mode")
      ? document.getElementById("footballLeagueOverview")
      : document.getElementById("footballScoreboardHome");
    if (!target) target = document.getElementById("footballLeagueOverview") || document.getElementById("footballScoreboardHome");
    if (target) target.innerHTML = '<div class="load-error"><p>Uygulama dosyalari yuklenemedi.</p><button type="button" onclick="location.reload()">Yeniden dene</button></div>';
  }

  // The general landing page is a static branch directory. Loading the full
  // football data/UI/fragment graph here spent more than a megabyte without
  // owning a single sports API request. Branch-router can still load the
  // selected branch module on demand through ensureXYZBranchModule.
  var appBootPromise = generalHome
    ? Promise.resolve(true)
    : ensureProductionRuntime()
      .then(function (productionMode) {
        if (!canonical.has(path) || fixture) return window.ensureXYZUiExtras().then(function () { return productionMode; });
        return productionMode;
      })
      .then(nextTask)
      .then(start);
  window.__XYZ_APP_BOOT_READY__ = appBootPromise;
  appBootPromise
    .then(function () {
      window.__XYZ_APP_BOOT_READY__ = true;
      if (generalHome || !document.getElementById("xyzChatTemplate")) return;
      // These modules stay available, but never collapse into the first
      // football paint's single adjacent-defer long task.
      var routePostChunks = postChunksForRoute();
      var initialBranchStylesReady = branchStylesForProduct(path);
      primeChunkDownloads(routePostChunks);
      var loadPostModules = function () {
        Promise.resolve(initialBranchStylesReady)
          .then(function () { return loadSequence(routePostChunks, true); })
          .catch(function (error) {
            console.error("[XYZSkor] Ikincil uygulama modulu yuklenemedi:", error);
          });
      };
      if (typeof requestIdleCallback === "function") requestIdleCallback(loadPostModules, { timeout:1500 });
      else setTimeout(loadPostModules, 100);
    })
    .catch(function (error) {
      window.__XYZ_APP_BOOT_READY__ = false;
      showFatalBootError(error);
    });
})();
