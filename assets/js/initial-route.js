(function () {
  "use strict";
  try {
    var route = new URLSearchParams(location.search);
    if (route.get("fixture") && route.get("view") !== "home") document.body.classList.add("matchday-detail-open");
    var league = location.pathname.replace(/^\/+|\/+$/g, "");
    if (["super-lig", "premier-league", "la-liga", "champions-league", "europa-league"].indexOf(league) >= 0) document.body.dataset.footballLeagueLoading = league;
    var parts = location.pathname.split("/").filter(Boolean);
    var leagueNames = {"super-lig":"Süper Lig","premier-league":"Premier League","la-liga":"La Liga","champions-league":"Şampiyonlar Ligi","europa-league":"Avrupa Ligi"};
    var productNames = {predict:"Predict",basketbol:"Basketbol",voleybol:"Voleybol",ufc:"UFC",motorsports:"Motor Sporları"};
    var sectionNames = {matches:"Maçlar",agenda:"Gündem",clubs:"Kulüpler",transfers:"Transferler",standings:"Puan Durumu"};
    var titleParts = [];
    if (leagueNames[parts[0]]) titleParts.push(leagueNames[parts[0]], sectionNames[parts[1]] || "Futbol");
    else if (productNames[parts[0]]) titleParts.push(productNames[parts[0]]);
    else titleParts.push("Futbol");
    document.title = titleParts.join(" · ") + " — XYZSKOR";
  } catch (_) {}
})();
