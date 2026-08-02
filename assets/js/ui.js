/* ===================== NAV ===================== */
function escapeHTML(value){
  return String(value == null ? '' : value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function renderNav(){
  const u = getCurrentUser(); const el = document.getElementById('navRight');
  el.innerHTML = `<button class="btn ghost notification-button" id="notificationBtn" type="button" aria-label="Hesap ve bildirim tercihlerini aç"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z"/><path d="M10 20h4"/></svg></button><button class="btn ghost account-button" id="accountBtn" type="button" aria-label="Hesap menüsünü aç"></button>`;
  document.getElementById('accountBtn').textContent = u && u.username ? String(u.username).trim().slice(0,2).toLocaleUpperCase('tr-TR') : 'HE';
  document.getElementById('accountBtn').onclick = openAccount;
  document.getElementById('notificationBtn').onclick = openAccount;
}

let accountReturnFocus = null;
function accountGeneralRank(uid){
  const rows = sortRows(leaderboardFor('Genel', activeWeek), 'season');
  const index = rows.findIndex(row=>row.uid===uid);
  return index < 0 ? null : index + 1;
}
function accountHistoryHTML(uid){
  const rows = MATCHES.filter(match=>ALL_PREDICTIONS[match.id] && ALL_PREDICTIONS[match.id][uid]).sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff)).slice(0,8);
  if(!rows.length) return '<p class="account-empty">Henüz kaydedilmiş tahmin bulunmuyor.</p>';
  return `<div class="account-history">${rows.map(match=>{
    const prediction=ALL_PREDICTIONS[match.id][uid]; const result=ALL_RESULTS[match.id];
    const points=result ? computeMatchPoints(prediction,result).toplam : null;
    const score=prediction.scoreHome!=null && prediction.scoreAway!=null ? ` · ${prediction.scoreHome}–${prediction.scoreAway}` : '';
    return `<div class="account-history-row"><div class="account-history-match">${escapeHTML(match.home)} – ${escapeHTML(match.away)}<span>${escapeHTML(fmtKickoff(match.kickoff))} · ${escapeHTML(String(match.hafta))}. hafta</span></div><div class="account-history-pick">${escapeHTML(prediction.pick)}${escapeHTML(score)}<span>${points==null?'Sonuç bekleniyor':escapeHTML(String(points))+' puan'}</span></div></div>`;
  }).join('')}</div>`;
}
function renderAccountContent(){
  const area = document.getElementById('accountContent'); const u = getCurrentUser();
  if(!u){
    area.innerHTML = `<div class="account-summary"><div class="account-name">Futbol dünyana katıl</div><div class="account-team">Tahminlerini kaydetmek ve yarışmak için hesabını aç.</div></div><div class="account-actions"><button class="btn" id="accountJoin">Üye Ol</button><button class="btn ghost" id="accountLogin">Giriş Yap</button></div>`;
    document.getElementById('accountJoin').onclick = () => { closeAccount(); openAuth('register'); };
    document.getElementById('accountLogin').onclick = () => { closeAccount(); openAuth('login'); };
    return;
  }
  const life = lifetimeStats(u.id); const week = userStatsForWeek(u.id, activeWeek); const rank=accountGeneralRank(u.id); const badges=computeBadges(u.id);
  area.innerHTML = `<div class="account-summary"><div class="account-name">${escapeHTML(u.username)}</div><div class="account-team">${escapeHTML(u.team||'Takım seçilmedi')}</div>${u.email?`<div class="account-email">${escapeHTML(u.email)}</div>`:''}</div>
    <div class="account-metrics" aria-label="Kullanıcı performansı"><div class="account-metric"><b>${week.toplam}</b><span>Haftalık puan</span></div><div class="account-metric"><b>${life.toplam}</b><span>Toplam puan</span></div><div class="account-metric"><b>${rank||'—'}</b><span>Genel sıralama</span></div><div class="account-metric"><b>${life.sonuclananTahmin?`%${life.dogruYuzde}`:'—'}</b><span>Doğru tahmin oranı</span></div><div class="account-metric"><b>${life.kesinSkor}</b><span>Kesin skor</span></div><div class="account-metric"><b>${life.tahmin}</b><span>Toplam tahmin</span></div></div>
    <section class="account-section" aria-labelledby="accountHistoryTitle"><h3 class="account-section-title" id="accountHistoryTitle">Tahmin geçmişi</h3>${accountHistoryHTML(u.id)}</section>
    <section class="account-section" aria-labelledby="accountBadgesTitle"><h3 class="account-section-title" id="accountBadgesTitle">Rozetler</h3>${badges.length?`<div class="account-badges">${badges.map(badge=>`<span class="account-badge">${escapeHTML(badge)}</span>`).join('')}</div>`:'<p class="account-empty">Henüz kazanılmış rozet bulunmuyor.</p>'}</section>
    <section class="account-section" aria-labelledby="accountFollowingTitle"><h3 class="account-section-title" id="accountFollowingTitle">Takip edilenler</h3><p class="account-empty">Takip edilen takım ve futbolcu verisi için bağlı bir profil kaydı bulunmuyor.</p></section>
    <section class="account-section" aria-labelledby="accountNotificationsTitle"><h3 class="account-section-title" id="accountNotificationsTitle">Bildirim tercihleri</h3><p class="account-empty">Bildirim tercihleri henüz kullanıcı hesabına bağlı değil. Varsayılan tercih uydurulmadı.</p></section>
    <section class="account-section" aria-labelledby="accountSettingsTitle"><h3 class="account-section-title" id="accountSettingsTitle">Hesap ayarları</h3><div class="account-settings"><div class="account-settings-row"><label for="accountTeamSelect">Tuttuğun takım</label><select id="accountTeamSelect" ${u.team_changed?'disabled':''}>${TEAMS.map(team=>`<option ${team===u.team?'selected':''}>${escapeHTML(team)}</option>`).join('')}</select></div><button class="btn ghost" id="accountTeamSave" type="button" disabled>Takımı değiştir</button>${u.team_changed?'<p class="account-note">Bu sezon için tek takım değişikliği hakkını kullandın.</p>':'<p class="account-note">Takım sezonda yalnız bir kez değiştirilebilir.</p>'}</div></section>
    <div class="account-actions">${u.is_admin?'<button class="btn ghost" id="accountAdmin" type="button">Yönetim Paneli</button>':''}<button class="btn ghost account-danger" id="accountLogout" type="button">Çıkış yap</button></div>`;
  const teamSelect=document.getElementById('accountTeamSelect'); const teamSave=document.getElementById('accountTeamSave');
  if(teamSelect && teamSave && !u.team_changed){
    teamSelect.onchange=()=>{ teamSave.disabled=teamSelect.value===u.team; };
    teamSave.onclick=async()=>{ if(await changeTeam(teamSelect.value)){ await loadAllData(); renderAll(); renderAccountContent(); } };
  }
  if(u.is_admin) document.getElementById('accountAdmin').onclick = () => { closeAccount(); switchMainTab('predict'); switchLeagueSection('admin'); };
  document.getElementById('accountLogout').onclick = async () => { closeAccount(); await logoutUser(); await loadAllData(); renderAll(); };
}
function openAccount(){
  accountReturnFocus = document.activeElement; renderAccountContent();
  const overlay = document.getElementById('accountOverlay'); overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  document.getElementById('accountClose').focus();
}
function closeAccount(){
  const overlay = document.getElementById('accountOverlay'); overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open');
  if(accountReturnFocus && accountReturnFocus.focus) accountReturnFocus.focus();
}
document.getElementById('accountClose').onclick = closeAccount;
document.getElementById('accountOverlay').addEventListener('click', event => { if(event.target.id==='accountOverlay') closeAccount(); });
document.getElementById('accountOverlay').addEventListener('keydown', event => {
  if(event.key==='Escape'){ closeAccount(); return; }
  if(event.key!=='Tab') return;
  const focusable = [...event.currentTarget.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])')].filter(el=>el.offsetParent!==null);
  if(!focusable.length) return;
  const first=focusable[0], last=focusable[focusable.length-1];
  if(event.shiftKey && document.activeElement===first){ event.preventDefault(); last.focus(); }
  else if(!event.shiftKey && document.activeElement===last){ event.preventDefault(); first.focus(); }
});

