(function () {
  "use strict";
  try {
    var route = new URLSearchParams(location.search);
    var hasFixture = Boolean(route.get("fixture") && route.get("view") !== "home");
    if (hasFixture) document.body.classList.add("matchday-detail-open");
    var league = location.pathname.replace(/^\/+|\/+$/g, "");
    var homeLeagues = ["super-lig", "premier-league", "la-liga", "bundesliga", "serie-a"];
    var isFootballRoot = !league || league === "index.html" || league === "all";
    document.body.classList.add("league-theme-all");
    if (isFootballRoot) {
      document.body.classList.add("football-root-route");
      document.body.dataset.footballLeague = "all";
      document.body.dataset.footballThemeReady = "1";
    }
    if (!hasFixture && homeLeagues.indexOf(league) >= 0) {
      document.body.classList.add("football-league-overview-mode");
      document.body.dataset.footballLeagueLoading = league;
    }

    function requestJSON(path) {
      return fetch(path, { headers:{ Accept:"application/json" }, cache:"no-store" })
        .then(function (response) { return response.json().catch(function () { return null; }).then(function (payload) { return response.ok ? payload : null; }); })
        .catch(function () { return null; });
    }
    if (!hasFixture && isFootballRoot && typeof fetch === "function") {
      try {
        var cachedRecord = JSON.parse(localStorage.getItem("xyzskor:football-home:v3") || "null");
        window.__XYZ_EARLY_HOME_CACHE__ = cachedRecord && cachedRecord.payload ? cachedRecord.payload : null;
      } catch (_) { window.__XYZ_EARLY_HOME_CACHE__ = null; }
      window.__XYZ_FOOTBALL_HOME_REQUEST__ = requestJSON("/api/football/home");
    } else if (!hasFixture && homeLeagues.indexOf(league) >= 0 && typeof fetch === "function") {
      window.__XYZ_FOOTBALL_SEASON_REQUEST__ = { league:league, promise:requestJSON("/api/football/season?league=" + encodeURIComponent(league)) };
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
