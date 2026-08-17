(function () {
  "use strict";
  try {
    var route = new URLSearchParams(location.search);
    if (route.get("fixture") && route.get("view") !== "home") document.body.classList.add("matchday-detail-open");
    var league = location.pathname.replace(/^\/+|\/+$/g, "");
    if (["super-lig", "premier-league", "la-liga", "champions-league", "europa-league"].indexOf(league) >= 0) document.body.dataset.footballLeagueLoading = league;
  } catch (_) {}
})();
