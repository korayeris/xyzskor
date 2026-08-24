(function () {
    "use strict";
    try {
      var route = new URLSearchParams(location.search);
    var requestedFixture = Boolean(route.get("fixture"));
    var detailFixture = requestedFixture && route.get("view") !== "home";
    if (detailFixture) document.body.classList.add("matchday-detail-open");
    var league = location.pathname.replace(/^\/+|\/+$/g, "");
    var homeLeagues = ["super-lig", "premier-league", "la-liga", "bundesliga", "serie-a"];
    var isFootballRoot = !league || league === "index.html" || league === "all";
    document.body.classList.add("league-theme-all");
    if (isFootballRoot) {
      document.body.classList.add("football-root-route");
      document.body.dataset.footballLeague = "all";
      document.body.dataset.footballThemeReady = "1";
    }
    if (!requestedFixture && homeLeagues.indexOf(league) >= 0) {
      document.body.classList.add("football-league-overview-mode");
      document.body.dataset.footballLeagueLoading = league;
    }

    function requestJSON(path, controller) {
      return fetch(path, { headers:{ Accept:"application/json" }, cache:"no-store", signal:controller && controller.signal })
        .then(function (response) { return response.json().catch(function () { return null; }).then(function (payload) { return response.ok ? payload : null; }); })
        .catch(function () { return null; });
    }
    if (!requestedFixture && isFootballRoot && typeof fetch === "function") {
      var homeFresh = false;
      try {
        var cachedRecord = JSON.parse(localStorage.getItem("xyzskor:football-home:v3") || "null");
        window.__XYZ_EARLY_HOME_CACHE__ = cachedRecord && cachedRecord.payload ? cachedRecord.payload : null;
        homeFresh = Boolean(cachedRecord && cachedRecord.savedAt && Date.now() - cachedRecord.savedAt < 10 * 60 * 1000 && cachedRecord.payload);
      } catch (_) { window.__XYZ_EARLY_HOME_CACHE__ = null; }
      var homeController = !homeFresh && typeof AbortController !== "undefined" ? new AbortController() : null;
      window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__ = homeController;
      window.__XYZ_FOOTBALL_HOME_REQUEST__ = homeFresh ? Promise.resolve(window.__XYZ_EARLY_HOME_CACHE__) : requestJSON("/api/football/home", homeController);
    } else if (!requestedFixture && homeLeagues.indexOf(league) >= 0 && typeof fetch === "function") {
      var seasonRecord = null;
      try {
        seasonRecord = typeof sessionStorage !== "undefined" ? JSON.parse(sessionStorage.getItem("xyzskor:provider-season:" + league) || "null") : null;
      } catch (_) { seasonRecord = null; }
      var seasonFresh = Boolean(seasonRecord && seasonRecord.savedAt && Date.now() - seasonRecord.savedAt < 10 * 60 * 1000 && seasonRecord.payload && seasonRecord.payload.league === league && Array.isArray(seasonRecord.payload.matches));
      var seasonController = !seasonFresh && typeof AbortController !== "undefined" ? new AbortController() : null;
      window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__ = seasonController;
      window.__XYZ_FOOTBALL_SEASON_REQUEST__ = {
        league:league,
        fromCache:seasonFresh,
        promise:seasonFresh ? Promise.resolve(seasonRecord.payload) : requestJSON("/api/football/season?league=" + encodeURIComponent(league), seasonController)
      };
    }

    var parts = location.pathname.split("/").filter(Boolean);
    var leagueNames = {"super-lig":"Süper Lig","premier-league":"Premier League","la-liga":"La Liga","bundesliga":"Bundesliga","serie-a":"Serie A"};
    var productNames = {predict:"Predict",basketbol:"Basketbol",voleybol:"Voleybol",ufc:"UFC",motorsports:"Motor Sporları"};
    var sectionNames = {matches:"Maçlar",agenda:"Gündem",clubs:"Kulüpler",transfers:"Transferler",standings:"Puan Durumu"};
    var titleParts = [];
    if (leagueNames[parts[0]]) titleParts.push(leagueNames[parts[0]], sectionNames[parts[1]] || "Futbol");
    else if (productNames[parts[0]]) titleParts.push(productNames[parts[0]]);
    else titleParts.push("Futbol");
    document.title = titleParts.join(" · ") + " — XYZSKOR";
  } catch (_) {}
})();
