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
  function eventTitle(event) { const type = String(event?.type || "").toLowerCase(); return /goal/.test(type) ? "GOL" : /yellow/.test(type) ? "SARI KART" : /red/.test(type) ? "KIRMIZI KART" : /substitution/.test(type) ? "OYUNCU DEĞİŞİKLİĞİ" : String(event?.type || "MAÇ OLAYI").toUpperCase(); }
  function renderEvents(events) {
    if (!events.length) return '<div class="matchday-empty">Gol, asist, kart ve değişiklikler maç başladığında burada görünecek.</div>';
    return `<ol class="matchday-timeline">${events.map((event) => `<li><time>${esc(event.minute || "-")}'</time><div><b>${esc(eventTitle(event))}</b><span>${esc(event.player || "")} ${event.relatedPlayer ? `· ${esc(event.relatedPlayer)}` : ""}</span></div></li>`).join("")}</ol>`;
  }
  function renderStats(stats) {
    if (!stats.length) return '<div class="matchday-empty">Şut, topa sahip olma, korner ve oyuncu istatistikleri sağlayıcının kapsamına göre açılacak.</div>';
    const grouped = new Map();
    stats.forEach((stat) => { const label = String(stat.label || "İstatistik"); if (!grouped.has(label)) grouped.set(label, []); grouped.get(label).push(stat.value); });
    return `<div class="matchday-stats">${Array.from(grouped.entries()).slice(0, 10).map(([label, values]) => `<div><span>${esc(values[0] ?? "-")}</span><b>${esc(label)}</b><span>${esc(values[1] ?? "-")}</span></div>`).join("")}</div>`;
  }
  function renderTeamLineup(title, members) {
    if (!members.length) return `<section class="matchday-lineup"><h4>${esc(title)}</h4><div class="matchday-empty">Resmî kadro henüz açıklanmadı.</div></section>`;
    const marked = members.filter((item) => item.type_id === 11 || /starter|lineup/i.test(String(item.type || ""))).slice(0, 11);
    const starters = marked.length ? marked : members.slice(0, 11);
    const substitutes = members.filter((item) => !starters.includes(item));
    const list = (items) => items.map((item) => `<li><span>${esc(item.number || "-")}</span><b>${esc(item.player || "Oyuncu")}</b><small>${esc(item.position || "")}${item.is_captain ? " · Kaptan" : ""}</small></li>`).join("");
    return `<section class="matchday-lineup"><h4>${esc(title)}</h4><h5>İlk 11</h5><ul>${list(starters)}</ul>${substitutes.length ? `<h5>Yedekler</h5><ul>${list(substitutes)}</ul>` : ""}</section>`;
  }
  function render(payload) {
    const f = payload.fixture || {}, d = payload.details || {}, events = rows(d.events), stats = rows(d.statistics), lineups = rows(d.lineups), formations = rows(d.formations);
    const names = fixtureNames(f), homeName = names.home || "-", awayName = names.away || "-";
    const parsedKickoff = Date.parse(fixtureKickoff(f));
    if (Number.isFinite(parsedKickoff)) kickoff = parsedKickoff;
    const title = document.getElementById("matchdayTitle");
    const intro = title?.nextElementSibling;
    if (title) title.textContent = `${homeName} - ${awayName}`;
    if (intro) intro.textContent = `${localTime(fixtureKickoff(f))} · Resmî veri geldikçe otomatik güncellenir`;
    const homeLineup = lineups.filter((item) => String(item.team || "").toLowerCase().includes(homeName.toLowerCase().split(" ")[0]));
    const awayLineup = lineups.filter((item) => !homeLineup.includes(item));
    const homeScore = f.score?.home, awayScore = f.score?.away, hasScore = homeScore != null && awayScore != null;
    sync.textContent = `${payload.degraded ? "Kısıtlı kapsam" : "Sportmonks canlı veri"} · ${new Date(payload.updatedAt || Date.now()).toLocaleTimeString("tr-TR")}`;
    root.innerHTML = `<div class="matchday-scoreboard"><div class="matchday-team"><span>${esc(teamAbbreviation(homeName))}</span><strong>${esc(homeName)}</strong><small>${esc(formations[0]?.formation || "Diziliş bekleniyor")}</small></div><div class="matchday-score"><em>${esc(stateLabel(f))}</em><b>${hasScore ? `${esc(homeScore)} - ${esc(awayScore)}` : "- : -"}</b><small>${esc(localTime(fixtureKickoff(f)))}</small></div><div class="matchday-team matchday-team--away"><span>${esc(teamAbbreviation(awayName))}</span><strong>${esc(awayName)}</strong><small>${esc(formations[1]?.formation || "Diziliş bekleniyor")}</small></div></div><div class="matchday-grid"><section class="matchday-card"><header><span>OLAY AKIŞI</span><h3>Gol, kart ve değişiklikler</h3></header>${renderEvents(events)}</section><section class="matchday-card"><header><span>MAÇ İSTATİSTİKLERİ</span><h3>Sahanın sayıları</h3></header>${renderStats(stats)}</section></div><section class="matchday-card matchday-card--lineups"><header><span>RESMÎ KADROLAR</span><h3>İlk 11, yedekler ve diziliş</h3></header><div class="matchday-lineups">${renderTeamLineup(homeName, homeLineup)}${renderTeamLineup(awayName, awayLineup)}</div></section>`;
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
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
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
  else { setDetailMode(true); refresh(); }
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