/* ===================== AUTH MODAL ===================== */
let authMode = 'register';
let authReturnFocus = null;
function closeAuth(){ document.getElementById('authOverlay').classList.remove('show'); document.body.classList.remove('modal-open'); if(authReturnFocus&&authReturnFocus.focus) authReturnFocus.focus(); }
function openAuth(mode){
  if(!document.getElementById('authOverlay').classList.contains('show')) authReturnFocus=document.activeElement;
  authMode = mode;
  document.getElementById('authTitle').textContent = mode==='register' ? 'Üye Ol' : 'Giriş Yap';
  document.getElementById('registerFields').style.display = mode==='register' ? 'block' : 'none';
  document.getElementById('authSubmit').textContent = mode==='register' ? 'Üye Ol' : 'Giriş Yap';
  document.getElementById('authSwitch').textContent = mode==='register' ? 'Zaten üye misin? Giriş yap' : 'Hesabın yok mu? Üye ol';
  document.getElementById('authErr').classList.remove('show');
  document.getElementById('authErr').style.color = '';
  document.getElementById('authOverlay').classList.add('show');
  document.body.classList.add('modal-open');
  document.getElementById('authClose').focus();
}
document.getElementById('authClose').onclick = closeAuth;
document.getElementById('authSwitch').onclick = () => openAuth(authMode==='register'?'login':'register');
document.getElementById('authOverlay').addEventListener('click', e => { if(e.target.id==='authOverlay') closeAuth(); });
document.getElementById('authOverlay').addEventListener('keydown', e => {
  if(e.key==='Escape'){ closeAuth(); return; } if(e.key!=='Tab') return;
  const focusable=[...e.currentTarget.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[href]')].filter(el=>el.offsetParent!==null); if(!focusable.length) return;
  const first=focusable[0],last=focusable[focusable.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
document.addEventListener('keydown', e => {
  if((e.key==='Enter' || e.key===' ') && e.target && e.target.getAttribute && e.target.getAttribute('role')==='button'){
    e.preventDefault(); e.target.click();
  }
});
document.getElementById('authSubmit').onclick = async () => {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const errEl = document.getElementById('authErr');
  const btn = document.getElementById('authSubmit');
  if(!email || !pass){ errEl.textContent='E-posta ve şifre gerekli.'; errEl.classList.add('show'); return; }
  let res; btn.disabled = true; btn.textContent = '...';
  if(authMode==='register'){
    const username = document.getElementById('regUsername').value.trim();
    const team = document.getElementById('regTeam').value;
    if(!username || !team){ errEl.textContent='Kullanıcı adı ve takım seçimi gerekli.'; errEl.classList.add('show'); btn.disabled=false; btn.textContent='Üye Ol'; return; }
    res = await registerUser(username, email, pass, team);
  } else { res = await loginUser(email, pass); }
  btn.disabled = false; btn.textContent = authMode==='register' ? 'Üye Ol' : 'Giriş Yap';
  if(!res.ok){ errEl.textContent = res.err; errEl.classList.add('show'); return; }
  if(res.pending){ errEl.textContent = res.message; errEl.style.color = 'var(--ok)'; errEl.classList.add('show'); return; }
  errEl.style.color = '';
  closeAuth();
  await loadAllData(); renderAll();
};

/* ===================== HAFTANIN HİKAYESİ: HERO + LİSTE ===================== */
function analysisBlockHTML(m){
  const a = ANALYSIS[m.id]; const completeness = analysisCompleteness(a); const total = ANALYSIS_FIELDS.length;
  const detailBlocks = ANALYSIS_FIELDS.map(([key,label]) => `
    <div class="detail-block"><div class="detail-label">${escapeHTML(label)}</div>
      <div class="detail-val ${a && a[key] ? '' : 'pending'}">${a && a[key] ? escapeHTML(a[key]) : 'Maç haftasında güncellenecek'}</div></div>`).join('');
  return `
    <div class="completeness-line">
      ${total} analiz başlığından ${completeness} tanesi hazır
      <div class="dots">${ANALYSIS_FIELDS.map((_,i)=>`<div class="dot ${i<completeness?'filled':''}"></div>`).join('')}</div>
    </div>
    <details class="analysis"><summary>Detaylı Analizi Göster</summary><div class="detail-grid">${detailBlocks}</div></details>`;
}
function heroCardHTML(m){
  const a = ANALYSIS[m.id]; const completeness = analysisCompleteness(a); const total = ANALYSIS_FIELDS.length;
  return `
    <div class="hero-eyebrow">
      <span>HAFTANIN MAÇI</span>
      ${m.verified ? '<span class="verify-badge">Doğrulandı</span>' : '<span class="unverified-badge">Doğrulanmadı</span>'}
    </div>
    <div class="hero-teams hero-clubs">
      <div class="hero-club">${crestHTML(m.ev,'lg')}<span>${escapeHTML(m.ev)}</span></div>
      <span class="vs">vs</span>
      <div class="hero-club">${crestHTML(m.konuk,'lg')}<span>${escapeHTML(m.konuk)}</span></div>
    </div>
    <div class="hero-meta"><b>${escapeHTML(fmtKickoff(m.kickoff))}</b> · ${escapeHTML(m.stadyum)} · <span class="mc-status-badge" style="margin-top:0;">${escapeHTML(matchStatusLabel(m))}</span></div>
    <div class="hero-analysis-mini mono">${completeness}/${total} analiz başlığı hazır <div class="dots">${ANALYSIS_FIELDS.map((_,i)=>`<div class="dot ${i<completeness?'filled':''}"></div>`).join('')}</div></div>
    <div class="hero-cta">
      <button class="btn gold" onclick="switchMainTab('league')">Tahminini Yap</button>
      <button class="btn ghost" onclick="openMatchCenter('${m.id}')">Maç Merkezi →</button>
    </div>
  `;
}
function matchRowHTML(m){
  return `
    <div class="match-row">
      <div class="match-row-top">
        ${crestHTML(m.ev)}
        <div class="teams">
          <div class="names">${escapeHTML(m.ev)} <span style="color:var(--ink-faint);font-weight:400;">—</span> ${escapeHTML(m.konuk)} ${m.verified?'<span class="verify-dot" title="Doğrulandı"></span>':''}</div>
          <div class="venue">${escapeHTML(m.stadyum)} · ${escapeHTML(matchStatusLabel(m))}</div>
        </div>
        ${crestHTML(m.konuk)}
        <div class="time-chip mono">${fmtTime(m.kickoff)}</div>
      </div>
      <div class="story-link-row"><button class="btn ghost" style="font-size:13px;padding:8px 10px;" onclick="openMatchCenter('${m.id}')">Maç Merkezi →</button></div>
    </div>`;
}
function footballEmpty(title, text){
  return `<div class="football-empty"><strong>${escapeHTML(title)}</strong>${escapeHTML(text)}</div>`;
}
function scrollFootballSection(id, button){
  const target=document.getElementById(id); if(!target) return;
  document.querySelectorAll('.football-context-tab').forEach(tab=>tab.classList.toggle('active',tab===button));
  target.scrollIntoView({behavior:'smooth',block:'start'});
}
function footballTeamOptions(){
  const names=[...MATCHES.flatMap(match=>[match.ev,match.konuk]),...STANDINGS.map(row=>row.team)].filter(Boolean);
  return [...new Set(names)].sort((a,b)=>String(a).localeCompare(String(b),'tr')).slice(0,18);
}
function renderFootballTeamStrip(){
  const area=document.getElementById('footballTeamStrip'); if(!area) return;
  const teams=footballTeamOptions();
  if(activeFootballTeam!=='Tümü' && !teams.includes(activeFootballTeam)) activeFootballTeam='Tümü';
  area.innerHTML=['Tümü',...teams].map(team=>`<button class="portal-team-button ${team===activeFootballTeam?'active':''}" type="button" data-portal-team="${escapeHTML(team)}" aria-pressed="${team===activeFootballTeam}">${team==='Tümü'?'<span aria-hidden="true">●</span>':crestHTML(team,'xs')}<span>${escapeHTML(team)}</span></button>`).join('');
  area.querySelectorAll('[data-portal-team]').forEach(button=>{ button.onclick=()=>selectFootballTeam(button.dataset.portalTeam); });
}
function selectFootballTeam(team){
  activeFootballTeam=team||'Tümü';
  renderFootballTeamStrip(); renderFootballQuickMatches(); renderFootballNews(); renderFootballTransfers();
  if(X_CLUBS.some(club=>club.team===team)) selectXClub(team);
}

/* ===================== RESMÎ KULÜP X AKIŞI ===================== */
function activeXClubConfig(){
  return X_CLUBS.find(club=>club.team===activeXClub) || X_CLUBS[0];
}
function rankedXClubs(){
  const orderedStandings=[...STANDINGS].sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity) || (b.goal_difference??-Infinity)-(a.goal_difference??-Infinity) || (b.goals_for??-Infinity)-(a.goals_for??-Infinity));
  const rankByTeam=new Map(orderedStandings.map((row,index)=>[row.team,index+1]));
  return X_CLUBS.map((club,index)=>({ ...club, leagueRank:rankByTeam.get(club.team)??null, fallbackOrder:index }))
    .sort((a,b)=>(a.leagueRank??99)-(b.leagueRank??99) || a.fallbackOrder-b.fallbackOrder);
}
function xTimelineGateHTML(club){
  return `<div class="club-social-gate">
    <span class="club-social-gate-mark" aria-hidden="true">𝕏</span>
    <div><strong>@${escapeHTML(club.handle)} akışını göster</strong><p>X içeriği yalnızca sen istediğinde yüklenir. Bu işlem X'in çerez ve benzeri teknolojilerini çalıştırabilir.</p></div>
    <button class="club-social-load" type="button" data-x-load>Akışı göster</button>
    <a class="club-social-policy" href="legal/cerez-politikasi.html">Çerez Politikası</a>
  </div>`;
}
function renderXClubTabs(){
  const tabs=document.getElementById('clubSocialTabs'); if(!tabs) return;
  tabs.innerHTML=rankedXClubs().map(club=>`<button class="club-social-tab ${club.team===activeXClub?'active':''}" type="button" role="tab" aria-selected="${club.team===activeXClub}" data-x-team="${escapeHTML(club.team)}">${crestHTML(club.team,'xs')}<span>${escapeHTML(club.team)}</span><small>${club.leagueRank?`Ligde ${escapeHTML(club.leagueRank)}. · `:''}@${escapeHTML(club.handle)}</small></button>`).join('');
  tabs.querySelectorAll('[data-x-team]').forEach(button=>{ button.onclick=()=>selectXClub(button.dataset.xTeam); });
}
function renderXTimelineGate(){
  const stage=document.getElementById('clubSocialStage'); const club=activeXClubConfig(); if(!stage||!club) return;
  stage.innerHTML=xTimelineGateHTML(club);
  stage.querySelector('[data-x-load]').onclick=()=>{ xFeedPermissionGranted=true; loadXClubTimeline(); };
}
function loadXWidgets(){
  if(window.twttr&&window.twttr.widgets) return Promise.resolve(window.twttr);
  if(xWidgetsPromise) return xWidgetsPromise;
  xWidgetsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://platform.x.com/widgets.js'; script.async=true; script.charset='utf-8'; script.dataset.xWidgets='true';
    script.onload=()=>window.twttr&&window.twttr.widgets?resolve(window.twttr):reject(new Error('X bileşeni hazırlanamadı.'));
    script.onerror=()=>reject(new Error('X bileşeni yüklenemedi.'));
    document.head.appendChild(script);
  });
  return xWidgetsPromise;
}
async function loadXClubTimeline(){
  const stage=document.getElementById('clubSocialStage'); const club=activeXClubConfig(); if(!stage||!club) return;
  stage.innerHTML=`<div class="club-social-loading"><span></span><strong>@${escapeHTML(club.handle)}</strong> akışı yükleniyor…</div>`;
  try{
    await loadXWidgets();
    stage.innerHTML=`<div class="club-social-timeline"><a class="twitter-timeline" data-theme="light" data-lang="tr" data-height="540" data-chrome="noheader nofooter noborders transparent" data-dnt="true" href="${escapeHTML(club.url)}">@${escapeHTML(club.handle)} resmî X paylaşımları</a></div><a class="club-social-profile-link" href="${escapeHTML(club.url)}" target="_blank" rel="noopener noreferrer">@${escapeHTML(club.handle)} hesabını X'te aç ↗</a>`;
    await window.twttr.widgets.load(stage);
  }catch(error){
    xWidgetsPromise=null;
    stage.innerHTML=`<div class="club-social-error"><strong>Akış şu anda yüklenemedi.</strong><p>Tarayıcın X bileşenini engelliyor olabilir.</p><a href="${escapeHTML(club.url)}" target="_blank" rel="noopener noreferrer">@${escapeHTML(club.handle)} hesabını X'te aç ↗</a></div>`;
  }
}
function selectXClub(team){
  if(!X_CLUBS.some(club=>club.team===team)) return;
  activeXClub=team; xClubSelectionTouched=true; renderXClubTabs();
  if(xFeedPermissionGranted) loadXClubTimeline(); else renderXTimelineGate();
}
function renderClubSocial(){
  if(!document.getElementById('clubSocialSection')) return;
  const leader=rankedXClubs()[0];
  if(!xClubSelectionTouched && leader) activeXClub=leader.team;
  renderXClubTabs();
  if(xFeedPermissionGranted) loadXClubTimeline(); else renderXTimelineGate();
}
function cardMentionsFootballTeam(card, team){
  if(team==='Tümü') return true;
  const fields=[card.team,card.related_team,card.title,card.text,card.summary,card.spot,card.body,card.content].filter(Boolean).join(' ');
  return fields.toLocaleLowerCase('tr-TR').includes(String(team).toLocaleLowerCase('tr-TR'));
}
function renderPortalSponsor(){
  const banner=document.getElementById('portalSponsorBanner'); const rail=document.getElementById('portalSponsorRail');
  const reward=Object.entries(REWARDS).flatMap(([team,items])=>(items||[]).map(item=>({team,item}))).find(entry=>entry.item&&entry.item.aciklama&&entry.item.aciklama!=='—');
  const rewardTitle=reward?escapeHTML(reward.item.aciklama):'Haftalık ödül programı güncelleniyor';
  const rewardNote=reward?`${escapeHTML(reward.team)} · ${escapeHTML(reward.item.sira)}. sıra ödülü`:'Yeni ödül duyurusu yayınlandığında burada görünecek.';
  if(banner) banner.innerHTML=`<div class="portal-sponsor-copy"><div class="portal-sponsor-label">Mythos Cards · Ödül sponsoru</div><div class="portal-sponsor-title">Futbolu takip et. Tahmin et. Yarış.</div><div class="portal-sponsor-note">Ücretsiz Predict yarışması · bahis ve para yatırma yok.</div></div><div class="portal-sponsor-action"><b>${rewardTitle}</b>${rewardNote}</div>`;
  if(rail) rail.innerHTML=`<div class="portal-rail-label">Ödül sponsoru</div><div class="portal-rail-title">${rewardTitle}</div><div class="portal-rail-note">${rewardNote}<br>Ürün satışı yapılmaz; açıklanan ödüller yarışma kazananlarına verilir.</div><div class="portal-rail-mark">MYTHOS CARDS × XYZSKOR</div>`;
}
function fmtEditorialDate(value){
  const date=new Date(value); if(!value || Number.isNaN(date.getTime())) return value ? String(value) : '';
  return date.toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'});
}
function explicitMatchState(m){
  if(m.status==='canlı') return { label:'Canlı', live:true };
  if(m.status==='devre_arasi') return { label:'Devre arası', live:true };
  if(m.status==='ertelendi') return { label:'Ertelendi', live:false };
  if(m.status==='iptal') return { label:'İptal', live:false };
  if(getResult(m.id)) return { label:'Bitti', live:false };
  return { label:new Date(m.kickoff).getTime()>Date.now() ? 'Yaklaşan' : 'Durum bekleniyor', live:false };
}
function footballQuickMatchRows(){
  const live = MATCHES.filter(m=>m.status==='canlı' || m.status==='devre_arasi');
  const upcoming = MATCHES.filter(m=>!getResult(m.id) && m.status!=='iptal' && m.status!=='ertelendi' && !live.includes(m) && new Date(m.kickoff).getTime()>Date.now())
    .sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  const completed = MATCHES.filter(m=>getResult(m.id)).sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff));
  const ordered=[...live, ...upcoming, ...completed];
  return ordered.filter(match=>activeFootballTeam==='Tümü' || match.ev===activeFootballTeam || match.konuk===activeFootballTeam).slice(0,7);
}
function renderFootballQuickMatches(){
  const area = document.getElementById('footballQuickMatches'); if(!area) return;
  if(DATA_ERRORS.matches){ area.innerHTML=footballEmpty('Fikstür alınamadı','Haberler ve puan durumu gibi diğer Futbol modüllerini kullanmaya devam edebilirsin.'); return; }
  const rows = footballQuickMatchRows();
  if(!rows.length){ area.innerHTML=footballEmpty('Maç bulunmuyor','Yayınlanmış fikstür veya doğrulanmış canlı maç kaydı henüz yok.'); return; }
  const user = getCurrentUser();
  area.innerHTML = rows.map(m=>{
    const state = explicitMatchState(m); const result = getResult(m.id);
    const prediction = user && ALL_PREDICTIONS[m.id] && ALL_PREDICTIONS[m.id][user.id];
    return `<button class="football-match-row" type="button" data-football-match="${escapeHTML(m.id)}" aria-label="${escapeHTML(m.ev)} ${escapeHTML(m.konuk)} maç merkezini aç">
      <span class="football-match-time"><strong>${escapeHTML(fmtTime(m.kickoff))}</strong>${escapeHTML(new Date(m.kickoff).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}))}</span>
      <span class="football-match-teams"><span>${escapeHTML(m.ev)}</span><span>${escapeHTML(m.konuk)}</span></span>
      <span class="football-match-meta">${result ? `<span class="football-score">${escapeHTML(result.home)}–${escapeHTML(result.away)}</span>` : ''}<span class="football-state ${state.live?'live':''}">${escapeHTML(state.label)}</span>${prediction?'<span class="prediction-indicator">Tahminin var</span>':''}</span>
    </button>`;
  }).join('');
  area.querySelectorAll('[data-football-match]').forEach(button=>{ button.onclick=()=>openMatchCenter(button.dataset.footballMatch); });
}
function storyConfidence(card){
  const raw = String(card.confidence_level || card.confidence || '').toLocaleLowerCase('tr-TR').replaceAll('ı','i').replaceAll('ü','u').replaceAll('ş','s').replaceAll('ğ','g').replaceAll('ç','c').replaceAll('ö','o');
  if(['official','resmi'].includes(raw)) return { label:'Resmî', tone:'official', explanation:'Doğrulanmış resmî kurum veya kulüp kaynağına dayanan yayın.' };
  if(['strong','guclu','guclu iddia'].includes(raw)) return { label:'Güçlü İddia', tone:'strong', explanation:'Birden fazla güvenilir kayıtla desteklenen, henüz resmîleşmemiş gelişme.' };
  if(['rumour','rumor','soylenti'].includes(raw)) return { label:'Söylenti', tone:'rumour', explanation:'Tek kaynaklı veya bağımsız ikinci doğrulaması bulunmayan gelişme; kesinleşmiş değildir.' };
  if(['data','data analysis','veri analizi'].includes(raw)) return { label:'Veri Analizi', tone:'strong', explanation:'Yayınlanmış ve doğrulanabilir futbol verilerinden üretilen analiz.' };
  if(['conflicting','celiskili'].includes(raw)) return { label:'Çelişkili', tone:'conflicting', explanation:'Kaynaklar arasında önemli uyuşmazlık var; bilgiler kesinleşmiş kabul edilmemeli.' };
  if(['developing','gelisiyor'].includes(raw)) return { label:'Gelişiyor', tone:'developing', explanation:'Doğrulama süreci devam eden gelişme; yeni bilgilerle değişebilir.' };
  return null;
}
function safeExternalURL(value){
  try{ const url=new URL(String(value||'')); return ['https:','http:'].includes(url.protocol) ? url.href : null; }catch(_error){ return null; }
}
function newsSources(card){
  const rows=Array.isArray(card.sources)?card.sources:[]; const fallback=card.source? [{name:card.source,url:card.source_url||card.url}]:[];
  return [...rows,...fallback].map(source=>typeof source==='string'?{name:source,url:null}:{name:source.name||source.title||source.domain||'Kaynak',url:safeExternalURL(source.url||source.href)}).filter(source=>source.name);
}
let newsReturnFocus=null;
function closeNewsDetail(){
  const overlay=document.getElementById('newsOverlay'); overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open');
  if(newsReturnFocus && newsReturnFocus.focus) newsReturnFocus.focus();
}
function openNewsDetail(index){
  const story=WEEKLY_STORIES[activeWeek]; const cards=publishedStoryCards(); const card=cards[index]; if(!story || !story.is_published || !card) return;
  newsReturnFocus=document.activeElement; const confidence=storyConfidence(card); const sources=newsSources(card); const related=MATCHES.find(match=>match.id===card.related_match_id);
  const updates=Array.isArray(card.updates)?card.updates:[]; const body=card.body||card.content||card.text||''; const spot=card.spot||card.summary||'';
  const metadata=[['Kategori',card.category||card.type],['İlk görülme',card.first_seen_at?fmtEditorialDate(card.first_seen_at):''],['Son güncelleme',fmtEditorialDate(card.updated_at||card.verified_at||story.updated_at||story.published_at)],['Editör',card.editor||card.editor_name],['İlgili takım',card.team||card.related_team],['İlgili oyuncu',card.player||card.related_player]].filter(item=>item[1]);
  document.getElementById('newsDetailBody').innerHTML=`<div class="news-detail-kicker">${escapeHTML(card.category||card.type||'Futbol')}</div><h1 class="news-detail-title" id="newsDetailTitle">${escapeHTML(card.title||'Başlıksız gelişme')}</h1>${spot?`<p class="news-detail-spot">${escapeHTML(spot)}</p>`:''}${confidence?`<section class="news-trust ${confidence.tone}" aria-label="Haber güven seviyesi"><b>${escapeHTML(confidence.label)}</b><p>${escapeHTML(confidence.explanation)}</p></section>`:'<p class="account-empty" style="margin:18px 0;">Bu kayıtta doğrulanmış güven seviyesi yayınlanmamış.</p>'}${body?`<div class="news-copy">${escapeHTML(body)}</div>`:'<p class="account-empty">Haber metni bu kayıtta yayınlanmamış.</p>'}${metadata.length?`<div class="news-meta-grid">${metadata.map(item=>`<div class="news-meta-item"><span>${escapeHTML(item[0])}</span><b>${escapeHTML(item[1])}</b></div>`).join('')}</div>`:''}<section class="news-sources"><h2 class="account-section-title">Kaynaklar</h2>${sources.length?`<div class="news-source-list">${sources.map(source=>`<div class="news-source"><span>${escapeHTML(source.name)}</span>${source.url?`<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a>`:'<span>URL yayınlanmadı</span>'}</div>`).join('')}</div>`:'<p class="account-empty">Kaynak listesi bu kayıtta yayınlanmamış.</p>'}</section><section class="news-updates"><h2 class="account-section-title">Kronolojik güncellemeler</h2>${updates.length?`<div class="news-update-list">${updates.map(update=>`<div class="news-update">${update.at||update.created_at?`<time>${escapeHTML(fmtEditorialDate(update.at||update.created_at))}</time>`:''}${escapeHTML(update.text||update.content||'')}</div>`).join('')}</div>`:'<p class="account-empty">Bu haber için ayrı güncelleme kaydı bulunmuyor.</p>'}</section>${card.correction?`<section class="news-updates"><h2 class="account-section-title">Düzeltme</h2><div class="news-update">${escapeHTML(card.correction)}</div></section>`:''}<div class="news-detail-actions">${related?`<button class="btn ghost" type="button" id="newsRelatedMatch">İlgili maça git</button>`:''}<button class="btn ghost" type="button" id="newsShare">Paylaş</button><span class="predict-save-status" id="newsShareStatus" aria-live="polite"></span></div>`;
  const overlay=document.getElementById('newsOverlay'); overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); document.getElementById('newsDetailClose').focus();
  if(related) document.getElementById('newsRelatedMatch').onclick=()=>{ closeNewsDetail(); openMatchCenter(related.id); };
  document.getElementById('newsShare').onclick=async()=>{ const text=card.title||'XYZSKOR haberi'; try{ if(navigator.share) await navigator.share({title:text,text}); else await navigator.clipboard.writeText(text); document.getElementById('newsShareStatus').textContent=navigator.share?'Paylaşım açıldı.':'Başlık kopyalandı.'; }catch(error){ if(error.name!=='AbortError') document.getElementById('newsShareStatus').textContent='Paylaşım başlatılamadı.'; } };
}
document.getElementById('newsDetailClose').onclick=closeNewsDetail;
document.getElementById('newsOverlay').addEventListener('click',event=>{ if(event.target.id==='newsOverlay') closeNewsDetail(); });
document.getElementById('newsOverlay').addEventListener('keydown',event=>{
  if(event.key==='Escape'){ closeNewsDetail(); return; } if(event.key!=='Tab') return;
  const focusable=[...event.currentTarget.querySelectorAll('button:not([disabled]),a[href]')].filter(el=>el.offsetParent!==null); if(!focusable.length) return;
  const first=focusable[0],last=focusable[focusable.length-1]; if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
function publishedStoryCards(){
  const story = WEEKLY_STORIES[activeWeek];
  if(!story || !story.is_published || !Array.isArray(story.cards)) return [];
  return story.cards.filter(card=>card && !/tahmin|kupon|oran|bahis/i.test(`${card.title||''} ${card.text||''}`) && cardMentionsFootballTeam(card,activeFootballTeam));
}
function storyIdentityHTML(card){
  const name=card.author||card.author_name||card.editor||card.source||''; const entity=card.player||card.related_player||card.team||card.related_team||''; const time=card.updated_at||card.verified_at||card.published_at||'';
  if(!name && !entity && !time) return '';
  const image=safeExternalURL(card.author_image||card.avatar_url||card.player_image); const initials=String(name||entity||'X').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toLocaleUpperCase('tr-TR');
  return `<div class="football-news-identity"><span class="football-news-avatar">${image?`<img src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:escapeHTML(initials)}</span><span class="football-news-byline"><b>${escapeHTML(name||entity)}</b><span>${entity&&entity!==name?escapeHTML(entity):''}${entity&&time?' · ':''}${time?escapeHTML(fmtEditorialDate(time)):''}</span></span></div>`;
}
function renderFootballFeatured(){
  const area=document.getElementById('footballFeaturedDevelopment'); if(!area) return;
  if(DATA_ERRORS.weekly_stories){ area.innerHTML=footballEmpty('Öne çıkan gelişme alınamadı','Maç ve puan durumu modülleri bağımsız olarak kullanılabilir.'); return; }
  const story=WEEKLY_STORIES[activeWeek];
  if(!story || !story.is_published){ area.innerHTML=footballEmpty('Öne çıkan gelişme yok',`${activeWeek}. hafta için yayınlanmış editoryal içerik bulunmuyor.`); return; }
  const source = story.source ? `Kaynak: ${escapeHTML(story.source)}` : '';
  const checked = story.verified_at || story.published_at || story.updated_at;
  area.innerHTML=`<div class="football-module-kicker">Haftanın Manşeti · ${escapeHTML(activeWeek)}. Hafta</div><h2>${escapeHTML(story.title || (activeWeek+'. Hafta'))}</h2>${story.intro?`<p>${escapeHTML(story.intro)}</p>`:''}${source || checked?`<div class="featured-source">${source}${source&&checked?' · ':''}${checked?escapeHTML(fmtEditorialDate(checked)):''}</div>`:''}<div class="headline-actions"><button type="button" onclick="scrollFootballSection('footballNewsSection',document.querySelectorAll('.football-context-tab')[1])">Gündemi takip et ↓</button></div>`;
}
function renderFootballNews(){
  const area=document.getElementById('footballNewsStream'); if(!area) return;
  if(DATA_ERRORS.weekly_stories){ area.innerHTML=footballEmpty('Gelişmeler alınamadı','Bu modüldeki hata maç listesini ve puan durumunu etkilemez.'); return; }
  const cards=publishedStoryCards().map((card,index)=>({card,index})).filter(entry=>!['transfer','transfer_development'].includes(String(entry.card.category || entry.card.type || '').toLocaleLowerCase('tr-TR')));
  if(!cards.length){ area.innerHTML=footballEmpty('Yayınlanmış gelişme yok','Kaynağı ve yayın durumu doğrulanmış içerik eklendiğinde burada görünecek.'); return; }
  area.innerHTML=`<div class="football-news-list">${cards.slice(0,5).map(({card,index})=>{
    const confidence=storyConfidence(card); const related=MATCHES.some(m=>m.id===card.related_match_id);
    return `<article class="football-news-card" tabindex="0" role="button" data-news-index="${index}" aria-label="${escapeHTML(card.title||'Haber')} haberini aç">${storyIdentityHTML(card)}<h3>${escapeHTML(card.title || 'Başlıksız gelişme')}</h3>${card.text?`<p>${escapeHTML(card.text)}</p>`:''}<div class="football-news-meta">${confidence?`<span class="confidence-chip ${confidence.tone}">${confidence.label}</span>`:''}${card.source?`<span>Kaynak: ${escapeHTML(card.source)}</span>`:''}${card.verified_at?`<span>${escapeHTML(fmtEditorialDate(card.verified_at))}</span>`:''}${related?`<button class="football-module-action" type="button" data-news-match="${escapeHTML(card.related_match_id)}">Maça bak →</button>`:''}</div></article>`;
  }).join('')}</div>`;
  area.querySelectorAll('[data-news-index]').forEach(article=>{ article.onclick=event=>{ if(!event.target.closest('[data-news-match]')) openNewsDetail(Number(article.dataset.newsIndex)); }; article.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){event.preventDefault();openNewsDetail(Number(article.dataset.newsIndex));} }; });
  area.querySelectorAll('[data-news-match]').forEach(button=>{ button.onclick=()=>openMatchCenter(button.dataset.newsMatch); });
}
function renderFootballTransfers(){
  const area=document.getElementById('footballTransferStream'); if(!area) return;
  if(DATA_ERRORS.weekly_stories){ area.innerHTML=footballEmpty('Transfer akışı alınamadı','Doğrulanmamış veya yerel örnek içerik gösterilmiyor.'); return; }
  const transfers=publishedStoryCards().map((card,index)=>({card,index})).filter(entry=>['transfer','transfer_development'].includes(String(entry.card.category || entry.card.type || '').toLocaleLowerCase('tr-TR')));
  if(!transfers.length){ area.innerHTML=footballEmpty('Doğrulanmış transfer gelişmesi yok','Kaynak ve durum bilgisi olan bir kayıt yayımlandığında bu alan güncellenecek.'); return; }
  area.innerHTML=`<div class="football-news-list">${transfers.slice(0,4).map(({card,index})=>{ const confidence=storyConfidence(card); return `<article class="football-news-card" tabindex="0" role="button" data-news-index="${index}" aria-label="${escapeHTML(card.title||'Transfer haberi')} haberini aç">${storyIdentityHTML(card)}<h3>${escapeHTML(card.title || 'Transfer gelişmesi')}</h3>${card.text?`<p>${escapeHTML(card.text)}</p>`:''}<div class="football-news-meta">${confidence?`<span class="confidence-chip ${confidence.tone}">${confidence.label}</span>`:''}${card.source?`<span>Kaynak: ${escapeHTML(card.source)}</span>`:''}${card.verified_at?`<span>${escapeHTML(fmtEditorialDate(card.verified_at))}</span>`:''}</div></article>`; }).join('')}</div>`;
  area.querySelectorAll('[data-news-index]').forEach(article=>{ article.onclick=()=>openNewsDetail(Number(article.dataset.newsIndex)); article.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){event.preventDefault();openNewsDetail(Number(article.dataset.newsIndex));} }; });
}
function renderFootballStandingsCompact(){
  const area=document.getElementById('footballStandingsCompact'); if(!area) return;
  if(DATA_ERRORS.league_standings){ area.innerHTML=footballEmpty('Puan durumu alınamadı','Diğer Futbol içerikleri kullanılabilir.'); return; }
  if(!STANDINGS.length){ area.innerHTML=footballEmpty('Puan durumu yok','Sağlayıcıdan yayınlanmış tablo henüz bulunmuyor.'); return; }
  const rows=[...STANDINGS].sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity)).slice(0,5);
  area.innerHTML=`<div class="standing-compact"><div class="standing-compact-header"><span>#</span><span>Takım</span><span>O</span><span>P</span></div>${rows.map((row,index)=>`<div class="standing-compact-row"><span>${index+1}</span><span class="standing-compact-team">${escapeHTML(row.team)}</span><span>${row.played==null?'—':escapeHTML(row.played)}</span><b>${row.points==null?'—':escapeHTML(row.points)}</b></div>`).join('')}</div>`;
}
function renderFootballHome(){ renderPortalSponsor(); renderFootballTeamStrip(); renderFootballQuickMatches(); renderFootballFeatured(); renderFootballNews(); renderFootballTransfers(); renderFootballStandingsCompact(); renderClubSocial(); }
function scrollToLiveCenter(){ const target=document.getElementById('page-live'); if(target) target.scrollIntoView({behavior:'smooth',block:'start'}); }
function renderStory(){
  renderWeekSelector();
  renderWeeklyStory();
  renderFootballHome();
  const ms = weekMatches(activeWeek);
  document.getElementById('storyFeaturedArea').innerHTML='';
  if(!ms.length){ document.getElementById('storyMatchList').innerHTML=DATA_ERRORS.matches?'<p class="section-desc">Fikstür verisi şu anda alınamıyor.</p>':'<p class="section-desc">Henüz fikstür eklenmedi.</p>'; renderVideo(); renderFeaturedStats(); renderAsideNextMatch(); renderAsideStandings(); renderPrevWeekSummary(); return; }
  const groups = groupByDate(ms);
  const entries = Object.entries(groups);
  document.getElementById('storyMatchList').innerHTML = entries.map(([date, group]) => `
    <div class="date-heading">${date}</div>
    ${group.map(m => matchRowHTML(m)).join('')}
  `).join('');
  renderVideo();
  renderFeaturedStats();
  renderAsideNextMatch();
  renderAsideStandings();
  renderPrevWeekSummary();
}
function renderPrevWeekSummary(){
  const el = document.getElementById('prevWeekSection'); if(!el) return;
  const weeks = getAvailableWeeks();
  const prevW = activeWeek - 1;
  if(!weeks.includes(prevW)){ el.innerHTML = ''; return; }
  const prevMs = weekMatches(prevW);
  const withResult = prevMs.filter(m=>getResult(m.id));
  if(!prevMs.length || withResult.length < prevMs.length){ el.innerHTML = ''; return; }
  el.innerHTML = `<div class="panel">
    <div class="section-title">${prevW}. Haftanın Özeti</div>
    <div class="section-desc" style="margin-bottom:0;">${prevMs.length} maçın tamamı tamamlandı. <button class="btn ghost" style="font-size:13px;padding:6px 10px;" onclick="goToWeek(${prevW})">${prevW}. haftaya bak →</button></div>
  </div>`;
}
function renderWeeklyStory(){
  const area = document.getElementById('weeklyStoryArea'); if(!area) return;
  const story = WEEKLY_STORIES[activeWeek];
  if(!story || !story.is_published){
    area.innerHTML = `<div class="intro-card"><div class="t">${activeWeek}. Hafta</div><div class="d">Bu haftanın editoryal özeti henüz eklenmedi.</div></div>`;
    return;
  }
  const cards = Array.isArray(story.cards) ? story.cards.filter(c=>!/tahmin|kupon|oran|bahis/i.test(`${c.title||''} ${c.text||''}`)) : [];
  const watch = Array.isArray(story.watch_for) ? story.watch_for.filter(w=>!/tahmin|kupon|oran|bahis/i.test(String(w))) : [];
  area.innerHTML = `
    <div class="intro-card">
      <div class="t">${escapeHTML(story.title || (activeWeek+'. Hafta'))}</div>
      ${story.intro ? `<div class="d">${escapeHTML(story.intro)}</div>` : ''}
    </div>
    ${cards.length ? `<div class="story-cards-grid">${cards.slice(0,5).map(c => `
      <div class="story-card">
        <div class="story-card-title">${escapeHTML(c.title||'')}</div>
        <div class="story-card-text">${escapeHTML(c.text||'')}</div>
        ${MATCHES.some(m=>m.id===c.related_match_id) ? `<button class="btn ghost" type="button" style="font-size:13px;padding:8px 10px;" data-story-match="${escapeHTML(c.related_match_id)}">Maça bak →</button>` : ''}
        ${c.source ? `<div class="source-line">Kaynak: ${escapeHTML(c.source)}${c.verified_at ? ' · '+escapeHTML(c.verified_at) : ''}</div>` : ''}
      </div>`).join('')}</div>` : ''}
    ${watch.length ? `<div class="panel"><div class="section-title">Bu Hafta Dikkat Et</div><ul class="watch-list">${watch.slice(0,5).map(w=>`<li>${escapeHTML(w)}</li>`).join('')}</ul></div>` : ''}
  `;
  area.querySelectorAll('[data-story-match]').forEach(button=>{ button.onclick=()=>openMatchCenter(button.dataset.storyMatch); });
}

/* ===================== HAFTANIN VİDEOSU ===================== */
let videoStarted = false;
let videoObserver = null;
function renderVideo(){
  const section = document.getElementById('videoSection'); if(!section) return;
  if(!VIDEO_CONFIG.src){
    section.innerHTML = `<div class="mini-status-line">Bu hafta için video henüz eklenmedi.</div>`;
    return;
  }
  section.innerHTML = `<div class="panel">
    <div class="section-title">Haftanın Videosu</div>
    <div class="video-frame" id="videoFrame">
      ${VIDEO_CONFIG.poster ? `<img class="poster-img" id="videoPoster" src="${VIDEO_CONFIG.poster}" alt="${VIDEO_CONFIG.title||'Video görseli'}" loading="lazy">` : ''}
      <video id="storyVideo" playsinline preload="none" ${VIDEO_CONFIG.poster ? `poster="${VIDEO_CONFIG.poster}"` : ''} controls style="display:none;">
        <source src="${VIDEO_CONFIG.src}">
      </video>
      <button class="video-play-btn" id="videoPlayBtn" aria-label="Videoyu oynat: ${VIDEO_CONFIG.title||'Haftanın Videosu'}">
        <span class="circle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z"/></svg></span>
      </button>
      <button class="video-mini-close" id="videoMiniClose" style="display:none;" aria-label="Mini oynatıcıyı kapat">✕</button>
    </div>
    <div class="video-meta-row">
      <div>
        <div style="font-family:var(--font-display);font-weight:600;font-size:15px;">${VIDEO_CONFIG.title||'Haftanın Videosu'}</div>
        ${VIDEO_CONFIG.description ? `<div style="font-size:13px;color:var(--ink-dim);margin-top:2px;">${VIDEO_CONFIG.description}</div>` : ''}
      </div>
      ${VIDEO_CONFIG.duration ? `<div class="video-duration mono">${VIDEO_CONFIG.duration}</div>` : ''}
    </div>
    ${VIDEO_CONFIG.source ? `<div class="video-sponsor-note">Kaynak: ${VIDEO_CONFIG.source}</div>` : ''}
  </div>`;
  const playBtn = document.getElementById('videoPlayBtn');
  const video = document.getElementById('storyVideo');
  const poster = document.getElementById('videoPoster');
  playBtn.onclick = () => {
    playBtn.style.display = 'none';
    if(poster) poster.style.display = 'none';
    video.style.display = 'block';
    video.play();
    videoStarted = true;
    setupVideoMiniPlayer();
  };
}
function setupVideoMiniPlayer(){
  const frame = document.getElementById('videoFrame'); const video = document.getElementById('storyVideo');
  const closeBtn = document.getElementById('videoMiniClose');
  if(!frame || !video || videoObserver) return;
  videoObserver = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!videoStarted || video.paused) return;
      if(!entry.isIntersecting){ frame.classList.add('mini'); closeBtn.style.display='flex'; }
      else { frame.classList.remove('mini'); closeBtn.style.display='none'; }
    });
  }, {threshold:0.05});
  videoObserver.observe(frame);
  closeBtn.onclick = () => { video.pause(); frame.classList.remove('mini'); closeBtn.style.display='none'; if(videoObserver){ videoObserver.disconnect(); videoObserver=null; } };
}

