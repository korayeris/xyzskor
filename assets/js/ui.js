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
let activeFootballSection='matches';
let activeTransferCenterTab='confirmed';
let activeTransferClub='all';
function footballSectionHash(section){ return ({matches:'football',news:'agenda',clubs:'clubs',transfers:'transfers',standings:'standings'})[section] || 'football'; }
function openFootballSection(section, button, updateUrl){
  const valid=['matches','news','clubs','transfers','standings'];
  activeFootballSection=valid.includes(section)?section:'matches';
  const dedicated=['clubs','transfers','standings'].includes(activeFootballSection);
  const overview=document.getElementById('footballOverviewView');
  if(overview) overview.hidden=dedicated;
  const views={clubs:'footballClubsView',transfers:'footballTransfersView',standings:'footballStandingsView'};
  Object.entries(views).forEach(([key,id])=>{ const view=document.getElementById(id); if(view) view.hidden=key!==activeFootballSection; });
  document.querySelectorAll('.football-context-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.footballRoute===activeFootballSection));
  renderFootballDataViews();
  if(updateUrl!==false) updateHash(footballSectionHash(activeFootballSection));
  const target=dedicated ? document.getElementById(views[activeFootballSection]) : document.getElementById(activeFootballSection==='news'?'footballNewsSection':'footballMatchesSection');
  if(target) requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth',block:'start'}));
}
function scrollFootballSection(id, button){
  const route={footballMatchesSection:'matches',footballNewsSection:'news',clubSocialSection:'clubs',footballTransferSection:'transfers',footballStandingsSummary:'standings'}[id];
  if(route){ openFootballSection(route,button); return; }
  const target=document.getElementById(id); if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderLeagueClubs(){
  const area=document.getElementById('leagueClubsGrid'); if(!area) return;
  area.innerHTML=SUPER_LIG_CLUBS_2026_27.map((club,index)=>`<button class="league-club-card" type="button" data-club-team="${escapeHTML(club.team)}" onclick="openClubProfile(this.dataset.clubTeam)" aria-label="${escapeHTML(club.display||club.team)} kulüp merkezini aç">
    <div class="league-club-rank">${String(index+1).padStart(2,'0')}</div>
    ${crestHTML(club.team,'lg')}
    <div class="league-club-copy"><div class="league-club-name">${escapeHTML(club.display||club.team)}${club.promoted?'<span class="promoted-chip">Yeni</span>':''}</div><div class="league-club-city">${escapeHTML(club.city)}</div></div>
    <div class="league-club-stadium"><span>Stadyum</span><strong>${escapeHTML(club.stadium)}</strong><small>${escapeHTML(club.capacity)} kapasite</small></div>
    <div class="league-club-value"><span>Kadro değeri</span><strong>${escapeHTML(club.marketValue||'Yayınlanmadı')}</strong><small>Kulüp merkezini aç →</small></div>
  </button>`).join('');
}
let activeClubProfileTeam=null;
const clubProfileCache=new Map();
function clubRecord(team){ return SUPER_LIG_CLUBS_2026_27.find(club=>club.team===team)||null; }
function clubDirectionsURL(club){ return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${club.stadium}, ${club.city}, Türkiye`)}`; }
function clubMapEmbedURL(club){ return `https://www.google.com/maps?q=${encodeURIComponent(`${club.stadium}, ${club.city}, Türkiye`)}&output=embed`; }
function clubCoachBio(coach,team){
  if(!coach?.name) return 'Teknik direktör bilgisi doğrulanmış veri kaynağından bekleniyor.';
  const contract=coach.contract&&coach.contract!=='Açıklanmadı'?` Sözleşme bitişi ${coach.contract} olarak listeleniyor.`:' Sözleşme bitiş tarihi kaynakta açıklanmadı.';
  return `${coach.age?`${coach.age} yaşındaki `:''}${coach.nationality?`${coach.nationality} futbol insanı `:''}${coach.name}, ${team} A takımının teknik sorumlusu. Görev süresi ${coach.tenure||'güncel kaynakta listeleniyor'}.${contract}`;
}
function clubLineupHTML(data,state){
  if(state==='loading') return `<div class="club-data-state"><span class="club-data-spinner"></span><strong>Son resmî maç kadrosu alınıyor</strong><p>Sportmonks kadro ve oyuncu kayıtları kontrol ediliyor.</p></div>`;
  const lineup=Array.isArray(data?.lineup)?data.lineup:[];
  if(!lineup.length){
    const message=state==='unconfigured'?'Sportmonks sunucu anahtarı henüz canlı siteye eklenmedi. Bağlantı açıldığında son resmî maçın gerçek ilk 11’i burada otomatik yayınlanacak.':'Son resmî maç için doğrulanmış ilk 11 henüz sağlayıcıda yayınlanmadı.';
    return `<div class="club-data-state"><span class="club-data-mark">11</span><strong>İsim uydurulmuyor</strong><p>${escapeHTML(message)}</p></div>`;
  }
  return `<div class="club-lineup-list">${lineup.map((player,index)=>{
    const photo=safeExternalURL(player.image);
    return `<article class="club-lineup-player"><span class="club-lineup-order">${String(index+1).padStart(2,'0')}</span><span class="club-player-photo">${photo?`<img src="${escapeHTML(photo)}" alt="${escapeHTML(player.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:escapeHTML(String(player.name||'?').slice(0,2).toLocaleUpperCase('tr-TR'))}</span><span><strong>${escapeHTML(player.name||'Oyuncu')}</strong><small>${player.number?`${escapeHTML(player.number)} · `:''}${escapeHTML(player.position||'Pozisyon')}</small></span></article>`;
  }).join('')}</div>`;
}
function clubSquadHTML(data){
  const squad=Array.isArray(data?.squad)?data.squad:[];
  if(!squad.length) return '';
  return `<details class="club-squad-drawer"><summary>Güncel kadronun tamamı <span>${squad.length} oyuncu</span></summary><div class="club-squad-grid">${squad.map(player=>`<span><b>${escapeHTML(player.number||'—')}</b>${escapeHTML(player.name||'Oyuncu')}<small>${escapeHTML(player.position||'')}</small></span>`).join('')}</div></details>`;
}
function renderClubProfile(team,data,state='ready'){
  const panel=document.getElementById('clubProfilePanel'); const club=clubRecord(team); if(!panel||!club) return;
  const liveCoach=data?.coach?.name?data.coach:null;
  const staticCoach=club.coach||{};
  const sameCoach=liveCoach&&staticCoach.name&&String(liveCoach.name).toLocaleLowerCase('tr-TR')===String(staticCoach.name).toLocaleLowerCase('tr-TR');
  const coach=liveCoach?(sameCoach?{...staticCoach,...liveCoach}:liveCoach):staticCoach;
  const coachPhoto=safeExternalURL(coach.image);
  const venue=data?.venue?.name||club.stadium;
  const lineupFixture=data?.lineupFixture;
  const lineupMeta=lineupFixture?.name?`${lineupFixture.name}${lineupFixture.startingAt?` · ${new Date(lineupFixture.startingAt).toLocaleDateString('tr-TR',{day:'2-digit',month:'short',year:'numeric'})}`:''}`:'Son resmî maçın açıklanmış kadrosu';
  const sourceState=state==='loading'?'Veri yenileniyor':state==='unconfigured'?'Sportmonks bağlantısı bekleniyor':data?.stale?'Son doğrulanmış veri':'Sportmonks güncel veri';
  panel.hidden=false;
  panel.innerHTML=`<header class="club-profile-head"><button class="club-profile-close" type="button" onclick="closeClubProfile()" aria-label="Kulüp merkezini kapat">×</button><div class="club-profile-identity">${crestHTML(club.team,'lg')}<div><span class="football-data-eyebrow">KULÜP MERKEZİ · ${escapeHTML(club.checkedAt)}</span><h2>${escapeHTML(club.display||club.team)}</h2><p>${escapeHTML(club.city)} · ${escapeHTML(venue)}</p></div></div><span class="club-source-state">${escapeHTML(sourceState)}</span></header>
    <div class="club-profile-metrics"><article><span>Kadro değeri</span><strong>${escapeHTML(club.marketValue||'—')}</strong><a href="${escapeHTML(club.marketSourceUrl)}" target="_blank" rel="noopener noreferrer">Transfermarkt kaynağı ↗</a></article><article><span>Kadro genişliği</span><strong>${escapeHTML(data?.squad?.length||club.squadSize||'—')}</strong><small>oyuncu</small></article><article><span>Yaş ortalaması</span><strong>${escapeHTML(club.averageAge||'—')}</strong><small>sezon kadrosu</small></article><article><span>Stadyum kapasitesi</span><strong>${escapeHTML(club.capacity)}</strong><small>seyirci</small></article></div>
    <div class="club-profile-main"><article class="club-stadium-feature"><div class="club-feature-title"><div><span>STADYUM VE ULAŞIM</span><h3>${escapeHTML(venue)}</h3><p>${escapeHTML(club.city)}</p></div><a href="${escapeHTML(clubDirectionsURL(club))}" target="_blank" rel="noopener noreferrer">Yol tarifi al ↗</a></div><iframe src="${escapeHTML(clubMapEmbedURL(club))}" title="${escapeHTML(venue)} haritası" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></article>
      <article class="club-coach-feature"><div class="club-coach-photo">${coachPhoto?`<img src="${escapeHTML(coachPhoto)}" alt="${escapeHTML(coach.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:'<span>TD</span>'}</div><div class="club-coach-copy"><span>TEKNİK DİREKTÖR</span><h3>${escapeHTML(coach.name||'Bilgi bekleniyor')}</h3><p>${escapeHTML(clubCoachBio(coach,club.display||club.team))}</p><dl><div><dt>Ülke</dt><dd>${escapeHTML(coach.nationality||'—')}</dd></div><div><dt>Görev</dt><dd>${escapeHTML(coach.tenure||'—')}</dd></div><div><dt>Sözleşme</dt><dd>${escapeHTML(coach.contract||'—')}</dd></div></dl><a href="${escapeHTML(club.coachSourceUrl)}" target="_blank" rel="noopener noreferrer">Teknik direktör kaynağı ↗</a></div></article></div>
    <article class="club-lineup-feature"><header><div><span>SON RESMÎ MAÇ</span><h3>Güncel ilk 11</h3><p>${escapeHTML(lineupMeta)}</p></div>${data?.formation?`<strong>${escapeHTML(data.formation)}</strong>`:''}</header>${clubLineupHTML(data,state)}${clubSquadHTML(data)}</article>`;
}
async function loadClubProfile(team){
  if(clubProfileCache.has(team)){ renderClubProfile(team,clubProfileCache.get(team),'ready'); return; }
  renderClubProfile(team,null,'loading');
  try{
    const response=await fetch(`/api/football/club?team=${encodeURIComponent(team)}`,{headers:{Accept:'application/json'}});
    const payload=await response.json().catch(()=>({}));
    if(response.status===503&&payload?.error==='sportmonks_not_configured'){ renderClubProfile(team,null,'unconfigured'); return; }
    if(!response.ok||!payload?.team) throw new Error(payload?.error||'club_data_unavailable');
    clubProfileCache.set(team,payload); renderClubProfile(team,payload,'ready');
  }catch(_){ renderClubProfile(team,null,'unavailable'); }
}
function openClubProfile(team){
  if(!clubRecord(team)) return; activeClubProfileTeam=team; loadClubProfile(team);
  const panel=document.getElementById('clubProfilePanel'); if(panel) requestAnimationFrame(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}));
}
function closeClubProfile(){ const panel=document.getElementById('clubProfilePanel'); activeClubProfileTeam=null; if(panel){ panel.hidden=true; panel.innerHTML=''; } }
function standingFormHTML(form){
  return `<span class="standing-form" aria-label="Son beş maç">${String(form||'').split('').map(result=>`<i class="${result==='W'?'win':result==='D'?'draw':'loss'}" title="${result==='W'?'Galibiyet':result==='D'?'Beraberlik':'Mağlubiyet'}">${result==='W'?'✓':result==='D'?'−':'×'}</i>`).join('')}</span>`;
}
function renderTransferCenterFilters(){
  const select=document.getElementById('transferClubFilter'); if(!select) return;
  const clubs=SUPER_LIG_CLUBS_2026_27.map(club=>club.team).sort((a,b)=>String(a).localeCompare(String(b),'tr'));
  select.innerHTML=`<option value="all">Tüm kulüpler</option>${clubs.map(team=>`<option value="${escapeHTML(team)}">${escapeHTML(team)}</option>`).join('')}`;
  select.value=clubs.includes(activeTransferClub)?activeTransferClub:'all';
}
function setTransferClubFilter(team){
  const clubs=SUPER_LIG_CLUBS_2026_27.map(club=>club.team);
  activeTransferClub=clubs.includes(team)?team:'all';
  renderTransferCenter();
}
const TRANSFER_PLAYER_PHOTOS=Object.freeze({
  'Mason Greenwood':'https://images.fotmob.com/image_resources/playerimages/950473.png',
  'Orkun Kökçü':'https://images.fotmob.com/image_resources/playerimages/935409.png',
  'Leandro Trossard':'https://images.fotmob.com/image_resources/playerimages/318615.png',
  'Vedat Muriqi':'https://images.fotmob.com/image_resources/playerimages/517052.png',
  'Nathan Aké':'https://images.fotmob.com/image_resources/playerimages/417068.png',
  'Kassoum Ouattara':'https://images.fotmob.com/image_resources/playerimages/1387194.png',
  'Alexander Nübel':'https://images.fotmob.com/image_resources/playerimages/554534.png',
  'Metehan Mimaroğlu':'https://images.fotmob.com/image_resources/playerimages/389181.png',
  'Mohamed Salah':'https://images.fotmob.com/image_resources/playerimages/292462.png',
  'Julio Enciso':'https://images.fotmob.com/image_resources/playerimages/1073742.png',
  'Can Uzun':'https://images.fotmob.com/image_resources/playerimages/1367924.png',
  'Jhon Lucumí':'https://images.fotmob.com/image_resources/playerimages/860913.png',
  'Mathys Tel':'https://images.fotmob.com/image_resources/playerimages/1288111.png',
  'Bruno Fernandes':'https://images.fotmob.com/image_resources/playerimages/422685.png',
  'Rafael Leão':'https://images.fotmob.com/image_resources/playerimages/848844.png'
});
function transferPlayerPhotoHTML(item){
  const initials=item.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('');
  const photo=TRANSFER_PLAYER_PHOTOS[item.name];
  return `<span class="transfer-player-photo" aria-hidden="true"><span>${escapeHTML(initials)}</span>${photo?`<img src="${photo}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</span>`;
}
function renderHistoricStandings(){
  const area=document.getElementById('historicStandingsTable'); if(!area) return;
  area.innerHTML=`<div class="historic-standings-head"><span>#</span><span>Takım</span><span>O</span><span>G</span><span>B</span><span>M</span><span>AG</span><span>YG</span><span>AV</span><strong>P</strong><span>Son 5</span></div><div class="historic-standings-body">${HISTORIC_STANDINGS_2024_25.map((row,index)=>`<div class="historic-standing-row ${row.zone||''}">
    <span class="historic-rank">${index+1}</span><span class="historic-team">${crestHTML(row.team,'xs')}<b>${escapeHTML(row.team)}</b></span><span>${row.played}</span><span>${row.won}</span><span>${row.drawn}</span><span>${row.lost}</span><span>${row.goals_for}</span><span>${row.goals_against}</span><span>${row.goal_difference>0?'+':''}${row.goal_difference}</span><strong>${row.points}</strong>${standingFormHTML(row.form)}
  </div>`).join('')}</div>`;
}
function renderTransferCenter(){
  const area=document.getElementById('transferCenterList');
  const summary=document.getElementById('transferCenterSummary');
  if(!area || !summary) return;
  renderTransferCenterFilters();
  const allRecords=TRANSFER_CENTER_DATA[activeTransferCenterTab]||[];
  const records=activeTransferClub==='all'?allRecords:allRecords.filter(item=>item.to===activeTransferClub || item.from===activeTransferClub);
  const descriptions={confirmed:'Kulüp veya kayıt kaynağında tamamlanmış olarak yer alan işlemler.',talks:'Yetkili açıklamasına dayanan, henüz sonuçlanmamış süreçler.',rumours:'Resmî olmayan iddialar. Her kayıt kaynak ve doğrulama durumu ile birlikte gösterilir.'};
  summary.innerHTML=`<strong>${records.length} kayıt · ${activeTransferClub==='all'?'Tüm Süper Lig':escapeHTML(activeTransferClub)}</strong><span>${descriptions[activeTransferCenterTab]}</span>`;
  area.innerHTML=records.length?records.map((item,index)=>`<article class="transfer-center-row ${item.status==='Kulüp yalanladı'?'denied':''}">
    <span class="transfer-center-index">${String(index+1).padStart(2,'0')}</span>
    ${transferPlayerPhotoHTML(item)}
    <div class="transfer-center-player"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.detail||item.status)}</span></div>
    <div class="transfer-route-block"><span>${escapeHTML(item.from)}</span><b aria-hidden="true">→</b><span class="transfer-destination">${crestHTML(item.to,'xs')} ${escapeHTML(item.to)}</span></div>
    <div class="transfer-center-fee"><strong>${escapeHTML(item.fee)}</strong><span class="transfer-status-chip ${activeTransferCenterTab}">${escapeHTML(item.status)}</span></div>
    <a class="transfer-record-source" href="${escapeHTML(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.source)} ↗</a>
  </article>`).join(''):footballEmpty('Kayıt bulunmuyor','Bu durum için kaynaklı bir transfer kaydı henüz eklenmedi.');
  document.querySelectorAll('.transfer-center-tab').forEach(tab=>{ const active=tab.dataset.transferView===activeTransferCenterTab; tab.classList.toggle('active',active); tab.setAttribute('aria-selected',active?'true':'false'); });
}
function setTransferCenterTab(name, button, updateUrl){
  if(!TRANSFER_CENTER_DATA[name]) return;
  activeTransferCenterTab=name;
  renderTransferCenter();
  if(updateUrl!==false) updateHash(`transfers/${name}`);
}
function renderFootballDataViews(){ renderLeagueClubs(); renderTransferCenter(); renderHistoricStandings(); }
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
  renderFootballTeamStrip(); renderFootballQuickMatches(); renderFootballNews(); renderFootballTransfers(); renderEditorialNews();
}

