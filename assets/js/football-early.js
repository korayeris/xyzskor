(function () {
  "use strict";
  var leagues = ["super-lig", "premier-league", "la-liga", "bundesliga", "serie-a"];
  function node(tag, className, text) {
    var item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined && text !== null) item.textContent = String(text);
    return item;
  }
  function label(key) {
    return ({"super-lig":"Süper Lig", "premier-league":"Premier League", "la-liga":"La Liga", bundesliga:"Bundesliga", "serie-a":"Serie A"})[key] || key;
  }
  function state(match, suppliedResult) {
    var status = String(match && match.status || "").toLocaleLowerCase("tr-TR");
    var result = suppliedResult || (match && match.result);
    if (/canlı|canli|live|inplay|in_play|devre|half[ -]?time/.test(status)) return { key:"live", label:match.minute ? String(match.minute) + "' CANLI" : "CANLI", score:result ? result.home + " - " + result.away : "—" };
    if (result || /bitti|finished|\bft\b|aet|pen/.test(status)) return { key:"finished", label:"MS", score:result ? result.home + " - " + result.away : "—" };
    if (/iptal|cancel|ertelen|postpon|suspend|delay/.test(status)) return { key:"unavailable", label:/ertelen|postpon/.test(status) ? "ERTELENDİ" : "İPTAL", score:"—" };
    var kickoff = Date.parse(match && match.kickoff || "");
    if (!Number.isFinite(kickoff) || kickoff < Date.now()) return { key:"unavailable", label:"DURUM BEKLENİYOR", score:"—" };
    return { key:"upcoming", label:new Intl.DateTimeFormat("tr-TR", { timeZone:"Europe/Istanbul", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }).format(new Date(kickoff)), score:"—" };
  }
  function routeLeague() {
    var key = location.pathname.replace(/^\/+|\/+$/g, "");
    return leagues.indexOf(key) >= 0 ? key : null;
  }
  function country(key) {
    return ({"super-lig":"Türkiye", "premier-league":"İngiltere", "la-liga":"İspanya", bundesliga:"Almanya", "serie-a":"İtalya"})[key] || "Avrupa";
  }
  function resultFor(payload, match) {
    if (match && match.result && Number.isFinite(Number(match.result.home)) && Number.isFinite(Number(match.result.away))) {
      return { home:Number(match.result.home), away:Number(match.result.away) };
    }
    var id = String(match && (match.id || match.match_id) || "");
    var row = (payload && Array.isArray(payload.results) ? payload.results : []).find(function (item) {
      return String(item && (item.match_id || item.id) || "") === id;
    });
    return row && Number.isFinite(Number(row.home)) && Number.isFinite(Number(row.away))
      ? { home:Number(row.home), away:Number(row.away) }
      : null;
  }
  function itemInLeague(item, leagueKey, leagueId) {
    if (!item) return false;
    var itemLeague = item.league_key || item.league_slug;
    if (itemLeague && itemLeague !== leagueKey) return false;
    var itemLeagueId = item.provider_league_id || item.league_id;
    return !leagueId || !itemLeagueId || String(itemLeagueId) === String(leagueId);
  }
  function validSeasonPayload(payload, leagueKey) {
    return Boolean(
      leagueKey
      && payload
      && payload.league === leagueKey
      && Array.isArray(payload.matches)
      && Array.isArray(payload.standings)
    );
  }
  function seasonText(payload, rows, matches) {
    var explicit = [payload && payload.seasonName, payload && payload.season_name]
      .concat(rows || [], matches || [])
      .map(function (item) { return typeof item === "string" ? item : item && (item.season_name || item.season_label || item.season); })
      .find(function (value) { return /\d{4}\s*[\/-]\s*(?:\d{2}|\d{4})/.test(String(value || "")); });
    if (explicit) return String(explicit).replace(/\s+/g, " ").trim();
    var now = new Date(), start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return start + "/" + String(start + 1).slice(-2);
  }
  function bindEarlyLeagueButton(button, leagueKey) {
    button.dataset.leagueSwitch = leagueKey;
    button.onclick = function () {
      if (typeof window.selectFootballLeague === "function") window.selectFootballLeague(leagueKey);
      else location.assign(leagueKey === "all" ? "/" : "/" + leagueKey);
    };
  }
  function bindEarlySectionButton(button, section) {
    button.dataset.footballSection = section;
    button.onclick = function () {
      if (typeof window.openFootballSection === "function") window.openFootballSection(section);
    };
  }
  var homeRenderSequence = 0;
  function render(payload) {
    if (!payload || payload.league !== "all" || !Array.isArray(payload.matches)) return;
    var root = document.getElementById("footballScoreboardHome");
    if (!root) return;
    var sequence = ++homeRenderSequence;
    var shell = root.querySelector(".scoreboard-shell");
    if (!shell) {
      shell = node("div", "scoreboard-shell");
      root.replaceChildren(shell);
    }
    shell.classList.remove("scoreboard-first-paint");
    shell.classList.add("scoreboard-early-ready");
    var rail = shell.querySelector(".scoreboard-leagues") || node("aside", "scoreboard-leagues");
    function renderRail() {
      rail.replaceChildren(node("div", "scoreboard-kicker", "FUTBOL"), node("h1", "", "Ligler"), node("p", "", "Bir lig seç ve tüm ayrıntılara geç."));
      var nav = node("nav");
      leagues.forEach(function (key) {
        var button = node("button", "scoreboard-early-league-link");
        button.type = "button";
        button.setAttribute("aria-label", label(key) + " lig merkezini aç");
        button.append(node("span", "", label(key)), node("b", "", "→"));
        bindEarlyLeagueButton(button, key);
        nav.append(button);
      });
      rail.append(nav);
    }

    var main = shell.querySelector(".scoreboard-fixtures") || node("main", "scoreboard-fixtures");
    function renderHeader() {
      var header = node("header");
      var title = node("div", "", "Bugün ve yaklaşan maçlar");
      title.prepend(node("span", "scoreboard-live-dot"));
      header.append(title, node("span", "", new Date().toLocaleDateString("tr-TR", { weekday:"long", day:"numeric", month:"long" })));
      var filters = node("div", "scoreboard-filters");
      [["all","Tümü"],["live","Canlı"],["finished","Biten"],["upcoming","Yaklaşan"]].forEach(function (entry, index) {
        var button = node("button", index ? "" : "active", entry[1]);
        button.type = "button";
        button.dataset.scoreboardFilter = entry[0];
        button.setAttribute("aria-pressed", index ? "false" : "true");
        button.addEventListener("click", function () {
          filters.querySelectorAll("button").forEach(function (item) { var active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
          main.querySelectorAll(".scoreboard-match-row").forEach(function (row) { row.hidden = entry[0] !== "all" && !row.classList.contains(entry[0]); });
          main.querySelectorAll(".scoreboard-league-group").forEach(function (group) { group.hidden = !Array.from(group.querySelectorAll(".scoreboard-match-row")).some(function (row) { return !row.hidden; }); });
        });
        filters.append(button);
      });
      main.replaceChildren(header, filters);
    }
    function leagueGroup(key) {
      var group = node("section", "scoreboard-league-group");
      var heading = node("div", "scoreboard-league-head");
      heading.append(node("h2", "", label(key)));
      var all = node("button", "scoreboard-early-action", "Tümünü gör →");
      all.type = "button";
      bindEarlyLeagueButton(all, key);
      heading.append(all);
      group.append(heading);
      var matches = payload.matches.filter(function (match) { return match && match.league_key === key; });
      if (!matches.length) group.append(node("p", "scoreboard-empty", payload.availability && payload.availability[key] === false ? "Lig verisi şu anda alınamadı." : "Program henüz açıklanmadı."));
      matches.forEach(function (match) {
        var matchState = state(match);
        var row = node("article", "scoreboard-match-row " + matchState.key);
        row.dataset.homeFixture = String(match.id || "");
        var center = node("a", "scoreboard-match-main");
        center.href = "/?fixture=" + encodeURIComponent(String(match.id || ""));
        center.append(node("span", "scoreboard-time", matchState.label), node("span", "scoreboard-team home", match.ev || "Ev sahibi"), node("strong", "scoreboard-score", matchState.score), node("span", "scoreboard-team away", match.konuk || "Deplasman"));
        var action;
        if (matchState.key === "upcoming") {
          action = node("div", "scoreboard-predict");
          action.setAttribute("aria-label", (match.ev || "Ev sahibi") + " " + (match.konuk || "Deplasman") + " maç sonucu tahmini");
          [["1",match.ev || "Ev sahibi"],["X","Beraberlik"],["2",match.konuk || "Deplasman"]].forEach(function (pick) {
            var choice = node("a", "scoreboard-pick-choice" + (pick[0] === "X" ? " is-draw" : ""));
            choice.href = "/?fixture=" + encodeURIComponent(String(match.id || "")) + "&pick=" + pick[0];
            choice.dataset.scoreboardPick = pick[0];
            choice.append(node("i", "", pick[0]), node("span", "", pick[1]));
            action.append(choice);
          });
        } else {
          action = node("a", "scoreboard-predict is-detail", "Detay");
          action.href = "/?fixture=" + encodeURIComponent(String(match.id || ""));
        }
        row.append(center, action);
        group.append(row);
      });
      return group;
    }

    var feature = shell.querySelector(".scoreboard-feature") || node("aside", "scoreboard-feature");
    function populateFeature() {
      feature.replaceChildren();
      var featured = payload.matches.find(function (match) { return state(match).key === "live"; }) || payload.matches.find(function (match) { return state(match).key === "upcoming"; }) || payload.matches[0];
      feature.append(node("div", "scoreboard-kicker", featured ? "ÖNE ÇIKAN MAÇ" : "FUTBOL"), node("h2", "", featured ? (featured.ev || "") + "\n" + (featured.konuk || "") : "Program hazırlanıyor"));
      if (featured) {
        var featuredState = state(featured);
        feature.append(node("div", "scoreboard-feature-score", featuredState.score === "—" ? featuredState.label : featuredState.score));
        var open = node("a", "scoreboard-open", featuredState.key === "live" ? "Canlı maç merkezine git →" : "Maç merkezi ve Predict →");
        open.href = "/?fixture=" + encodeURIComponent(String(featured.id || ""));
        feature.append(open);
      }
    }
    if (rail.parentNode !== shell) shell.prepend(rail);
    if (main.parentNode !== shell) shell.insertBefore(main, feature.parentNode === shell ? feature : null);
    if (feature.parentNode !== shell) shell.append(feature);
    delete root.dataset.earlyHydrated;
    root.dataset.earlyRendering = "true";
    function stillCurrent() {
      return sequence === homeRenderSequence
        && root.isConnected
        && root.querySelector(".scoreboard-shell") === shell;
    }
    var nextLeague = 0;
    function appendLeagueBatch() {
      if (!stillCurrent()) return;
      main.append(leagueGroup(leagues[nextLeague]));
      nextLeague = nextLeague + 1;
      if (nextLeague < leagues.length) setTimeout(appendLeagueBatch, 0);
      else setTimeout(function () {
        if (!stillCurrent()) return;
        populateFeature();
        root.dataset.earlyHydrated = "true";
        delete root.dataset.earlyRendering;
        window.__XYZ_EARLY_HOME_RENDERED__ = true;
        if (typeof window.dispatchEvent === "function" && typeof window.Event === "function") {
          window.dispatchEvent(new window.Event("xyz:football-home-early-ready"));
        }
      }, 0);
    }
    function renderRailStage() {
      if (!stillCurrent()) return;
      renderRail();
      setTimeout(appendLeagueBatch, 0);
    }
    function renderHeaderStage() {
      if (!stillCurrent()) return;
      renderHeader();
      setTimeout(renderRailStage, 0);
    }
    setTimeout(renderHeaderStage, 0);
  }
  function panelHeader(kicker, title, actionLabel, section) {
    var header = node("header");
    var copy = node("div");
    copy.append(node("small", "", kicker), node("h2", "", title));
    var action = node("button", "", actionLabel);
    action.type = "button";
    bindEarlySectionButton(action, section);
    header.append(copy, action);
    return header;
  }
  function earlyTable(row, leagueKey, seasonLabel) {
    if (!row) {
      var empty = node("p", "scoreboard-empty", "Puan durumu sağlayıcıdan bekleniyor.");
      var emptySource = node("footer", "league-overview-source");
      emptySource.append(node("span", "", seasonLabel + " sezonu"), node("b", "", "Sportmonks lig tablosu"));
      return [empty, emptySource];
    }
    var scroll = node("div", "league-overview-table-scroll");
    var table = node("table", "league-overview-table");
    var caption = node("caption", "", label(leagueKey) + " puan durumu");
    var thead = node("thead"), headRow = node("tr");
    ["#", "Takım", "O", "G", "B", "M", "AG-YG", "AV", "P", "Form"].forEach(function (value) {
      var cell = node("th", "", value);
      cell.scope = "col";
      headRow.append(cell);
    });
    thead.append(headRow);
    var tbody = node("tbody");
    var bodyRow = node("tr");
    bodyRow.dataset.leagueOverviewTeam = String(row.team || "");
    bodyRow.append(node("td", "rank", "1"));
    var team = node("th", "team");
    team.scope = "row";
    team.append(node("strong", "", row.team || "Takım"));
    bodyRow.append(team);
    [row.played, row.won, row.drawn, row.lost, String(row.goals_for ?? 0) + "-" + String(row.goals_against ?? 0)].forEach(function (value) {
      bodyRow.append(node("td", "", value ?? 0));
    });
    var difference = Number(row.goal_difference || 0);
    bodyRow.append(node("td", "", (difference > 0 ? "+" : "") + difference));
    bodyRow.append(node("td", "points", row.points ?? 0));
    bodyRow.append(node("td", "", String(row.form || "—").slice(-5)));
    tbody.append(bodyRow);
    table.append(caption, thead, tbody);
    scroll.append(table);
    var source = node("footer", "league-overview-source");
    source.append(node("span", "", seasonLabel + " sezonu"), node("b", "", "Sportmonks doğrulanmış lig tablosu"));
    return [scroll, source];
  }
  function earlyFixture(payload, match) {
    var body = node("div", "league-overview-fixtures-body");
    if (!match) {
      body.append(node("p", "scoreboard-empty", "Maç programı sağlayıcıdan bekleniyor."));
      return body;
    }
    var result = resultFor(payload, match);
    var matchState = state(match, result);
    var group = node("div", "league-overview-fixture-group");
    var groupLabel = matchState.key === "live" ? "Canlı" : matchState.key === "upcoming" ? "Yaklaşan" : "Son sonuçlar";
    group.append(node("h3", "", groupLabel));
    var button = node("button", "league-overview-fixture" + (matchState.key === "live" ? " is-live" : "") + (matchState.key === "unavailable" ? " is-unavailable" : ""));
    button.type = "button";
    button.dataset.leagueOverviewMatch = String(match.id || match.match_id || "");
    button.setAttribute("aria-label", String(match.ev || "Ev sahibi") + " " + String(match.konuk || "Deplasman") + " maç merkezini aç");
    button.onclick = function () {
      var id = button.dataset.leagueOverviewMatch;
      if (typeof window.openMatchCenter === "function") window.openMatchCenter(id);
      else location.assign("/?fixture=" + encodeURIComponent(id));
    };
    var home = node("span", "home"), away = node("span", "away");
    home.append(node("b", "", match.ev || "Ev sahibi"));
    away.append(node("b", "", match.konuk || "Deplasman"));
    button.append(node("span", "state", matchState.label), home, node("strong", "", result ? result.home + "–" + result.away : "—"), away);
    group.append(button);
    body.append(group);
    return body;
  }
  function renderLeague(payload, leagueKey) {
    if (!validSeasonPayload(payload, leagueKey) || routeLeague() !== leagueKey) return;
    var leagueId = payload.leagueId || payload.league_id || null;
    var rows = payload.standings.filter(function (row) { return itemInLeague(row, leagueKey, leagueId); });
    var matches = payload.matches.filter(function (match) { return itemInLeague(match, leagueKey, leagueId); });
    var root = document.getElementById("footballLeagueOverview");
    if (!root || root.dataset.earlyLeagueHydrated === leagueKey) return;
    var seasonLabel = seasonText(payload, rows, matches);
    var initialMatch = matches.find(function (match) { return state(match, resultFor(payload, match)).key === "live"; })
      || matches.find(function (match) { return state(match, resultFor(payload, match)).key === "upcoming"; })
      || matches.find(function (match) { return state(match, resultFor(payload, match)).key === "finished"; })
      || matches[0];

    document.body.classList.remove("football-aggregate-home", "football-root-route");
    document.body.classList.add("football-league-overview-mode");
    root.hidden = false;
    var scoreboard = document.getElementById("footballScoreboardHome");
    if (scoreboard) scoreboard.hidden = true;

    var hero = node("header", "league-overview-hero");
    var identity = node("div", "league-overview-identity");
    var logo = node("span", "league-overview-logo", "⚽");
    var identityCopy = node("div");
    identityCopy.append(node("small", "", "XYZSKOR · LİG MERKEZİ"), node("h1", "", label(leagueKey)), node("p", "", country(leagueKey) + " · " + seasonLabel + " sezonu"));
    identity.append(logo, identityCopy);
    var leagueSwitch = node("div", "league-overview-switch");
    leagueSwitch.setAttribute("aria-label", "Lig değiştir");
    leagues.forEach(function (key) {
      var button = node("button", key === leagueKey ? "active" : "", label(key));
      button.type = "button";
      if (key === leagueKey) button.setAttribute("aria-current", "page");
      bindEarlyLeagueButton(button, key);
      leagueSwitch.append(button);
    });
    var allLeagues = node("button", "", "Tüm ligler");
    allLeagues.type = "button";
    bindEarlyLeagueButton(allLeagues, "all");
    leagueSwitch.append(allLeagues);
    hero.append(identity, leagueSwitch);

    var tabs = node("nav", "league-overview-tabs");
    tabs.setAttribute("aria-label", label(leagueKey) + " bölümleri");
    [["home","Genel bakış"], ["standings","Puan durumu"], ["matches","Maçlar"], ["clubs","Takımlar"], ["transfers","Transferler"], ["news","Haberler"]].forEach(function (entry, index) {
      var button = node("button", index === 0 ? "active" : "", entry[1]);
      button.type = "button";
      if (index === 0) button.setAttribute("aria-current", "page");
      else bindEarlySectionButton(button, entry[0]);
      tabs.append(button);
    });

    root.replaceChildren(hero);
    root.dataset.earlyLeagueHydrated = leagueKey;
    var stillEarly = function () {
      return root.isConnected
        && routeLeague() === leagueKey
        && root.dataset.earlyLeagueHydrated === leagueKey
        && root.dataset.fullLeagueHydrated !== leagueKey;
    };
    setTimeout(function () {
      if (!stillEarly()) return;
      root.append(tabs);
      setTimeout(function () {
        if (!stillEarly()) return;
      var layout = node("div", "league-overview-layout");
      var tablePanel = node("section", "league-overview-panel league-table-panel");
      tablePanel.append(panelHeader("GÜNCEL SEZON", "Puan durumu", "Tam tablo →", "standings"));
      var fixturesPanel = node("aside", "league-overview-panel league-fixtures-panel");
      fixturesPanel.append(panelHeader("MAÇ AKIŞI", "Sonuçlar ve fikstür", "Tüm maçlar →", "matches"));
      layout.append(tablePanel, fixturesPanel);
      root.append(layout, node("section", "league-overview-metrics"), node("div", "league-overview-lower"));
      setTimeout(function () {
        if (!stillEarly()) return;
        earlyTable(rows[0], leagueKey, seasonLabel).forEach(function (part) { tablePanel.append(part); });
        setTimeout(function () {
          if (!stillEarly()) return;
          fixturesPanel.append(earlyFixture(payload, initialMatch));
          window.__XYZ_EARLY_LEAGUE_RENDERED__ = { league:leagueKey, renderedAt:Date.now() };
        }, 0);
      }, 0);
      }, 0);
    }, 0);
  }
  function readyHome(payload) {
    var stillHome = function () {
      var path = location.pathname.replace(/^\/+|\/+$/g, "");
      var route = new URLSearchParams(location.search);
      return (!path || path === "index.html" || path === "all") && !route.get("fixture") && !document.hidden;
    };
    var paint = function () {
      if (!stillHome()) return;
      if (document.getElementById("footballScoreboardHome")) render(payload);
      else document.addEventListener("DOMContentLoaded", function () { if(stillHome()) render(payload); }, { once:true });
    };
    var styleReady = window.__XYZ_FOOTBALL_HUB_READY__;
    if (styleReady && typeof styleReady.then === "function") styleReady.then(function () { setTimeout(paint, 0); });
    else setTimeout(paint, 0);
  }
  function readyLeague(payload, leagueKey) {
    var paint = function () {
      if (routeLeague() !== leagueKey || !validSeasonPayload(payload, leagueKey)) return;
      if (document.getElementById("footballLeagueOverview")) renderLeague(payload, leagueKey);
      else document.addEventListener("DOMContentLoaded", function () { renderLeague(payload, leagueKey); }, { once:true });
    };
    var styleReady = window.__XYZ_FOOTBALL_HUB_READY__;
    if (styleReady && typeof styleReady.then === "function") styleReady.then(function () { setTimeout(paint, 0); });
    else setTimeout(paint, 0);
  }
  if (window.__XYZ_EARLY_HOME_CACHE__) readyHome(window.__XYZ_EARLY_HOME_CACHE__);
  if (window.__XYZ_FOOTBALL_HOME_REQUEST__) window.__XYZ_FOOTBALL_HOME_REQUEST__.then(readyHome);
  var earlySeason = window.__XYZ_FOOTBALL_SEASON_REQUEST__;
  var initialLeague = routeLeague();
  if (initialLeague && earlySeason && earlySeason.league === initialLeague && earlySeason.promise) {
    earlySeason.promise.then(function (payload) {
      if (earlySeason.league === initialLeague && payload && payload.league === initialLeague) readyLeague(payload, initialLeague);
    });
  }
})();
