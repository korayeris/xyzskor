(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  const requestedFixture = params.get("fixture");
  let fixtureId = String(requestedFixture || "").replace(/^sportmonks:/, "");
  let kickoff = NaN;
  const root = document.getElementById("matchdayLiveRoot");
  const sync = document.getElementById("matchdaySync");
  const command = document.getElementById("matchdayCommand");
  if (!root) return;
  let timer = 0;
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const rows = (value) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
  const localTime = (value) => value ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(new Date(value)) : "Program bekleniyor";
  const finishedStatuses = new Set(["bitti", "ft", "aet", "pen", "finished", "after penalties", "after extra time"]);
  const isFinishedFixture = (fixture) => finishedStatuses.has(String(fixture?.status || "").toLocaleLowerCase("tr-TR"));
  const fixtureTimeLabel = (fixture) => fixtureKickoff(fixture) ? localTime(fixtureKickoff(fixture)) : isFinishedFixture(fixture) ? "Maç tamamlandı" : "Tarih bilgisi bekleniyor";
  const statisticLabels = {
    "corners":"Korner", "shots off target":"İsabetsiz şut", "shots on target":"İsabetli şut",
    "shots total":"Toplam şut", "attacks":"Atak", "dangerous attacks":"Tehlikeli atak",
    "ball possession %":"Topa sahip olma", "ball possession":"Topa sahip olma", "ball safe":"Başarılı pas",
    "shots insidebox":"Ceza sahası içinden şut", "shots inside box":"Ceza sahası içinden şut",
    "shots outsidebox":"Ceza sahası dışından şut", "shots outside box":"Ceza sahası dışından şut",
    "offsides":"Ofsayt", "fouls":"Faul", "yellowcards":"Sarı kart", "redcards":"Kırmızı kart",
    "saves":"Kurtarış", "passes":"Pas", "successful passes":"Başarılı pas"
  };
  const statisticLabel = (value) => statisticLabels[String(value || "").trim().toLocaleLowerCase("en-US")] || String(value || "İstatistik");
  const imageTag = (src, alt, className) => src ? `<img class="${className}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">` : "";
  function setDetailMode(active) {
    document.body.classList.toggle("matchday-detail-open", active);
    command.hidden = false;
    backButton.hidden = !active;
    if (!active) clearTimeout(timer);
  }
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "matchday-back";
  backButton.textContent = "Ana sayfaya dön";
  document.querySelector(".matchday-command__head")?.appendChild(backButton);
  backButton.addEventListener("click", () => {
    location.assign("/?view=home");
  });
  document.querySelectorAll(".brand-lockup,.brand-copy .logo").forEach((brand) => brand.addEventListener("click", (event) => {
    event.preventDefault();
    location.assign("/?view=home");
  }));
  function interval() { if (!Number.isFinite(kickoff)) return 300000; const delta = kickoff - Date.now(); return delta > 75 * 60000 ? 300000 : delta > 15 * 60000 ? 60000 : Date.now() < kickoff + 4 * 3600000 ? 10000 : 300000; }
  function fixtureKickoff(fixture) { return fixture?.kickoff_utc || fixture?.kickoff || fixture?.starting_at || ""; }
  function fixtureNames(fixture) { return { home:String(fixture?.home_name || fixture?.ev || fixture?.home?.name || ""), away:String(fixture?.away_name || fixture?.konuk || fixture?.away?.name || "") }; }
  function fixtureProviderId(fixture) { return String(fixture?.provider_fixture_id || fixture?.fixture_id || fixture?.provider_id || fixture?.id || "").replace(/^sportmonks:/, ""); }
  function isLiveFixture(fixture, now = Date.now()) {
    const status = String(fixture?.status || "").toLocaleLowerCase("tr-TR");
    const start = Date.parse(fixtureKickoff(fixture));
    return ["canlı", "devre_arasi", "live", "halftime"].includes(status) && (!Number.isFinite(start) || now < start + 4 * 3600000);
  }
  function selectFixture(fixtures, now = Date.now()) {
    const valid = rows(fixtures).filter((fixture) => /^\d+$/.test(fixtureProviderId(fixture)) && Number.isFinite(Date.parse(fixtureKickoff(fixture))));
    const live = valid.filter((fixture) => isLiveFixture(fixture, now)).sort((a, b) => Date.parse(fixtureKickoff(a)) - Date.parse(fixtureKickoff(b)));
    if (live.length) return live[0];
    const upcoming = valid.filter((fixture) => Date.parse(fixtureKickoff(fixture)) > now && !["iptal", "ertelendi"].includes(String(fixture.status || "").toLocaleLowerCase("tr-TR"))).sort((a, b) => Date.parse(fixtureKickoff(a)) - Date.parse(fixtureKickoff(b)));
    if (upcoming.length) return upcoming[0];
    return valid.filter((fixture) => Date.parse(fixtureKickoff(fixture)) <= now && (fixture.result || ["bitti", "ft", "aet", "pen"].includes(String(fixture.status || "").toLocaleLowerCase("tr-TR")))).sort((a, b) => Date.parse(fixtureKickoff(b)) - Date.parse(fixtureKickoff(a)))[0] || null;
  }
  function teamAbbreviation(name) {
    const words = String(name || "").trim().split(/\s+/u).filter(Boolean);
    if (!words.length) return "-";
    const initials = words.map((word) => Array.from(word)[0]).join("");
    return Array.from(initials.length > 1 ? initials : words[0]).slice(0, 3).join("").toLocaleUpperCase("tr-TR");
  }
  function stateLabel(fixture) { const minute = Number(fixture?.minute), status = String(fixture?.status || "").toLocaleLowerCase("tr-TR"); if (isLiveFixture(fixture)) return Number.isFinite(minute) && minute > 0 ? `${minute}' CANLI` : "CANLI"; if (["canlı", "devre_arasi", "live", "halftime"].includes(status)) return "DURUM GÜNCELLENİYOR"; return String(fixture?.status || "PROGRAMLANDI").toLocaleUpperCase("tr-TR"); }
  function eventTitle(event) { const id=Number(event?.type_id), type = String(event?.type || "").toLowerCase(); return [14,15,16].includes(id) || /goal/.test(type) ? "GOL" : id === 19 || /yellow/.test(type) ? "SARI KART" : id === 20 || /red/.test(type) ? "KIRMIZI KART" : id === 18 || /substitution/.test(type) ? "OYUNCU DEĞİŞİKLİĞİ" : String(event?.type || "MAÇ OLAYI").toLocaleUpperCase("tr-TR"); }
  function renderEvents(events, homeName) {
    if (!events.length) return '<div class="matchday-empty">Gol, asist, kart ve değişiklikler maç başladığında burada görünecek.</div>';
    return `<ol class="matchday-timeline">${events.map((event) => { const side=event.team && event.team === homeName ? "home" : "away"; return `<li class="is-${side}"><time>${esc(event.minute || "-")}'</time><div class="matchday-event-copy">${imageTag(event.player_image,event.player || "Oyuncu","matchday-event-player")}<p><b>${esc(event.player || eventTitle(event))}${event.result ? ` <mark>${esc(event.result)}</mark>` : ""}</b><span>${esc(eventTitle(event))}${event.relatedPlayer ? ` · ${esc(event.relatedPlayer)}` : ""}</span></p></div></li>`; }).join("")}</ol>`;
  }
  function renderStats(stats, homeName) {
    if (!stats.length) return '<div class="matchday-empty">Şut, topa sahip olma, korner ve oyuncu istatistikleri sağlayıcının kapsamına göre açılacak.</div>';
    const grouped = new Map();
    stats.forEach((stat) => { const label = statisticLabel(stat.label); if (!grouped.has(label)) grouped.set(label, {home:null,away:null}); const side=stat.location === "home" || stat.team === homeName ? "home" : "away"; grouped.get(label)[side]=stat.value; });
    return `<div class="matchday-stats">${Array.from(grouped.entries()).slice(0, 12).map(([label, values]) => `<div><span>${esc(values.home ?? "-")}</span><b>${esc(label)}</b><span>${esc(values.away ?? "-")}</span></div>`).join("")}</div>`;
  }
  function renderTeamLineup(title, members) {
    if (!members.length) return `<section class="matchday-lineup"><h4>${esc(title)}</h4><div class="matchday-empty">Resmî kadro henüz açıklanmadı.</div></section>`;
    const marked = members.filter((item) => item.type_id === 11 || /starter|lineup/i.test(String(item.type || ""))).slice(0, 11);
    const starters = marked.length ? marked : members.slice(0, 11);
    const substitutes = members.filter((item) => !starters.includes(item));
    const list = (items) => items.map((item) => `<li>${imageTag(item.player_image,item.player_name || "Oyuncu","matchday-player-photo")}<span>${esc(item.number || "-")}</span><b>${esc(item.player_name || item.player || "Oyuncu")}${item.is_captain ? " ©" : ""}</b><small>${esc(item.position || "")}</small></li>`).join("");
    const fallbackRows = [1,4,3,3];
    const positioned = starters.slice(0,11).map((item,index) => {
      let row = Number(item.formation_field);
      if (!Number.isFinite(row) || row < 1) {
        let cursor = 0;
        row = fallbackRows.findIndex((count) => { cursor += count; return index < cursor; }) + 1;
      }
      return { item, row, order:Number(item.formation_position) || index + 1 };
    });
    const pitchRows = Array.from(new Set(positioned.map((entry) => entry.row))).sort((a,b)=>b-a).map((row) => {
      const players = positioned.filter((entry) => entry.row === row).sort((a,b)=>a.order-b.order);
      return `<div class="matchday-pitch-row" style="--players:${players.length}">${players.map(({item}) => `<div class="matchday-pitch-player">${imageTag(item.player_image,item.player_name || "Oyuncu","matchday-pitch-photo") || `<i>${esc(teamAbbreviation(item.player_name || "?"))}</i>`}<b>${item.number ? `<span>${esc(item.number)}</span>` : ""}${esc(item.player_name || item.player || "Oyuncu")}${item.is_captain ? " ©" : ""}</b></div>`).join("")}</div>`;
    }).join("");
    return `<section class="matchday-lineup"><h4>${esc(title)}</h4><div class="matchday-pitch" role="img" aria-label="${esc(title)} ilk 11 saha dizilişi"><div class="matchday-pitch-box"></div><div class="matchday-pitch-circle"></div><div class="matchday-pitch-formation">${pitchRows}</div></div>${substitutes.length ? `<h5>Yedekler</h5><ul>${list(substitutes)}</ul>` : ""}</section>`;
  }
  function renderInsights(xg, predictions, homeName, awayName) {
    const homeXg=xg.find((row)=>row.location === "home")?.value, awayXg=xg.find((row)=>row.location === "away")?.value;
    const result=predictions.find((row)=>Number(row.type_id) === 237)?.predictions;
    const btts=predictions.find((row)=>Number(row.type_id) === 231)?.predictions;
    const over=predictions.find((row)=>Number(row.type_id) === 235)?.predictions;
    if(homeXg == null && awayXg == null && !result && !btts && !over) return "";
    const probability=(label,value)=>value == null ? "" : `<div><span>${esc(label)}</span><b>${Number(value).toLocaleString("tr-TR",{maximumFractionDigits:1})}%</b><i style="--prob:${Math.max(0,Math.min(100,Number(value)))}%"></i></div>`;
    return `<section class="matchday-insights"><header><span>MAÇ VERİSİ</span><h3>xG ve olasılıklar</h3></header>${homeXg != null || awayXg != null ? `<div class="matchday-xg"><span>${esc(homeName)} <b>${Number(homeXg || 0).toFixed(2)}</b></span><em>BEKLENEN GOL</em><span><b>${Number(awayXg || 0).toFixed(2)}</b> ${esc(awayName)}</span></div>` : ""}<div class="matchday-probabilities">${probability("Ev",result?.home)}${probability("Beraberlik",result?.draw)}${probability("Deplasman",result?.away)}${probability("Karşılıklı gol",btts?.yes)}${probability("2,5 üst",over?.yes)}</div></section>`;
  }
  function render(payload) {
    const f = payload.fixture || {}, d = payload.details || {}, events = rows(d.events), stats = rows(d.statistics), lineups = rows(d.lineups), formations = rows(d.formations), xg=rows(d.xg), predictions=rows(d.predictions);
    const names = fixtureNames(f), homeName = names.home || "-", awayName = names.away || "-";
    const parsedKickoff = Date.parse(fixtureKickoff(f));
    if (Number.isFinite(parsedKickoff)) kickoff = parsedKickoff;
    const title = document.getElementById("matchdayTitle");
    const intro = title?.nextElementSibling;
    if (title) title.textContent = `${homeName} - ${awayName}`;
    if (intro) intro.textContent = `${fixtureTimeLabel(f)} · Sportmonks tarafından doğrulanan maç verisi`;
    const homeLineup = lineups.filter((item) => String(item.team || "").toLowerCase().includes(homeName.toLowerCase().split(" ")[0]));
    const awayLineup = lineups.filter((item) => !homeLineup.includes(item));
    const homeScore = f.score?.home, awayScore = f.score?.away, hasScore = homeScore != null && awayScore != null;
    sync.textContent = `${payload.degraded ? "Kısıtlı kapsam" : "Sportmonks canlı veri"} · ${new Date(payload.updatedAt || Date.now()).toLocaleTimeString("tr-TR")}`;
    root.innerHTML = `<div class="matchday-scoreboard"><div class="matchday-team">${imageTag(f.home_logo,homeName,"matchday-team-logo") || `<span>${esc(teamAbbreviation(homeName))}</span>`}<strong>${esc(homeName)}</strong><small>${esc(formations[0]?.formation || "Diziliş bekleniyor")}</small></div><div class="matchday-score"><em>${esc(stateLabel(f))}</em><b>${hasScore ? `${esc(homeScore)} - ${esc(awayScore)}` : "- : -"}</b><small>${esc(fixtureTimeLabel(f))}</small></div><div class="matchday-team matchday-team--away">${imageTag(f.away_logo,awayName,"matchday-team-logo") || `<span>${esc(teamAbbreviation(awayName))}</span>`}<strong>${esc(awayName)}</strong><small>${esc(formations[1]?.formation || "Diziliş bekleniyor")}</small></div></div>${renderInsights(xg,predictions,homeName,awayName)}<nav class="matchday-jump" aria-label="Maç ayrıntıları"><a href="#matchdayEvents">Olaylar <b>${events.length}</b></a><a href="#matchdayStatistics">İstatistikler <b>${stats.length}</b></a><a href="#matchdayLineups">Kadrolar <b>${lineups.length}</b></a></nav><div class="matchday-grid"><section class="matchday-card" id="matchdayEvents"><header><span>OLAY AKIŞI</span><h3>Gol, kart ve değişiklikler</h3></header>${renderEvents(events,homeName)}</section><section class="matchday-card" id="matchdayStatistics"><header><span>MAÇ İSTATİSTİKLERİ</span><h3>Sahanın sayıları</h3></header>${renderStats(stats,homeName)}</section></div><section class="matchday-card matchday-card--lineups" id="matchdayLineups"><header><span>RESMÎ KADROLAR</span><h3>İlk 11, yedekler ve diziliş</h3></header><div class="matchday-lineups">${renderTeamLineup(homeName, homeLineup)}${renderTeamLineup(awayName, awayLineup)}</div></section>`;
    if (requestedFixture && params.get("view") !== "home") setDetailMode(true);
  }
  function renderEmpty() {
    const title = document.getElementById("matchdayTitle"), intro = title?.nextElementSibling;
    if (title) title.textContent = "Program bekleniyor";
    if (intro) intro.textContent = "Sağlayıcı henüz uygun bir maç yayınlamadı";
    sync.textContent = "Fikstür bekleniyor";
    root.innerHTML = '<div class="matchday-loading"><b>Program bekleniyor.</b><span>Yeni fikstür yayınlandığında maç merkezi otomatik güncellenecek.</span></div>';
  }
  async function refresh() {
    clearTimeout(timer);
    try { const response = await fetch(`/api/football/matchday?fixture=${encodeURIComponent(fixtureId)}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.message || payload.error || "Veri alınamadı"); render(payload); }
    catch (error) { sync.textContent = "Canlı bağlantı yeniden deneniyor"; root.innerHTML = `<div class="matchday-loading matchday-loading--error"><b>Maç merkezi geçici olarak beklemede.</b><span>${esc(error.message)}</span></div>`; }
    timer = setTimeout(refresh, interval());
  }
  async function resolveFixture() {
    try {
      const response = await fetch("/api/football/season?league=super-lig", { cache:"no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.detail || payload.error || "Fikstür alınamadı");
      const selected = selectFixture(payload.matches);
      if (!selected) { renderEmpty(); timer = setTimeout(resolveFixture, 300000); return; }
      fixtureId = fixtureProviderId(selected);
      kickoff = Date.parse(fixtureKickoff(selected));
      await refresh();
    } catch (error) {
      sync.textContent = "Canlı bağlantı yeniden deneniyor";
      root.innerHTML = `<div class="matchday-loading matchday-loading--error"><b>Maç merkezi geçici olarak beklemede.</b><span>${esc(error.message)}</span></div>`;
      timer = setTimeout(resolveFixture, 300000);
    }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (fixtureId) refresh(); else resolveFixture(); } });
  function fixtureFromElement(element) {
    if (!element) return "";
    const values = [element.dataset?.fixtureId, element.dataset?.fixture, element.dataset?.matchId, element.dataset?.providerId, element.getAttribute?.("href")];
    for (const value of values) {
      const match = String(value || "").match(/(?:fixture=|sportmonks:)?(\d{5,})/);
      if (match) return match[1];
    }
    const markupMatch = String(element.outerHTML || "").slice(0, 1600).match(/(?:fixture|match|sportmonks)[^0-9]{0,20}(\d{5,})/i);
    if (markupMatch) return markupMatch[1];
    const container = element?.closest?.("article,li,.football-match-row,.match-card,.fixture-card,.score-card,.panel") || element;
    const text = String(container?.textContent || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
    const fixtures = typeof MATCHES !== "undefined" && Array.isArray(MATCHES) ? MATCHES : Array.isArray(window.MATCHES) ? window.MATCHES : [];
    const found = fixtures.find((item) => {
      const home = String(item.home_name || item.home || item.homeTeam || "").toLocaleLowerCase("tr-TR");
      const away = String(item.away_name || item.away || item.awayTeam || "").toLocaleLowerCase("tr-TR");
      return home && away && text.includes(home) && text.includes(away);
    });
    const candidate = found?.provider_fixture_id || found?.fixture_id || found?.provider_id || found?.id || "";
    return String(candidate).replace(/^sportmonks:/, "").match(/^\d{5,}$/)?.[0] || "";
  }
  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-fixture-id],[data-fixture],[data-match-id],[data-provider-id],a[href*='fixture='],.football-match-row,.match-card,.fixture-card,.score-card");
    const selected = fixtureFromElement(card);
    if (!selected || (selected === fixtureId && document.body.classList.contains("matchday-detail-open"))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const nextUrl = new URL("/", location.origin);
    nextUrl.searchParams.set("fixture", selected);
    location.assign(nextUrl.toString());
  }, true);
  window.addEventListener("popstate", () => {
    const current = new URLSearchParams(location.search);
    const selectedParam = current.get("fixture");
    const detailOpen = Boolean(selectedParam) && current.get("view") !== "home";
    setDetailMode(detailOpen);
    if (!detailOpen) return;
    const selected = String(selectedParam).replace(/^sportmonks:/, "");
    if (selected !== fixtureId) fixtureId = selected;
    refresh();
  });
  if (!requestedFixture || params.get("view") === "home") { setDetailMode(false); resolveFixture(); }
  else { setDetailMode(false); refresh(); }
})();
function syncMatchSummaryChrome() {
  document.body.classList.toggle('match-summary-open', /^#match\//i.test(window.location.hash));
}

window.addEventListener('hashchange', syncMatchSummaryChrome);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncMatchSummaryChrome, { once: true });
} else {
  syncMatchSummaryChrome();
}