/* ===================== ÖNE ÇIKAN VERİLER (gerçek veriden) ===================== */
function renderFeaturedStats(){
  const area = document.getElementById('storyStatsArea'); if(!area) return;
  const ms = weekMatches(activeWeek);
  const toplamMac = ms.length;
  const dogrulanan = ms.filter(m=>m.verified).length;
  const katilimci = Object.keys(PROFILES).length;
  const matematikHazir = ms.filter(m=>matchMathMetrics(m)).length;
  area.innerHTML = `
    <div class="pstat"><div class="n">${toplamMac}</div><div class="l">Bu Hafta Maç</div></div>
    <div class="pstat"><div class="n">${dogrulanan}/${toplamMac}</div><div class="l">Doğrulanmış Fikstür</div></div>
    <div class="pstat"><div class="n">${katilimci}</div><div class="l">Kayıtlı Kullanıcı</div></div>
    <div class="pstat"><div class="n">${matematikHazir}/${toplamMac}</div><div class="l">Matematik Modeli Hazır</div></div>
  `;
}

/* ===================== SIDEBAR: SIRADAKİ MAÇ ===================== */
function renderAsideNextMatch(){
  const area = document.getElementById('asideNextMatch'); if(!area) return;
  const now = Date.now();
  const weekUpcoming = weekMatches(activeWeek).filter(m => new Date(m.kickoff).getTime() > now).sort((a,b)=> new Date(a.kickoff)-new Date(b.kickoff))[0];
  const m = weekUpcoming || nextUpcomingMatch();
  if(!m){
    const st = weekStatus(activeWeek);
    if(st.key==='completed'){
      area.innerHTML = `<div class="aside-title">Sıradaki Maç</div><p style="font-size:14px;color:var(--ink-dim);margin:0 0 10px;">Bu hafta tamamlandı.</p><button class="btn ghost" style="width:100%;" onclick="switchMainTab('story');document.getElementById('storyMatchList').scrollIntoView({behavior:'smooth'});">Hafta sonuçlarına bak</button>`;
    } else {
      area.innerHTML = `<div class="aside-title">Sıradaki Maç</div><p style="font-size:14px;color:var(--ink-dim);margin:0;">Sezonun tüm maçları tamamlandı.</p>`;
    }
    return;
  }
  area.innerHTML = `
    <div class="aside-title">Sıradaki Maç${!weekUpcoming ? ' (gelecek hafta)' : ''}</div>
    <div class="aside-next-match">${escapeHTML(m.ev)} — ${escapeHTML(m.konuk)}</div>
    <div class="aside-next-time mono">${escapeHTML(fmtKickoff(m.kickoff))}</div>
    <div class="aside-facts">${escapeHTML(m.stadyum)}${m.verified ? ' · Doğrulandı' : ''}</div>
    <button class="btn ghost" style="width:100%;margin-top:10px;" onclick="openMatchCenter('${m.id}')">Maç Merkezi →</button>
  `;
}

