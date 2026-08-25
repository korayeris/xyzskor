// XYZSKOR route-aware branş router'ı.
//
// Sözleşme (EXTERNAL-REVIEW-HANDOFF-2026-08-25 P1.2):
//   - Branş geçişinde ham DOM, eski branş metni, tüm sayfa skeleton'ı veya
//     beyaz/siyah flash görünmez.
//   - Geçişte yalnız yeni görünür branşın API ailesi çağrılır; eski branşın
//     devam eden istekleri abort edilir.
//   - Header yeniden kurulmaz; focus, scroll ve seçili filtre korunur.
//   - Router hiçbir API endpointinin sahibi değildir.
//
// İki geçiş modu vardır:
//   1. CLIENT: hedef yüzey `register()` ile mount/unmount sunuyorsa geçiş
//      tamamen istemcide yapılır (history.pushState, belge yenilenmez).
//   2. MANAGED: hedef modül yüklenme anında `location.pathname`'e bağlıysa
//      (futbol kökü, UFC, motor sporları) belge değişimi zorunludur. Bu
//      durumda router eski isteği abort eder, mevcut içeriği ekranda tutar,
//      ince bir üst progress göstergesi açar, hedef belgeyi ve paketini
//      prefetch eder, ancak ondan sonra navigasyonu commit eder. Böylece ham
//      DOM ve flash oluşmaz.
(function () {
  "use strict";

  var surfaces = [];
  var abortHooks = [];
  var currentKey = null;
  var navToken = 0;
  var progressElement = null;
  var progressTimer = null;
  var MANAGED_PREFETCH_TIMEOUT_MS = 3000;
  var BRANCH_MODULE_TIMEOUT_MS = 3000;
  var LEGACY_STYLE_PRODUCTS = {
    basketbol: true,
    voleybol: true,
    ufc: true,
    motorsports: true
  };

  function normalize(pathname) {
    return String(pathname || "").replace(/\/+$/, "") || "/";
  }

  var LEAGUE_LABELS = {
    "super-lig": "Süper Lig",
    "premier-league": "Premier League",
    "la-liga": "La Liga",
    bundesliga: "Bundesliga",
    "serie-a": "Serie A"
  };
  var SECTION_LABELS = {
    matches: "Maçlar", maclar: "Maçlar", agenda: "Gündem", news: "Gündem", clubs: "Kulüpler",
    transfers: "Transferler", standings: "Puan Durumu", ligler: "Ligler",
    takimlar: "Takımlar", predict: "Predict", live: "Canlı", events: "Etkinlikler",
    fighters: "Dövüşçüler", rankings: "Sıralama", bouts: "Maç Merkezi",
    leader: "Liderlik", rewards: "Ödüller", profile: "Profil"
  };

  function routeMetadata(pathname, search) {
    var path = normalize(pathname);
    var parts = path.split("/").filter(Boolean);
    var first = parts[0] || "";
    var second = parts[1] || "";
    var hasFixture = false;
    try { hasFixture = Boolean(new URLSearchParams(search || "").get("fixture")); } catch (_) {}

    if (hasFixture) return {
      title: "Maç Merkezi — XYZSKOR",
      description: "Canlı maç olayları, istatistikler, kadrolar ve ücretsiz tahmin seçenekleri XYZSKOR Maç Merkezi'nde."
    };
    if (!first || first === "index.html") return {
      title: "Çok Sporlu Canlı Skor — XYZSKOR",
      description: "Futbol, basketbol, voleybol, UFC ve motor sporları merkezlerini XYZSKOR'da keşfet; veri yalnız seçtiğin branş için yüklenir."
    };
    if (first === "futbol" || first === "all" || first === "football") return {
      title: "Futbol · 5 Lig — XYZSKOR",
      description: "Süper Lig, Premier League, La Liga, Bundesliga ve Serie A için canlı skor, fikstür ve puan durumu."
    };
    if (LEAGUE_LABELS[first]) {
      var leagueSection = SECTION_LABELS[second] || "Futbol";
      return {
        title: LEAGUE_LABELS[first] + " · " + leagueSection + " — XYZSKOR",
        description: LEAGUE_LABELS[first] + " için canlı skor, fikstür, puan durumu, kulüp ve gündem verileri."
      };
    }
    if (first === "predict") return {
      title: "Predict" + (SECTION_LABELS[second] ? " · " + SECTION_LABELS[second] : "") + " — XYZSKOR",
      description: "XYZSKOR Predict'te ücretsiz maç tahminleri yap, puan topla ve sıralamadaki yerini takip et."
    };
    if (first === "basketbol" || first === "voleybol") {
      var sportLabel = first === "basketbol" ? "Basketbol" : "Voleybol";
      return {
        title: sportLabel + (SECTION_LABELS[second] ? " · " + SECTION_LABELS[second] : "") + " — XYZSKOR",
        description: sportLabel + " için günlük maç programı, canlı skorlar, ligler ve takım verileri."
      };
    }
    if (first === "ufc") return {
      title: "UFC" + (SECTION_LABELS[second] ? " · " + SECTION_LABELS[second] : "") + " — XYZSKOR",
      description: "UFC etkinlikleri, canlı maçlar, dövüşçü profilleri ve güncel sıralamalar."
    };
    if (first === "motorsports") {
      var seriesLabels = {
        "formula-1": "Formula 1", "formula-e": "Formula E", indycar: "IndyCar",
        motogp: "MotoGP", moto2: "Moto2", moto3: "Moto3", wrc: "WRC",
        wec: "WEC", "le-mans": "Le Mans", nascar: "NASCAR"
      };
      return {
        title: "Motor Sporları" + (seriesLabels[second] ? " · " + seriesLabels[second] : "") + " — XYZSKOR",
        description: "Formula, MotoGP, WRC, WEC ve diğer motor sporları için takvim, sonuç, sıralama ve canlı veri."
      };
    }
    return {
      title: "XYZSKOR — Spor Verileri",
      description: "Canlı skor, fikstür, puan durumu ve ücretsiz spor tahminleri XYZSKOR'da."
    };
  }

  function syncMetadata(pathname, search) {
    var metadata = routeMetadata(pathname == null ? location.pathname : pathname, search == null ? location.search : search);
    var routePath = pathname == null ? location.pathname : pathname;
    var routeSearch = search == null ? location.search : search;
    var canonical;
    try {
      canonical = new URL(routePath || "/", location.origin);
      canonical.hash = "";
      canonical.search = "";
      var fixture = new URLSearchParams(routeSearch || "").get("fixture");
      if (fixture) canonical.searchParams.set("fixture", fixture);
    } catch (_) {
      canonical = { href: location.origin + "/" };
    }

    document.title = metadata.title;
    function setAttribute(selector, attribute, value) {
      var element = document.querySelector && document.querySelector(selector);
      if (element) element.setAttribute(attribute, value);
    }
    setAttribute('meta[name="description"]', "content", metadata.description);
    setAttribute('link[rel="canonical"]', "href", canonical.href);
    setAttribute('meta[property="og:url"]', "content", canonical.href);
    setAttribute('meta[property="og:title"]', "content", metadata.title);
    setAttribute('meta[property="og:description"]', "content", metadata.description);
    setAttribute('meta[name="twitter:title"]', "content", metadata.title);
    setAttribute('meta[name="twitter:description"]', "content", metadata.description);
    metadata.url = canonical.href;
    return metadata;
  }

  function findSurface(pathname) {
    for (var index = 0; index < surfaces.length; index += 1) {
      try {
        if (surfaces[index].matches(pathname)) return surfaces[index];
      } catch (_) {}
    }
    return null;
  }

  function ensureBranchStyles(pathname) {
    var product = normalize(pathname).split("/").filter(Boolean)[0] || "";
    if (!LEGACY_STYLE_PRODUCTS[product] || typeof window.ensureXYZLegacyStyles !== "function") {
      return Promise.resolve();
    }
    document.documentElement.classList.add("xyz-branch-css-pending");
    try {
      return Promise.resolve(window.ensureXYZLegacyStyles()).then(function () {
        document.documentElement.classList.remove("xyz-branch-css-pending");
      }, function () {
        document.documentElement.classList.remove("xyz-branch-css-pending");
        document.documentElement.classList.add("xyz-branch-css-failed");
      });
    } catch (_) {
      document.documentElement.classList.remove("xyz-branch-css-pending");
      document.documentElement.classList.add("xyz-branch-css-failed");
      return Promise.resolve();
    }
  }

  function register(surface) {
    if (!surface || typeof surface.matches !== "function") return;
    surfaces.push(surface);
    if (!currentKey && surface.matches(location.pathname)) currentKey = surface.key;
  }

  // Branş modülleri devam eden isteklerini buraya kaydeder; router geçişte
  // hepsini iptal eder. Böylece eski branş yeni branşın üstüne veri yazamaz.
  function registerAbortHook(hook) {
    if (typeof hook === "function") abortHooks.push(hook);
  }

  function abortPendingBranchWork() {
    for (var index = 0; index < abortHooks.length; index += 1) {
      try { abortHooks[index](); } catch (_) {}
    }
    var controllers = [
      window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__,
      window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__
    ];
    for (var i = 0; i < controllers.length; i += 1) {
      try { if (controllers[i] && !controllers[i].signal.aborted) controllers[i].abort(); } catch (_) {}
    }
  }

  function ensureProgress() {
    if (progressElement && progressElement.isConnected) return progressElement;
    progressElement = document.createElement("div");
    progressElement.className = "xyz-route-progress";
    progressElement.setAttribute("role", "status");
    progressElement.setAttribute("aria-live", "polite");
    progressElement.innerHTML = '<span class="xyz-route-progress-bar"></span>'
      + '<span class="xyz-route-progress-label">Yükleniyor</span>';
    document.body.appendChild(progressElement);
    return progressElement;
  }

  // Tüm sayfayı skeleton'a çevirmek yasaktır: kullanıcı eski içeriği görmeye
  // devam ederken yalnız ince bir üst gösterge açılır.
  function showProgress(label) {
    var element = ensureProgress();
    var text = element.querySelector(".xyz-route-progress-label");
    if (text) text.textContent = label || "Yükleniyor";
    element.classList.add("is-active");
    document.documentElement.classList.add("xyz-route-transition");
    clearTimeout(progressTimer);
  }

  function hideProgress() {
    if (!progressElement) return;
    progressElement.classList.remove("is-active");
    document.documentElement.classList.remove("xyz-route-transition");
  }

  function prefetch(url) {
    // A service worker, captive portal or half-open connection can leave a
    // fetch pending indefinitely. Navigation must never wait forever for this
    // optional cache warm-up: abort it at the deadline and commit the target
    // document with the browser's normal navigation fallback.
    return new Promise(function (resolve) {
      var settled = false;
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () {
        try { if (controller) controller.abort(); } catch (_) {}
        finish(false);
      }, MANAGED_PREFETCH_TIMEOUT_MS);

      function finish(warmed) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(warmed);
      }

      try {
        fetch(url, {
          credentials: "same-origin",
          signal: controller ? controller.signal : undefined
        }).then(function (response) {
          return response.ok ? response.text() : null;
        }).then(function () {
          finish(true);
        }).catch(function () {
          finish(false);
        });
      } catch (_) {
        finish(false);
      }
    });
  }

  function loadBranchModule(pathname) {
    // A dynamically inserted script can remain pending forever when the
    // connection disappears without an error event. Treat module loading as
    // an optional fast path: after the deadline, continue through the managed
    // document-navigation fallback instead of trapping the user on this page.
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () { finish(false); }, BRANCH_MODULE_TIMEOUT_MS);

      function finish(loaded) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(Boolean(loaded));
      }

      try {
        Promise.resolve(window.ensureXYZBranchModule(pathname))
          .then(finish)
          .catch(function () { finish(false); });
      } catch (_) {
        finish(false);
      }
    });
  }

  function commitNavigation(url) {
    // Prefetch tamamlandığı için hedef belge ve paketi tarayıcı cache'inden
    // boyanır; ham DOM aralığı pratikte kapanır.
    window.location.assign(url);
  }

  function scrollTopSoft() {
    try { window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (_) { window.scrollTo(0, 0); }
  }

  function navigate(url, options) {
    var settings = options || {};
    var target = new URL(url, location.href);
    if (target.origin !== location.origin) { commitNavigation(target.href); return Promise.resolve(false); }
    if (normalize(target.pathname) === normalize(location.pathname) && target.search === location.search) {
      return Promise.resolve(true);
    }

    var token = ++navToken;
    abortPendingBranchWork();
    var stylesReady = ensureBranchStyles(target.pathname);

    // Hedef branşın JS paketi henüz yüklü değilse önce onu indir. Paket hazır
    // olursa geçiş belge yenilemeden istemcide yapılır; olmazsa denetimli
    // navigasyona düşülür. Bu adım hiçbir spor API'sini çağırmaz.
    if (!findSurface(target.pathname) && typeof window.ensureXYZBranchModule === "function") {
      showProgress(settings.label || "Yükleniyor");
      return Promise.all([stylesReady, loadBranchModule(target.pathname)]).then(function () {
        if (token !== navToken) return false;
        return finishNavigate(target, settings, token);
      });
    }
    return stylesReady.then(function () {
      if (token !== navToken) return false;
      return finishNavigate(target, settings, token);
    });
  }

  function finishNavigate(target, settings, token) {
    var surface = findSurface(target.pathname);
    var previous = currentKey ? findSurfaceByKey(currentKey) : null;

    if (surface && typeof surface.mount === "function") {
      if (previous && previous !== surface && typeof previous.unmount === "function") {
        try { previous.unmount(); } catch (_) {}
      }
      if (settings.push !== false) {
        try { history.pushState({ xyzBranch: surface.key }, "", target.pathname + target.search); } catch (_) {}
      }
      currentKey = surface.key;
      try { surface.mount({ pathname: target.pathname, search: target.search }); } catch (_) {}
      syncMetadata(target.pathname, target.search);
      hideProgress();
      if (settings.scroll !== false) scrollTopSoft();
      return Promise.resolve(true);
    }

    // MANAGED geçiş: hedef modül belge yüklenmesine bağlı.
    showProgress(settings.label || "Yükleniyor");
    return prefetch(target.href).then(function () {
      if (token !== navToken) return false;
      commitNavigation(target.href);
      return true;
    });
  }

  function findSurfaceByKey(key) {
    for (var index = 0; index < surfaces.length; index += 1) {
      if (surfaces[index].key === key) return surfaces[index];
    }
    return null;
  }

  // Router içi bağlantılar: tam sayfa navigasyonu router'a devreder.
  function bindLinks(root) {
    var scope = root || document;
    var links = scope.querySelectorAll("a[data-branch-link], a[data-router-link]");
    for (var index = 0; index < links.length; index += 1) {
      bindLink(links[index]);
    }
  }

  function bindLink(link) {
    if (!link || link.dataset.xyzRouterBound === "1") return;
    link.dataset.xyzRouterBound = "1";
    link.addEventListener("click", function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(link.getAttribute("href"), { label: (link.textContent || "").trim() || "Yükleniyor" });
    });
  }

  window.addEventListener("popstate", function (event) {
    var surface = findSurface(location.pathname);
    if (surface && typeof surface.mount === "function") {
      abortPendingBranchWork();
      var previous = currentKey ? findSurfaceByKey(currentKey) : null;
      if (previous && previous !== surface && typeof previous.unmount === "function") {
        try { previous.unmount(); } catch (_) {}
      }
      currentKey = surface.key;
      try { surface.mount({ pathname: location.pathname, search: location.search }); } catch (_) {}
      syncMetadata(location.pathname, location.search);
      hideProgress();
      return;
    }

    // pushState ile acilan bir istemci yuzeyinden (ornegin Basketbol) belgeye
    // bagli bir rotaya (ornegin /futbol) geri donuldugunde tarayici ayni belgeyi
    // korur; kendiliginden yeni belge yuklemez. Bu durumda mevcut branch DOM'unu
    // ekranda tutup isteklerini kapatir ve hedef rotayi kontrollu olarak yeniden
    // yukleriz. Aksi halde URL /futbol olurken Basketbol yuzeyi acik kalirdi.
    if (currentKey) {
      abortPendingBranchWork();
      showProgress("Yükleniyor");
      try { if (event && typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation(); } catch (_) {}
      try { window.location.reload(); }
      catch (_) { commitNavigation(location.href); }
    }
  });

  window.addEventListener("pagehide", hideProgress);

  window.XYZBranchRouter = {
    register: register,
    registerAbortHook: registerAbortHook,
    navigate: navigate,
    bindLinks: bindLinks,
    bindLink: bindLink,
    showProgress: showProgress,
    hideProgress: hideProgress,
    routeMetadata: routeMetadata,
    syncMetadata: syncMetadata,
    currentKey: function () { return currentKey; }
  };
  syncMetadata(location.pathname, location.search);
})();
