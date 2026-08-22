(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  const requestedFixture = params.get("fixture");
  let fixtureId = String(requestedFixture || "").replace(/^sportmonks:/, "");
  const leagueRoutes = new Set(["super-lig", "premier-league", "la-liga", "bundesliga", "serie-a", "all"]);
  const pathLeague = String(location.pathname || "").replace(/^\/+|\/+$/g, "").split("/")[0];
  if (["basketbol", "voleybol", "ufc", "motorsports"].includes(pathLeague)) return;
  let activeMatchdayLeague = leagueRoutes.has(pathLeague) ? pathLeague : "super-lig";
  let kickoff = NaN;
  const root = document.getElementById("matchdayLiveRoot");
  const sync = document.getElementById("matchdaySync");
  const command = document.getElementById("matchdayCommand");
  if (!root) return;
  let timer = 0;
  let currentFixture = null;
  let currentStatsXg = [];
  let selectedPredictionPick = "";
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
  function interval() { if (!Number.isFinite(kickoff)) return 300000; const delta = kickoff - Date.now(); return delta > 75 * 60000 ? 300000 : delta > 15 * 60000 ? 60000 : Date.now() < kickoff + 4 * 3600000 ? 60000 : 300000; }
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
    const inPlayWindow = valid.filter((fixture) => {
      const start=Date.parse(fixtureKickoff(fixture)), status=String(fixture.status || "").toLocaleLowerCase("tr-TR");
      return start<=now && now<start+4*3600000 && !finishedStatuses.has(status) && !["iptal","ertelendi","cancelled","postponed"].includes(status);
    }).sort((a,b)=>Date.parse(fixtureKickoff(b))-Date.parse(fixtureKickoff(a)));
    if (inPlayWindow.length) return { ...inPlayWindow[0], status:"canlı", minute:Math.max(1,Math.min(120,Math.floor((now-Date.parse(fixtureKickoff(inPlayWindow[0])))/60000))) };
    const upcoming = valid.filter((fixture) => Date.parse(fixtureKickoff(fixture)) > now && !["iptal", "ertelendi"].includes(String(fixture.status || "").toLocaleLowerCase("tr-TR"))).sort((a, b) => Date.parse(fixtureKickoff(a)) - Date.parse(fixtureKickoff(b)));
    if (upcoming.length) return upcoming[0];
    return valid.filter((fixture) => Date.parse(fixtureKickoff(fixture)) <= now && (fixture.result || ["bitti", "ft", "aet", "pen"].includes(String(fixture.status || "").toLocaleLowerCase("tr-TR")))).sort((a, b) => Date.parse(fixtureKickoff(b)) - Date.parse(fixtureKickoff(a)))[0] || null;
  }
  function fixtureFromLiveMatch(match) {
    if (!match) return null;
    return {
      id:match.id, ev:match.home?.name || "", konuk:match.away?.name || "",
      kickoff:match.startedAt || "", status:match.status === "halftime" ? "devre_arasi" : match.status === "finished" ? "bitti" : "canlı",
      minute:match.minute, added_time:match.addedTime ?? null,
      home_logo:match.home?.logo || null, away_logo:match.away?.logo || null,
      score:{ home:match.home?.score ?? null, away:match.away?.score ?? null },
      competition:match.competition || "", provider_league_id:match.providerLeagueId || null,
    };
  }
  function isLikelyInPlay(match) {
    const status=String(match?.status || "").toLowerCase();
    if (["live","halftime"].includes(status)) return true;
    if (["finished","ft","aet","pen","cancelled","postponed"].includes(status)) return false;
    const startedAt=Date.parse(match?.startedAt || ""), age=Date.now()-startedAt;
    const hasScore=Number.isFinite(Number(match?.home?.score)) && Number.isFinite(Number(match?.away?.score));
    return hasScore && Number.isFinite(startedAt) && age>=0 && age<=4*60*60*1000;
  }
  function liveMatchForLeague(matches) {
    return rows(matches).find((match) => {
      const leagueKey=String(match?.leagueKey || "");
      const competition=String(match?.competition || "").toLocaleLowerCase("tr-TR");
      const inferredKey=competition.includes("super") ? "super-lig" : competition.includes("premier") ? "premier-league" : competition.includes("la liga") ? "la-liga" : competition.includes("bundesliga") ? "bundesliga" : competition.includes("serie a") ? "serie-a" : "";
      return (activeMatchdayLeague === "all" || leagueKey === activeMatchdayLeague || (!leagueKey && inferredKey === activeMatchdayLeague)) && isLikelyInPlay(match);
    }) || null;
  }
  async function promoteLiveMatch(match, updatedAt) {
    const liveFixture=fixtureFromLiveMatch(match); if(!liveFixture) return false;
    const nextId=fixtureProviderId(liveFixture), changed=nextId && nextId!==fixtureId;
    fixtureId=nextId; kickoff=Date.parse(fixtureKickoff(liveFixture));
    render({fixture:liveFixture,details:{},degraded:false,updatedAt:updatedAt || new Date().toISOString()});
    if(changed) await refresh();
    return true;
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
  function renderStats(stats, homeName, xg=currentStatsXg) {
    if (!stats.length) return '<div class="matchday-empty">Şut, topa sahip olma, korner ve oyuncu istatistikleri sağlayıcının kapsamına göre açılacak.</div>';
    const grouped = new Map();
    stats.forEach((stat) => { const label = statisticLabel(stat.label); if (!grouped.has(label)) grouped.set(label, {home:null,away:null}); const side=stat.location === "home" || stat.team === homeName ? "home" : "away"; grouped.get(label)[side]=stat.value; });
    const homeXg=xg.find(row=>row.location==='home')?.value, awayXg=xg.find(row=>row.location==='away')?.value;
    if(homeXg!=null||awayXg!=null) grouped.set('Beklenen gol (xG)',{home:homeXg??'-',away:awayXg??'-'});
    const priority = ["Topa sahip olma", "Beklenen gol", "Toplam şut", "İsabetli şut", "Ceza sahası içinden şut", "Tehlikeli atak", "Atak", "Korner", "Faul", "Ofsayt", "Kurtarış", "Pas", "Başarılı pas"];
    const entries = Array.from(grouped.entries()).sort((a,b) => { const ai=priority.indexOf(a[0]), bi=priority.indexOf(b[0]); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi); }).slice(0, 10);
    const numeric = (value) => Number(String(value ?? "").replace(/[^0-9.,-]/g, "").replace(",", "."));
    return `<div class="matchday-stats">${entries.map(([label, values],index) => { const home=numeric(values.home), away=numeric(values.away), total=(Number.isFinite(home)?home:0)+(Number.isFinite(away)?away:0), homeWidth=total>0 ? Math.max(4,Math.min(96,home/total*100)) : 50, awayWidth=100-homeWidth, featured=label==='Topa sahip olma'||index===0; return `<div class="matchday-stat-comparison ${featured?'is-featured':''}"><div class="matchday-stat-values"><span>${esc(values.home ?? "-")}${label==='Topa sahip olma'&&values.home!=null&&!String(values.home).includes('%')?'%':''}</span><b>${esc(label)}</b><span>${esc(values.away ?? "-")}${label==='Topa sahip olma'&&values.away!=null&&!String(values.away).includes('%')?'%':''}</span></div><div class="matchday-stat-bar" aria-hidden="true"><i style="--value:${homeWidth}%"></i><i style="--value:${awayWidth}%"></i></div></div>`; }).join("")}</div>`;
  }

  function renderOverview(fixture, predictions, homeName, awayName, homeScore, awayScore, hasScore) {
    const result=predictions.find((row)=>Number(row.type_id) === 237)?.predictions || {};
    const probability=(pick,label,value)=>`<button type="button" data-overview-pick="${esc(pick)}" style="--prob:${Math.max(0,Math.min(100,Number(value)||0))}%"><span>${esc(pick)}</span><small>${esc(label)}</small><b>${Number.isFinite(Number(value)) ? `${Number(value).toLocaleString("tr-TR",{maximumFractionDigits:1})}%` : "–"}</b><i></i></button>`;
    const providerId=esc(fixtureProviderId(fixture));
    return `<article class="matchday-overview-card" data-fixture-id="${providerId}" role="link" tabindex="0" aria-label="${esc(homeName)} ${esc(awayName)} maç detayını aç"><div class="matchday-overview-meta"><span>${esc(fixture.competition || "SEÇİLİ LİG")}</span><b>${esc(fixtureTimeLabel(fixture))}</b><small>${esc(fixture.venue || fixture.stadium || "Stadyum bilgisi bekleniyor")}</small></div><div class="matchday-overview-faceoff"><div>${imageTag(fixture.home_logo,homeName,"matchday-overview-logo") || `<i>${esc(teamAbbreviation(homeName))}</i>`}<strong>${esc(homeName)}</strong></div><section><em>${esc(stateLabel(fixture))}</em><b>${hasScore ? `${esc(homeScore)} - ${esc(awayScore)}` : fixtureTimeLabel(fixture).split(" ").slice(-1)[0]}</b></section><div>${imageTag(fixture.away_logo,awayName,"matchday-overview-logo") || `<i>${esc(teamAbbreviation(awayName))}</i>`}<strong>${esc(awayName)}</strong></div><div class="matchday-overview-predict"><button class="matchday-overview-reveal" type="button" aria-expanded="false">Tahminini yap <span>↓</span></button><div class="matchday-overview-probabilities" hidden><header><b>1-X-2 olasılıkları</b><small>Seçimini kaydetmek için giriş yapmalısın.</small></header>${probability("1",homeName,result.home)}${probability("X","Beraberlik",result.draw)}${probability("2",awayName,result.away)}<p class="matchday-overview-predict-status" role="status" aria-live="polite"></p></div></div></div></article>`;
  }
  function bindOverviewPrediction(fixtureId) {
    if(typeof root.querySelector!=='function') return;
    const card=root.querySelector('.matchday-overview-card');
    if(card) card.onkeydown=(event)=>{ if((event.key==='Enter'||event.key===' ')&&!event.target.closest('.matchday-overview-predict')){ event.preventDefault(); location.assign(`/?fixture=${encodeURIComponent(fixtureId)}`); } };
    const reveal=root.querySelector('.matchday-overview-reveal');
    const panel=root.querySelector('.matchday-overview-probabilities');
    if(!reveal||!panel) return;
    reveal.onclick=()=>{ const expanded=reveal.getAttribute('aria-expanded')==='true'; reveal.setAttribute('aria-expanded',String(!expanded)); panel.hidden=expanded; reveal.closest('.matchday-overview-predict')?.classList.toggle('is-open',!expanded); };
    panel.querySelectorAll('[data-overview-pick]').forEach(button=>{ button.onclick=async()=>{
      panel.querySelectorAll('[data-overview-pick]').forEach(item=>item.classList.toggle('is-selected',item===button));
      const status=panel.querySelector('.matchday-overview-predict-status');
      const token=await predictionAuthToken();
      if(!token){ if(status) status.textContent='Seçimini kaydetmek için giriş yap veya ücretsiz üye ol.'; if(typeof openAuth==='function') openAuth('login'); return; }
      if(status) status.textContent='Seçimin kaydediliyor…';
      try{
        const response=await fetch('/api/football/prediction',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({fixture_id:String(fixtureId),pick:button.dataset.overviewPick,score_home:null,score_away:null})});
        const payload=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(payload.message||'Tahmin kaydedilemedi.');
        if(status) status.textContent=`${button.dataset.overviewPick} seçimin kaydedildi.`;
      }catch(error){ if(status) status.textContent=error.message||'Tahmin kaydedilemedi.'; }
    }; });
  }
  function renderTeamLineup(title, members, formation) {
    if (!members.length) return `<section class="matchday-lineup"><h4>${esc(title)}</h4><div class="matchday-empty">Resmî kadro henüz açıklanmadı.</div></section>`;
    const marked = members.filter((item) => item.type_id === 11 || /starter|lineup/i.test(String(item.type || ""))).slice(0, 11);
    const starters = marked.length ? marked : members.slice(0, 11);
    const substitutes = members.filter((item) => !starters.includes(item));
    const list = (items) => items.map((item) => `<li>${imageTag(item.player_image,item.player_name || "Oyuncu","matchday-player-photo")}<span>${esc(item.number || "-")}</span><b>${esc(item.player_name || item.player || "Oyuncu")}${item.is_captain ? " ©" : ""}</b><small>${esc(item.position || "")}</small></li>`).join("");
    const formationLines = String(formation || "").split("-").map(Number).filter((count) => Number.isInteger(count) && count > 0);
    const keeperIndex = starters.findIndex((item) => item.is_keeper || /goal|keeper|kaleci/i.test(String(item.position || "")) || /^1:/.test(String(item.formation_field || "")) || Number(item.formation_position) === 1);
    const keeper = keeperIndex >= 0 ? starters[keeperIndex] : null;
    const outfield = starters.filter((_, index) => index !== keeperIndex).sort((a,b) => (Number(a.formation_position) || 99) - (Number(b.formation_position) || 99));
    const validShape = keeper && formationLines.reduce((sum,count)=>sum+count,0) === outfield.length;
    if (!validShape) return `<section class="matchday-lineup"><h4>${esc(title)}${formation ? ` <small>${esc(formation)}</small>` : ""}</h4><div class="matchday-empty">Sağlayıcı saha koordinatlarını yayınlamadı. Yanlış diziliş yerine resmî ilk 11 listeleniyor.</div><ul>${list(starters)}</ul>${substitutes.length ? `<h5>Yedekler</h5><ul>${list(substitutes)}</ul>` : ""}</section>`;
    let cursor = 0;
    const logicalRows = [[keeper], ...formationLines.map((count) => { const line = outfield.slice(cursor, cursor + count); cursor += count; return line; })];
    const pitchRows = logicalRows.reverse().map((players) => {
      return `<div class="matchday-pitch-row" style="--players:${players.length}">${players.map((item) => `<div class="matchday-pitch-player">${imageTag(item.player_image,item.player_name || "Oyuncu","matchday-pitch-photo") || `<i>${esc(teamAbbreviation(item.player_name || "?"))}</i>`}<b>${item.number ? `<span>${esc(item.number)}</span>` : ""}${esc(item.player_name || item.player || "Oyuncu")}${item.is_captain ? " ©" : ""}</b></div>`).join("")}</div>`;
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
    return `<section class="matchday-insights"><header><span>SPORTMONKS PREDICTIONS</span><h3>Maç olasılıkları</h3></header>${homeXg != null || awayXg != null ? `<div class="matchday-xg"><span>${esc(homeName)} <b>${Number(homeXg || 0).toFixed(2)}</b></span><em>BEKLENEN GOL</em><span><b>${Number(awayXg || 0).toFixed(2)}</b> ${esc(awayName)}</span></div>` : ""}<div class="matchday-probabilities">${probability(homeName,result?.home)}${probability("Beraberlik",result?.draw)}${probability(awayName,result?.away)}${probability("Karşılıklı gol",btts?.yes)}${probability("2,5 üst",over?.yes)}</div><p class="matchday-insights-note">Yüzdeler SportMonks veri modelidir; bahis oranı değildir ve sonuç garantisi vermez.</p></section>`;
  }
  function renderMatchPrediction(fixture, predictions, homeName, awayName) {
    const result = predictions.find((row) => Number(row.type_id) === 237)?.predictions || {};
    const closed = isFinishedFixture(fixture) || Date.now() >= Date.parse(fixtureKickoff(fixture)) - 15 * 60000;
    const percentage = (value) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString("tr-TR", { maximumFractionDigits:1 })}%` : "Veri bekleniyor";
    return `<section class="matchday-user-predict" id="matchdayUserPredict"><header><div><span>XYZSKOR PREDICT</span><h3>Bu maç için tahminini yap</h3><p>SportMonks olasılıklarını incele, kendi 1 / X / 2 seçimini kaydet.</p></div><b>ÜCRETSİZ · BAHİS YOK</b></header><div class="matchday-provider-picks" aria-label="SportMonks maç sonucu olasılıkları"><button type="button" data-pick="1" ${closed ? "disabled" : ""}><small>1 · ${esc(homeName)}</small><strong>${esc(percentage(result.home))}</strong></button><button type="button" data-pick="X" ${closed ? "disabled" : ""}><small>X · Beraberlik</small><strong>${esc(percentage(result.draw))}</strong></button><button type="button" data-pick="2" ${closed ? "disabled" : ""}><small>2 · ${esc(awayName)}</small><strong>${esc(percentage(result.away))}</strong></button></div>${closed ? '<div class="matchday-predict-closed">Tahmin süresi maçtan 15 dakika önce kapandı.</div>' : `<div class="matchday-predict-score"><label>Kesin skor <input id="matchdayScoreHome" type="number" min="0" max="99" inputmode="numeric" aria-label="${esc(homeName)} skor tahmini"></label><span>–</span><label><input id="matchdayScoreAway" type="number" min="0" max="99" inputmode="numeric" aria-label="${esc(awayName)} skor tahmini"></label><button type="button" id="matchdayPredictSave">Tahminimi kaydet</button></div>`}<div class="matchday-predict-status" id="matchdayPredictStatus" role="status" aria-live="polite"></div></section>`;
  }
  async function predictionAuthToken() {
    if (typeof sb === "undefined" || !sb?.auth?.getSession) return "";
    const result = await sb.auth.getSession();
    return result?.data?.session?.access_token || "";
  }
  async function hydrateOwnPrediction() {
    const status = document.getElementById("matchdayPredictStatus");
    if (!status || !currentFixture) return;
    const token = await predictionAuthToken();
    if (!token) { status.innerHTML = 'Tahminini kaydetmek için <button type="button" data-predict-login>giriş yap veya ücretsiz üye ol</button>.'; return; }
    const response = await fetch(`/api/football/prediction?fixture=${encodeURIComponent(fixtureId)}`, { headers:{ Accept:"application/json", Authorization:`Bearer ${token}` }, cache:"no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const saved = payload?.prediction;
    if (!saved) return;
    selectedPredictionPick = saved.pick;
    root.querySelectorAll(".matchday-provider-picks button").forEach((button) => button.classList.toggle("is-selected", button.dataset.pick === saved.pick));
    const homeInput=document.getElementById("matchdayScoreHome"), awayInput=document.getElementById("matchdayScoreAway");
    if (homeInput && saved.score_home != null) homeInput.value=saved.score_home;
    if (awayInput && saved.score_away != null) awayInput.value=saved.score_away;
    status.textContent = `Kayıtlı tahminin: ${saved.pick}${saved.score_home != null ? ` · ${saved.score_home}-${saved.score_away}` : ""}`;
    status.classList.add("is-success");
  }
  async function saveMatchdayPrediction() {
    const status=document.getElementById("matchdayPredictStatus"), button=document.getElementById("matchdayPredictSave");
    if (!status || !selectedPredictionPick) { if(status) status.textContent="Önce 1 / X / 2 seç."; return; }
    const token=await predictionAuthToken();
    if (!token) { status.textContent="Tahminini kaydetmek için giriş yap."; if(typeof openAuth === "function") openAuth("login"); return; }
    const home=document.getElementById("matchdayScoreHome")?.value ?? "", away=document.getElementById("matchdayScoreAway")?.value ?? "";
    if ((home === "") !== (away === "")) { status.textContent="Kesin skor için iki skoru da gir."; return; }
    if(button){ button.disabled=true; button.textContent="Kaydediliyor…"; }
    try {
      const response=await fetch("/api/football/prediction", { method:"POST", headers:{ Accept:"application/json", "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body:JSON.stringify({ fixture_id:fixtureId, pick:selectedPredictionPick, score_home:home === "" ? null : Number(home), score_away:away === "" ? null : Number(away) }) });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload.error === "prediction_closed" ? "Tahmin süresi kapandı." : payload.message || "Tahmin kaydedilemedi.");
      status.textContent=`Tahminin kaydedildi: ${selectedPredictionPick}${home !== "" ? ` · ${home}-${away}` : ""}`; status.classList.add("is-success");
    } catch(error) { status.textContent=error.message || "Tahmin kaydedilemedi."; status.classList.remove("is-success"); }
    finally { if(button){ button.disabled=false; button.textContent="Tahminimi kaydet"; } }
  }
  function renderTeamContexts(contexts) {
    if (!contexts.length) return "";
    const dateLabel = (value) => value ? new Intl.DateTimeFormat("tr-TR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit", timeZone:"Europe/Istanbul" }).format(new Date(value)) : "Program bekleniyor";
    return `<section class="matchday-form-panel"><header><span>TAKIM GÜNDEMİ</span><h3>İki takımın son 5 maçı ve sıradaki karşılaşması</h3></header><div class="matchday-form-grid">${contexts.map((context) => { const recent=rows(context.recent).slice(-5), slots=[...Array(Math.max(0,5-recent.length)).fill(null),...recent]; return `<article><h4>${imageTag(context.team_logo,context.team || "Takım","matchday-form-logo")}<span>${esc(context.team || "Takım")}</span><small>SON 5 MAÇ</small></h4><div class="matchday-form-results">${slots.map((match) => match ? `<div class="is-${esc(String(match.result || "D").toLowerCase())}"><b>${esc(match.result === "W" ? "G" : match.result === "L" ? "M" : "B")}</b>${imageTag(match.opponent_logo,match.opponent,"matchday-form-opponent")}<span>${esc(match.score ? `${match.score.team}-${match.score.opponent}` : "-")}</span><small>${esc(match.opponent)}</small></div>` : '<div class="is-missing"><b>–</b><i></i><span>–</span><small>Veri bekleniyor</small></div>').join("")}</div>${context.next ? `<div class="matchday-next"><span>SONRAKİ MAÇ</span>${imageTag(context.next.opponent_logo,context.next.opponent,"matchday-next-logo")}<div><b>${esc(context.next.opponent)}</b><small>${esc(context.next.league || "Futbol")} · ${esc(dateLabel(context.next.kickoff))}</small></div></div>` : '<div class="matchday-next matchday-next--empty">Sonraki maç programı bekleniyor.</div>'}</article>`; }).join("")}</div></section>`;
  }
  function render(payload) {
    const f = payload.fixture || {}, d = payload.details || {}, events = rows(d.events), stats = rows(d.statistics), lineups = rows(d.lineups), formations = rows(d.formations), xg=rows(d.xg), predictions=rows(d.predictions), teamContexts=rows(d.teamContexts);
    currentStatsXg=xg;
    currentFixture = f;
    selectedPredictionPick = "";
    const names = fixtureNames(f), homeName = names.home || "-", awayName = names.away || "-";
    const parsedKickoff = Date.parse(fixtureKickoff(f));
    if (Number.isFinite(parsedKickoff)) kickoff = parsedKickoff;
    const title = document.getElementById("matchdayTitle");
    const intro = title?.nextElementSibling;
    const eyebrow = title?.previousElementSibling;
    if (eyebrow) eyebrow.textContent = isLiveFixture(f) ? "LİGİN CANLI MAÇI" : "LİGİN SIRADAKİ MAÇI";
    if (title) title.textContent = `${homeName} - ${awayName}`;
    if (intro) intro.textContent = `${fixtureTimeLabel(f)} · Sportmonks tarafından doğrulanan maç verisi`;
    const homeLineup = lineups.filter((item) => String(item.team || "").toLowerCase().includes(homeName.toLowerCase().split(" ")[0]));
    const awayLineup = lineups.filter((item) => !homeLineup.includes(item));
    const homeFormation = formations[0]?.formation || formations[0]?.name || "";
    const awayFormation = formations[1]?.formation || formations[1]?.name || "";
    const homeScore = f.score?.home, awayScore = f.score?.away, hasScore = homeScore != null && awayScore != null;
    sync.textContent = `${payload.degraded ? "Kısıtlı kapsam" : "Sportmonks canlı veri"} · ${new Date(payload.updatedAt || Date.now()).toLocaleTimeString("tr-TR")}`;
    const detailMode = Boolean(new URLSearchParams(location.search).get("fixture")) && params.get("view") !== "home";
    if (!detailMode) {
      root.innerHTML = renderOverview(f,predictions,homeName,awayName,homeScore,awayScore,hasScore);
      bindOverviewPrediction(fixtureProviderId(f));
      setDetailMode(false);
      return;
    }
    root.innerHTML = `<div class="matchday-scoreboard"><div class="matchday-team">${imageTag(f.home_logo,homeName,"matchday-team-logo") || `<span>${esc(teamAbbreviation(homeName))}</span>`}<strong>${esc(homeName)}</strong><small>${esc(homeFormation || "Diziliş bekleniyor")}</small></div><div class="matchday-score"><em>${esc(stateLabel(f))}</em><b>${hasScore ? `${esc(homeScore)} - ${esc(awayScore)}` : isLiveFixture(f) ? "Skor yenileniyor" : "- : -"}</b><small>${esc(fixtureTimeLabel(f))}</small></div><div class="matchday-team matchday-team--away">${imageTag(f.away_logo,awayName,"matchday-team-logo") || `<span>${esc(teamAbbreviation(awayName))}</span>`}<strong>${esc(awayName)}</strong><small>${esc(awayFormation || "Diziliş bekleniyor")}</small></div></div>${renderInsights(xg,predictions,homeName,awayName)}<nav class="matchday-jump" aria-label="Maç ayrıntıları"><a href="#matchdayEvents">Olaylar <b>${events.length}</b></a><a href="#matchdayStatistics">İstatistikler <b>${stats.length}</b></a><a href="#matchdayLineups">Kadrolar <b>${lineups.length}</b></a></nav><div class="matchday-grid"><section class="matchday-card" id="matchdayEvents"><header><span>OLAY AKIŞI</span><h3>Gol, kart ve değişiklikler</h3></header>${renderEvents(events,homeName)}</section><section class="matchday-card" id="matchdayStatistics"><header><span>MAÇ İSTATİSTİKLERİ</span><h3>Sahanın sayıları</h3></header>${renderStats(stats,homeName)}</section></div><section class="matchday-card matchday-card--lineups" id="matchdayLineups"><header><span>RESMÎ KADROLAR</span><h3>İlk 11, yedekler ve diziliş</h3></header><div class="matchday-lineups">${renderTeamLineup(homeName, homeLineup, homeFormation)}${renderTeamLineup(awayName, awayLineup, awayFormation)}</div></section>`;
    root.innerHTML = root.innerHTML.replace('<nav class="matchday-jump"', `${renderMatchPrediction(f,predictions,homeName,awayName)}<nav class="matchday-jump"`);
    if (teamContexts.length) root.innerHTML = root.innerHTML.replace('<nav class="matchday-jump"', `${renderTeamContexts(teamContexts)}<nav class="matchday-jump"`);
    setDetailMode(true);
    hydrateOwnPrediction();
  }
  function renderEmpty() {
    const title = document.getElementById("matchdayTitle"), intro = title?.nextElementSibling;
    if (title) title.textContent = "Program bekleniyor";
    if (intro) intro.textContent = "Sağlayıcı henüz uygun bir maç yayınlamadı";
    sync.textContent = "Fikstür bekleniyor";
    root.innerHTML = '<div class="matchday-loading"><b>Program bekleniyor.</b><span>Yeni fikstür yayınlandığında maç merkezi otomatik güncellenecek.</span></div>';
  }
  async function readApiJSON(response, fallbackMessage) {
    const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("application/json")) throw new Error(fallbackMessage);
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") throw new Error(fallbackMessage);
    if (!response.ok) throw new Error(payload.message || payload.detail || payload.error || fallbackMessage);
    return payload;
  }
  async function renderSeasonFallbackForFixture() {
    const response=await fetch(`/api/football/season?league=${encodeURIComponent(activeMatchdayLeague)}`,{headers:{Accept:"application/json"},cache:"no-store"});
    const payload=await readApiJSON(response,"Temel fikstür verisi alınamadı.");
    const fixture=rows(payload.matches).find((item)=>fixtureProviderId(item)===fixtureId);
    if(!fixture) return false;
    const start=Date.parse(fixtureKickoff(fixture)), now=Date.now(), status=String(fixture.status || "").toLocaleLowerCase("tr-TR");
    const inPlay=Number.isFinite(start) && start<=now && now<start+4*3600000 && !finishedStatuses.has(status) && !["iptal","ertelendi","cancelled","postponed"].includes(status);
    const seasonFixture={...fixture,status:inPlay?"canlı":fixture.status,minute:inPlay?Math.max(1,Math.min(120,Math.floor((now-start)/60000))):fixture.minute,score:fixture.score || fixture.result || {home:null,away:null}};
    render({fixture:seasonFixture,details:{},degraded:true,updatedAt:payload.updatedAt || new Date().toISOString()});
    sync.textContent="Temel fikstür gösteriliyor · ayrıntılar kota yenilenince tamamlanır";
    return true;
  }
  async function refresh() {
    clearTimeout(timer);
    try { const response = await fetch(`/api/football/matchday?fixture=${encodeURIComponent(fixtureId)}`, { headers:{Accept:"application/json"}, cache: "no-store" }); const payload = await readApiJSON(response, "Maç verisi kısa süreliğine alınamadı."); render(payload); }
    catch (_error) {
      if (currentFixture) sync.textContent = "Temel fikstür verisi · ayrıntılar kota yenilenince güncellenir";
      else if (!await renderSeasonFallbackForFixture().catch(()=>false)) { sync.textContent = "Maç ayrıntıları alınamadı"; root.innerHTML = '<div class="matchday-loading matchday-loading--error"><b>Maç ayrıntıları şu anda kullanılamıyor.</b><span>Fikstür listesinden başka bir maçı açabilirsin.</span></div>'; }
    }
    timer = setTimeout(refresh, interval());
  }
  async function resolveFixture() {
    try {
      const existingLive=typeof LIVE_FEED !== "undefined" ? liveMatchForLeague(LIVE_FEED.matches) : null;
      if(existingLive && await promoteLiveMatch(existingLive,LIVE_FEED.updatedAt)) return;
      const response = await fetch(`/api/football/season?league=${encodeURIComponent(activeMatchdayLeague)}`, { headers:{Accept:"application/json"}, cache:"no-store" });
      const payload = await readApiJSON(response, "Fikstür kısa süreliğine alınamadı.");
      const selected = selectFixture(payload.matches);
      if (!selected) { renderEmpty(); timer = setTimeout(resolveFixture, 300000); return; }
      fixtureId = fixtureProviderId(selected);
      kickoff = Date.parse(fixtureKickoff(selected));
      // Sezon endpointi fikstur, takim, logo, saat ve sonucu zaten dogruluyor.
      // Zengin detay endpointi kota sinirina takilsa bile ana mac kartini bosaltma.
      const seasonFixture = { ...selected, score:selected.score || selected.result || { home:null, away:null } };
      render({ fixture:seasonFixture, details:{}, degraded:true, updatedAt:payload.updatedAt || new Date().toISOString() });
      await refresh();
    } catch (_error) {
      sync.textContent = "Fikstür servisine ulaşılamadı";
      root.innerHTML = '<div class="matchday-loading matchday-loading--error"><b>Maç programı şu anda alınamıyor.</b><span>Yukarıdaki maç şeridi ve lig tablosu kullanılabilir.</span></div>';
      timer = setTimeout(resolveFixture, 300000);
    }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (fixtureId) refresh(); else resolveFixture(); } });
  window.addEventListener("xyz:football-league-change", (event) => {
    const league = String(event?.detail?.league || "");
    if (!leagueRoutes.has(league) || league === activeMatchdayLeague) return;
    activeMatchdayLeague = league;
    fixtureId = "";
    kickoff = NaN;
    clearTimeout(timer);
    sync.textContent = "Seçili lig fikstürü yükleniyor";
    root.innerHTML = '<div class="matchday-loading"><b>En yakın maç aranıyor.</b><span>Seçili ligin canlı veya yaklaşan fikstürü yükleniyor.</span></div>';
    resolveFixture();
  });
  window.addEventListener("xyz:live-feed-updated", (event) => {
    const live=liveMatchForLeague(event?.detail?.matches);
    if(live) promoteLiveMatch(live,event?.detail?.updatedAt);
  });
  root.addEventListener("click", (event) => {
    const pickButton = event.target.closest(".matchday-provider-picks button[data-pick]");
    if (pickButton && !pickButton.disabled) {
      selectedPredictionPick = pickButton.dataset.pick || "";
      root.querySelectorAll(".matchday-provider-picks button").forEach((button) => button.classList.toggle("is-selected", button === pickButton));
      return;
    }
    if (event.target.closest("#matchdayPredictSave")) { saveMatchdayPrediction(); return; }
    if (event.target.closest("[data-predict-login]") && typeof openAuth === "function") openAuth("login");
  });
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
    if (event.target.closest(".matchday-overview-predict")) return;
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