/* ===================== TAHMİN LİGİ: MATCH LIST ===================== */
let pickState = {};
function togglePredictForm(id){ const f = document.getElementById('form-'+id); if(f) f.style.display = f.style.display==='none' ? 'block' : 'none'; }
function setPick(id, val, el){
  pickState[id] = val;
  const scope = el.closest('.predict-form');
  scope.querySelectorAll('.pick-btn').forEach(button=>{ button.className='pick-btn'; button.setAttribute('aria-pressed','false'); });
  el.classList.add('sel-'+val); el.setAttribute('aria-pressed','true');
}
function setPredictionStatus(id, message, tone){
  const status=document.getElementById('saveStatus-'+id); if(!status) return;
  status.textContent=message; status.className='predict-save-status'+(tone?' '+tone:'');
}
async function submitPrediction(id){
  const u = getCurrentUser(); if(!u) return;
  const button=document.getElementById('savePrediction-'+id);
  const pick = pickState[id]; if(!pick){ setPredictionStatus(id,'Önce 1 / X / 2 seç.','error'); return; }
  const sh = document.getElementById('sh-'+id).value; const sa = document.getElementById('sa-'+id).value;
  if((sh==='') !== (sa==='')){ setPredictionStatus(id,'Kesin skor için iki takımın skorunu da gir.','error'); return; }
  const scoreHome = sh==='' ? null : Number(sh); const scoreAway = sa==='' ? null : Number(sa);
  if(button){ button.disabled=true; button.textContent='Kaydediliyor…'; }
  setPredictionStatus(id,'Tahminin kaydediliyor…','');
  try{
    const res = await savePrediction(id, {pick, scoreHome, scoreAway});
    if(!res.ok){ setPredictionStatus(id,'Kaydetme başarısız: '+(res.err||'Tekrar dene.'),'error'); if(button){button.disabled=false;button.textContent='Kaydet';} return; }
    renderProgress(); renderLeagueMatches();
    setTimeout(()=>{ const flag = document.getElementById('flag-'+id); if(flag) flag.classList.add('pop'); }, 30);
  }catch(error){
    setPredictionStatus(id,'Kaydetme başarısız. Bağlantını kontrol edip tekrar dene.','error');
    if(button){ button.disabled=false; button.textContent='Kaydet'; }
  }
}
function teamMathRow(team, homeAdvantage){
  const r = STANDINGS.find(x=>x.team===team);
  if(!r || !Number(r.played)) return null;
  const played = Number(r.played), ppg = Number(r.points||0)/played;
  const gdpg = Number(r.goal_difference||0)/played;
  const gfpg = Number(r.goals_for||0)/played;
  const gapg = Math.max(0, gfpg-gdpg);
  const power = Math.max(0,Math.min(100,50+(ppg-1.5)*16+gdpg*9+(homeAdvantage?3:0)));
  return {played,ppg,gdpg,gfpg,gapg,power};
}
function matchMathMetrics(m){
  const h=teamMathRow(m.ev,true), a=teamMathRow(m.konuk,false);
  if(!h || !a) return null;
  const draw=Math.max(18,Math.min(30,28-Math.abs(h.power-a.power)*.18));
  const homeShare=1/(1+Math.exp(-(h.power-a.power)/11));
  const home=(100-draw)*homeShare, away=100-draw-home;
  const xgHome=Math.max(.15,(h.gfpg+a.gapg)/2+.15), xgAway=Math.max(.15,(a.gfpg+h.gapg)/2);
  return {home,draw,away,xgHome,xgAway,powerHome:h.power,powerAway:a.power,sample:Math.min(h.played,a.played)};
}
function predictionActionHTML(m){
  const locked=isLocked(m.kickoff), u=getCurrentUser(), pred=u?getPrediction(m.id,u.id):null;
  if(m.status==='iptal') return `<div class="prediction-zone"><div class="locked-flag">Bu maç iptal edildi.</div></div>`;
  if(m.status==='ertelendi') return `<div class="prediction-zone"><div class="locked-flag">Maç ertelendi; yeni tarih açıklanınca tahmin yeniden açılacak.</div></div>`;
  if(locked) return `<div class="prediction-zone"><div class="locked-flag">Tahmin kilitlendi. Maç başladıktan sonra değiştirilemez.</div></div>`;
  if(pred) return `<div class="prediction-zone"><div class="prediction-label">Kaydedildi</div><div class="submitted-flag" id="flag-${escapeHTML(m.id)}"><span>${escapeHTML(pred.pick)}${pred.scoreHome!=null?` · ${escapeHTML(pred.scoreHome)}–${escapeHTML(pred.scoreAway)}`:''}</span><span class="mono">✓</span></div></div>`;
  if(!u) return `<div class="prediction-zone"><div class="prediction-label">Giriş yaptığında 1 / X / 2 seçimleri burada açılır.</div></div>`;
  return `<div class="prediction-zone"><div class="prediction-label">Maç sonucu</div><div class="predict-form" id="form-${escapeHTML(m.id)}"><div class="pick-row"><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','1',this)">1 · ${escapeHTML(m.ev)}</button><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','X',this)">X · Berabere</button><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','2',this)">2 · ${escapeHTML(m.konuk)}</button></div><div class="mini-note">Kesin skor isteğe bağlıdır.</div><div class="score-row"><span class="mono" style="font-size:12px;color:var(--ink-dim);">Kesin skor</span><input type="number" min="0" max="99" id="sh-${escapeHTML(m.id)}" inputmode="numeric" placeholder="0" aria-label="${escapeHTML(m.ev)} gol sayısı"><span class="mono">—</span><input type="number" min="0" max="99" id="sa-${escapeHTML(m.id)}" inputmode="numeric" placeholder="0" aria-label="${escapeHTML(m.konuk)} gol sayısı"><button class="btn" type="button" id="savePrediction-${escapeHTML(m.id)}" onclick="submitPrediction('${m.id}')">Kaydet</button></div><div class="predict-save-status" id="saveStatus-${escapeHTML(m.id)}" role="status" aria-live="polite"></div></div></div>`;
}
function leagueRowHTML(m){
  const mm=matchMathMetrics(m);
  const deadline=new Date(new Date(m.kickoff).getTime()-15*60000);
  const dataDetails=mm?`<details class="predict-data-details"><summary>Maç önü verisini gör</summary><div style="margin-top:8px;line-height:1.6;">Güç: ${escapeHTML(m.ev)} ${mm.powerHome.toFixed(1)} · ${escapeHTML(m.konuk)} ${mm.powerAway.toFixed(1)}<br>Beklenen gol: ${mm.xgHome.toFixed(2)}–${mm.xgAway.toFixed(2)} · Örneklem: ${mm.sample} maç</div></details>`:'';
  return `
    <article class="predict-match" id="lcard-${escapeHTML(m.id)}">
      <div class="predict-fixture"><div class="predict-kickoff">${escapeHTML(fmtTime(m.kickoff))}<span>${escapeHTML(new Date(m.kickoff).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}))}</span></div><div class="predict-teams"><div class="predict-team">${crestHTML(m.ev,'xs')}<span>${escapeHTML(m.ev)}</span></div><div class="predict-team">${crestHTML(m.konuk,'xs')}<span>${escapeHTML(m.konuk)}</span></div></div><div class="predict-lock">${isLocked(m.kickoff)?'Kilitli':`Kapanış ${deadline.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`}</div></div>
      <div class="predict-action">${predictionActionHTML(m)}</div>${dataDetails}
      <div class="predict-match-footer"><button class="football-module-action" type="button" onclick="openMatchCenter('${m.id}')">Maç detayını aç →</button></div>
    </article>`;
}
function renderLeagueMatches(){
  const ms0 = weekMatches(activeWeek);
  if(!ms0.length){ document.getElementById('leagueMatchList').innerHTML = '<p class="section-desc">Bu hafta için fikstür henüz eklenmedi.</p>'; }
  else{
    const groups = groupByDate(ms0);
    document.getElementById('leagueMatchList').innerHTML = Object.entries(groups).map(([date, ms]) => `
      <div class="predict-date-group">${escapeHTML(date)}</div>
      ${ms.map(m => leagueRowHTML(m)).join('')}
    `).join('');
  }
  const sel = document.getElementById('adminMatchSelect');
  if(sel) sel.innerHTML = MATCHES.map(m=>`<option value="${m.id}">${m.ev} — ${m.konuk} (${m.hafta}. Hafta)</option>`).join('');
}

/* ===================== TEAM BANNER + PROGRESS ===================== */
function renderTeamBanner(){
  const u = getCurrentUser(); const area = document.getElementById('teamBannerArea');
  if(!u || !u.team){ area.innerHTML=''; return; }
  const rows = sortRows(leaderboardFor(u.team, activeWeek), 'week');
  const rank = rows.findIndex(r=>r.uid===u.id) + 1;
  area.innerHTML = `
    <div class="team-banner" style="background:${crestColor(u.team)};">
      ${crestHTML(u.team,'xl')}
      <div class="team-banner-copy"><div class="eyebrow mono">${u.team.toUpperCase()} TARAFTAR LİGİ</div>
      <div class="msg">Bu hafta ${u.team} taraftarlarıyla yarış, ilk 3'e gir, takımına özel ödülleri kazan.</div>
      <div class="stats-line">Şu anki sıran: <b>${rank || '—'}</b> / ${rows.length} kişi</div></div>
    </div>`;
}
function renderProgress(){
  const u = getCurrentUser(); const panel = document.getElementById('progressPanel');
  const matches=weekMatches(activeWeek);
  const deadlineRows=matches.filter(match=>match.status!=='iptal'&&match.status!=='ertelendi').map(match=>new Date(new Date(match.kickoff).getTime()-15*60000)).filter(date=>!Number.isNaN(date.getTime())).sort((a,b)=>a-b);
  const deadline=deadlineRows[0] || null;
  const stats=u&&u.id?userStatsForWeek(u.id,activeWeek):null;
  const life=u&&u.id?lifetimeStats(u.id):null;
  const generalRows=u&&u.id?sortRows(leaderboardFor('Genel',activeWeek),'season'):[];
  const generalRank=u&&u.id?generalRows.findIndex(row=>row.uid===u.id)+1:0;
  const missing=stats?Math.max(0,stats.toplamMac-stats.tahminSayisi):null;
  const rewardRows=u&&u.team&&REWARDS[u.team]?REWARDS[u.team]:[];
  const teamReward=rewardRows.find(item=>item&&item.aciklama&&item.aciklama!=='—');
  const fallbackReward=Object.entries(REWARDS).flatMap(([team,items])=>(items||[]).map(item=>({team,item}))).find(entry=>entry.item&&entry.item.aciklama&&entry.item.aciklama!=='—');
  const reward=teamReward?{team:u.team,item:teamReward}:fallbackReward;
  const completion=stats&&stats.toplamMac?Math.round((stats.tahminSayisi/stats.toplamMac)*100):0;
  const progressText=stats ? (stats.toplamMac ? (missing?`${stats.toplamMac} maçın ${stats.tahminSayisi} tanesini tamamladın. ${missing} tahminin kaldı.`:`${stats.toplamMac} maçın tamamı için tahmin yaptın.`) : 'Bu hafta için fikstür henüz eklenmedi.') : `${matches.length} maçlık haftalık yarışma. İlerlemeni görmek için giriş yap.`;
  panel.style.display='block';
  panel.innerHTML=`<div class="predict-overview-head"><div><div class="predict-overview-kicker">${activeWeek}. Hafta</div><div class="predict-overview-title">Haftalık Predict</div><div class="predict-overview-copy">Ücretsiz futbol tahmin yarışması · para yatırma ve bahis yok.</div></div><div class="predict-deadline"><b>${deadline?deadline.toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</b><span>İlk tahmin kapanışı</span></div></div><div class="predict-summary-grid"><div class="predict-summary-item"><b>${stats?stats.tahminSayisi:'—'}</b><span>Tamamlanan</span></div><div class="predict-summary-item"><b>${missing==null?'—':missing}</b><span>Eksik tahmin</span></div><div class="predict-summary-item"><b>${stats?stats.toplam:'—'}</b><span>Haftalık puan</span></div><div class="predict-summary-item"><b>${life?life.toplam:'—'}</b><span>Sezon puanı</span></div><div class="predict-summary-item"><b>${generalRank||'—'}</b><span>Genel sıra</span></div><div class="predict-summary-item"><b>${reward?escapeHTML(reward.item.aciklama):'Açıklanmadı'}</b><span>${reward?escapeHTML(reward.team)+' ödülü':'Haftanın ödülü'}</span></div></div><div class="predict-progress-row"><div class="progress-track" aria-label="Haftalık tahmin ilerlemesi"><div class="progress-fill" style="width:${completion}%;"></div></div><p>${escapeHTML(progressText)}</p></div>${!u?'<div class="predict-guest-action"><p>Tahminlerini kaydetmek, puan toplamak ve sıralamaya katılmak için hesabına giriş yap.</p><button class="btn" type="button" onclick="openAuth(\'login\')">Giriş Yap</button></div>':''}`;
}

/* ===================== LİDERLİK: HAFTALIK / SEZONLUK ===================== */
let activeTab = 'Genel'; let activePeriod = 'week';
function setPeriod(p){
  activePeriod = p;
  document.getElementById('subtabWeek').classList.toggle('active', p==='week');
  document.getElementById('subtabSeason').classList.toggle('active', p==='season');
  document.getElementById('colWeekHeader').textContent = p==='week' ? 'Bu Hafta' : 'Sezon Toplamı';
  renderLeaderTable();
}
function renderLeaderTabs(){
  const tabs = ['Genel', ...TEAMS];
  document.getElementById('leaderTabs').innerHTML = tabs.map(t=>`<div class="tab ${t===activeTab?'active':''}" role="button" tabindex="0" onclick="setTab('${t}')">${t}</div>`).join('');
  renderLeaderTable();
}
function setTab(t){ activeTab = t; renderLeaderTabs(); }
function medalSVG(rank){
  const colors = {1:'#D9A94E',2:'#B9C2C8',3:'#B5763F'};
  if(!colors[rank]) return '';
  return `<svg class="medal" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="${colors[rank]}"/><circle cx="12" cy="12" r="9" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>`;
}
function renderLeaderTable(){
  const rows = sortRows(leaderboardFor(activeTab, activeWeek), activePeriod);
  const body = document.getElementById('leaderBody');
  if(!rows.length){ body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--ink-dim);">Henüz katılımcı yok.</td></tr>`; return; }
  const u = getCurrentUser();
  body.innerHTML = rows.map((r,i)=>`
    <tr class="${i===0?'rank1':''} ${u && r.uid===u.id ? 'me':''}">
      <td class="mono">${medalSVG(i+1)}${i+1}</td>
      <td>${escapeHTML(r.username)}${u && r.uid===u.id ? ' <span class="mono" style="color:var(--gold);font-size:12px;">(sen)</span>':''} <span class="mono" style="color:var(--ink-dim);font-size:12.5px;">· ${escapeHTML(r.team)}</span></td>
      <td class="num mono">${activePeriod==='week' ? r.weekPts : r.total}</td>
      <td class="num mono">${r.total}</td>
    </tr>`).join('');
}

/* ===================== PUAN DURUMU ===================== */
let activeStandingsFilter = 'genel';
function setStandingsFilter(f){ activeStandingsFilter = f; renderStandings(); }
function standingsHasHomeAway(){ return STANDINGS.some(r => (r.home_played||0)>0 || (r.away_played||0)>0); }
function standingsHasForm(){ return STANDINGS.some(r => r.form); }
function seasonNotStarted(){ return STANDINGS.length>0 && STANDINGS.every(r => (r.played||0)===0); }
function standingsStale(){ return STANDINGS.length>0 && seasonNotStarted() && Object.keys(ALL_RESULTS).length>0; }
function sortedStandings(){
  const rows = [...STANDINGS];
  const alfabetik = (a,b)=> a.team.localeCompare(b.team,'tr');
  if(activeStandingsFilter==='ic'){
    return rows.filter(r=>(r.home_played||0)>0).sort((a,b)=> (b.home_points||0)-(a.home_points||0) || alfabetik(a,b));
  }
  if(activeStandingsFilter==='dis'){
    return rows.filter(r=>(r.away_played||0)>0).sort((a,b)=> (b.away_points||0)-(a.away_points||0) || alfabetik(a,b));
  }
  if(activeStandingsFilter==='form'){
    return rows.filter(r=>r.form);
  }
  if(seasonNotStarted()) return rows.sort(alfabetik);
  return rows.sort((a,b)=> b.points-a.points || b.goal_difference-a.goal_difference || b.goals_for-a.goals_for || alfabetik(a,b));
}
function renderStandingsFilterTabs(){
  const el = document.getElementById('standingsFilterTabs'); if(!el) return;
  const opts = [{k:'genel',l:'Genel'}];
  if(standingsHasHomeAway()) opts.push({k:'ic',l:'İç Saha'}, {k:'dis',l:'Deplasman'});
  if(standingsHasForm()) opts.push({k:'form',l:'Son 5 Form'});
  if(opts.length===1){ el.innerHTML=''; return; }
  el.innerHTML = opts.map(o=>`<div class="tab ${activeStandingsFilter===o.k?'active':''}" role="button" tabindex="0" onclick="setStandingsFilter('${o.k}')">${o.l}</div>`).join('');
}
function renderStandings(){
  const body = document.getElementById('standingsBody');
  const summaryEl = document.getElementById('standingsStorySummary');
  if(!body) return;
  renderStandingsFilterTabs();
  if(standingsStale()){
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-dim);">Puan durumu güncelleniyor.</td></tr>`;
    if(summaryEl) summaryEl.textContent = '';
    return;
  }
  if(!STANDINGS.length){
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-dim);">Puan durumu verisi henüz eklenmedi.</td></tr>`;
    if(summaryEl) summaryEl.textContent = '';
    return;
  }
  const preseason = seasonNotStarted();
  const rows = sortedStandings();
  const u = getCurrentUser();
  body.innerHTML = rows.map((r,i)=>`
    <tr class="${(!preseason && i===0)?'rank1':''} ${u && r.team===u.team ? 'me':''}">
      <td class="mono">${!preseason ? medalSVG(i+1) : ''}${i+1}</td>
      <td><div class="standing-team">${crestHTML(r.team,'xs')}<span>${escapeHTML(r.team)}</span></div></td>
      <td class="num mono">${r.played}</td>
      <td class="num mono">${r.won}</td>
      <td class="num mono">${r.drawn}</td>
      <td class="num mono">${r.lost}</td>
      <td class="num mono">${r.goal_difference>0?'+':''}${r.goal_difference}</td>
      <td class="num mono" style="font-weight:700;color:var(--gold);">${r.points}</td>
    </tr>`).join('');
  if(summaryEl){
    if(preseason){
      summaryEl.textContent = 'Sezon henüz başlamadı. Tüm takımlar sezona 0 puanla başlayacak — sıralama alfabetiktir.';
    } else {
      const genel = [...STANDINGS].sort((a,b)=> b.points-a.points || b.goal_difference-a.goal_difference);
      if(genel.length>=2){
        const gap = genel[0].points - genel[1].points;
        summaryEl.textContent = gap<=2 ? `Zirvede ${genel[0].team} ile ${genel[1].team} arasında ${gap} puan var.` : `${genel[0].team} zirvede, ikinci sıraya ${gap} puan farkı var.`;
      } else summaryEl.textContent = '';
    }
  }
}
function renderAsideStandings(){
  const area = document.getElementById('asideStandings'); if(!area) return;
  if(standingsStale()){ area.innerHTML = `<div class="aside-title">Puan Durumu</div><p style="font-size:14px;color:var(--ink-dim);margin:0;">Puan durumu güncelleniyor.</p>`; return; }
  if(!STANDINGS.length){ area.innerHTML = `<div class="aside-title">Puan Durumu</div><p style="font-size:14px;color:var(--ink-dim);margin:0;">Puan durumu verisi henüz eklenmedi.</p>`; return; }
  const preseason = seasonNotStarted();
  const rows = sortedStandings().slice(0,5);
  area.innerHTML = `<div class="aside-title">Puan Durumu${preseason?' (alfabetik)':' (İlk 5)'}</div>` +
    (preseason ? `<p style="font-size:13px;color:var(--ink-dim);margin:0 0 8px;">Sezon henüz başlamadı.</p>` : '') +
    rows.map((r,i)=>`
    <div style="display:flex;justify-content:space-between;font-size:14px;padding:5px 0;border-bottom:1px solid var(--line-soft);">
      <span class="mono" style="color:var(--ink-faint);width:18px;">${i+1}</span>
      <span class="aside-standing-team">${crestHTML(r.team,'xs')}<span>${escapeHTML(r.team)}</span></span>
      <span class="mono" style="color:var(--gold);font-weight:600;">${r.points}</span>
    </div>`).join('') + `<button class="btn ghost" style="width:100%;margin-top:10px;" onclick="switchMainTab('league');switchLeagueSection('standings');">Tam tabloyu gör</button>`;
}