/* ===================== RESMÎ KULÜP X AKIŞI ===================== */
function rankedXClubs(){
  const orderedStandings=[...STANDINGS].sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity) || (b.goal_difference??-Infinity)-(a.goal_difference??-Infinity) || (b.goals_for??-Infinity)-(a.goals_for??-Infinity));
  const rankByTeam=new Map(orderedStandings.map((row,index)=>[row.team,index+1]));
  return X_CLUBS.map((club,index)=>({ ...club, leagueRank:rankByTeam.get(club.team)??null, fallbackOrder:index }))
    .sort((a,b)=>(a.leagueRank??99)-(b.leagueRank??99) || a.fallbackOrder-b.fallbackOrder);
}
function xPostDate(value){
  const date=new Date(value); if(!value||Number.isNaN(date.getTime())) return 'Güncel paylaşım';
  return date.toLocaleDateString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
function xMetric(value){
  return new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1}).format(Number(value)||0);
}
function xPostCardHTML(club){
  const rankLabel=club.leagueRank?`Süper Lig ${escapeHTML(club.leagueRank)}. · `:'';
  const post=club.post||null;
  const metrics=post&&post.metrics?post.metrics:{};
  const postBody=post?`<p class="club-social-copy">${escapeHTML(post.text)}</p>
    <div class="club-social-meta" aria-label="Paylaşım etkileşimleri">
      <span aria-label="${escapeHTML(xMetric(metrics.reply_count))} yanıt"><i aria-hidden="true">○</i>${escapeHTML(xMetric(metrics.reply_count))}</span>
      <span aria-label="${escapeHTML(xMetric(metrics.retweet_count))} yeniden paylaşım"><i aria-hidden="true">↻</i>${escapeHTML(xMetric(metrics.retweet_count))}</span>
      <span aria-label="${escapeHTML(xMetric(metrics.like_count))} beğeni"><i aria-hidden="true">♡</i>${escapeHTML(xMetric(metrics.like_count))}</span>
      <span aria-label="${escapeHTML(xMetric(metrics.impression_count))} görüntülenme"><i aria-hidden="true">◒</i>${escapeHTML(xMetric(metrics.impression_count))}</span>
    </div>`:`<div class="club-social-pending"><strong>Güncel paylaşım bekleniyor</strong><span>Resmî hesap bağlantısı hazır.</span></div>`;
  const targetURL=post?.url||club.url;
  return `<article class="club-social-card">
    <header class="club-social-card-head"><span class="club-social-avatar">${crestHTML(club.team,'xs')}</span><div class="club-social-identity"><span class="club-social-team-line"><strong>${escapeHTML(club.team)}</strong><span class="club-social-verified" aria-label="Resmî hesap">✓</span></span><small>${rankLabel}@${escapeHTML(club.handle)}</small></div><span class="club-social-platform-mark" aria-hidden="true">𝕏</span></header>
    <div class="club-social-post">${postBody}<footer class="club-social-card-foot"><time datetime="${escapeHTML(post?.created_at||'')}">${post?escapeHTML(xPostDate(post.created_at)):'Günlük yenilenir'}</time><a class="club-social-profile-link" href="${escapeHTML(targetURL)}" target="_blank" rel="noopener noreferrer">${post?'Gönderiyi görüntüle':'Hesabı aç'} <span aria-hidden="true">↗</span></a></footer></div>
  </article>`;
}
let xClubPostsRequest=null;
async function loadXClubPosts(){
  const stage=document.getElementById('clubSocialStage'); const clubs=rankedXClubs(); if(!stage||!clubs.length) return;
  stage.innerHTML=`<div class="club-social-loading"><span></span><strong>Dört kulübün günlük akışı hazırlanıyor…</strong></div>`;
  try{
    if(!xClubPostsRequest) xClubPostsRequest=fetch('/api/social/x',{headers:{Accept:'application/json'}}).then(async response=>{
      const payload=await response.json().catch(()=>null);
      if(!response.ok||!Array.isArray(payload?.clubs)) throw new Error('X veri katmanı hazır değil.');
      return payload;
    });
    const payload=await xClubPostsRequest;
    const apiClubs=new Map(payload.clubs.map(club=>[String(club.handle||'').toLocaleLowerCase('tr-TR'),club]));
    stage.innerHTML=clubs.map(club=>xPostCardHTML({...club,...(apiClubs.get(club.handle.toLocaleLowerCase('tr-TR'))||{})})).join('');
  }catch(error){
    xClubPostsRequest=null;
    stage.innerHTML=clubs.map(xPostCardHTML).join('');
  }
}
function renderClubSocial(){
  if(!document.getElementById('clubSocialSection')) return;
  loadXClubPosts();
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

/* ===================== HABER + YOUTUBE YAYIN MASASI ===================== */
const YOUTUBE_CHANNEL_FALLBACK=[
  {name:'Sports Digitale',handle:'@sportsdigitale',url:'https://www.youtube.com/@sportsdigitale',note:'Futbol gündemi, yorum ve canlı programlar'},
  {name:'HT Spor',handle:'@htspor',url:'https://www.youtube.com/@htspor',note:'Güncel spor haberleri ve stüdyo yayınları'},
  {name:'beIN SPORTS Türkiye',handle:'@beINSPORTSTurkiye',url:'https://www.youtube.com/@beINSPORTSTurkiye',note:'Süper Lig röportajları, özetler ve programlar'},
  {name:'TRT Spor',handle:'@trtspor',url:'https://www.youtube.com/@trtspor',note:'Resmî spor yayınları ve gündem programları'}
];
let EDITORIAL_NEWS_CACHE=[];
let youtubeMediaRequest=null;
function editorialTransferEntries(){
  const rows=[
    ...(TRANSFER_CENTER_DATA.confirmed||[]).map(item=>({...item,editorialTone:'Resmî işlem',editorialKind:'confirmed'})),
    ...(TRANSFER_CENTER_DATA.rumours||[]).map(item=>({...item,editorialTone:item.status,editorialKind:'rumour'}))
  ];
  return rows.filter(item=>activeFootballTeam==='Tümü'||item.to===activeFootballTeam||item.from===activeFootballTeam).map(item=>({
    kind:'source',
    title:item.editorialKind==='confirmed'?`${item.name}: ${item.from} → ${item.to}`:`${item.name} için ${item.to} gündeminde son durum`,
    text:item.detail||`${item.fee} · ${item.status}`,
    source:item.source,
    sourceUrl:safeExternalURL(item.sourceUrl),
    label:item.editorialTone,
    image:TRANSFER_PLAYER_PHOTOS[item.name]||null
  }));
}
function editorialNewsEntries(){
  const storyEntries=publishedStoryCards().map((card,index)=>({
    kind:'story',index,title:card.title||'Futbol gündemi',text:card.spot||card.summary||card.text||'',source:card.source||'XYZSKOR',label:storyConfidence(card)?.label||'Güncel',time:card.verified_at||card.updated_at||card.published_at||'',image:safeExternalURL(card.hero_image||card.image_url||card.image||card.thumbnail_url||card.player_image)
  }));
  const seen=new Set();
  return [...storyEntries,...editorialTransferEntries()].filter(item=>{ const key=String(item.title).toLocaleLowerCase('tr-TR'); if(seen.has(key)) return false; seen.add(key); return true; }).slice(0,7);
}
function openEditorialEntry(index){
  const entry=EDITORIAL_NEWS_CACHE[index]; if(!entry) return;
  if(entry.kind==='story'){ openNewsDetail(entry.index); return; }
  if(entry.sourceUrl){ const opened=window.open(entry.sourceUrl,'_blank','noopener,noreferrer'); if(opened) opened.opener=null; }
}
function bindEditorialEntries(area){
  area.querySelectorAll('[data-editorial-index]').forEach(card=>{
    card.onclick=()=>openEditorialEntry(Number(card.dataset.editorialIndex));
    card.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){ event.preventDefault(); openEditorialEntry(Number(card.dataset.editorialIndex)); } };
  });
}
function renderEditorialNews(){
  const lead=document.getElementById('editorialLeadNews'); const list=document.getElementById('editorialHighlights'); if(!lead||!list) return;
  EDITORIAL_NEWS_CACHE=editorialNewsEntries();
  const primary=EDITORIAL_NEWS_CACHE[0];
  if(!primary){ lead.innerHTML=footballEmpty('Gündem hazırlanıyor','Kaynağı doğrulanmış ilk içerik yayınlandığında burada görünecek.'); list.innerHTML=''; return; }
  const media=EDITORIAL_NEWS_CACHE.slice(0,3).filter(item=>item.image);
  lead.innerHTML=`<article class="editorial-lead-card" tabindex="0" role="button" data-editorial-index="0" aria-label="${escapeHTML(primary.title)} haberini aç"><div class="editorial-lead-media ${media.length>1?'collage':''}">${media.length?media.map(item=>`<img src="${escapeHTML(item.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`).join(''):'<div class="editorial-media-fallback">XYZ</div>'}</div><div class="editorial-lead-copy"><span class="editorial-news-label">${escapeHTML(primary.label)}</span><h3>${escapeHTML(primary.title)}</h3><p>${escapeHTML(primary.text)}</p><footer><strong>${escapeHTML(primary.source)}</strong>${primary.time?`<time>${escapeHTML(fmtEditorialDate(primary.time))}</time>`:''}</footer></div></article>`;
  list.innerHTML=`<div class="editorial-highlights-title">Öne çıkanlar</div>${EDITORIAL_NEWS_CACHE.slice(1,6).map((item,index)=>`<article class="editorial-highlight-row" tabindex="0" role="button" data-editorial-index="${index+1}" aria-label="${escapeHTML(item.title)} haberini aç"><span class="editorial-highlight-rank">${index+1}</span><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.source)}${item.time?` · ${escapeHTML(fmtEditorialDate(item.time))}`:''}</p></div>${item.image?`<img src="${escapeHTML(item.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:'<span class="editorial-highlight-mark">XYZ</span>'}</article>`).join('')}`;
  bindEditorialEntries(lead); bindEditorialEntries(list);
}
function formatYouTubeDuration(value){
  const match=String(value||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/); if(!match) return '';
  const hours=Number(match[1]||0),minutes=Number(match[2]||0),seconds=Number(match[3]||0);
  return `${hours?`${hours}:`:''}${String(minutes).padStart(hours?2:1,'0')}:${String(seconds).padStart(2,'0')}`;
}
function renderYouTubeFallback(){
  const grid=document.getElementById('youtubeMediaGrid'); const status=document.getElementById('youtubeMediaStatus'); if(!grid||!status) return;
  status.textContent='Doğrulanmış kanal rehberi';
  grid.innerHTML=`<div class="youtube-channel-intro"><span class="youtube-play-mark">▶</span><div><strong>Canlı yayın bulunduğunda burada otomatik görünür.</strong><p>Şimdilik doğrulanmış yayıncıların resmî YouTube kanallarına doğrudan ulaşabilirsin.</p></div></div>${YOUTUBE_CHANNEL_FALLBACK.map((channel,index)=>`<a class="youtube-channel-card" href="${channel.url}/live" target="_blank" rel="noopener noreferrer"><span class="youtube-channel-avatar">${index+1}</span><div><strong>${escapeHTML(channel.name)}</strong><small>${escapeHTML(channel.handle)}</small><p>${escapeHTML(channel.note)}</p></div><span aria-hidden="true">↗</span></a>`).join('')}`;
}
function renderYouTubeItems(payload){
  const grid=document.getElementById('youtubeMediaGrid'); const status=document.getElementById('youtubeMediaStatus'); if(!grid||!status) return;
  const items=Array.isArray(payload?.items)?payload.items.slice(0,6):[]; if(!items.length){ renderYouTubeFallback(); return; }
  const liveCount=items.filter(item=>item.live).length;
  status.textContent=liveCount?`${liveCount} canlı yayın`:`${items.length} güncel program`;
  grid.innerHTML=items.map((item,index)=>`<a class="youtube-video-card ${index===0?'featured':''}" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><div class="youtube-video-thumb"><img src="${escapeHTML(item.thumbnail)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="youtube-video-play" aria-hidden="true">▶</span>${item.live?'<span class="youtube-live-chip">CANLI</span>':item.upcoming?'<span class="youtube-upcoming-chip">YAKINDA</span>':''}${item.duration?`<span class="youtube-duration">${escapeHTML(formatYouTubeDuration(item.duration))}</span>`:''}</div><div class="youtube-video-copy"><span>${escapeHTML(item.channelTitle)}</span><h3>${escapeHTML(item.title)}</h3><p>${item.live&&item.concurrentViewers?`${escapeHTML(String(item.concurrentViewers))} kişi izliyor`:escapeHTML(fmtEditorialDate(item.publishedAt))}</p></div></a>`).join('');
}
async function renderYouTubeMedia(){
  const grid=document.getElementById('youtubeMediaGrid'); if(!grid) return;
  grid.innerHTML='<div class="youtube-media-loading"><span></span>Doğrulanmış yayınlar kontrol ediliyor…</div>';
  try{
    if(!youtubeMediaRequest) youtubeMediaRequest=fetch('/api/media/youtube',{headers:{Accept:'application/json'}}).then(async response=>{ const payload=await response.json().catch(()=>null); if(!response.ok) throw new Error(payload?.error||'youtube_unavailable'); return payload; });
    renderYouTubeItems(await youtubeMediaRequest);
  }catch(_error){ youtubeMediaRequest=null; renderYouTubeFallback(); }
}
function renderFootballTransfers(){
  const area=document.getElementById('footballTransferStream'); if(!area) return;
  const transfers=publishedStoryCards().map((card,index)=>({card,index})).filter(entry=>['transfer','transfer_development'].includes(String(entry.card.category || entry.card.type || '').toLocaleLowerCase('tr-TR')));
  if(!transfers.length){
    area.innerHTML=`<div class="transfer-compact-list">${TRANSFER_CENTER_DATA.confirmed.slice(0,3).map(item=>`<div class="transfer-compact-row">${transferPlayerPhotoHTML(item)}<span>${escapeHTML(item.name)}</span><small>${escapeHTML(item.from)} → ${escapeHTML(item.to)}</small><b>${escapeHTML(item.fee)}</b></div>`).join('')}</div><button class="football-module-full-link" type="button" onclick="openFootballSection('transfers')">Transfer merkezini aç →</button>`;
    return;
  }
  area.innerHTML=`<div class="football-news-list">${transfers.slice(0,4).map(({card,index})=>{ const confidence=storyConfidence(card); return `<article class="football-news-card" tabindex="0" role="button" data-news-index="${index}" aria-label="${escapeHTML(card.title||'Transfer haberi')} haberini aç">${storyIdentityHTML(card)}<h3>${escapeHTML(card.title || 'Transfer gelişmesi')}</h3>${card.text?`<p>${escapeHTML(card.text)}</p>`:''}<div class="football-news-meta">${confidence?`<span class="confidence-chip ${confidence.tone}">${confidence.label}</span>`:''}${card.source?`<span>Kaynak: ${escapeHTML(card.source)}</span>`:''}${card.verified_at?`<span>${escapeHTML(fmtEditorialDate(card.verified_at))}</span>`:''}</div></article>`; }).join('')}</div>`;
  area.querySelectorAll('[data-news-index]').forEach(article=>{ article.onclick=()=>openNewsDetail(Number(article.dataset.newsIndex)); article.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){event.preventDefault();openNewsDetail(Number(article.dataset.newsIndex));} }; });
}
function renderFootballStandingsCompact(){
  const area=document.getElementById('footballStandingsCompact'); if(!area) return;
  const rows=HISTORIC_STANDINGS_2024_25.slice(0,5);
  area.innerHTML=`<div class="standing-compact"><div class="standing-compact-header"><span>#</span><span>2024–25 final</span><span>O</span><span>P</span></div>${rows.map((row,index)=>`<div class="standing-compact-row"><span>${index+1}</span><span class="standing-compact-team">${escapeHTML(row.team)}</span><span>${row.played}</span><b>${row.points}</b></div>`).join('')}</div><button class="football-module-full-link" type="button" onclick="openFootballSection('standings')">Tam puan durumunu aç →</button>`;
}
function renderFootballHome(){ renderPortalSponsor(); renderFootballTeamStrip(); renderFootballQuickMatches(); renderFootballFeatured(); renderFootballNews(); renderFootballTransfers(); renderFootballStandingsCompact(); renderClubSocial(); renderEditorialNews(); renderYouTubeMedia(); renderFootballDataViews(); startTransferCountdown(); }
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
  if(!u) return `<div class="prediction-zone predict-login-prompt"><div><div class="prediction-label">Seçimini kaydet</div><p>1 / X / 2 seçimi ve kesin skor için hesabına giriş yap.</p></div><button class="btn" type="button" onclick="openAuth('login')">Giriş yap</button></div>`;
  return `<div class="prediction-zone"><div class="prediction-label">Maç sonucu</div><div class="predict-form" id="form-${escapeHTML(m.id)}"><div class="pick-row"><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','1',this)">1 · ${escapeHTML(m.ev)}</button><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','X',this)">X · Berabere</button><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','2',this)">2 · ${escapeHTML(m.konuk)}</button></div><div class="mini-note">Kesin skor isteğe bağlıdır.</div><div class="score-row"><span class="mono" style="font-size:12px;color:var(--ink-dim);">Kesin skor</span><input type="number" min="0" max="99" id="sh-${escapeHTML(m.id)}" inputmode="numeric" placeholder="0" aria-label="${escapeHTML(m.ev)} gol sayısı"><span class="mono">—</span><input type="number" min="0" max="99" id="sa-${escapeHTML(m.id)}" inputmode="numeric" placeholder="0" aria-label="${escapeHTML(m.konuk)} gol sayısı"><button class="btn" type="button" id="savePrediction-${escapeHTML(m.id)}" onclick="submitPrediction('${m.id}')">Kaydet</button></div><div class="predict-save-status" id="saveStatus-${escapeHTML(m.id)}" role="status" aria-live="polite"></div></div></div>`;
}
function communityPredictionSummary(matchId){
  const predictions=Object.values(ALL_PREDICTIONS[matchId]||{}).filter(item=>item&&['1','X','2'].includes(item.pick));
  if(!predictions.length) return null;
  const counts=predictions.reduce((result,item)=>{ result[item.pick]+=1; return result; },{1:0,X:0,2:0});
  const percentage=key=>Math.round((counts[key]/predictions.length)*100);
  return {total:predictions.length,home:percentage('1'),draw:percentage('X'),away:percentage('2')};
}
function leagueRowHTML(m){
  const mm=matchMathMetrics(m);
  const community=communityPredictionSummary(m.id);
  const deadline=new Date(new Date(m.kickoff).getTime()-15*60000);
  const dataDetails=mm?`<details class="predict-data-details"><summary>Veri özeti</summary><div>Takım gücü: ${escapeHTML(m.ev)} ${mm.powerHome.toFixed(1)} · ${escapeHTML(m.konuk)} ${mm.powerAway.toFixed(1)}<br>Veri modeli xG: ${mm.xgHome.toFixed(2)}–${mm.xgAway.toFixed(2)} · Örneklem: ${mm.sample} maç</div></details>`:'';
  const communityHTML=community?`<div class="predict-community" aria-label="${community.total} kullanıcı tahmini"><span><b>1</b>${community.home}%</span><span><b>X</b>${community.draw}%</span><span><b>2</b>${community.away}%</span><small>${community.total} kullanıcı</small></div>`:`<div class="predict-community empty"><span>Topluluk dağılımı ilk kayıtlı tahminlerle açılır.</span></div>`;
  return `
    <article class="predict-match" id="lcard-${escapeHTML(m.id)}">
      <header class="predict-card-head"><time datetime="${escapeHTML(m.kickoff)}">${escapeHTML(fmtTime(m.kickoff))}</time><span>${isLocked(m.kickoff)?'Tahmin kapandı':`Kapanış ${deadline.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`}</span></header>
      <div class="predict-faceoff"><div class="predict-faceoff-team home">${crestHTML(m.ev,'md')}<strong>${escapeHTML(m.ev)}</strong><small>Ev sahibi</small></div><div class="predict-versus"><span>VS</span><small>${escapeHTML(new Date(m.kickoff).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}))}</small></div><div class="predict-faceoff-team away">${crestHTML(m.konuk,'md')}<strong>${escapeHTML(m.konuk)}</strong><small>Deplasman</small></div></div>
      <div class="predict-action">${predictionActionHTML(m)}</div>
      <div class="predict-evidence-row">${communityHTML}${dataDetails}</div>
      <div class="predict-match-footer"><button class="football-module-action" type="button" onclick="openMatchCenter('${m.id}')">Maç merkezi <span aria-hidden="true">→</span></button></div>
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
  panel.innerHTML=`<div class="predict-rail-head"><span class="predict-overview-kicker">${activeWeek}. HAFTA · PREDICT</span><h2>Yarışma merkezim</h2><p>Seçimlerini tamamla, sıralamadaki yerini canlı takip et.</p></div><div class="predict-deadline"><span>İlk tahmin kapanışı</span><b>${deadline?deadline.toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</b></div><div class="predict-progress-ring" style="--completion:${completion}%;"><strong>${completion}%</strong><span>tamamlandı</span></div><div class="predict-progress-row"><div class="progress-track" aria-label="Haftalık tahmin ilerlemesi"><div class="progress-fill" style="width:${completion}%;"></div></div><p>${escapeHTML(progressText)}</p></div><div class="predict-summary-grid"><div class="predict-summary-item"><b>${stats?stats.tahminSayisi:'—'}</b><span>Tahmin</span></div><div class="predict-summary-item"><b>${stats?stats.toplam:'—'}</b><span>Hafta puanı</span></div><div class="predict-summary-item"><b>${generalRank||'—'}</b><span>Genel sıra</span></div></div><div class="predict-reward-line"><span>Haftanın ödülü</span><strong>${reward?escapeHTML(reward.item.aciklama):'Açıklanmadı'}</strong>${reward?`<small>${escapeHTML(reward.team)}</small>`:''}</div>${!u?'<div class="predict-guest-action"><p>Skorlarını kaydetmek ve sıralamaya katılmak için giriş yap.</p><button class="btn" type="button" onclick="openAuth(\'login\')">Giriş Yap</button></div>':''}`;
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
    else if(parsed && parsed.type==='football-section'){ switchMainTab('football',false); if(parsed.value==='transfers') setTransferCenterTab(parsed.sub||'confirmed',null,false); openFootballSection(parsed.value,null,false); }
    else if(parsed && parsed.type==='product'){ switchMainTab(parsed.value, false); }
  }catch(e){
    console.error('[XYZSkor] boot() veri yükleme başarısız:', e);
    lastLoadError = e;
    showLoadError('Veriler şu anda alınamıyor. (' + e.message + ')');
  }
}
boot();
