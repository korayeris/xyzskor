// XYZSKOR genel çok sporlu ana sayfa.
//
// Sözleşme (EXTERNAL-REVIEW-HANDOFF-2026-08-25 P1.1):
//   - Bu modül HİÇBİR spor API'sinin sahibi değildir ve kendi başına fetch
//     yapmaz. İlk ekran tamamen statik branş kartlarıdır.
//   - Veri yalnız kullanıcı bir branş seçtiğinde, o branşın kendi modülü
//     tarafından lazy olarak istenir.
//   - Marka logosu buraya döner; futbol beş lig merkezi `/futbol` altındadır.
(function () {
  "use strict";

  var BRANCHES = [
    {
      key: "football",
      label: "Futbol",
      href: "/futbol/",
      kicker: "5 LİG",
      note: "Süper Lig, Premier League, La Liga, Bundesliga, Serie A",
      accent: "coral"
    },
    {
      key: "basketball",
      label: "Basketbol",
      href: "/basketbol/",
      kicker: "GÜNLÜK PROGRAM",
      note: "Ligler, maçlar ve takımlar",
      accent: "amber"
    },
    {
      key: "volleyball",
      label: "Voleybol",
      href: "/voleybol/",
      kicker: "GÜNLÜK PROGRAM",
      note: "Sultanlar Ligi, Efeler Ligi ve uluslararası kupalar",
      accent: "mint"
    },
    {
      key: "motorsports",
      label: "Motor Sporları",
      href: "/motorsports/",
      kicker: "SERİLER",
      note: "Formula 1, MotoGP, WRC, WEC ve daha fazlası",
      accent: "steel"
    },
    {
      key: "mma",
      label: "UFC",
      href: "/ufc/",
      kicker: "ETKİNLİKLER",
      note: "Kartlar, dövüşçüler ve sıralamalar",
      accent: "crimson"
    },
    {
      key: "predict",
      label: "Predict",
      href: "/predict/",
      kicker: "ÜCRETSİZ",
      note: "Maç tahmini yap, puan topla",
      accent: "violet"
    }
  ];

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function cardHTML(branch) {
    return '<a class="gh-card gh-accent-' + escapeHTML(branch.accent) + '"'
      + ' href="' + escapeHTML(branch.href) + '"'
      + ' data-branch-link="' + escapeHTML(branch.key) + '">'
      + '<span class="gh-card-kicker">' + escapeHTML(branch.kicker) + '</span>'
      + '<strong class="gh-card-title">' + escapeHTML(branch.label) + '</strong>'
      + '<span class="gh-card-note">' + escapeHTML(branch.note) + '</span>'
      + '<span class="gh-card-go" aria-hidden="true">→</span>'
      + '</a>';
  }

  function render(host) {
    host.innerHTML =
      '<header class="gh-hero">'
        + '<span class="gh-hero-kicker">XYZSKOR SPORTS INTELLIGENCE</span>'
        + '<h1>Bilinmeyen skoru verilerle çöz</h1>'
        + '<p>Bir branş seç; canlı veri yalnız açtığın branş için istenir.</p>'
      + '</header>'
      + '<nav class="gh-grid" aria-label="Spor branşları">'
        + BRANCHES.map(cardHTML).join("")
      + '</nav>'
      + '<p class="gh-scope-note">Canlı skor ve istatistik verileri yalnız görüntülediğin '
      + 'branş için sağlayıcıdan istenir; bu sayfa açılırken hiçbir spor API\'si çağrılmaz.</p>';
  }

  function mount() {
    var host = document.getElementById("generalHome");
    if (!host) return;
    if (!host.dataset.ghRendered) {
      render(host);
      host.dataset.ghRendered = "1";
    }
    host.hidden = false;
    document.body.classList.add("general-home-route", "general-home-open");
    if (window.XYZBranchRouter && typeof window.XYZBranchRouter.bindLinks === "function") {
      window.XYZBranchRouter.bindLinks(host);
      window.XYZBranchRouter.bindLinks(document);
    }
    bindHeaderTabs();
  }

  // Genel ana sayfada üst ürün sekmeleri futbol yüzeyini burada açmaz;
  // kendi rotalarına router üzerinden gider.
  function bindHeaderTabs() {
    var mapping = [["tabBtnFootball", "/futbol/", "Futbol"], ["tabBtnPredict", "/predict/", "Predict"]];
    for (var index = 0; index < mapping.length; index += 1) {
      (function (spec) {
        var button = document.getElementById(spec[0]);
        if (!button || button.dataset.ghBound === "1") return;
        button.dataset.ghBound = "1";
        button.addEventListener("click", function (event) {
          if (!document.body.classList.contains("general-home-route")) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (window.XYZBranchRouter) window.XYZBranchRouter.navigate(spec[1], { label: spec[2] });
        }, true);
      })(mapping[index]);
    }
    var footballTab = document.getElementById("tabBtnFootball");
    if (footballTab) footballTab.classList.remove("active");
  }

  function unmount() {
    var host = document.getElementById("generalHome");
    if (host) host.hidden = true;
    document.body.classList.remove("general-home-route", "general-home-open");
  }

  window.XYZGeneralHome = { mount: mount, unmount: unmount };

  function boot() {
    if (window.XYZBranchRouter && typeof window.XYZBranchRouter.register === "function") {
      window.XYZBranchRouter.register({
        key: "general-home",
        matches: function (pathname) {
          var path = String(pathname || "").replace(/^\/+|\/+$/g, "");
          return !path || path === "index.html";
        },
        mount: mount,
        unmount: unmount
      });
    }
    if (document.body.classList.contains("general-home-route")) mount();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