/* ===================== ÖDÜLLER ===================== */
let activeRewardTeam = 'Genel';
function setRewardTeam(t){ activeRewardTeam = t; renderRewards(); }
function rewardCardHTML(t, r, isFirst){
  const desc = (r.aciklama==='—' || !r.aciklama) ? '<span class="reward-pending">Ödül yakında açıklanacak</span>' : escapeHTML(r.aciklama);
  return `
    <div class="reward-card ${isFirst?'first':''}">
      ${crestHTML(t,'md').replace('class="shield md"','class="shield md reward-crest"')}
      <div class="reward-place">${r.sira}. SIRA</div>
      <div class="reward-desc">${desc}</div>
    </div>`;
}
function renderRewards(){
  const tabsEl = document.getElementById('rewardTeamTabs');
  if(tabsEl){
    const opts = ['Genel', ...TEAMS];
    tabsEl.innerHTML = opts.map(t=>`<div class="tab ${t===activeRewardTeam?'active':''}" role="button" tabindex="0" onclick="setRewardTeam('${t}')">${t}</div>`).join('');
  }
  const area = document.getElementById('rewardsArea');
  const teamsToShow = activeRewardTeam === 'Genel' ? TEAMS : [activeRewardTeam];
  area.innerHTML = teamsToShow.map(t => `
    <div style="margin-bottom:12px;">
      <div class="mono" style="font-size:13px;color:var(--ink-dim);margin-bottom:7px;">${t.toUpperCase()}</div>
      <div class="reward-grid">
        ${REWARDS[t].map((r,i) => rewardCardHTML(t, r, i===0)).join('')}
      </div>
    </div>`).join('');

  const u = getCurrentUser();
  const sectionBtn = document.getElementById('lst-admin');
  const adminPanel = document.getElementById('adminRewardPanel');
  if(!u || !u.is_admin){
    if(sectionBtn) sectionBtn.hidden = true;
    if(adminPanel){ adminPanel.classList.remove('show'); adminPanel.innerHTML=''; }
    return;
  }
  if(sectionBtn) sectionBtn.hidden = false;
  if(!adminPanel) return;
  adminPanel.innerHTML = TEAMS.map(t => `
    <div style="margin-bottom:9px;">
      <div class="mono" style="font-size:12.5px;color:var(--ink-dim);margin-bottom:5px;">${t}</div>
      ${[1,2,3].map(s => `<input style="margin-bottom:5px;" data-team="${t}" data-sira="${s}" class="rewardInput" value="${escapeHTML(REWARDS[t][s-1].aciklama)}" placeholder="${s}. sıra ödülü">`).join('')}
    </div>`).join('') + `<button class="btn" id="saveRewardsBtn">Ödülleri Kaydet</button><div class="status-msg" id="rewardStatus"></div>`;
  document.getElementById('saveRewardsBtn').onclick = async () => {
    const inputs = adminPanel.querySelectorAll('.rewardInput'); const newRewards = JSON.parse(JSON.stringify(REWARDS));
    inputs.forEach(inp => { const t = inp.dataset.team, s = parseInt(inp.dataset.sira); newRewards[t][s-1].aciklama = inp.value; });
    const ok = await saveRewardsData(newRewards);
    if(ok){ await loadAllData(); renderRewards(); }
    const st = document.getElementById('rewardStatus'); if(st){ st.textContent=ok?'Kaydedildi.':'Kaydedilemedi; yetkini ve bağlantını kontrol et.'; st.classList.add('show'); }
  };
}
document.getElementById('adminRewardToggle').onclick = () => document.getElementById('adminRewardPanel').classList.toggle('show');

/* ===================== PROFİL ===================== */
function renderProfile(){
  const u = getCurrentUser(); const panel = document.getElementById('profilePanel');
  if(!u || !u.id){ panel.style.display='none'; return; }
  const life = lifetimeStats(u.id); const weekS = userStatsForWeek(u.id, activeWeek);
  const teamRows = sortRows(leaderboardFor(u.team, activeWeek), 'season');
  const teamRank = teamRows.findIndex(r=>r.uid===u.id)+1;
  const genRows = sortRows(leaderboardFor('Genel', activeWeek), 'season');
  const genRank = genRows.findIndex(r=>r.uid===u.id)+1;
  const badges = computeBadges(u.id); const level = levelFor(life.toplam);
  panel.innerHTML = `
    <div class="profile-head">
      ${crestHTML(u.team,'md')}
      <div><h3 class="disp" style="font-size:17px;margin:0;">${escapeHTML(u.username)}</h3>
        <div class="mono" style="font-size:14px;color:var(--ink-dim);">${escapeHTML(u.team)} · Seviye ${level} <span style="opacity:.7;">(sıralamayı etkilemez)</span></div></div>
    </div>
    <div class="profile-stats">
      <div class="pstat"><div class="n">${weekS.toplam}</div><div class="l">Bu Hafta Puan</div></div>
      <div class="pstat"><div class="n">${teamRank||'—'}</div><div class="l">Takım Sıralaması</div></div>
      <div class="pstat"><div class="n">${genRank||'—'}</div><div class="l">Genel Sıralama</div></div>
      <div class="pstat"><div class="n">${life.sonuc}</div><div class="l">Doğru Tahmin</div></div>
      <div class="pstat"><div class="n">${life.kesinSkor}</div><div class="l">Kesin Skor</div></div>
      <div class="pstat"><div class="n">%${life.dogruYuzde}</div><div class="l">Başarı Yüzdesi</div></div>
      <div class="pstat"><div class="n">${life.katilimHafta}</div><div class="l">Katıldığı Hafta</div></div>
    </div>
    <div class="section-desc" style="margin-bottom:7px;">Rozetler</div>
    <div class="badge-list" style="margin-bottom:14px;">${ALL_BADGES.map(b => `<span class="badge-chip ${badges.includes(b)?'':'locked'}">${b}</span>`).join('')}</div>
    <div class="section-desc" style="margin-bottom:7px;">Takım Değiştir</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <select id="teamChangeSelect" ${u.team_changed?'disabled':''}>${TEAMS.map(t=>`<option ${t===u.team?'selected':''}>${t}</option>`).join('')}</select>
      <button class="btn ghost" id="teamChangeBtn" disabled>Değiştir (sezonda 1 kez)</button>
    </div>
    ${u.team_changed ? '<div class="mono" style="font-size:12.5px;color:var(--ink-dim);margin-top:6px;">Bu sezon için takım değişikliğini kullandın.</div>' : ''}
  `;
  panel.style.display = 'block';
  const btn = document.getElementById('teamChangeBtn');
  const teamSelect = document.getElementById('teamChangeSelect');
  if(btn && teamSelect && !u.team_changed){
    teamSelect.onchange = () => { btn.disabled = teamSelect.value===u.team; };
    btn.onclick = async () => { const newTeam = teamSelect.value; if(await changeTeam(newTeam)){ await loadAllData(); renderAll(); } };
  }
}

/* ===================== ADMIN: SONUÇ GİR ===================== */
document.getElementById('adminToggle').onclick = () => document.getElementById('adminPanel').classList.toggle('show');
document.getElementById('adminSaveBtn').onclick = async () => {
  const matchId = document.getElementById('adminMatchSelect').value;
  const homeRaw = document.getElementById('adminHome').value; const awayRaw = document.getElementById('adminAway').value;
  const home = Number(homeRaw); const away = Number(awayRaw);
  const statusEl = document.getElementById('adminStatus');
  if(homeRaw==='' || awayRaw==='' || !Number.isInteger(home) || !Number.isInteger(away) || home<0 || away<0 || home>99 || away>99){ statusEl.textContent='0 ile 99 arasında geçerli skor gir.'; statusEl.classList.add('show'); return; }
  const ok = await setResult(matchId, home, away);
  if(ok){ await loadAllData(); renderAll(); }
  const nextStatusEl = document.getElementById('adminStatus');
  nextStatusEl.textContent = ok ? 'Sonuç kaydedildi, puanlar yeniden hesaplandı.' : 'Kaydedilemedi (yetkin yok olabilir).';
  nextStatusEl.classList.add('show');
};

/* ===================== MASTER RENDER ===================== */
function renderSkeletons(){
  document.getElementById('storyFeaturedArea').innerHTML = `<div class="skeleton skeleton-hero"></div>`;
  document.getElementById('storyMatchList').innerHTML = `<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;
  const lm = document.getElementById('leagueMatchList'); if(lm) lm.innerHTML = `<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>`;
}
function showLoadError(message){
  const box = `<div class="load-error"><p>${message || 'Veriler şu anda alınamıyor.'}</p><button class="btn gold" onclick="boot()">Tekrar dene</button></div>`;
  document.getElementById('storyFeaturedArea').innerHTML = box;
  document.getElementById('storyMatchList').innerHTML = '';
  document.getElementById('navRight').innerHTML = `<button class="btn ghost" onclick="boot()">Tekrar dene</button>`;
  renderTicker();
}
function renderAll(){
  renderNav(); renderTicker(); renderStory(); renderTeamBanner(); renderProgress(); renderLeagueMatches();
  renderLeaderTabs(); renderRewards(); renderStandings();
  const u = getCurrentUser();
  if(u && u.id) renderProfile(); else document.getElementById('profilePanel').style.display='none';
  updateMobileNavActive();
  if(document.getElementById('page-story').classList.contains('active')) startLiveFeed();
}
async function boot(){
  document.getElementById('navRight').innerHTML = `<span class="mono" style="font-size:14px;color:var(--ink-dim);">Yükleniyor…</span>`;
  renderSkeletons();
  lastLoadError = null;
  try{
    await loadAllData();
    lastLoadError = null;
    const weeks = getAvailableWeeks();
    const parsed = parseHash();
    if(weeks.length){
      if(parsed && parsed.type==='week' && weeks.includes(parsed.value)) activeWeek = parsed.value;
      else activeWeek = weeks[0];
    }
    renderAll();
    if(parsed && parsed.type==='match'){ openMatchCenter(parsed.value, false); }
    else if(parsed && parsed.type==='product'){ switchMainTab(parsed.value, false); }
  }catch(e){
    console.error('[XYZSkor] boot() veri yükleme başarısız:', e);
    lastLoadError = e;
    showLoadError('Veriler şu anda alınamıyor. (' + e.message + ')');
  }
}
boot();
