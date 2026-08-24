/* ===================== NAV ===================== */
function escapeHTML(value){
  return String(value == null ? '' : value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function renderNav(){
  const u = getCurrentUser(); const el = document.getElementById('navRight');
  el.innerHTML = `<button class="btn ghost notification-button" id="notificationBtn" type="button" aria-label="Hesap ve bildirim tercihlerini aç"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z"/><path d="M10 20h4"/></svg></button><button class="btn ghost account-button" id="accountBtn" type="button" aria-label="Hesap menüsünü aç"></button>`;
  const accountButton = document.getElementById('accountBtn');
  accountButton.textContent = !u ? 'Giriş / Üye Ol' : u.is_admin ? 'Yönetim' : u.username ? String(u.username).trim().slice(0,2).toLocaleUpperCase('tr-TR') : 'Hesap';
  accountButton.classList.toggle('is-guest', !u);
  accountButton.classList.toggle('is-admin', !!u?.is_admin);
  accountButton.setAttribute('aria-label', !u ? 'Giriş yap veya üye ol' : u.is_admin ? 'Üye ve admin yönetimini aç' : 'Profil ve hesap menüsünü aç');
  accountButton.onclick = openAccount;
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
const ADMIN_ROLE_OPTIONS = [
  ['','Editoryal yetki yok'],
  ['owner','Owner'],
  ['editor','Editör'],
  ['reviewer','Reviewer'],
  ['source_manager','Kaynak yöneticisi'],
  ['football_data','Futbol veri sorumlusu']
];
let memberAdminRows = [];
function adminRoleLabel(role){
  const found = ADMIN_ROLE_OPTIONS.find(item=>item[0]===role);
  return found ? found[1] : 'Yetki yok';
}
function memberAdminRowHTML(row){
  const current = getCurrentUser();
  const isSelf = current && current.id === row.id;
  const safeId = escapeHTML(row.id);
  const role = row.editorial_active ? row.editorial_role : '';
  return `<article class="account-member-card" data-member-admin="${safeId}">
    <div class="account-member-head">
      <div>
        <div class="account-member-name">${escapeHTML(row.username || row.email || 'İsimsiz üye')}</div>
        <div class="account-member-meta">${escapeHTML(row.email || 'E-posta yok')} · ${escapeHTML(row.team || 'Takım yok')}</div>
      </div>
      <span class="account-admin-chip ${row.is_admin?'is-on':'is-off'}">${row.is_admin?'Admin':'Üye'}</span>
    </div>
    <div class="account-member-stats" aria-label="Üye aktivitesi">
      <span><b>${Number(row.prediction_count || 0)}</b> tahmin</span>
      <span><b>${Number(row.weekly_game_count || 0)}</b> oyun</span>
      <span><b>${Number(row.reward_claim_count || 0)}</b> ödül talebi</span>
    </div>
    <div class="account-member-actions">
      <label class="account-admin-toggle"><input type="checkbox" data-admin-toggle ${row.is_admin?'checked':''} ${isSelf?'disabled':''}> Admin</label>
      <select class="account-role-select" data-role-select aria-label="Editoryal rol seç">
        ${ADMIN_ROLE_OPTIONS.map(([value,label])=>`<option value="${escapeHTML(value)}" ${value===role?'selected':''}>${escapeHTML(label)}</option>`).join('')}
      </select>
      <button class="btn ghost" type="button" data-member-save>${isSelf?'Rolü kaydet':'Yetkiyi kaydet'}</button>
    </div>
    <div class="account-member-foot">${role ? escapeHTML(adminRoleLabel(role)) : 'Editoryal rol pasif'}${isSelf?' · kendi admin yetkini buradan kapatamazsın':''}</div>
  </article>`;
}
function renderMemberAdminRows(rows){
  const list = document.getElementById('memberAdminList');
  const status = document.getElementById('memberAdminStatus');
  if(!list || !status) return;
  if(!rows.length){
    status.textContent = 'Bu aramaya uygun üye bulunamadı.';
    status.style.display = 'block';
    list.innerHTML = '';
    return;
  }
  status.style.display = 'none';
  list.innerHTML = rows.map(memberAdminRowHTML).join('');
  bindMemberAdminActions();
}
async function loadMemberAdminConsole(search=''){
  const list = document.getElementById('memberAdminList');
  const status = document.getElementById('memberAdminStatus');
  if(!list || !status) return;
  status.textContent = 'Üyeler yükleniyor…';
  status.style.display = 'block';
  const result = await fetchMemberAdminConsole(search);
  if(!result.ok){
    status.textContent = result.err || 'Üye listesi alınamadı.';
    list.innerHTML = '';
    return;
  }
  memberAdminRows = result.rows || [];
  renderMemberAdminRows(memberAdminRows);
}
function bindMemberAdminActions(){
  document.querySelectorAll('[data-member-admin]').forEach(card=>{
    const save = card.querySelector('[data-member-save]');
    const adminToggle = card.querySelector('[data-admin-toggle]');
    const roleSelect = card.querySelector('[data-role-select]');
    if(!save || !adminToggle || !roleSelect) return;
    save.onclick = async () => {
      const userId = card.getAttribute('data-member-admin');
      save.disabled = true;
      save.textContent = 'Kaydediliyor…';
      const result = await setMemberAdminRole(userId, adminToggle.checked, roleSelect.value || null, !!roleSelect.value);
      save.disabled = false;
      save.textContent = 'Yetkiyi kaydet';
      if(!result.ok){
        const status = document.getElementById('memberAdminStatus');
        if(status){ status.textContent = result.err || 'Yetki güncellenemedi.'; status.style.display = 'block'; }
        return;
      }
      if(result.row){
        memberAdminRows = memberAdminRows.map(row=>row.id===userId ? result.row : row);
        renderMemberAdminRows(memberAdminRows);
      } else {
        await loadMemberAdminConsole(document.getElementById('memberAdminSearch')?.value || '');
      }
    };
  });
}
function initMemberAdminConsole(){
  const search = document.getElementById('memberAdminSearch');
  const refresh = document.getElementById('memberAdminRefresh');
  if(!search || !refresh) return;
  let timer = null;
  search.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(()=>loadMemberAdminConsole(search.value), 250);
  };
  refresh.onclick = () => loadMemberAdminConsole(search.value);
  loadMemberAdminConsole('');
}
function renderAccountContent(){
  const area = document.getElementById('accountContent'); const u = getCurrentUser();
  if(!u){
    area.innerHTML = `<div class="account-summary"><div class="account-name">Futbol dünyana katıl</div><div class="account-team">Tahminlerini kaydetmek ve yarışmak için hesabını aç.</div></div><div class="account-actions"><button class="btn" id="accountJoin">Üye Ol</button><button class="btn ghost" id="accountLogin">Giriş Yap</button></div>`;
    document.getElementById('accountJoin').onclick = () => { closeAccount(); openAuth('register'); };
    document.getElementById('accountLogin').onclick = () => { closeAccount(); openAuth('login'); };
    return;
  }
  const life = lifetimeStats(u.id); const week = userStatsForWeek(u.id, activeWeek); const rank=accountGeneralRank(u.id); const badges=computeBadges(u.id); const rewardProgress=monthlyRewardProgress(u.id);
  area.innerHTML = `<div class="account-summary"><div class="account-name">${escapeHTML(u.username)}</div><div class="account-team">${escapeHTML(u.team||'Takım seçilmedi')}</div>${u.email?`<div class="account-email">${escapeHTML(u.email)}</div>`:''}</div>
    <div class="account-metrics" aria-label="Kullanıcı performansı"><div class="account-metric"><b>${week.toplam}</b><span>Haftalık puan</span></div><div class="account-metric"><b>${life.toplam}</b><span>Toplam puan</span></div><div class="account-metric"><b>${rank||'—'}</b><span>Genel sıralama</span></div><div class="account-metric"><b>${life.sonuclananTahmin?`%${life.dogruYuzde}`:'—'}</b><span>Doğru tahmin oranı</span></div><div class="account-metric"><b>${life.kesinSkor}</b><span>Kesin skor</span></div><div class="account-metric"><b>${life.tahmin}</b><span>Toplam tahmin</span></div></div>
    ${rewardProgressHTML(rewardProgress,'account')}
    <section class="account-section" aria-labelledby="accountHistoryTitle"><h3 class="account-section-title" id="accountHistoryTitle">Tahmin geçmişi</h3>${accountHistoryHTML(u.id)}</section>
    <section class="account-section" aria-labelledby="accountBadgesTitle"><h3 class="account-section-title" id="accountBadgesTitle">Rozetler</h3>${badges.length?`<div class="account-badges">${badges.map(badge=>`<span class="account-badge">${escapeHTML(badge)}</span>`).join('')}</div>`:'<p class="account-empty">Henüz kazanılmış rozet bulunmuyor.</p>'}</section>
    <div class="account-secondary-grid"><section class="account-section" aria-labelledby="accountFollowingTitle"><h3 class="account-section-title" id="accountFollowingTitle">Takip edilenler</h3><p class="account-empty">Henüz takip edilen takım veya futbolcu yok.</p></section><section class="account-section" aria-labelledby="accountNotificationsTitle"><h3 class="account-section-title" id="accountNotificationsTitle">Bildirim tercihleri</h3><p class="account-empty">Bildirim kanalı bağlı değil.</p></section></div>
    <section class="account-section" aria-labelledby="accountSettingsTitle"><h3 class="account-section-title" id="accountSettingsTitle">Hesap ayarları</h3><div class="account-settings"><div class="account-settings-row"><label for="accountTeamSelect">Tuttuğun takım</label><select id="accountTeamSelect" ${u.team_changed?'disabled':''}>${TEAMS.map(team=>`<option ${team===u.team?'selected':''}>${escapeHTML(team)}</option>`).join('')}</select></div><button class="btn ghost" id="accountTeamSave" type="button" disabled>Takımı değiştir</button>${u.team_changed?'<p class="account-note">Bu sezon için tek takım değişikliği hakkını kullandın.</p>':'<p class="account-note">Takım sezonda yalnız bir kez değiştirilebilir.</p>'}</div></section>
    ${u.is_admin?`<section class="account-section account-admin-console" aria-labelledby="memberAdminTitle">
      <div class="account-admin-title-row">
        <div>
          <h3 class="account-section-title" id="memberAdminTitle">Üye Yetkilendirme</h3>
          <p class="account-admin-desc">Kayıtlı üyeleri kontrol et, admin ve editoryal rollerini ver. E-posta bilgisi yalnız admin oturumunda DB RPC üzerinden gelir.</p>
        </div>
        <span class="account-admin-secure">DB bağlı</span>
      </div>
      <div class="account-admin-toolbar">
        <input id="memberAdminSearch" class="account-admin-search" type="search" placeholder="E-posta, kullanıcı adı veya takım ara">
        <button class="btn ghost" id="memberAdminRefresh" type="button">Yenile</button>
      </div>
      <p class="account-empty" id="memberAdminStatus">Üye listesi yükleniyor…</p>
      <div class="account-admin-list" id="memberAdminList"></div>
    </section>`:''}
    <div class="account-actions"><button class="btn account-predict-shortcut" id="accountPredictShortcut" type="button">Maç seçimine git →</button>${u.is_admin?'<button class="btn ghost" id="accountAdmin" type="button">Predict admin paneline git</button>':''}<button class="btn ghost account-danger" id="accountLogout" type="button">Çıkış yap</button></div>`;
  const teamSelect=document.getElementById('accountTeamSelect'); const teamSave=document.getElementById('accountTeamSave');
  if(teamSelect && teamSave && !u.team_changed){
    teamSelect.onchange=()=>{ teamSave.disabled=teamSelect.value===u.team; };
    teamSave.onclick=async()=>{ if(await changeTeam(teamSelect.value)){ await refreshAccountContext(); refreshVisibleAccountViews(); } };
  }
  if(u.is_admin) document.getElementById('accountAdmin').onclick = () => { closeAccount(); switchMainTab('predict'); switchLeagueSection('admin'); };
  document.getElementById('accountPredictShortcut').onclick = () => { closeAccount(); switchMainTab('predict'); window.scrollTo({top:0,behavior:'smooth'}); };
  if(u.is_admin) initMemberAdminConsole();
  document.getElementById('accountLogout').onclick = async () => { closeAccount(); await logoutUser(); await refreshAccountContext(); refreshVisibleAccountViews(); };
}
function openAccount(){
  if(typeof ensureXYZSupabaseClient==='function') ensureXYZSupabaseClient().catch(()=>{});
  accountReturnFocus = document.activeElement; renderAccountContent();
  const overlay = document.getElementById('accountOverlay'); overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  document.getElementById('accountClose').focus();
}
function refreshAccountPresentation(){
  renderNav();
  if(document.getElementById('accountOverlay')?.classList.contains('show')) renderAccountContent();
}
function refreshVisibleAccountViews(){
  refreshAccountPresentation();
  if(!document.body.classList.contains('predict-product-open')) return;
  if(typeof renderProgress==='function') renderProgress();
  if(typeof renderRewards==='function') renderRewards();
  if(typeof renderProfile==='function') renderProfile();
}
window.addEventListener('xyz:supabase-ready',refreshAccountPresentation);
window.addEventListener('xyz:auth-context-ready',refreshAccountPresentation);
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
  if(typeof ensureXYZSupabaseClient==='function') ensureXYZSupabaseClient().catch(()=>{});
  if(!document.getElementById('authOverlay').classList.contains('show')) authReturnFocus=document.activeElement;
  authMode = mode;
  document.getElementById('authTitle').textContent = mode==='register' ? 'Üye Ol' : 'Giriş Yap';
  document.getElementById('registerFields').style.display = mode==='register' ? 'block' : 'none';
  const consentFields=document.getElementById('authConsentFields'); if(consentFields) consentFields.style.display = mode==='register' ? 'grid' : 'none';
  document.getElementById('authSubmit').textContent = mode==='register' ? 'Üye Ol' : 'Giriş Yap';
  document.getElementById('authPass').autocomplete = mode==='register' ? 'new-password' : 'current-password';
  document.getElementById('authSwitch').textContent = mode==='register' ? 'Zaten üye misin? Giriş yap' : 'Hesabın yok mu? Üye ol';
  document.getElementById('authErr').classList.remove('show');
  document.getElementById('authErr').style.color = '';
  const resendButton=document.getElementById('authResend'); if(resendButton) resendButton.hidden=true;
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
    const termsAccepted = document.getElementById('authTermsConsent')?.checked;
    const marketingOptIn = document.getElementById('authMarketingConsent')?.checked;
    if(!username || !team){ errEl.textContent='Kullanıcı adı ve takım seçimi gerekli.'; errEl.classList.add('show'); btn.disabled=false; btn.textContent='Üye Ol'; return; }
    if(!termsAccepted){ errEl.textContent='Üyelik için Kullanım Koşulları ve KVKK Aydınlatma Metni kabul edilmeli.'; errEl.classList.add('show'); btn.disabled=false; btn.textContent='Üye Ol'; return; }
    res = await registerUser(username, email, pass, team, Boolean(marketingOptIn));
  } else { res = await loginUser(email, pass); }
  btn.disabled = false; btn.textContent = authMode==='register' ? 'Üye Ol' : 'Giriş Yap';
  if(!res.ok){ errEl.textContent = res.err; errEl.classList.add('show'); return; }
  if(res.pending){ errEl.textContent = res.message; errEl.style.color = 'var(--ok)'; errEl.classList.add('show'); const resendButton=document.getElementById('authResend'); if(resendButton) resendButton.hidden=false; return; }
  errEl.style.color = '';
  closeAuth();
  await refreshAccountContext(); refreshVisibleAccountViews();
};
document.getElementById('authResend').onclick = async () => {
  const button=document.getElementById('authResend');
  const errEl=document.getElementById('authErr');
  button.disabled=true;
  const result=await resendSignupConfirmation(document.getElementById('authEmail').value.trim());
  button.disabled=false;
  errEl.textContent=result.ok ? result.message : result.err;
  errEl.style.color=result.ok ? 'var(--ok)' : '';
  errEl.classList.add('show');
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
let activeFootballSection='home';
let activeTransferCenterTab='confirmed';
let activeTransferClub='all';
let activeMatchHubFilter='all';
function setFootballOverviewChromeHidden(hidden){
  ['footballContextNav','footballLeagueCommand','matchdayCommand'].forEach(id=>{const element=document.getElementById(id);if(element) element.hidden=Boolean(hidden);});
}
function openFootballSection(section, button, updateUrl){
  const valid=['home','matches','news','clubs','transfers','standings'];
  activeFootballSection=valid.includes(section)?section:'home';
  if(!(activeFootballSection==='transfers'&&activeFootballLeague==='all')){
    abortLeagueTransferRequestsExcept(['home','transfers'].includes(activeFootballSection)?activeFootballLeague:null);
  }
  const dedicated=activeFootballSection!=='home';
  const views={matches:'footballMatchesView',news:'footballNewsView',clubs:'footballClubsView',transfers:'footballTransfersView',standings:'footballStandingsView'};
  if(dedicated&&!document.getElementById(views[activeFootballSection])){
    const fallback=typeof buildFootballPath==='function'
      ? buildFootballPath(activeFootballLeague,activeFootballSection,activeTransferCenterTab)
      : `/${activeFootballLeague==='all'?'all':activeFootballLeague}/${activeFootballSection==='news'?'agenda':activeFootballSection}`;
    location.assign(fallback);
    return;
  }
  if(dedicated&&typeof ensureXYZLegacyStyles==='function') ensureXYZLegacyStyles();
  if(dedicated&&typeof ensureXYZUiExtras==='function') ensureXYZUiExtras();
  if(dedicated) document.body.classList.remove('football-aggregate-home','football-root-route','football-league-overview-mode');
  setFootballOverviewChromeHidden(!dedicated||activeFootballLeague==='all');
  const overview=document.getElementById('footballOverviewView');
  if(overview) overview.hidden=dedicated;
  Object.entries(views).forEach(([key,id])=>{ const view=document.getElementById(id); if(view) view.hidden=key!==activeFootballSection; });
  document.querySelectorAll('.football-context-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.footballRoute===activeFootballSection));
  // Yalnizca gorunen paneli guncelle. Onceki davranis her tiklamada maclar,
  // gundem, kulupler, transferler ve puan durumunun tamamini yeniden kuruyordu.
  if(dedicated){
    renderMatchesLeagueFilters();
    updateLeagueScopedCopy();
  }else renderFootballHome();
  const renderActiveView={
    matches:renderMatchesHub,
    news:renderNewsHub,
    clubs:renderLeagueClubs,
    transfers:renderTransferCenter,
    standings:renderHistoricStandings
  }[activeFootballSection];
  if(renderActiveView) renderActiveView();
  if(updateUrl!==false && typeof updatePath==='function' && typeof buildFootballPath==='function') updatePath(buildFootballPath(activeFootballLeague, activeFootballSection, activeTransferCenterTab));
  if(['home','matches'].includes(activeFootballSection)) startLiveFeed(); else stopLiveFeed();
  const target=dedicated ? document.getElementById(views[activeFootballSection]) : document.getElementById('footballOverviewView');
  if(target) requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth',block:'start'}));
}
function scrollFootballSection(id, button){
  const route={footballMatchesSection:'matches',footballNewsSection:'news',clubSocialSection:'news',footballTransferSection:'transfers',footballStandingsSummary:'standings'}[id];
  if(route){ openFootballSection(route,button); return; }
  const target=document.getElementById(id); if(target) target.scrollIntoView({behavior:'smooth',block:'start'});
}

function leagueTeamSourceRows(){
  const rows=new Map();
  const push=(team,patch={})=>{
    if(!team) return;
    const key=String(team).toLocaleLowerCase('tr-TR');
    const current=rows.get(key)||{team,display:team};
    rows.set(key,{...current,...patch,team:current.team||team,display:patch.display||current.display||team});
  };
  if(activeFootballLeague==='all' || activeFootballLeague==='super-lig'){
    SUPER_LIG_CLUBS_2026_27.forEach(club=>push(club.team,club));
  }
  STANDINGS.filter(row=>activeFootballLeague==='all' || competitionSlug(row.competition||row.league||row.tournament||row.source)===activeFootballLeague)
    .forEach(row=>push(row.team,{source:'standing',providerTeamId:row.provider_team_id||null,providerSeasonId:row.provider_season_id||null,logo:row.team_logo||null,country:row.country||null}));
  MATCHES.filter(matchInActiveLeague).forEach(match=>{
    const competition=competitionName(match);
    push(match.ev,{competition,providerTeamId:match.home_team_id||null,logo:match.home_logo||null,stadium:match.stadyum&&match.stadyum!=='Açıklanacak'?match.stadyum:null,source:'fixture'});
    push(match.konuk,{competition,providerTeamId:match.away_team_id||null,logo:match.away_logo||null,source:'fixture'});
  });
  const label=competitionLabelBySlug(activeFootballLeague);
  return [...rows.values()].map((club,index)=>({
    checkedAt:club.checkedAt||'Sportmonks sezon alanı',
    city:club.city||club.country||label,
    stadium:club.stadium||club.venue||'Stadyum bilgisi henüz yayınlanmadı',
    capacity:club.capacity||'—',
    marketValue:club.marketValue||'Sağlayıcı verisi',
    marketSourceUrl:club.marketSourceUrl||null,
    coachSourceUrl:club.coachSourceUrl||null,
    squadSize:club.squadSize||'—',
    averageAge:club.averageAge||'—',
    promoted:club.promoted||false,
    sortOrder:index,
    ...club
  })).sort((a,b)=>String(a.display||a.team).localeCompare(String(b.display||b.team),'tr'));
}
function renderLeagueClubs(){
  const area=document.getElementById('leagueClubsGrid'); if(!area) return;
  const clubs=leagueTeamSourceRows();
  if(activeClubProfileTeam && !clubs.some(club=>club.team===activeClubProfileTeam)) closeClubProfile(false);
  area.innerHTML=clubs.map((club,index)=>`<button class="league-club-card" type="button" data-club-team="${escapeHTML(club.team)}" onclick="openClubProfile(this.dataset.clubTeam)" aria-label="${escapeHTML(club.display||club.team)} kulüp merkezini aç">
    <div class="league-club-rank">${String(index+1).padStart(2,'0')}</div>
    ${crestHTML(club.team,'lg')}
    <div class="league-club-copy"><div class="league-club-name">${escapeHTML(club.display||club.team)}${club.promoted?'<span class="promoted-chip">Yeni</span>':''}</div><div class="league-club-city">${escapeHTML(club.city)}</div></div>
    <div class="league-club-stadium"><span>Stadyum</span><strong>${escapeHTML(club.stadium)}</strong><small>${escapeHTML(club.capacity)} kapasite</small></div>
    <div class="league-club-value"><span>Kadro değeri</span><strong>${escapeHTML(club.marketValue||'Yayınlanmadı')}</strong><small>Kulüp merkezini aç →</small></div>
  </button>`).join('');
}
let activeClubProfileTeam=null;
const clubProfileCache=new Map();
function clubRecord(team){
  const scoped=leagueTeamSourceRows().find(club=>club.team===team);
  if(scoped) return scoped;
  if(activeFootballLeague==='super-lig' || activeFootballLeague==='all'){
    return SUPER_LIG_CLUBS_2026_27.find(club=>club.team===team)||null;
  }
  return null;
}
function clubMapTarget(club){ return [club.stadium,club.city].filter(Boolean).join(', '); }
function clubDirectionsURL(club){ return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clubMapTarget(club))}`; }
function clubMapEmbedURL(club){ return `https://www.google.com/maps?q=${encodeURIComponent(clubMapTarget(club))}&output=embed`; }
function clubCoachBio(coach,team){
  if(!coach?.name) return 'Doğrulanmış teknik direktör kaydı henüz yayınlanmadı.';
  const contract=coach.contract&&coach.contract!=='Açıklanmadı'?` Sözleşme bitişi ${coach.contract} olarak listeleniyor.`:' Sözleşme bitiş tarihi kaynakta açıklanmadı.';
  return `${coach.age?`${coach.age} yaşındaki `:''}${coach.nationality?`${coach.nationality} futbol insanı `:''}${coach.name}, ${team} A takımının teknik sorumlusu. Görev süresi ${coach.tenure||'güncel kaynakta listeleniyor'}.${contract}`;
}
function clubLineupHTML(data,state){
  if(state==='loading') return `<div class="club-data-state"><span class="club-data-spinner"></span><strong>Son resmî maç kadrosu alınıyor</strong><p>Resmî kadro ve oyuncu kayıtları kontrol ediliyor.</p></div>`;
  const lineup=Array.isArray(data?.lineup)?data.lineup:[];
  if(!lineup.length){
    const message=state==='unconfigured'?'Canlı kadro bağlantısı henüz yayın ortamında aktif değil. Bağlantı açıldığında son resmî maçın gerçek ilk 11’i burada otomatik yayınlanacak.':'Son resmî maç için doğrulanmış ilk 11 henüz veri kaynağında yayınlanmadı.';
    return `<div class="club-data-state"><span class="club-data-mark">11</span><strong>İsim uydurulmuyor</strong><p>${escapeHTML(message)}</p></div>`;
  }
  const pitch=clubPitchHTML(lineup,data?.formation);
  return `${pitch}<div class="club-lineup-list">${lineup.map((player,index)=>{
    const photo=safeExternalURL(player.image);
    return `<article class="club-lineup-player"><span class="club-lineup-order">${String(index+1).padStart(2,'0')}</span><span class="club-player-photo">${photo?`<img src="${escapeHTML(photo)}" alt="${escapeHTML(player.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:escapeHTML(String(player.name||'?').slice(0,2).toLocaleUpperCase('tr-TR'))}</span><span><strong>${escapeHTML(player.name||'Oyuncu')}</strong><small>${player.number?`${escapeHTML(player.number)} · `:''}${escapeHTML(player.position||'Pozisyon')}</small></span></article>`;
  }).join('')}</div>`;
}
function clubSlug(team){
  return String(team||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function clubPitchHTML(lineup,formation){
  if(!Array.isArray(lineup)||lineup.length<11) return '';
  const parts=String(formation||'4-3-3').split('-').map(Number).filter(n=>Number.isFinite(n)&&n>0);
  const lines=parts.reduce((sum,n)=>sum+n,0)===10?parts:[4,3,3];
  const rows=[[lineup[0]]]; let cursor=1;
  lines.forEach(count=>{ rows.push(lineup.slice(cursor,cursor+count)); cursor+=count; });
  return `<div class="club-pitch" aria-label="${escapeHTML(formation||'4-3-3')} saha dizilişi"><div class="club-pitch-lines" aria-hidden="true"></div>${rows.map((row,rowIndex)=>row.map((player,index)=>{ const photo=safeExternalURL(player.image); const left=((index+1)/(row.length+1))*100; const top=91-(rowIndex/(rows.length-1))*82; return `<span class="club-pitch-player" style="--pitch-left:${left}%;--pitch-top:${top}%"><span class="club-pitch-photo">${photo?`<img src="${escapeHTML(photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:escapeHTML(String(player.name||'?').slice(0,2).toLocaleUpperCase('tr-TR'))}</span><b>${escapeHTML(player.number||'')}</b><small>${escapeHTML(player.name||'Oyuncu')}</small></span>`; }).join('')).join('')}</div>`;
}
function clubSquadHTML(data){
  const squad=Array.isArray(data?.squad)?data.squad:[];
  if(!squad.length) return '';
  return `<details class="club-squad-drawer"><summary>Güncel kadronun tamamı <span>${squad.length} oyuncu</span></summary><div class="club-squad-grid">${squad.map(player=>{ const photo=safeExternalURL(player.image); return `<span><span class="club-squad-photo">${photo?`<img src="${escapeHTML(photo)}" alt="${escapeHTML(player.name||'Oyuncu')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:escapeHTML(String(player.name||'?').slice(0,2).toLocaleUpperCase('tr-TR'))}</span><b>${escapeHTML(player.number||'—')}</b><span class="club-squad-name">${escapeHTML(player.name||'Oyuncu')}<small>${escapeHTML(player.position||'')}</small></span></span>`; }).join('')}</div></details>`;
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
  const sourceState=state==='loading'?'Veri yenileniyor':state==='unconfigured'?'Veri bağlantısı doğrulanıyor':data?.stale?'Son doğrulanmış veri':'Güncel resmî veri';
  const marketLink=club.marketSourceUrl?`<a href="${escapeHTML(club.marketSourceUrl)}" target="_blank" rel="noopener noreferrer">Transfermarkt kaynağı ↗</a>`:'<small>Piyasa değeri kaynağı henüz bağlı değil</small>';
  const coachLink=club.coachSourceUrl?`<a href="${escapeHTML(club.coachSourceUrl)}" target="_blank" rel="noopener noreferrer">Teknik direktör kaynağı ↗</a>`:'<small>Teknik direktör verisi sağlayıcıdan gelecek</small>';
  panel.hidden=false;
  panel.innerHTML=`<header class="club-profile-head"><button class="club-profile-close" type="button" onclick="closeClubProfile()" aria-label="Kulüp merkezini kapat">×</button><div class="club-profile-identity">${crestHTML(club.team,'lg')}<div><span class="football-data-eyebrow">KULÜP MERKEZİ · ${escapeHTML(club.checkedAt)}</span><h2>${escapeHTML(club.display||club.team)}</h2><p>${escapeHTML(club.city)} · ${escapeHTML(venue)}</p></div></div><span class="club-source-state">${escapeHTML(sourceState)}</span></header>
    <div class="club-profile-metrics"><article><span>Kadro değeri</span><strong>${escapeHTML(club.marketValue||'—')}</strong>${marketLink}</article><article><span>Kadro genişliği</span><strong>${escapeHTML(data?.squad?.length||club.squadSize||'—')}</strong><small>oyuncu</small></article><article><span>Yaş ortalaması</span><strong>${escapeHTML(club.averageAge||'—')}</strong><small>sezon kadrosu</small></article><article><span>Stadyum kapasitesi</span><strong>${escapeHTML(club.capacity)}</strong><small>seyirci</small></article></div>
    <div class="club-profile-main"><article class="club-stadium-feature"><div class="club-feature-title"><div><span>STADYUM VE ULAŞIM</span><h3>${escapeHTML(venue)}</h3><p>${escapeHTML(club.city)}</p></div><a href="${escapeHTML(clubDirectionsURL(club))}" target="_blank" rel="noopener noreferrer">Yol tarifi al ↗</a></div><iframe src="${escapeHTML(clubMapEmbedURL(club))}" title="${escapeHTML(venue)} haritası" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></article>
      <article class="club-coach-feature"><div class="club-coach-photo"><span class="club-coach-portrait">${coachPhoto?`<img src="${escapeHTML(coachPhoto)}" alt="${escapeHTML(coach.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<b aria-hidden="true">${escapeHTML(String(coach.name||'Teknik Direktör').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('tr-TR'))}</b></span></div><div class="club-coach-copy"><span>TEKNİK DİREKTÖR</span><h3>${escapeHTML(coach.name||'Bilgi bekleniyor')}</h3><p>${escapeHTML(clubCoachBio(coach,club.display||club.team))}</p><dl><div><dt>Ülke</dt><dd>${escapeHTML(coach.nationality||'—')}</dd></div><div><dt>Görev</dt><dd>${escapeHTML(coach.tenure||'—')}</dd></div><div><dt>Sözleşme</dt><dd>${escapeHTML(coach.contract||'—')}</dd></div></dl>${coachLink}</div></article></div>
    <article class="club-lineup-feature"><header><div><span>SON RESMÎ MAÇ</span><h3>Güncel ilk 11</h3><p>${escapeHTML(lineupMeta)}</p></div>${data?.formation?`<strong>${escapeHTML(data.formation)}</strong>`:''}</header>${clubLineupHTML(data,state)}${clubSquadHTML(data)}</article>`;
}
async function loadClubProfile(team){
  const cacheId=`${activeFootballLeague}:${team}`;
  if(clubProfileCache.has(cacheId)){ renderClubProfile(team,clubProfileCache.get(cacheId),'ready'); return; }
  renderClubProfile(team,null,'loading');
  try{
    const providerTeamId=clubRecord(team)?.providerTeamId||'';
    const providerSeasonId=clubRecord(team)?.providerSeasonId||'';
    const providerTeamImage=clubRecord(team)?.logo||TEAM_CRESTS[team]||'';
    const response=await fetch(`/api/football/club?team=${encodeURIComponent(team)}&teamId=${encodeURIComponent(providerTeamId)}&seasonId=${encodeURIComponent(providerSeasonId)}&teamImage=${encodeURIComponent(providerTeamImage)}`,{headers:{Accept:'application/json'},cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if(response.status===503){ renderClubProfile(team,null,'unconfigured'); return; }
    if(!response.ok||!payload?.team) throw new Error(payload?.error||'club_data_unavailable');
    if(payload?.team?.image && safeExternalURL(payload.team.image)) TEAM_CRESTS[team]=payload.team.image;
    clubProfileCache.set(cacheId,payload); renderClubProfile(team,payload,'ready');
  }catch(_){ renderClubProfile(team,null,'unavailable'); }
}
function openClubProfile(team,updateUrl=true){
  if(!clubRecord(team)) return; activeClubProfileTeam=team; loadClubProfile(team);
  activeFootballSection='clubs';
  if(updateUrl && typeof updatePath==='function') updatePath(buildFootballPath(activeFootballLeague,'clubs','confirmed',clubSlug(team)));
  const panel=document.getElementById('clubProfilePanel'); if(panel) requestAnimationFrame(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}));
}
function openClubProfileBySlug(slug,updateUrl=false){ const club=leagueTeamSourceRows().find(row=>clubSlug(row.team)===clubSlug(slug)); if(club) openClubProfile(club.team,updateUrl); }
function closeClubProfile(updateUrl=true){ const panel=document.getElementById('clubProfilePanel'); activeClubProfileTeam=null; if(panel){ panel.hidden=true; panel.innerHTML=''; } if(updateUrl&&typeof updatePath==='function') updatePath(buildFootballPath(activeFootballLeague,'clubs')); }
function standingFormHTML(form){
  return `<span class="standing-form" aria-label="Son beş maç">${String(form||'').split('').map(result=>`<i class="${result==='W'?'win':result==='D'?'draw':'loss'}" title="${result==='W'?'Galibiyet':result==='D'?'Beraberlik':'Mağlubiyet'}">${result==='W'?'✓':result==='D'?'−':'×'}</i>`).join('')}</span>`;
}
function standingRowsForActiveLeague(){
  const direct=STANDINGS.filter(row=>{
    const slug=competitionSlug(row.competition||row.league||row.tournament||row.source||'');
    return activeFootballLeague==='all' ? true : slug===activeFootballLeague;
  }).map(row=>({...row,sourceType:'provider'}));
  if(direct.length) return direct.sort((a,b)=>(b.points||0)-(a.points||0)||(b.goal_difference||0)-(a.goal_difference||0)||(b.goals_for||0)-(a.goals_for||0));
  const table=new Map();
  const ensure=(team)=>{
    if(!team) return null;
    const key=String(team).toLocaleLowerCase('tr-TR');
    if(!table.has(key)) table.set(key,{team,played:0,won:0,drawn:0,lost:0,goals_for:0,goals_against:0,goal_difference:0,points:0,form:'',sourceType:'computed'});
    return table.get(key);
  };
  MATCHES.filter(matchInActiveLeague).forEach(match=>{
    const home=ensure(match.ev), away=ensure(match.konuk), result=getResult(match.id);
    if(!home||!away||!result) return;
    const hg=Number(result.home), ag=Number(result.away);
    if(!Number.isFinite(hg)||!Number.isFinite(ag)) return;
    home.played+=1; away.played+=1; home.goals_for+=hg; home.goals_against+=ag; away.goals_for+=ag; away.goals_against+=hg;
    if(hg>ag){ home.won+=1; home.points+=3; away.lost+=1; home.form+='W'; away.form+='L'; }
    else if(hg<ag){ away.won+=1; away.points+=3; home.lost+=1; home.form+='L'; away.form+='W'; }
    else { home.drawn+=1; away.drawn+=1; home.points+=1; away.points+=1; home.form+='D'; away.form+='D'; }
    home.goal_difference=home.goals_for-home.goals_against;
    away.goal_difference=away.goals_for-away.goals_against;
  });
  const computed=[...table.values()].sort((a,b)=>(b.points||0)-(a.points||0)||(b.goal_difference||0)-(a.goal_difference||0)||String(a.team).localeCompare(String(b.team),'tr'));
  if(computed.length) return computed;
  if(activeFootballLeague==='super-lig') return HISTORIC_STANDINGS_2024_25.map(row=>({...row,sourceType:'historic'}));
  return computed;
}

/* ---- Puan durumu kaynak etiketleme ----
   standingRowsForActiveLeague() üç kademeli fallback döndürür:
   provider (sağlayıcı canlı tablosu) → computed (maç sonuçlarından hesaplanan)
   → historic (yalnız Süper Lig, 2024-25 final tablosu arşivi).
   Site dili güncel sezonu anlattığı için arşiv tablosunun geçici/geçmiş
   olduğu kullanıcıya HER görünümde açıkça belirtilir. */
const STANDINGS_ARCHIVE_SEASON = '2024–25';
function standingsSourceType(rows){
  const list = rows || standingRowsForActiveLeague();
  if(!list.length) return 'empty';
  if(list.some(row=>row.sourceType==='provider')) return 'provider';
  if(list.some(row=>row.sourceType==='historic')) return 'historic';
  return 'computed';
}
function isArchiveStandings(rows){ return standingsSourceType(rows)==='historic'; }
/* Arşiv tablosunun üstüne konan uyarı bandı. Boş string = arşiv değil. */
function standingsArchiveBannerHTML(rows){
  if(!isArchiveStandings(rows)) return '';
  return `<div class="standings-archive-banner" role="note">
    <span class="standings-archive-tag">ARŞİV</span>
    <div class="standings-archive-copy">
      <strong>${escapeHTML(STANDINGS_ARCHIVE_SEASON)} final tablosu gösteriliyor</strong>
      <p>Bu güncel sezon tablosu değildir. Güncel sezonun resmî puan durumu sağlayıcıdan geldiği anda bu alan otomatik olarak güncel tabloyla değişir.</p>
    </div>
  </div>`;
}
/* Sezon rozetlerinde kullanılacak kısa etiket. */
function standingsSeasonBadge(rows){
  const type=standingsSourceType(rows);
  if(type==='historic') return { label:`${STANDINGS_ARCHIVE_SEASON} arşiv`, note:'Geçmiş sezon · güncel değil', archive:true };
  if(type==='computed') return { label:'Güncel sezon', note:'Oynanan maç sonuçlarından hesaplandı', archive:false };
  if(type==='provider') return { label:'Güncel sezon', note:'Sağlayıcı resmî tablosu', archive:false };
  return { label:'Güncel sezon', note:'Tablo verisi bekleniyor', archive:false };
}
function renderTransferCenterFilters(){
  const select=document.getElementById('transferClubFilter'); if(!select) return;
  const scopedClubs=leagueTeamSourceRows().map(club=>club.team);
  if(!scopedClubs.length){ select.innerHTML='<option value="all">Tüm kulüpler</option>'; select.value='all'; select.disabled=true; return; }
  select.disabled=false;
  const clubs=scopedClubs.sort((a,b)=>String(a).localeCompare(String(b),'tr'));
  select.innerHTML=`<option value="all">Tüm kulüpler</option>${clubs.map(team=>`<option value="${escapeHTML(team)}">${escapeHTML(team)}</option>`).join('')}`;
  select.value=clubs.includes(activeTransferClub)?activeTransferClub:'all';
}
function setTransferClubFilter(team){
  const clubs=leagueTeamSourceRows().map(club=>club.team);
  activeTransferClub=clubs.includes(team)?team:'all';
  renderTransferCenter();
}
// Sabit portre hotlinkleri tutulmaz. Saglayici lisansli photo alani dondururse
// kullanilir; aksi halde transferPlayerPhotoHTML tipografik bas harf gosterir.
const TRANSFER_PLAYER_PHOTOS=Object.freeze({});
const leagueTransferCache=new Map();
const leagueTransferRequests=new Map();
const leagueTransferControllers=new Map();
function abortLeagueTransferRequestsExcept(leagueKey){
  leagueTransferControllers.forEach((controller,scope)=>{
    if(leagueKey&&scope===leagueKey) return;
    controller.abort();
    leagueTransferControllers.delete(scope);
    leagueTransferRequests.delete(scope);
  });
}
if(typeof window!=='undefined') window.addEventListener('xyz:football-league-change',event=>{
  const nextLeague=event?.detail?.league;
  abortLeagueTransferRequestsExcept(nextLeague&&nextLeague!=='all'?nextLeague:null);
});
function leagueTeamNamesForKey(leagueKey){
  if(!leagueKey || leagueKey==='all') return [];
  const teamSet=new Set();
  const add=(value)=>{ if(value) teamSet.add(value); };
  if(leagueKey==='super-lig'){
    for(const club of SUPER_LIG_CLUBS_2026_27) add(club.team);
  }
  if(Array.isArray(LEAGUE_FALLBACK_CLUBS[leagueKey])){
    for(const team of LEAGUE_FALLBACK_CLUBS[leagueKey]) add(team);
  }
  STANDINGS.filter(row=>competitionSlug(row.competition||row.league||row.tournament||row.source)===leagueKey).forEach(row=>add(row.team));
  MATCHES.filter(match=>competitionSlug(competitionName(match))===leagueKey).forEach(match=>{
    add(match.ev); add(match.konuk);
  });
  if(leagueKey===activeFootballLeague){
    const liveNames=[...MATCHES.filter(matchInActiveLeague).flatMap(match=>[match.ev,match.konuk]),...standingRowsForActiveLeague().map(row=>row.team)].filter(Boolean);
    liveNames.forEach(team=>add(team));
  }
  if(teamSet.size) return [...teamSet];
  return [];
}
function transferPlayerPhotoHTML(item){
  const initials=item.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('');
  const photo=safeExternalURL(item.photo||TRANSFER_PLAYER_PHOTOS[item.name]);
  return `<span class="transfer-player-photo" aria-hidden="true"><span>${escapeHTML(initials)}</span>${photo?`<img src="${photo}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</span>`;
}
function transferRowsFromCache(leagueKey,tab){
  const cached=leagueTransferCache.get(leagueKey);
  // Transfer ekranında yerel/demo kayıt kullanma. Her lig yalnızca kendi
  // Sportmonks yanıtı geldikten sonra dolar.
  if(!cached) return [];
  if(tab==='confirmed') return cached.confirmed||[];
  if(tab==='rumours') return cached.rumours||[];
  if(tab==='talks') return [...(cached.confirmed||[]),...(cached.rumours||[])].filter(item=>/görüş|talk|negotiation|süreç/i.test(`${item.status||''} ${item.detail||''}`));
  return [];
}
function dedupeTransferRows(rows){
  const seen=new Set();
  return rows.filter(item=>{
    const key=normalizeLoose([item.name,item.from,item.to,item.status].join('|'));
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function leagueTransferRecords(tab=activeTransferCenterTab){
  if(activeFootballLeague==='all'){
    const rows=[
      ...transferRowsFromCache('super-lig',tab),
      ...SELECTED_COMPETITIONS.filter(item=>!['super-lig','all'].includes(item.key)).flatMap(item=>transferRowsFromCache(item.key,tab))
    ];
    return dedupeTransferRows(rows).slice(0,24);
  }
  return transferRowsFromCache(activeFootballLeague,tab);
}
function normalizeApiTransfer(item){
  return {
    name:item.name||'Oyuncu',
    from:item.from||'Açıklanmadı',
    to:item.to||'Açıklanmadı',
    fee:item.fee||'Açıklanmadı',
    status:item.status||'Kaynaklı kayıt',
    detail:item.detail||item.date||'Sportmonks transfer kaydı',
    source:item.source||'Sportmonks',
    sourceUrl:safeExternalURL(item.sourceUrl)||'#',
    photo:safeExternalURL(item.photo)
  };
}
function requestLeagueTransferFeed(leagueKey){
  if(!leagueKey || leagueKey==='all') return Promise.resolve(true);
  if(leagueTransferCache.has(leagueKey)) return Promise.resolve(true);
  if(leagueTransferRequests.has(leagueKey)) return leagueTransferRequests.get(leagueKey);
  const teams=leagueTeamNamesForKey(leagueKey).slice(0,80).join('|');
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  if(controller) leagueTransferControllers.set(leagueKey,controller);
  const request=fetch(`/api/football/transfers?league=${encodeURIComponent(leagueKey)}&teams=${encodeURIComponent(teams)}`,{headers:{Accept:'application/json'},cache:'no-store',signal:controller?.signal})
    .then(async response=>{
      const payload=await response.json().catch(()=>({}));
      if(!response.ok || payload?.league!==leagueKey) throw new Error(payload?.error||'transfer_feed_scope_mismatch');
      leagueTransferCache.set(leagueKey,{
        confirmed:(payload.confirmed||[]).map(normalizeApiTransfer),
        rumours:(payload.rumours||[]).map(normalizeApiTransfer),
        errors:payload.errors||[],
        updatedAt:payload.updatedAt||new Date().toISOString()
      });
      return true;
    })
    .catch(error=>{
      if(error?.name==='AbortError') return false;
      leagueTransferCache.set(leagueKey,{confirmed:[],rumours:[],errors:[{message:error.message||'transfer_feed_unavailable'}],updatedAt:new Date().toISOString()});
      return false;
    })
    .finally(()=>{
      if(leagueTransferRequests.get(leagueKey)===request) leagueTransferRequests.delete(leagueKey);
      if(leagueTransferControllers.get(leagueKey)===controller) leagueTransferControllers.delete(leagueKey);
    });
  leagueTransferRequests.set(leagueKey,request);
  return request;
}
function ensureLeagueTransferFeed(){ return requestLeagueTransferFeed(activeFootballLeague); }
function ensureAllLeagueTransferFeeds(){
  return Promise.all(SELECTED_COMPETITIONS.filter(item=>item.key!=='all').map(item=>requestLeagueTransferFeed(item.key)));
}
function renderHistoricStandings(){
  const area=document.getElementById('historicStandingsTable'); if(!area) return;
  const rows=standingRowsForActiveLeague();
  const label=competitionLabelBySlug(activeFootballLeague);
  const sourceType=standingsSourceType(rows);
  const note=sourceType==='provider'
    ? `${label} için sağlayıcıdan gelen güncel puan tablosu`
    : sourceType==='computed'
      ? 'Sportmonks fikstür ve sonuç akışından hesaplanan güncel sezon tablosu'
      : sourceType==='historic'
        ? `${STANDINGS_ARCHIVE_SEASON} final tablosu · güncel sezon verisi henüz yayınlanmadı`
        : `${label} sezon verisi yayınlandığında puan tablosu burada görünür`;
  area.innerHTML=`${standingsArchiveBannerHTML(rows)}<div class="historic-standings-note">${escapeHTML(note)}</div><div class="historic-standings-head"><span>#</span><span>Takım</span><span>O</span><span>G</span><span>B</span><span>M</span><span>AG</span><span>YG</span><span>AV</span><strong>P</strong><span>Son 5</span></div><div class="historic-standings-body">${rows.map((row,index)=>`<div class="historic-standing-row ${row.zone||''}">
    <span class="historic-rank">${index+1}</span><span class="historic-team">${crestHTML(row.team,'xs')}<b>${escapeHTML(row.team)}</b></span><span>${row.played}</span><span>${row.won}</span><span>${row.drawn}</span><span>${row.lost}</span><span>${row.goals_for}</span><span>${row.goals_against}</span><span>${row.goal_difference>0?'+':''}${row.goal_difference}</span><strong>${row.points}</strong>${standingFormHTML(row.form)}
  </div>`).join('')}</div>`;
}
function renderTransferCenter(){
  const area=document.getElementById('transferCenterList');
  const summary=document.getElementById('transferCenterSummary');
  if(!area || !summary || activeFootballSection!=='transfers') return;
  renderTransferCenterFilters();
  if(activeFootballLeague==='all' && !SELECTED_COMPETITIONS.filter(item=>item.key!=='all').every(item=>leagueTransferCache.has(item.key))){
    summary.innerHTML=`<strong>Tüm ligler transfer merkezi</strong><span>Seçili liglerin transfer ve söylenti kayıtları kontrol ediliyor.</span>`;
    area.innerHTML=`<div class="league-scoped-empty transfer-provider-empty is-loading"><span>Tümü</span><strong>Lig bazlı transfer verileri çekiliyor</strong><p>Seçili liglerin resmî işlem, görüşme ve söylenti kayıtları aynı merkezde toplanacak.</p></div><div class="transfer-signal-shell" data-transfer-signals></div>`;
    ensureAllLeagueTransferFeeds().then(()=>{ if(activeFootballLeague==='all'&&activeFootballSection==='transfers') renderTransferCenter(); });
    renderTransferSignals(area.querySelector('[data-transfer-signals]'));
    return;
  }
  if(activeFootballLeague!=='all' && !leagueTransferCache.has(activeFootballLeague)){
    const label=competitionLabelBySlug(activeFootballLeague);
    const requestedLeague=activeFootballLeague;
    summary.innerHTML=`<strong>${escapeHTML(label)} transfer merkezi</strong><span>Sportmonks transfer ve söylenti kayıtları kontrol ediliyor.</span>`;
    area.innerHTML=`<div class="league-scoped-empty transfer-provider-empty is-loading"><span>${escapeHTML(label)}</span><strong>Canlı transfer verisi çekiliyor</strong><p>Oyuncu fotoğrafı, kulüp rotası, ücret ve kaynak alanları gerçek veri geldikçe burada görünecek.</p></div><div class="transfer-signal-shell" data-transfer-signals></div>`;
    ensureLeagueTransferFeed().then(()=>{ if(activeFootballLeague===requestedLeague&&activeFootballSection==='transfers') renderTransferCenter(); });
    renderTransferSignals(area.querySelector('[data-transfer-signals]'));
    return;
  }
  const allRecords=leagueTransferRecords(activeTransferCenterTab);
  const records=activeTransferClub==='all'?allRecords:allRecords.filter(item=>item.to===activeTransferClub || item.from===activeTransferClub);
  const descriptions={confirmed:'Kulüp veya kayıt kaynağında tamamlanmış olarak yer alan işlemler.',talks:'Yetkili açıklamasına dayanan, henüz sonuçlanmamış süreçler.',rumours:'Resmî olmayan iddialar. Her kayıt kaynak ve doğrulama durumu ile birlikte gösterilir.'};
  const label=competitionLabelBySlug(activeFootballLeague);
  summary.innerHTML=`<strong>${records.length} kayıt · ${activeTransferClub==='all'?label:escapeHTML(activeTransferClub)}</strong><span>${descriptions[activeTransferCenterTab]}</span>`;
  const feedState=leagueTransferCache.get(activeFootballLeague);
  area.innerHTML=records.length?`${records.map((item,index)=>`<article class="transfer-center-row ${item.status==='Kulüp yalanladı'?'denied':''}">
    <span class="transfer-center-index">${String(index+1).padStart(2,'0')}</span>
    ${transferPlayerPhotoHTML(item)}
    <div class="transfer-center-player"><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.detail||item.status)}</span></div>
    <div class="transfer-route-block"><span>${escapeHTML(item.from)}</span><b aria-hidden="true">→</b><span class="transfer-destination">${crestHTML(item.to,'xs')} ${escapeHTML(item.to)}</span></div>
    <div class="transfer-center-fee"><strong>${escapeHTML(item.fee)}</strong><span class="transfer-status-chip ${activeTransferCenterTab}">${escapeHTML(item.status)}</span></div>
    <a class="transfer-record-source" href="${escapeHTML(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.source)} ↗</a>
  </article>`).join('')}<div class="transfer-signal-shell" data-transfer-signals></div>`:`<div class="league-scoped-empty transfer-provider-empty"><span>${escapeHTML(label)}</span><strong>${feedState?.errors?.length?'Transfer verisi yetki/plan kontrolü istiyor':'Transfer veri alanı hazır'}</strong><p>${feedState?.errors?.length?'Sportmonks bu endpoint için boş veya kısıtlı yanıt verdi. Canlı X sinyalleri altta çalışmaya devam ediyor.':'Bu lig için Sportmonks transfer/rumour bağlantısı açıldığında oyuncu fotoğrafı, kulüp rotası, ücret ve kaynak etiketi burada aynı tabloda yayınlanacak. Kaynak gelmeden isim uydurulmuyor.'}</p></div><div class="transfer-signal-shell" data-transfer-signals></div>`;
  document.querySelectorAll('.transfer-center-tab').forEach(tab=>{ const active=tab.dataset.transferView===activeTransferCenterTab; tab.classList.toggle('active',active); tab.setAttribute('aria-selected',active?'true':'false'); });
  renderTransferSignals(area.querySelector('[data-transfer-signals]'));
}
function setTransferCenterTab(name, button, updateUrl){
  if(!['confirmed','talks','rumours'].includes(name)) return;
  activeTransferCenterTab=name;
  renderTransferCenter();
  if(updateUrl!==false && activeFootballSection==='transfers' && typeof updatePath==='function' && typeof buildFootballPath==='function'){
    updatePath(buildFootballPath(activeFootballLeague, 'transfers', activeTransferCenterTab));
  }
}
function renderFootballDataViews(){ renderMatchesLeagueFilters(); updateLeagueScopedCopy(); renderMatchesHub(); renderNewsHub(); renderLeagueClubs(); renderTransferCenter(); renderHistoricStandings(); }
let leagueTransitionTimer = null;
function playFootballLeagueTransition(fromKey, toKey){
  if(!document.body) return;
  const transitionClasses = SELECTED_COMPETITIONS.flatMap(item=>[`league-transition-from-${item.key}`,`league-transition-to-${item.key}`]);
  if(leagueTransitionTimer) clearTimeout(leagueTransitionTimer);
  leagueTransitionTimer = null;
  document.body.classList.remove('league-switching', ...transitionClasses);
}
function applyFootballLeagueTheme(){
  if(!document.body) return;
  const classes = SELECTED_COMPETITIONS.filter(item=>item.key!=='all').map(item=>`league-theme-${item.key}`);
  const key = SELECTED_COMPETITIONS.some(item=>item.key===activeFootballLeague) ? activeFootballLeague : 'all';
  if(document.body.dataset.footballLeague===key&&document.body.dataset.footballThemeReady==='1') return;
  const themes={
    all:['#f05a65','#8f96a3','#303841','#272f38','#1f272f','#202830','#2b343e'],
    'super-lig':['#e17e86','#e5cf89','#443b40','#352f34','#29262a','#282226','#403038'],
    'premier-league':['#7fd4b0','#c2a4d8','#3b384d','#302e40','#262533','#242330','#373349'],
    'la-liga':['#e28a9a','#e8cc78','#473942','#383038','#2b272e','#29242b','#40333d'],
    bundesliga:['#df6464','#f0c96b','#41383b','#342e31','#292629','#282326','#3d3034'],
    'serie-a':['#68a7df','#77c9a1','#34404c','#2b343e','#222a32','#202830','#303b46']
  };
  const values=themes[key]||themes.all;
  const names=['--league-accent','--league-accent-2','--league-bg-1','--league-bg-2','--league-bg-3','--league-nav','--league-nav-2'];
  document.body.classList.remove(...classes);
  if(!document.body.classList.contains('league-theme-all')) document.body.classList.add('league-theme-all');
  names.forEach((name,index)=>document.body.style.setProperty(name,values[index]));
  document.body.dataset.footballLeague = key;
  document.body.dataset.footballThemeReady = '1';
}
function renderFootballLeaguePickerInto(area){
  if(!area) return;
  applyFootballLeagueTheme();
  const commandTitle=document.getElementById('footballLeagueCommandTitle');
  if(commandTitle) commandTitle.textContent=competitionLabelBySlug(activeFootballLeague);
  area.innerHTML=SELECTED_COMPETITIONS.map(item=>{ const unavailable=footballCoverageUnavailable(item.key); return `<button class="${item.key===activeFootballLeague?'active ':''}${unavailable?'is-unavailable':''}" type="button" data-match-league="${escapeHTML(item.key)}" aria-pressed="${item.key===activeFootballLeague}" aria-disabled="${unavailable}" ${unavailable?'disabled':''} aria-label="${escapeHTML(item.label)}${unavailable?' · sağlayıcı kapsamı dışında':''}"><span>${escapeHTML(item.short)}</span><small>${escapeHTML(item.label)}${unavailable?' · kapsam dışı':''}</small></button>`; }).join('');
  area.querySelectorAll('[data-match-league]').forEach(button=>{ button.onclick=()=>selectFootballLeague(button.dataset.matchLeague); });
}
function updateLeagueScopedCopy(){
  const ctx=activeLeagueContext();
  const label=competitionLabelBySlug(activeFootballLeague);
  const summary=officialSeasonSummaryForLeague(activeFootballLeague);
  const setText=(id,value)=>{ const el=document.getElementById(id); if(el) el.textContent=value; };
  setText('footballMatchesKicker', `${label} · Maç Merkezi`);
  setText('footballMatchesNote', ctx.copy);
  setText('footballNewsKicker', ctx.agenda);
  setText('footballTransferKicker', ctx.transfer);
  setText('footballStandingsKicker', ctx.standings);
  setText('portalTeamStripNote', activeFootballLeague==='all'?'Önce lig seç, sonra takıma göre daralt.':'Takım listesi seçilen lige göre daralır.');
  setText('editorialDeskCopy', `${ctx.agenda}; resmî açıklama, kaynaklı iddia ve veri analizi ayrı etiketlenir.`);
  setText('footballMatchesViewKicker', `${label.toLocaleUpperCase('tr-TR')} · MAÇ MERKEZİ`);
  setText('footballMatchesViewCopy', `${ctx.copy} Canlı durum, yaklaşan fikstür ve tamamlanan karşılaşmalar aynı doğrulanmış akışta.`);
  setText('footballClubsViewKicker', `${label.toLocaleUpperCase('tr-TR')} · KULÜP MERKEZİ`);
  setText('footballClubsViewCopy', activeFootballLeague==='all'?'Lig seçimine göre kulüp merkezi, kadro değeri, stadyum ve teknik direktör alanları yenilenir.':`${label} kulüpleri için kadro değeri, stadyum, teknik direktör ve ilk 11 alanları.`);
  setText('footballStandingsViewKicker', `${label.toLocaleUpperCase('tr-TR')} · PUAN DURUMU`);
  setText('footballStandingsViewCopy', `${label} tablosu, form ve iç/dış saha kırılımları doğrulanmış sezon verisine göre yenilenir.`);
  setText('transferPeriodNote', activeFootballLeague==='super-lig'?'Yalnız Süper Lig hareketleri':`${label} kayıtları bu lig için ayrı yayınlanır`);
  const transferLeague=document.getElementById('transferLeagueStatic');
  if(transferLeague) transferLeague.innerHTML=`${escapeHTML(label)} <span>${escapeHTML(competitionShortBySlug(activeFootballLeague))}</span>`;
  const clubsSource=document.getElementById('footballClubsSourceLink');
  if(clubsSource){
    const clubSourceUrl=safeExternalURL(summary?.sourceLinks?.[0]?.url);
    clubsSource.style.display=clubSourceUrl && activeFootballLeague!=='all' ? 'inline-flex' : 'none';
    if(clubSourceUrl) clubsSource.href=clubSourceUrl;
  }
  const standingsSource=document.getElementById('footballStandingsSourceLink');
  if(standingsSource){
    const standingsSourceUrl=safeExternalURL(summary?.sourceLinks?.[0]?.url);
    standingsSource.style.display=standingsSourceUrl && activeFootballLeague!=='all' ? 'inline-flex' : 'none';
    if(standingsSourceUrl) standingsSource.href=standingsSourceUrl;
  }
  const seasonCard=document.querySelector('.standings-season-card');
  if(seasonCard){
    // Sezon rozeti artık tablonun gerçek kaynağını yansıtır: arşiv tablosu
    // gösteriliyorsa rozet de "arşiv" olarak işaretlenir.
    const badge=standingsSeasonBadge();
    const seasonLabel=badge.archive ? badge.label : (summary?.season || badge.label);
    const seasonNote=badge.archive ? badge.note : (summary?.championNote || badge.note);
    seasonCard.classList.toggle('is-archive', badge.archive);
    seasonCard.innerHTML=`<span>Sezon</span><strong>${escapeHTML(seasonLabel)}</strong><small>${escapeHTML(seasonNote)}</small>`;
  }
}
function footballTeamOptions(){
  const matchTeams=MATCHES.filter(matchInActiveLeague).flatMap(match=>[match.ev,match.konuk]);
  const standingTeams=standingRowsForActiveLeague().map(row=>row.team);
  const names=[...matchTeams,...standingTeams].filter(Boolean);
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
  renderFootballTeamStrip(); renderFootballQuickMatches(); renderMatchesHub(); renderFootballNews(); renderNewsHub(); renderFootballTransfers(); renderEditorialNews();
  if(activeFootballTeam!=='Tümü'){ openFootballSection('clubs',null,false); openClubProfile(activeFootballTeam,true); }
}
function renderMatchesLeagueFilters(){
  renderFootballLeaguePickerInto(document.getElementById('footballTopLeagueStrip'));
  renderFootballLeaguePickerInto(document.getElementById('footballLeagueStrip'));
  renderFootballLeaguePickerInto(document.getElementById('matchesLeagueFilters'));
}
function selectFootballLeague(key){
  const previousLeague=activeFootballLeague;
  const requestedLeague=SELECTED_COMPETITIONS.some(item=>item.key===key) ? key : 'super-lig';
  playFootballLeagueTransition(previousLeague, requestedLeague);
  activeFootballLeague=requestedLeague;
  applyFootballLeagueTheme();
  loadFootballLeagueSelection(requestedLeague);
  if(typeof updatePath==='function' && typeof buildFootballPath==='function') updatePath(buildFootballPath(activeFootballLeague, activeFootballSection, activeTransferCenterTab));
}

/* ===================== RESMÎ KULÜP X AKIŞI ===================== */
function rankedXClubs(){
  const sourceClubs=X_CLUBS_BY_LEAGUE?.[activeFootballLeague]||[];
  const orderedStandings=standingRowsForActiveLeague().sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity) || (b.goal_difference??-Infinity)-(a.goal_difference??-Infinity) || (b.goals_for??-Infinity)-(a.goals_for??-Infinity));
  const rankByTeam=new Map(orderedStandings.map((row,index)=>[row.team,index+1]));
  return sourceClubs.map((club,index)=>({ ...club, leagueRank:rankByTeam.get(club.team)??null, fallbackOrder:index }))
    .sort((a,b)=>(a.leagueRank??99)-(b.leagueRank??99) || a.fallbackOrder-b.fallbackOrder);
}
function xPostDate(value){
  const date=new Date(value); if(!value||Number.isNaN(date.getTime())) return 'Güncel paylaşım';
  return date.toLocaleDateString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
}
function xMetric(value){
  return new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1}).format(Number(value)||0);
}
function xMediaPreviewURL(media){
  const candidate=media?.type==='photo'?media?.url:(media?.preview_image_url||media?.url);
  return safeExternalURL(candidate);
}
function xPostDisplayText(post){
  if(!post) return '';
  const translated=post.translated_text_tr && normalizeLoose(post.translated_text_tr)!==normalizeLoose(post.text) ? post.translated_text_tr : '';
  return translated || post.text || '';
}
function xPostHasMedia(post){
  return Array.isArray(post?.media) && post.media.some(item=>xMediaPreviewURL(item));
}
const X_FEED_TOGGLE_KEY = "xyzskor.xFeedEnabled.v2";
let xFeedsEnabled = true;
(() => {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("x_feeds") === "on") {
      localStorage.setItem(X_FEED_TOGGLE_KEY, "1");
      xFeedsEnabled = true;
    } else if (params.get("x_feeds") === "off") {
      localStorage.setItem(X_FEED_TOGGLE_KEY, "0");
      xFeedsEnabled = false;
    } else {
      const stored = localStorage.getItem(X_FEED_TOGGLE_KEY);
      if (stored === null) {
        localStorage.setItem(X_FEED_TOGGLE_KEY, "1");
        xFeedsEnabled = true;
      } else {
        xFeedsEnabled = stored !== "0";
      }
    }
  } catch {
    xFeedsEnabled = true;
  }
})();
function isXFeedPaused() {
  return !xFeedsEnabled;
}
let xClubPostsRequest=null;
function fetchLeagueXMediaPayload(){
  const requestedLeague=activeFootballLeague;
  if (isXFeedPaused()) {
    const payload={
      source:'x-api',
      league:requestedLeague,
      status:'paused',
      clubs: rankedXClubs().map(club=>({...club,post:null,account_found:true,upstream_error:'x_feed_paused'})),
      publishers:[],
      updated_at:new Date().toISOString(),
    };
    return Promise.resolve(payload);
  }
  if(!xClubPostsRequest||xClubPostsRequest.league!==requestedLeague){
    const request=fetch('/api/football/x-media'+`?league=${encodeURIComponent(requestedLeague)}&v=2`,{headers:{Accept:'application/json'},cache:'no-store'}).then(async response=>{
      const payload=await response.json().catch(()=>null);
      if(!response.ok||payload?.league!==requestedLeague||!Array.isArray(payload?.clubs)) throw new Error(payload?.error||'X veri katmanı hazır değil.');
      return payload;
    });
    xClubPostsRequest={league:requestedLeague,promise:request};
  }
  return xClubPostsRequest.promise;
}
async function loadXClubPosts(){
  const stage=document.getElementById('clubSocialStage'); const clubs=rankedXClubs(); if(!stage||!clubs.length) return;
  const label=competitionLabelBySlug(activeFootballLeague);
  if (isXFeedPaused()) {
    stage.innerHTML=xEmptyFeedHTML(clubs,label,'paused');
    return;
  }
  stage.innerHTML=`<div class="club-social-loading"><span></span><strong>${escapeHTML(label)} kulüp paylaşımları yükleniyor…</strong></div>`;
  try{
    const requestedLeague=activeFootballLeague;
    if(!xClubPostsRequest||xClubPostsRequest.league!==requestedLeague){
      const request=fetch('/api/football/x-media'+`?league=${encodeURIComponent(requestedLeague)}&v=2`,{headers:{Accept:'application/json'},cache:'no-store'}).then(async response=>{
      const payload=await response.json().catch(()=>null);
      if(!response.ok||payload?.league!==requestedLeague||!Array.isArray(payload?.clubs)) throw new Error(payload?.error||'X veri katmanı hazır değil.');
      return payload;
      });
      xClubPostsRequest={league:requestedLeague,promise:request};
    }
    const payload=await xClubPostsRequest.promise;
    if(activeFootballLeague!==requestedLeague) return;
    const apiClubs=new Map((payload.clubs||[]).map(club=>[String(club.handle||'').toLocaleLowerCase('tr-TR'),club]));
    const apiPublishers=new Map((payload.publishers||[]).map(club=>[String(club.handle||'').toLocaleLowerCase('tr-TR'),club]));
    const feedItems=clubs.map(club=>({...club,...(apiClubs.get(club.handle.toLocaleLowerCase('tr-TR'))||{})}))
      .concat((payload.publishers||[]).map(publisher=>({...publisher,...(apiPublishers.get(publisher.handle.toLocaleLowerCase('tr-TR'))||{})})));
    const populated=feedItems.filter(item=>item.post);
    stage.innerHTML=populated.length ? populated.map(xPostCardHTML).join('') : xEmptyFeedHTML(feedItems,label,payload.status);
  }catch(error){
    xClubPostsRequest=null;
    const code=/credit|402|payment/i.test(String(error?.message||''))?'x_credits_depleted':'unavailable';
    stage.innerHTML=xEmptyFeedHTML(clubs,label,code);
  }
}
function scrollClubSocial(direction){
  const stage=document.getElementById('clubSocialStage'); if(!stage) return;
  const card=stage.querySelector('.club-social-card');
  const step=card?card.getBoundingClientRect().width+1:stage.clientWidth*.82;
  stage.scrollBy({left:(direction<0?-1:1)*step,behavior:'smooth'});
}
let preseasonPostsRequest=null;
async function loadPreseasonPosts(){
  const stage=document.getElementById('preseasonSocialStage'); const clubs=rankedXClubs(); if(!stage||!clubs.length) return;
  const label=competitionLabelBySlug(activeFootballLeague);
  if (isXFeedPaused()) {
    stage.innerHTML=clubs.map(club=>preseasonCardHTML({...club,preseason_post:null,account_found:true,upstream_error:'x_feed_paused'})).join('');
    return;
  }
  stage.innerHTML=`<div class="club-social-loading"><span></span><strong>${escapeHTML(label)} hazırlık maçı akışı yükleniyor…</strong></div>`;
  try{
    const requestedLeague=activeFootballLeague;
    if(!preseasonPostsRequest||preseasonPostsRequest.league!==requestedLeague){
      const request=fetch('/api/football/x-preseason'+`?league=${encodeURIComponent(requestedLeague)}&v=2`,{headers:{Accept:'application/json'},cache:'no-store'}).then(async response=>{
        const payload=await response.json().catch(()=>null);
        if(!response.ok||payload?.league!==requestedLeague||!Array.isArray(payload?.clubs)) throw new Error(payload?.error||'Hazırlık maçı akışı hazır değil.');
        return payload;
      });
      preseasonPostsRequest={league:requestedLeague,promise:request};
    }
    const payload=await preseasonPostsRequest.promise;
    if(activeFootballLeague!==requestedLeague) return;
    const apiClubs=new Map((payload.clubs||[]).map(club=>[String(club.handle||'').toLocaleLowerCase('tr-TR'),club]));
    const mergedClubs=clubs.map(club=>({...club,...(apiClubs.get(club.handle.toLocaleLowerCase('tr-TR'))||{})}));
    stage.innerHTML=mergedClubs.map(club=>preseasonCardHTML(club)).join('');
  }catch(error){
    preseasonPostsRequest=null;
    const code=/credit|402|payment/i.test(String(error?.message||''))?'x_credits_depleted':'unavailable';
    stage.innerHTML=clubs.map(club=>preseasonCardHTML({...club,preseason_post:null,account_found:true,upstream_error:code})).join('');
  }
}
function scrollPreseasonSocial(direction){
  const stage=document.getElementById('preseasonSocialStage'); if(!stage) return;
  const card=stage.querySelector('.preseason-social-card,.club-social-card');
  const step=card?card.getBoundingClientRect().width+1:stage.clientWidth*.82;
  stage.scrollBy({left:(direction<0?-1:1)*step,behavior:'smooth'});
}
function cardMentionsFootballTeam(card, team){
  if(team==='Tümü') return true;
  const fields=[card.team,card.related_team,card.title,card.text,card.summary,card.spot,card.body,card.content].filter(Boolean).join(' ');
  return fields.toLocaleLowerCase('tr-TR').includes(String(team).toLocaleLowerCase('tr-TR'));
}
function renderPortalSponsor(){
  const rail=document.getElementById('portalSponsorRail');
  const reward=Object.entries(REWARDS).flatMap(([team,items])=>(items||[]).map(item=>({team,item}))).find(entry=>entry.item&&entry.item.aciklama&&entry.item.aciklama!=='—');
  const rewardTitle=reward?escapeHTML(reward.item.aciklama):'Haftalık ödül programı güncelleniyor';
  const rewardNote=reward?`${escapeHTML(reward.team)} · ${escapeHTML(reward.item.sira)}. sıra ödülü`:'Yeni ödül duyurusu yayınlandığında burada görünecek.';
  if(rail) rail.innerHTML=`<div class="portal-rail-label">Ödül sponsoru</div><div class="portal-rail-title">${rewardTitle}</div><div class="portal-rail-note">${rewardNote}<br>Ürün satışı yapılmaz; açıklanan ödüller yarışma kazananlarına verilir.</div><div class="portal-rail-mark">MYTHOS CARDS · RESMÎ SPONSOR</div>`;
}
function fmtEditorialDate(value){
  const date=new Date(value); if(!value || Number.isNaN(date.getTime())) return value ? String(value) : '';
  return date.toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'});
}
function explicitMatchState(m){
  const status=normalizeClientFootballStatus(m.status);
  if(status==='live') return { label:'Canlı', live:true };
  if(status==='halftime') return { label:'Devre arası', live:true };
  if(status==='postponed') return { label:'Ertelendi', live:false };
  if(status==='cancelled') return { label:'İptal', live:false };
  if(status==='finished' || m.result || getResult(m.id)) return { label:'Bitti', live:false };
  return { label:new Date(m.kickoff).getTime()>Date.now() ? 'Yaklaşan' : 'Sonuç açıklanmadı', live:false };
}
function matchIsCurrentFixture(match){
  if(!match) return false;
  const status=String(match.status||match.state||'').toLocaleLowerCase('tr-TR');
  if(/finished|ended|after|ft|tamamland/.test(status) || getResult(match.id)) return false;
  const kickoff=new Date(match.kickoff).getTime();
  return Number.isFinite(kickoff) && kickoff>Date.now()-3*60*60*1000;
}
function matchDayKey(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function leagueMatchDaySelection(matches,now=Date.now()){
  const valid=matches.filter(match=>matchDayKey(match.kickoff));
  const today=matchDayKey(now);
  const todayRows=valid.filter(match=>matchDayKey(match.kickoff)===today).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  if(todayRows.length) return {key:today,rows:todayRows,isToday:true};
  const future=valid.filter(match=>new Date(match.kickoff).getTime()>now&&!footballStatusIsUnavailable(match)).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  if(future.length){ const key=matchDayKey(future[0].kickoff); return {key,rows:future.filter(match=>matchDayKey(match.kickoff)===key),isToday:false}; }
  const past=valid.sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff));
  const key=past.length?matchDayKey(past[0].kickoff):'';
  return {key,rows:past.filter(match=>matchDayKey(match.kickoff)===key),isToday:false};
}
function footballQuickMatchRows(){
  const base=MATCHES.filter(match=>matchInActiveLeague(match) && matchInActiveTeam(match));
  const featured=homeFeaturedMatch();
  const remaining=featured?base.filter(match=>match.id!==featured.id):base;
  return leagueMatchDaySelection(remaining).rows;
}
function homeFeaturedMatch(){
  return matchesForActiveLeague().filter(match=>matchInActiveTeam(match)&&matchIsCurrentFixture(match)).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff))[0]||null;
}
function renderFootballQuickMatches(){
  const area = document.getElementById('footballQuickMatches'); if(!area) return;
  if(DATA_ERRORS.matches){ area.innerHTML=footballEmpty('Fikstür alınamadı','Haberler ve puan durumu gibi diğer Futbol modüllerini kullanmaya devam edebilirsin.'); return; }
  const rows = footballQuickMatchRows();
  if(!rows.length){ area.innerHTML=footballEmpty('Maç bulunmuyor','Yayınlanmış fikstür veya doğrulanmış canlı maç kaydı henüz yok.'); return; }
  const title=document.getElementById('footballMatchesTitle');
  const note=document.getElementById('footballMatchesNote');
  if(title) title.textContent='Gündem maçları';
  if(note) note.textContent='Sonuçlanan ve yaklaşan maçlar durum renkleriyle gösterilir.';
  const user = getCurrentUser();
  const overviewRows=rows.slice(0,12);
  area.innerHTML = overviewRows.map(m=>{
    const state = explicitMatchState(m); const result = getResult(m.id);
    const prediction = user && ALL_PREDICTIONS[m.id] && ALL_PREDICTIONS[m.id][user.id];
    const homeScore=Number(result?.home); const awayScore=Number(result?.away);
    const hasResult=result && Number.isFinite(homeScore) && Number.isFinite(awayScore);
    const outcome=hasResult?(homeScore===awayScore?'draw':homeScore>awayScore?'home-win':'away-win'):'';
    const timing=state.live?'is-live-match':result||new Date(m.kickoff).getTime()<=Date.now()?'is-past-match':'is-upcoming-match';
    const homeClass=outcome==='draw'?'is-draw':outcome==='home-win'?'is-winner':outcome==='away-win'?'is-loser':'';
    const awayClass=outcome==='draw'?'is-draw':outcome==='away-win'?'is-winner':outcome==='home-win'?'is-loser':'';
    return `<button class="football-match-row ${timing} ${outcome?`outcome-${outcome}`:''}" type="button" data-football-match="${escapeHTML(m.id)}" aria-label="${escapeHTML(m.ev)} ${escapeHTML(m.konuk)} maç merkezini aç">
      <span class="football-match-time"><strong>${escapeHTML(fmtTime(m.kickoff))}</strong>${escapeHTML(new Date(m.kickoff).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}))}</span>
      <span class="football-match-teams"><span class="${homeClass}">${escapeHTML(m.ev)}</span><span class="${awayClass}">${escapeHTML(m.konuk)}</span></span>
      <span class="football-match-meta">${result ? `<span class="football-score">${escapeHTML(result.home)}–${escapeHTML(result.away)}</span>` : ''}<span class="football-state ${state.live?'live':''}">${escapeHTML(state.label)}</span>${prediction?'<span class="prediction-indicator">Tahminin var</span>':''}</span>
    </button>`;
  }).join('')+`<button class="football-quick-more" type="button" onclick="openFootballSection('matches')"><span>${escapeHTML(rows.length)} maçın tamamı</span><b>Maç merkezini aç →</b></button>`;
  area.querySelectorAll('[data-football-match]').forEach(button=>{ button.onclick=()=>openMatchCenter(button.dataset.footballMatch); });
}
function matchHubScopedRows(){
  const rows=MATCHES.filter(match=>matchInActiveLeague(match) && matchInActiveTeam(match));
  const live=rows.filter(footballStatusIsLive).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  const upcoming=rows.filter(match=>!getResult(match.id)&&!match.result&&!live.includes(match)&&!footballStatusIsUnavailable(match)&&new Date(match.kickoff).getTime()>Date.now()).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  const completed=rows.filter(match=>getResult(match.id)||match.result||footballStatusIsFinished(match)).sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff));
  const pending=rows.filter(match=>!live.includes(match)&&!upcoming.includes(match)&&!completed.includes(match)).sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff));
  if(activeMatchHubFilter==='live') return live;
  if(activeMatchHubFilter==='today') return rows.filter(match=>matchDayKey(match.kickoff)===matchDayKey(Date.now())).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  if(activeMatchHubFilter==='upcoming') return upcoming;
  if(activeMatchHubFilter==='results') return completed;
  return [...live,...upcoming,...completed,...pending];
}
function matchHubDateLabel(value){
  const date=new Date(value); if(Number.isNaN(date.getTime())) return 'Tarih doğrulanıyor';
  return date.toLocaleDateString('tr-TR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}
function setMatchHubFilter(name,button){
  activeMatchHubFilter=['all','today','live','upcoming','results'].includes(name)?name:'all';
  document.querySelectorAll('[data-match-hub-filter]').forEach(item=>{ const selected=item.dataset.matchHubFilter===activeMatchHubFilter; item.classList.toggle('active',selected); item.setAttribute('aria-pressed',String(selected)); });
  renderMatchesHub();
}
function renderMatchesHub(){
  const stats=document.getElementById('footballMatchesStats'); const area=document.getElementById('footballMatchesFullList'); if(!stats||!area) return;
  const scoped=MATCHES.filter(match=>matchInActiveLeague(match) && matchInActiveTeam(match));
  const live=scoped.filter(footballStatusIsLive).length;
  const upcoming=scoped.filter(match=>!getResult(match.id)&&!match.result&&!footballStatusIsLive(match)&&!footballStatusIsUnavailable(match)&&new Date(match.kickoff).getTime()>Date.now()).length;
  const results=scoped.filter(match=>getResult(match.id)||match.result||footballStatusIsFinished(match)).length;
  const activeScope=activeFootballTeam==='Tümü'?competitionLabelBySlug(activeFootballLeague):`${competitionShortBySlug(activeFootballLeague)} · ${activeFootballTeam}`;
  stats.innerHTML=`<article><span>Toplam kayıt</span><strong>${escapeHTML(scoped.length)}</strong><small>${escapeHTML(activeScope)}</small></article><article class="${live?'is-live':''}"><span>Canlı</span><strong>${escapeHTML(live)}</strong><small>resmî durum kaydı</small></article><article><span>Yaklaşan</span><strong>${escapeHTML(upcoming)}</strong><small>yayınlanmış fikstür</small></article><article><span>Sonuç</span><strong>${escapeHTML(results)}</strong><small>tamamlanan maç</small></article>`;
  if(DATA_ERRORS.matches){ area.innerHTML=footballEmpty('Fikstür alınamadı','Maç veri kaynağına ulaşılamadı; diğer bölümler çalışmaya devam ediyor.'); return; }
  const rows=matchHubScopedRows();
  if(!rows.length){ area.innerHTML=footballEmpty('Bu filtrede maç yok','Doğrulanmış yeni bir kayıt geldiğinde liste otomatik güncellenecek.'); return; }
  let lastDate='';
  area.innerHTML=rows.map(match=>{
    const dateKey=String(match.kickoff||'').slice(0,10); const dateHead=dateKey!==lastDate?`<div class="matches-hub-date">${escapeHTML(matchHubDateLabel(match.kickoff))}</div>`:''; lastDate=dateKey;
    const state=explicitMatchState(match); const result=getResult(match.id); const score=result?`<span class="matches-hub-score"><b>${escapeHTML(result.home)}</b><i>–</i><b>${escapeHTML(result.away)}</b></span>`:`<span class="matches-hub-kickoff">${escapeHTML(fmtTime(match.kickoff))}</span>`;
    const competition=competitionName(match);
    return `${dateHead}<button class="matches-hub-row" type="button" data-match-hub-id="${escapeHTML(match.id)}" aria-label="${escapeHTML(match.ev)} ${escapeHTML(match.konuk)} maç merkezini aç"><span class="matches-hub-week">${escapeHTML(match.hafta||'—')}<small>HAFTA</small></span><span class="matches-hub-team home">${crestHTML(match.ev,'sm')}<strong>${escapeHTML(match.ev)}</strong></span>${score}<span class="matches-hub-team away"><strong>${escapeHTML(match.konuk)}</strong>${crestHTML(match.konuk,'sm')}</span><span class="matches-hub-state ${state.live?'live':''}">${escapeHTML(state.label)}</span><span class="matches-hub-venue"><b>${escapeHTML(competition)}</b><small>${escapeHTML(match.stadyum||'Stadyum bilgisi açıklanmadı')}</small></span><span class="matches-hub-open">Maç merkezi <b>→</b></span></button>`;
  }).join('');
  area.querySelectorAll('[data-match-hub-id]').forEach(button=>{ button.onclick=()=>openMatchCenter(button.dataset.matchHubId); });
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
  if(activeFootballLeague!=='super-lig') return [];
  const story = WEEKLY_STORIES[activeWeek];
  if(!story || !story.is_published || !Array.isArray(story.cards)) return [];
  return story.cards.filter(card=>card && !/tahmin|kupon|oran|bahis/i.test(`${card.title||''} ${card.text||''}`) && cardMentionsFootballTeam(card,activeFootballTeam));
}
function matchesForActiveLeague(){
  return MATCHES.filter(matchInActiveLeague);
}
function storyIdentityHTML(card){
  const name=card.author||card.author_name||card.editor||card.source||''; const entity=card.player||card.related_player||card.team||card.related_team||''; const time=card.updated_at||card.verified_at||card.published_at||'';
  if(!name && !entity && !time) return '';
  const image=safeExternalURL(card.author_image||card.avatar_url||card.player_image); const initials=String(name||entity||'X').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toLocaleUpperCase('tr-TR');
  return `<div class="football-news-identity"><span class="football-news-avatar">${image?`<img src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:escapeHTML(initials)}</span><span class="football-news-byline"><b>${escapeHTML(name||entity)}</b><span>${entity&&entity!==name?escapeHTML(entity):''}${entity&&time?' · ':''}${time?escapeHTML(fmtEditorialDate(time)):''}</span></span></div>`;
}
/* ===================== DENSE LEAGUE CONTENT OVERRIDES ===================== */
function leagueEditorialBaseEntries(){
  const league=activeFootballLeague;
  const label=competitionLabelBySlug(league);
  const summary=officialSeasonSummaryForLeague(league);
  const standings=standingRowsForActiveLeague().slice(0,5);
  const upcoming=matchesForActiveLeague().filter(match=>matchInActiveTeam(match)&&matchIsCurrentFixture(match)).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)).slice(0,3);
  const transfers=leagueTransferRecords('confirmed').slice(0,4);
  const rumours=leagueTransferRecords('rumours').slice(0,3);
  const entries=[];
  if(summary){
    entries.push({
      kind:'summary',
      title:`${label} ${summary.season} sezon özeti`,
      text:`Şampiyon ${summary.champion}. ${summary.standoutLabel}: ${summary.standout}.`,
      source:summary.championNote||'Resmî sezon kaydı',
      label:'Sezon özeti',
      time:'',
      image:null,
      imageType:'none',
      sourceUrl:summary.sourceLinks?.[0]?.url || null,
      routeTarget:'standings'
    });
  }
  if(standings.length){
    const first=standings[0];
    const second=standings[1];
    entries.push({
      kind:'standing',
      title:`${label} zirvesi`,
      text:second ? `${first.team} ${first.points} puanla önde. Takipçisi ${second.team} ${second.points} puanda.` : `${first.team} son tabloda ${first.points} puanla lider.`,
      source:'Lig tablosu',
      label:'Tablo',
      time:'',
      image:null,
      imageType:'none',
      routeTarget:'standings'
    });
  }
  upcoming.forEach((match,index)=>{
    entries.push({
      kind:'fixture',
      title:index===0?`${label} sıradaki maç`: `${match.ev} – ${match.konuk}`,
      text:`${match.ev} ile ${match.konuk} ${fmtKickoff(match.kickoff)} saatinde karşılaşıyor.`,
      source:match.competition||label,
      label:index===0?'Maç takvimi':'Fikstür',
      time:match.kickoff||'',
      image:null,
      imageType:'none',
      matchId:match.id,
      routeTarget:'matches'
    });
  });
  transfers.forEach(item=>{
    entries.push({
      kind:'transfer',
      title:`${item.name}: ${item.from} → ${item.to}`,
      text:`${item.fee} · ${item.status||'Resmî işlem'}`,
      source:item.source||`${label} transfer kaydı`,
      label:'Transfer',
      time:'',
      image:TRANSFER_PLAYER_PHOTOS[item.name]||null,
      imageType:(TRANSFER_PLAYER_PHOTOS[item.name]?'portrait':'none'),
      sourceUrl:item.sourceUrl||null,
      routeTarget:'transfers'
    });
  });
  rumours.filter(item=>item.photo||TRANSFER_PLAYER_PHOTOS[item.name]).forEach(item=>{
    entries.push({
      kind:'rumour',
      title:`${item.name} için ${item.to} hattı`,
      text:item.detail||`${item.status||'Söylenti'} · ${item.fee||'Bedel açıklanmadı'}`,
      source:item.source||`${label} söylenti hattı`,
      label:'Söylenti',
      time:'',
      image:item.photo||TRANSFER_PLAYER_PHOTOS[item.name]||null,
      imageType:(TRANSFER_PLAYER_PHOTOS[item.name]?'portrait':'none'),
      sourceUrl:item.sourceUrl||null,
      routeTarget:'transfers'
    });
  });
  return entries;
}
function leagueEditorialEntries(){
  if(activeFootballLeague==='super-lig') return editorialNewsEntries();
  const seen=new Set();
  return leagueEditorialBaseEntries().filter(entry=>{
    const key=normalizeLoose(`${entry.kind}|${entry.title}`);
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function contextualEditorialEntries(){
  const currentOnly=entries=>entries.filter(item=>{
    const match=item?.relatedMatch;
    if(!match?.kickoff) return true;
    const kickoff=new Date(match.kickoff).getTime();
    if(!Number.isFinite(kickoff)) return true;
    const status=String(match.status||match.state||'').toLocaleLowerCase('tr-TR');
    if(/finished|ended|after|ft|tamamland/.test(status)) return false;
    return kickoff>Date.now()-3*60*60*1000;
  });
  if(activeFootballLeague==='super-lig'){
    const primary=currentOnly(editorialNewsEntries());
    return primary.length ? primary : leagueEditorialBaseEntries();
  }
  return currentOnly(leagueEditorialEntries());
}
function footballNewsCardHTML(item,index){
  const image=safeExternalURL(item.image);
  const visual=image?`<div class="football-news-card-media ${item.imageType==='portrait'?'portrait':'photo'}"><img src="${escapeHTML(image)}" alt="${escapeHTML(item.title||'Gündem görseli')}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`:'';
  const action=item.matchId?`<button class="football-module-action" type="button" data-news-match="${escapeHTML(item.matchId)}">Maça bak →</button>`:'';
  return `<article class="football-news-card ${visual?'has-media':''}" tabindex="0" role="button" data-editorial-index="${index}" aria-label="${escapeHTML(item.title||'Gündem kaydı')} kaydını aç">${visual}<div class="football-news-card-copy"><div class="football-news-identity"><span class="football-news-avatar">${escapeHTML((item.label||'G').slice(0,2).toLocaleUpperCase('tr-TR'))}</span><span class="football-news-byline"><b>${escapeHTML(item.source||'XYZSKOR yayın masası')}</b><span>${escapeHTML(item.label||'Güncel')}${item.time?` · ${escapeHTML(item.time.includes('T')?fmtEditorialDate(item.time):item.time)}`:''}</span></span></div><h3>${escapeHTML(item.title||'Bağlam kaydı')}</h3>${item.text?`<p>${escapeHTML(item.text)}</p>`:''}<div class="football-news-meta"><span class="confidence-chip neutral">${escapeHTML(item.label||'Güncel')}</span>${item.source?`<span>${escapeHTML(item.source)}</span>`:''}${action}</div></div></article>`;
}
function renderFootballFeatured(){
  const area=document.getElementById('footballFeaturedDevelopment'); if(!area) return;
  if(activeFootballLeague!=='super-lig'){
    const ctx=activeLeagueContext();
    const summary=officialSeasonSummaryForLeague(activeFootballLeague);
    const leadMatch=matchesForActiveLeague().filter(match=>matchInActiveTeam(match)&&matchIsCurrentFixture(match)).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff))[0];
    const supporting=[
      summary?`${summary.season} sezon şampiyonu ${summary.champion}`:'',
      summary?.standout?`${summary.standoutLabel}: ${summary.standout}`:'',
      leadMatch?`Sıradaki maç: ${leadMatch.ev} – ${leadMatch.konuk}`:''
    ].filter(Boolean).join(' · ');
    area.innerHTML=`<div class="football-module-kicker">${escapeHTML(competitionLabelBySlug(activeFootballLeague))} · MERKEZ</div><h2>${escapeHTML(ctx.headline)}</h2><p>${escapeHTML(ctx.copy)}</p>${supporting?`<div class="featured-source">${escapeHTML(supporting)}</div>`:''}<div class="headline-actions"><button type="button" onclick="openFootballSection('matches')">Maçlara geç →</button><button type="button" onclick="openFootballSection('standings')">Tabloyu aç →</button></div>`;
    return;
  }
  const story=WEEKLY_STORIES[activeWeek];
  const storyMatch=publishedStoryCards().map(editorialRelatedMatch).find(Boolean);
  const storyKickoff=storyMatch?.kickoff?new Date(storyMatch.kickoff).getTime():NaN;
  const storyFinished=storyMatch && (/finished|ended|after|ft|tamamland/i.test(String(storyMatch.status||storyMatch.state||'')) || (Number.isFinite(storyKickoff) && storyKickoff<Date.now()-3*60*60*1000));
  if(!story || !story.is_published || storyFinished){
    const fallback=contextualEditorialEntries()[0];
    if(fallback){
      area.innerHTML=`<div class="football-module-kicker">${escapeHTML(competitionLabelBySlug(activeFootballLeague))} · GÜNCEL BAĞLAM</div><h2>${escapeHTML(fallback.title)}</h2><p>${escapeHTML(fallback.text||activeLeagueContext().copy)}</p><div class="featured-source">${escapeHTML(fallback.source||'XYZSKOR yayın masası')}</div><div class="headline-actions"><button type="button" onclick="openFootballSection(fallback.routeTarget||'news')">Detaya git →</button></div>`;
      return;
    }
    area.innerHTML=footballEmpty('Güncel gündem bekleniyor','Oynanmış maçlar öne çıkanlardan kaldırıldı. Yeni doğrulanmış kayıt geldiğinde bu alan otomatik güncellenecek.');
    return;
  }
  const source = story?.source ? `Kaynak: ${escapeHTML(story.source)}` : '';
  const checked = story?.verified_at || story?.published_at || story?.updated_at;
  area.innerHTML=`<div class="football-module-kicker">Haftanın Manşeti · ${escapeHTML(activeWeek)}. Hafta</div><h2>${escapeHTML(story?.title || (activeWeek+'. Hafta'))}</h2>${story?.intro?`<p>${escapeHTML(story.intro)}</p>`:''}${source || checked?`<div class="featured-source">${source}${source&&checked?' · ':''}${checked?escapeHTML(fmtEditorialDate(checked)):''}</div>`:''}<div class="headline-actions"><button type="button" onclick="openFootballSection('news')">Gündemi takip et →</button></div>`;
}
function renderClubSocial(){
  if(!document.getElementById('clubSocialSection')) return;
  const label=competitionLabelBySlug(activeFootballLeague);
  const clubs=rankedXClubs();
  const title=document.getElementById('clubSocialTitle'); if(title) title.textContent=`${label} kulüplerinden son paylaşımlar`;
  const kicker=document.getElementById('clubSocialKicker'); if(kicker) kicker.textContent=`RESMÎ SOSYAL AKIŞ · ${competitionShortBySlug(activeFootballLeague)}`;
  const description=document.getElementById('clubSocialDescription'); if(description) description.textContent=`${clubs.length} doğrulanmış hesaptan son paylaşım, görsel ve video kapağı tek akışta sunulur.`;
  loadXClubPosts();
}
function renderPreseasonSocial(){
  if(!document.getElementById('preseasonSocialSection')) return;
  const label=competitionLabelBySlug(activeFootballLeague);
  const clubs=rankedXClubs();
  const title=document.getElementById('preseasonSocialTitle'); if(title) title.textContent=`${label} hazırlık maçları akışı`;
  const kicker=document.getElementById('preseasonSocialKicker'); if(kicker) kicker.textContent=`HAZIRLIK MAÇLARI · ${competitionShortBySlug(activeFootballLeague)}`;
  const description=document.getElementById('preseasonSocialDescription'); if(description) description.textContent=`${clubs.length} kulübün kamp, hazırlık maçı ve son skor paylaşımları günlük olarak derlenir.`;
  loadPreseasonPosts();
}

function transferSignalCardHTML(entry){
  const account=entry?.account||entry||{};
  const post=entry?.post||account?.post||null;
  const text=post ? escapeHTML(xPostDisplayText(post)) : 'Güncel paylaşım bulunamadı.';
  const targetURL=post?.url||account?.url||'#';
  const media=post?xPostMediaHTML(account,post,targetURL):'';
  const avatar=account.profile_image_url?`<img src="${escapeHTML(account.profile_image_url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'𝕏';
  return `<article class="transfer-signal-card ${entry?.pinned?'is-pinned ':''}${media?'has-media':''}"><header class="transfer-signal-card-head"><span class="transfer-signal-avatar">${avatar}</span><span><strong>${escapeHTML(account.team||account.handle||'Kaynak')}</strong><small>@${escapeHTML(account.handle||'source')}</small></span><b aria-label="X">𝕏</b></header><div class="transfer-signal-card-body"><p>${text}</p>${media}</div><footer class="transfer-signal-card-foot"><time datetime="${escapeHTML(post?.created_at||'')}">${post?.created_at?escapeHTML(xPostDate(post.created_at)):'Polling aktif'}</time><a href="${escapeHTML(targetURL)}" target="_blank" rel="noopener noreferrer">Gönderiyi aç ↗</a></footer></article>`;
}
function renderTransferSignals(shell){
  if(!shell) return;
  const requestedLeague=activeFootballLeague;
  shell.innerHTML=`<div class="transfer-signal-loading"><span></span>Kaynak hesap sinyalleri yükleniyor…</div>`;
  fetchLeagueXMediaPayload().then(payload=>{
    if(activeFootballLeague!==requestedLeague) return;
    const accounts=(payload?.publishers||[]).slice(0,3);
    const posts=accounts.flatMap(account=>(Array.isArray(account.posts)&&account.posts.length?account.posts:[account.post]).filter(Boolean).map(post=>({account,post}))).sort((a,b)=>new Date(b.post.created_at||0)-new Date(a.post.created_at||0)).slice(0,5);
    if(!posts.length){
      const fallback=(accounts.length?accounts:rankedXClubs().slice(0,4)).map(account=>({account,post:null}));
      shell.innerHTML=`<div class="transfer-signal-head"><span>X kaynakları</span><small>${escapeHTML(competitionShortBySlug(activeFootballLeague))} · günlük kontrol tamamlandı</small></div><div class="transfer-signal-stream">${fallback.map(transferSignalCardHTML).join('')}</div>`;
      return;
    }
    shell.innerHTML=`<div class="transfer-signal-head"><span>Son transfer sinyalleri</span><small>${escapeHTML(competitionShortBySlug(activeFootballLeague))} · ${posts.length} gönderi · ${accounts.length} kaynak</small></div><div class="transfer-signal-stream">${posts.map(transferSignalCardHTML).join('')}</div>`;
  }).catch(()=>{
    if(activeFootballLeague!==requestedLeague) return;
    const fallback=rankedXClubs().slice(0,4).map(account=>({account,post:null}));
    shell.innerHTML=`<div class="transfer-signal-head"><span>X kaynakları</span><small>${escapeHTML(competitionShortBySlug(activeFootballLeague))} · bağlantı tekrar denenecek</small></div><div class="transfer-signal-stream">${fallback.map(transferSignalCardHTML).join('')}</div>`;
  });
}
/* ===================== HABER + YOUTUBE YAYIN MASASI ===================== */
const YOUTUBE_CHANNEL_FALLBACK=[
  {name:'Sports Digitale',handle:'@sportsdigitale',url:'https://www.youtube.com/@sportsdigitale',note:'Futbol gündemi, yorum ve canlı programlar'},
  {name:'HT Spor',handle:'@htspor',url:'https://www.youtube.com/@htspor',note:'Güncel spor haberleri ve stüdyo yayınları'},
  {name:'beIN SPORTS Türkiye',handle:'@beINSPORTSTurkiye',url:'https://www.youtube.com/@beINSPORTSTurkiye',note:'Futbol röportajları, özetler ve stüdyo programları'},
  {name:'TRT Spor',handle:'@trtspor',url:'https://www.youtube.com/@trtspor',note:'Resmî spor yayınları ve gündem programları'}
];
let EDITORIAL_NEWS_CACHE=[];
const youtubeMediaRequests=new Map();
function editorialTransferEntries(){
  const rows=[
    ...(leagueTransferRecords('confirmed')||[]).map(item=>({...item,editorialTone:item.status||'Resmî işlem',editorialKind:'confirmed'})),
    ...(leagueTransferRecords('rumours')||[]).map(item=>({...item,editorialTone:item.status||'Söylenti',editorialKind:'rumour'}))
  ];
  return rows
    .filter(item=>item.editorialKind!=='rumour' || item.photo || TRANSFER_PLAYER_PHOTOS[item.name])
    .filter(item=>activeFootballTeam==='Tümü'||item.to===activeFootballTeam||item.from===activeFootballTeam).map(item=>({
    kind:'source',
    title:item.editorialKind==='confirmed'?`${item.name}: ${item.from} → ${item.to}`:`${item.name} için ${item.to} gündeminde son durum`,
    text:item.detail||`${item.fee} · ${item.status}`,
    source:item.source,
    sourceUrl:safeExternalURL(item.sourceUrl),
    label:item.editorialTone,
    image:item.photo||TRANSFER_PLAYER_PHOTOS[item.name]||null,
    imageType:'portrait'
  }));
}
function editorialNewsEntries(){
  const storyEntries=publishedStoryCards().map((card,index)=>{
    const editorialPhoto=safeExternalURL(card.hero_image||card.image_url||card.image||card.thumbnail_url);
    const playerPortrait=safeExternalURL(card.player_image);
    const relatedMatch=editorialRelatedMatch(card);
    return {kind:'story',index,title:card.title||'Futbol gündemi',text:card.spot||card.summary||card.text||'',source:card.source||'Editoryal kayıt',label:storyConfidence(card)?.label||'Güncel',time:card.verified_at||card.updated_at||card.published_at||'',image:editorialPhoto||playerPortrait,imageType:editorialPhoto?'photo':playerPortrait?'portrait':'none',relatedMatch};
  });
  const seen=new Set();
  return [...storyEntries,...editorialTransferEntries()].filter(item=>{ const key=String(item.title).toLocaleLowerCase('tr-TR'); if(seen.has(key)) return false; seen.add(key); return true; });
}
function editorialRelatedMatch(card){
  const direct=MATCHES.find(match=>match.id===card.related_match_id);
  if(direct) return direct;
  const storyText=`${card.title||''} ${card.spot||''} ${card.summary||''} ${card.text||''}`.toLocaleLowerCase('tr-TR');
  const mentionedTeams=leagueTeamSourceRows().map(club=>club.team).filter(team=>storyText.includes(team.toLocaleLowerCase('tr-TR')));
  if(mentionedTeams.length<2) return null;
  return MATCHES.find(match=>mentionedTeams.includes(match.ev)&&mentionedTeams.includes(match.konuk))||null;
}
function editorialMatchVisualHTML(item){
  const match=item?.relatedMatch;
  if(!match) return '';
  const kickoff=match.kickoff?new Date(match.kickoff):null;
  const dateLabel=kickoff&&!Number.isNaN(kickoff.getTime())?kickoff.toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}):'';
  const meta=[match.hafta?`${match.hafta}. hafta`:'',dateLabel].filter(Boolean).join(' · ');
  return `<div class="editorial-match-visual" role="img" aria-label="${escapeHTML(match.ev)} ile ${escapeHTML(match.konuk)} açılış maçı"><span class="editorial-match-glow" aria-hidden="true"></span><div class="editorial-match-club">${crestHTML(match.ev,'lg')}<strong>${escapeHTML(match.ev)}</strong></div><div class="editorial-match-center"><small>HAFTANIN AÇILIŞI</small><b>VS</b>${meta?`<span>${escapeHTML(meta)}</span>`:''}</div><div class="editorial-match-club">${crestHTML(match.konuk,'lg')}<strong>${escapeHTML(match.konuk)}</strong></div></div>`;
}
function openEditorialEntry(index){
  const entry=EDITORIAL_NEWS_CACHE[index]; if(!entry) return;
  if(entry.kind==='story'){ openNewsDetail(entry.index); return; }
  if(entry.matchId){ openMatchCenter(entry.matchId); return; }
  if(entry.routeTarget){ openFootballSection(entry.routeTarget); }
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
  EDITORIAL_NEWS_CACHE=contextualEditorialEntries();
  const primary=EDITORIAL_NEWS_CACHE[0];
  if(!primary){ lead.innerHTML=footballEmpty('Yayın masası hazırlanıyor','Kaynağı doğrulanmış ilk içerik yayınlandığında burada görünür.'); list.innerHTML=''; return; }
  const matchVisual=editorialMatchVisualHTML(primary);
  const leadMedia=primary.image?`<span class="editorial-portrait-shell"><img src="${escapeHTML(primary.image)}" alt="${escapeHTML(primary.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.editorial-portrait-shell').remove()"></span>`:matchVisual||'<div class="editorial-media-fallback"><span>●</span><small>Kaynaklı yayın</small></div>';
  const leadMediaType=primary.imageType==='portrait'?'portrait':matchVisual?'match':'photo';
  lead.innerHTML=`<article class="editorial-lead-card" tabindex="0" role="button" data-editorial-index="0" aria-label="${escapeHTML(primary.title)} haberini aç"><div class="editorial-lead-media ${leadMediaType}">${leadMedia}</div><div class="editorial-lead-copy"><span class="editorial-news-label">${escapeHTML(primary.label)}</span><h3>${escapeHTML(primary.title)}</h3><p>${escapeHTML(primary.text)}</p><footer><strong>${escapeHTML(primary.source)}</strong>${primary.time?`<time>${escapeHTML(fmtEditorialDate(primary.time))}</time>`:''}</footer></div></article>`;
  list.innerHTML=`<div class="editorial-highlights-title">Öne çıkanlar</div>${EDITORIAL_NEWS_CACHE.slice(1,6).map((item,index)=>`<article class="editorial-highlight-row" tabindex="0" role="button" data-editorial-index="${index+1}" aria-label="${escapeHTML(item.title)} haberini aç"><span class="editorial-highlight-rank">${index+1}</span><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.source)}${item.time?` · ${escapeHTML(fmtEditorialDate(item.time))}`:''}</p></div>${item.image?`<span class="editorial-highlight-image ${item.imageType==='portrait'?'portrait':'photo'}"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.editorial-highlight-image').remove()"></span>`:'<span class="editorial-highlight-mark">●</span>'}</article>`).join('')}`;
  bindEditorialEntries(lead); bindEditorialEntries(list);
}
function renderNewsHub(){
  const area=document.getElementById('footballNewsFullStream'); const sidebar=document.getElementById('footballNewsHubSidebar'); if(!area||!sidebar) return;
  EDITORIAL_NEWS_CACHE=contextualEditorialEntries();
  if(DATA_ERRORS.weekly_stories&&!EDITORIAL_NEWS_CACHE.length){ area.innerHTML=footballEmpty('Gündem alınamadı','Kaynaklı içerik akışı şu anda kullanılamıyor.'); sidebar.innerHTML=''; return; }
  if(!EDITORIAL_NEWS_CACHE.length){ const label=competitionLabelBySlug(activeFootballLeague); area.innerHTML=footballEmpty(`${label} yayın akışı hazırlanıyor`,'Kaynağı doğrulanan ilk kayıt burada tam ayrıntısıyla görünür.'); sidebar.innerHTML=''; return; }
  area.innerHTML=`<div class="news-hub-list">${EDITORIAL_NEWS_CACHE.map((item,index)=>`<article class="news-hub-card" tabindex="0" role="button" data-editorial-index="${index}" aria-label="${escapeHTML(item.title)} haberini aç"><div class="news-hub-card-media ${item.imageType==='portrait'?'portrait':'photo'}">${item.image?`<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:'<span>●</span>'}</div><div class="news-hub-card-copy"><div class="news-hub-card-meta"><span>${escapeHTML(item.label||'Güncel')}</span><b>${escapeHTML(item.source||'Editoryal kayıt')}</b>${item.time?`<time>${escapeHTML(fmtEditorialDate(item.time))}</time>`:''}</div><h3>${escapeHTML(item.title)}</h3>${item.text?`<p>${escapeHTML(item.text)}</p>`:''}<small>Kaydı aç <b aria-hidden="true">→</b></small></div></article>`).join('')}</div>`;
  const sourced=EDITORIAL_NEWS_CACHE.filter(item=>item.source).length; const official=EDITORIAL_NEWS_CACHE.filter(item=>/resm/i.test(item.label||'')).length;
  sidebar.innerHTML=`<section class="news-hub-count"><span>YAYIN MASASI</span><strong>${escapeHTML(EDITORIAL_NEWS_CACHE.length)}</strong><p>güncel kayıt</p><dl><div><dt>Kaynaklı</dt><dd>${escapeHTML(sourced)}</dd></div><div><dt>Resmî</dt><dd>${escapeHTML(official)}</dd></div></dl></section><section class="news-standard-card"><span>GÜVEN STANDARDI</span><ul><li><b>Resmî</b><small>Kulüp veya kurum açıklaması</small></li><li><b>Güçlü iddia</b><small>Birden fazla güvenilir kayıt</small></li><li><b>Söylenti</b><small>Kesinleşmemiş, açıkça etiketli</small></li><li><b>Veri analizi</b><small>Yayınlanmış futbol verisinden hesaplama</small></li></ul></section><button type="button" onclick="openFootballSection('home')">Anasayfa özetine dön <span aria-hidden="true">→</span></button>`;
  bindEditorialEntries(area);
}
function formatYouTubeDuration(value){
  const match=String(value||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/); if(!match) return '';
  const hours=Number(match[1]||0),minutes=Number(match[2]||0),seconds=Number(match[3]||0);
  return `${hours?`${hours}:`:''}${String(minutes).padStart(hours?2:1,'0')}:${String(seconds).padStart(2,'0')}`;
}
/* Yayin merkezi bos kalirken kullaniciya NEDEN bos oldugu acikca soylenir.
   reason: 'empty' (yayin yok) | 'error' (baglanti/kota hatasi) | 'unconfigured' (anahtar tanimli degil).
   Her durumda dogrulanmis kanal rehberi gosterilir, yani modul asla bombos kalmaz. */
const YOUTUBE_FALLBACK_COPY={
  empty:{ status:'Şu anda canlı yayın yok', title:'Şu anda doğrulanmış canlı yayın yok.', body:'Kanallar dakikada bir kontrol edilir; yeni yayın açıldığında bu alan otomatik güncellenir. Bu arada resmî kanallara doğrudan geçebilirsin.' },
  error:{ status:'Yayın servisi geçici olarak yanıt vermiyor', title:'Yayın listesi şu anda alınamıyor.', body:'Bağlantı yeniden kurulduğunda program akışı otomatik yüklenecek. Şimdilik resmî kanallara doğrudan geçebilirsin.' },
  unconfigured:{ status:'Doğrulanmış kanal rehberi', title:'Canlı yayın entegrasyonu bu ortamda henüz aktif değil.', body:'Yayın anahtarı tanımlandığında programlar burada otomatik listelenir. Şimdilik resmî kanallara doğrudan geçebilirsin.' },
};
function renderYouTubeFallback(reason,league=activeFootballLeague){
  const grid=document.getElementById('youtubeMediaGrid'); const status=document.getElementById('youtubeMediaStatus'); if(!grid||!status) return;
  const copy=YOUTUBE_FALLBACK_COPY[reason]||YOUTUBE_FALLBACK_COPY.empty;
  status.textContent=copy.status;
  status.dataset.state=reason||'empty';
  const label=competitionLabelBySlug(league);
  grid.innerHTML=`<div class="youtube-channel-intro" data-state="${escapeHTML(reason||'empty')}"><span class="youtube-play-mark">▶</span><div><strong>${escapeHTML(label)} için ${escapeHTML(copy.title.toLocaleLowerCase('tr-TR'))}</strong><p>Bu alan yalnız ${escapeHTML(label)} ile eşleşen doğrulanmış yayınları gösterir. ${escapeHTML(copy.body)}</p></div></div>${YOUTUBE_CHANNEL_FALLBACK.map((channel,index)=>`<a class="youtube-channel-card" href="${channel.url}/search?query=${encodeURIComponent(label)}" target="_blank" rel="noopener noreferrer"><span class="youtube-channel-avatar">${index+1}</span><div><strong>${escapeHTML(channel.name)}</strong><small>${escapeHTML(channel.handle)}</small><p>${escapeHTML(label)} kanal araması</p></div><span aria-hidden="true">↗</span></a>`).join('')}`;
}
function renderYouTubeItems(payload,league){
  const grid=document.getElementById('youtubeMediaGrid'); const status=document.getElementById('youtubeMediaStatus'); if(!grid||!status) return;
  if(activeFootballLeague!==league) return;
  const items=Array.isArray(payload?.items)?payload.items.slice(0,6):[]; if(!items.length){ renderYouTubeFallback('empty',league); return; }
  status.dataset.state='live';
  const liveCount=items.filter(item=>item.live).length;
  status.textContent=liveCount?`${liveCount} canlı yayın`:`${items.length} güncel program`;
  grid.innerHTML=items.map((item,index)=>`<a class="youtube-video-card ${index===0?'featured':''}" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer"><div class="youtube-video-thumb"><img src="${escapeHTML(item.thumbnail)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="youtube-video-play" aria-hidden="true">▶</span>${item.live?'<span class="youtube-live-chip">CANLI</span>':item.upcoming?'<span class="youtube-upcoming-chip">YAKINDA</span>':''}${item.duration?`<span class="youtube-duration">${escapeHTML(formatYouTubeDuration(item.duration))}</span>`:''}</div><div class="youtube-video-copy"><span>${escapeHTML(item.channelTitle)}</span><h3>${escapeHTML(item.title)}</h3><p>${item.live&&item.concurrentViewers?`${escapeHTML(String(item.concurrentViewers))} kişi izliyor`:escapeHTML(fmtEditorialDate(item.publishedAt))}</p></div></a>`).join('');
}
async function renderYouTubeMedia(){
  const grid=document.getElementById('youtubeMediaGrid'); if(!grid) return;
  const status=document.getElementById('youtubeMediaStatus');
  if(status){ status.textContent='Yayın akışı kontrol ediliyor'; status.dataset.state='loading'; }
  // Bos kutu yerine gercek kart olcusunde skeleton goster.
  grid.innerHTML=skeletonCardsHTML(3,'youtube-skeleton-card');
  const league=activeFootballLeague;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),2500);
  try{
    if(!youtubeMediaRequests.has(league)) youtubeMediaRequests.set(league,fetch(`/api/media/youtube?league=${encodeURIComponent(league)}`,{headers:{Accept:'application/json'},signal:controller.signal}).then(async response=>{ const payload=await response.json().catch(()=>null); if(!response.ok){ const error=new Error(payload?.error||'youtube_unavailable'); error.code=payload?.error; throw error; } return payload; }));
    renderYouTubeItems(await youtubeMediaRequests.get(league),league);
  }catch(error){
    youtubeMediaRequests.delete(league);
    if(activeFootballLeague===league) renderYouTubeFallback(error?.code==='youtube_not_configured' ? 'unconfigured' : 'error',league);
  }finally{
    clearTimeout(timeout);
  }
}
function renderFootballTransfers(){
  const area=document.getElementById('footballTransferStream'); if(!area) return;
  const signalShellMarkup=`<div class="transfer-signal-shell" data-transfer-signals></div>`;
  if(activeFootballLeague!=='all'){
    const label=competitionLabelBySlug(activeFootballLeague);
    const rows=leagueTransferRecords('confirmed').slice(0,6);
    const lead=rows[0];
    const nextMatch=matchesForActiveLeague().filter(match=>matchInActiveTeam(match)&&matchIsCurrentFixture(match)).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff))[0];
    const leadMarkup=lead
      ? `<article class="transfer-visual-lead"><div class="transfer-visual-media">${transferPlayerPhotoHTML(lead)}<span>${crestHTML(lead.from,'sm')}${crestHTML(lead.to,'sm')}</span></div><div class="transfer-visual-copy"><small>DOĞRULANMIŞ TRANSFER</small><h3>${escapeHTML(lead.name)}</h3><p>${escapeHTML(lead.from)} <b>→</b> ${escapeHTML(lead.to)}</p><strong>${escapeHTML(lead.fee)}</strong></div></article>`
      : nextMatch
        ? `<article class="transfer-visual-lead fixture-focus"><div class="transfer-visual-media"><span>${crestHTML(nextMatch.ev,'md')}${crestHTML(nextMatch.konuk,'md')}</span></div><div class="transfer-visual-copy"><small>${escapeHTML(label)} · SIRADAKİ MAÇ</small><h3>${escapeHTML(nextMatch.ev)} – ${escapeHTML(nextMatch.konuk)}</h3><p>${escapeHTML(fmtEditorialDate(nextMatch.kickoff))}</p><strong>Sportmonks doğrulandı</strong></div></article>`
        : `<article class="transfer-visual-lead league-focus"><div class="transfer-visual-media"><span class="transfer-league-mark">${escapeHTML((SELECTED_COMPETITIONS.find(item=>item.key===activeFootballLeague)?.short||label).slice(0,4))}</span></div><div class="transfer-visual-copy"><small>${escapeHTML(label)} · LİG GÜNDEMİ</small><h3>Doğrulanmış kayıt bekleniyor</h3><p>Transfer veya sıradaki maç doğrulandığında bu görsel kart otomatik güncellenir.</p><strong>Kaynak gelmeden bilgi üretilmez</strong></div></article>`;
    area.innerHTML=`${leadMarkup}${rows.length>1?`<div class="transfer-compact-list">${rows.slice(1,5).map(item=>`<div class="transfer-compact-row">${transferPlayerPhotoHTML(item)}<span>${escapeHTML(item.name)}</span><small>${escapeHTML(item.from)} → ${escapeHTML(item.to)}</small><b>${escapeHTML(item.fee)}</b></div>`).join('')}</div>`:''}${signalShellMarkup}<button class="football-module-full-link" type="button" onclick="openFootballSection('transfers')">Transfer merkezini aç →</button>`;
    renderTransferSignals(area.querySelector('[data-transfer-signals]'));
    return;
  }
  const transfers=publishedStoryCards().map((card,index)=>({card,index})).filter(entry=>['transfer','transfer_development'].includes(String(entry.card.category || entry.card.type || '').toLocaleLowerCase('tr-TR')));
  if(!transfers.length){
    area.innerHTML=`<div class="league-module-waiting"><strong>Seçili liglerin transfer akışı hazırlanıyor</strong><p>Yalnızca sağlayıcıdan doğrulanan ve lig kapsamı eşleşen kayıtlar burada yayınlanır.</p></div>${signalShellMarkup}<button class="football-module-full-link" type="button" onclick="openFootballSection('transfers')">Transfer merkezini aç →</button>`;
    renderTransferSignals(area.querySelector('[data-transfer-signals]'));
    return;
  }
  area.innerHTML=`<div class="football-news-list">${transfers.slice(0,4).map(({card,index})=>{ const confidence=storyConfidence(card); return `<article class="football-news-card" tabindex="0" role="button" data-news-index="${index}" aria-label="${escapeHTML(card.title||'Transfer haberi')} haberini aç">${storyIdentityHTML(card)}<h3>${escapeHTML(card.title || 'Transfer gelişmesi')}</h3>${card.text?`<p>${escapeHTML(card.text)}</p>`:''}<div class="football-news-meta">${confidence?`<span class="confidence-chip ${confidence.tone}">${confidence.label}</span>`:''}${card.source?`<span>Kaynak: ${escapeHTML(card.source)}</span>`:''}${card.verified_at?`<span>${escapeHTML(fmtEditorialDate(card.verified_at))}</span>`:''}</div></article>`; }).join('')}</div>${signalShellMarkup}`;
  area.querySelectorAll('[data-news-index]').forEach(article=>{ article.onclick=()=>openNewsDetail(Number(article.dataset.newsIndex)); article.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){event.preventDefault();openNewsDetail(Number(article.dataset.newsIndex));} }; });
  renderTransferSignals(area.querySelector('[data-transfer-signals]'));
}
function officialSeasonSummaryForLeague(key){
  return OFFICIAL_SEASON_SUMMARIES?.[key] || null;
}
function seasonSummaryCardHTML(key, summary){
  if(!summary) return '';
  const crest=TEAM_CRESTS?.[summary.champion] ? crestHTML(summary.champion,'xs') : '';
  const links=(Array.isArray(summary.sourceLinks)?summary.sourceLinks:[])
    .map(link=>{
      const url=safeExternalURL(link?.url);
      if(!url) return '';
      return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label||'Resmî kaynak')} ↗</a>`;
    }).filter(Boolean).join('');
  return `<article class="season-honor-card ${key===activeFootballLeague?'is-active':''}">
    <div class="season-honor-head">
      <span class="season-honor-season">${escapeHTML(summary.season||'')}</span>
      <span class="season-honor-context">${escapeHTML(competitionShortBySlug(key))}</span>
    </div>
    <div class="season-honor-grid">
      <div class="season-honor-stat">
        <small>Şampiyon</small>
        <strong>${crest}${escapeHTML(summary.champion||'')}</strong>
        <span>${escapeHTML(summary.championNote||'')}</span>
      </div>
      <div class="season-honor-stat">
        <small>${escapeHTML(summary.standoutLabel||'Öne çıkan isim')}</small>
        <strong>${escapeHTML(summary.standout||'')}</strong>
        <span>${escapeHTML([summary.standoutTeam,summary.standoutNote].filter(Boolean).join(' · '))}</span>
      </div>
    </div>
    ${links?`<div class="season-honor-links">${links}</div>`:''}
  </article>`;
}
function renderFootballSeasonHonors(){
  const area=document.getElementById('footballSeasonHonors'); if(!area) return;
  const keys=activeFootballLeague==='all'
    ? SELECTED_COMPETITIONS.filter(item=>item.key!=='all').map(item=>item.key)
    : [activeFootballLeague];
  const cards=keys.map(key=>seasonSummaryCardHTML(key,officialSeasonSummaryForLeague(key))).filter(Boolean);
  if(!cards.length){ area.innerHTML=''; return; }
  area.innerHTML=`<div class="season-honor-shell ${keys.length>1?'multi':''}">
    <div class="season-honor-kicker">Resmî sezon özeti</div>
    <div class="season-honor-cards">${cards.join('')}</div>
  </div>`;
}
function renderFootballStandingsCompact(){
  const area=document.getElementById('footballStandingsCompact'); if(!area) return;
  const rows=standingRowsForActiveLeague().slice(0,5);
  const summary=officialSeasonSummaryForLeague(activeFootballLeague);
  const compactBadge=standingsSeasonBadge(rows);
  const hasProviderRows=rows.some(row=>row.sourceType==='provider');
  const label=compactBadge.archive ? `${STANDINGS_ARCHIVE_SEASON} arşiv` : summary?.season ? `${summary.season} tablo` : hasProviderRows ? `${competitionShortBySlug(activeFootballLeague)} tablo` : competitionShortBySlug(activeFootballLeague);
  const note=summary ? `<div class="standing-compact-note">Üstte son tamamlanan sezonun resmî özeti, altta bu lig için tabloda görünen son kayıt yer alır.</div>` : '';
  area.innerHTML=`${standingsArchiveBannerHTML(rows)}${note}<div class="standing-compact"><div class="standing-compact-header"><span>#</span><span>${escapeHTML(label)}</span><span>O</span><span>P</span></div>${rows.map((row,index)=>`<div class="standing-compact-row"><span>${index+1}</span><span class="standing-compact-team">${crestHTML(row.team,'xs')}${escapeHTML(row.team)}</span><span>${row.played}</span><b>${row.points}</b></div>`).join('')}</div><button class="football-module-full-link" type="button" onclick="openFootballSection('standings')">Tam puan durumunu aç →</button>`;
}

/* ===================== INSTAGRAM GÜNDEM GÖNDERİLERİ =====================
   Worker /api/social/instagram uzerinden gelir. Graph API kisiti geregi
   icerik ya hashtag aramasindan ya da kendi Business hesabimizdan gelir;
   bu ayrim her kartta "kaynak" rozetiyle kullaniciya gosterilir.
   Sahte veri uretilmez: yapilandirilmamis / hata / bos durumlari ayridir. */
let instagramFeedRequest = null;
let instagramFeedLeague = null;

const INSTAGRAM_STATE_COPY = {
  unconfigured: { status:'Bağlantı kurulmadı', title:'Instagram akışı kullanılamıyor.', body:'Instagram Business bağlantısı etkin olmadığı için bu bölüm veri göstermiyor.' },
  error: { status:'Akış geçici olarak alınamıyor', title:'Instagram gönderileri şu anda yüklenemedi.', body:'Bağlantı yeniden kurulduğunda gündem akışı otomatik güncellenecek.' },
  empty: { status:'Yeni gönderi yok', title:'Bu lig için güncel Instagram gönderisi bulunamadı.', body:'Son kontrolde yayınlanabilir bir gönderi gelmedi.' },
};

function instagramStateHTML(reason){
  const copy = INSTAGRAM_STATE_COPY[reason] || INSTAGRAM_STATE_COPY.empty;
  const status = document.getElementById('instagramFeedStatus');
  if(status){ status.textContent = copy.status; status.dataset.state = reason; }
  return `<div class="instagram-state" data-state="${escapeHTML(reason)}">
    <span class="instagram-state-mark" aria-hidden="true">◎</span>
    <div><strong>${escapeHTML(copy.title)}</strong><p>${escapeHTML(copy.body)}</p></div>
  </div>`;
}

function instagramCardHTML(item){
  const sourceLabel = item?.source?.kind === 'hashtag' ? `#${item.source.value}` : '@' + (item.username || 'xyzskor');
  const metrics = [];
  if(Number.isFinite(item.likeCount)) metrics.push(`♥ ${escapeHTML(String(item.likeCount))}`);
  if(Number.isFinite(item.commentsCount)) metrics.push(`💬 ${escapeHTML(String(item.commentsCount))}`);
  const link = safeExternalURL(item.permalink);
  const media = item.preview
    ? `<img src="${escapeHTML(item.preview)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : '<div class="instagram-card-nomedia" aria-hidden="true">◎</div>';
  const inner = `<div class="instagram-card-media">${media}${item.isVideo?'<span class="instagram-card-video" aria-hidden="true">▶</span>':''}<span class="instagram-card-source">${escapeHTML(sourceLabel)}</span></div>
    <div class="instagram-card-copy">
      ${item.caption?`<p>${escapeHTML(item.caption)}</p>`:''}
      <div class="instagram-card-foot">
        <time datetime="${escapeHTML(item.timestamp||'')}">${escapeHTML(fmtEditorialDate(item.timestamp))}</time>
        ${metrics.length?`<span class="instagram-card-metrics">${metrics.join(' · ')}</span>`:''}
      </div>
    </div>`;
  return link
    ? `<a class="instagram-card" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    : `<article class="instagram-card">${inner}</article>`;
}

function renderInstagramItems(payload){
  const grid = document.getElementById('instagramFeedGrid');
  const status = document.getElementById('instagramFeedStatus');
  if(!grid) return;
  const items = Array.isArray(payload?.items) ? payload.items.slice(0,12) : [];
  if(!items.length){ grid.innerHTML = instagramStateHTML('empty'); return; }
  if(status){
    status.textContent = `${items.length} güncel gönderi`;
    status.dataset.state = 'live';
  }
  grid.innerHTML = items.map(instagramCardHTML).join('');
}

async function renderInstagramFeed(){
  const grid = document.getElementById('instagramFeedGrid');
  if(!grid) return;
  const league = activeFootballLeague === 'all' ? 'super-lig' : activeFootballLeague;
  // Lig degistiyse onbellegi tazele.
  if(instagramFeedLeague !== league){ instagramFeedRequest = null; instagramFeedLeague = league; }
  const status = document.getElementById('instagramFeedStatus');
  if(status){ status.textContent = 'Gündem akışı kontrol ediliyor'; status.dataset.state = 'loading'; }
  grid.innerHTML = skeletonCardsHTML(3,'instagram-skeleton-card');
  try{
    if(!instagramFeedRequest){
      instagramFeedRequest = fetch(`/api/social/instagram?league=${encodeURIComponent(league)}`,{headers:{Accept:'application/json'}})
        .then(async (response)=>{
          const payload = await response.json().catch(()=>null);
          if(!response.ok){ const error = new Error(payload?.error||'instagram_unavailable'); error.code = payload?.error; throw error; }
          return payload;
        });
    }
    renderInstagramItems(await instagramFeedRequest);
  }catch(error){
    instagramFeedRequest = null;
    grid.innerHTML = instagramStateHTML(error?.code === 'instagram_not_configured' ? 'unconfigured' : 'error');
  }
}

const footballLazyModuleObservers=new Map();
function scheduleFootballLazyModule(key,targetId,loader){
  const target=document.getElementById(targetId); if(!target) return;
  const signature=`${key}:${activeFootballLeague}`;
  if(target.dataset.lazySignature===signature) return;
  target.dataset.lazySignature=signature;
  footballLazyModuleObservers.get(key)?.disconnect();
  const run=()=>{ if(target.dataset.lazySignature===signature) loader(); };
  if(typeof IntersectionObserver!=='function'){
    // Eski tarayıcı yedeği de gizli bloğu önden çağırmaz. Scroll/resize ile
    // yalnız gerçek viewport kesişmesi oluştuğunda aynı loader çalışır.
    let stopped=false;
    const cleanup=()=>{
      if(stopped) return;
      stopped=true;
      window.removeEventListener('scroll',check);
      window.removeEventListener('resize',check);
    };
    const check=()=>{
      if(stopped||!target.isConnected) return;
      const rect=target.getBoundingClientRect?.();
      const viewportHeight=window.innerHeight||document.documentElement?.clientHeight||0;
      if(!rect||rect.bottom<0||rect.top>viewportHeight) return;
      cleanup(); footballLazyModuleObservers.delete(key); run();
    };
    footballLazyModuleObservers.set(key,{disconnect:cleanup});
    window.addEventListener('scroll',check,{passive:true});
    window.addEventListener('resize',check);
    setTimeout(check,0);
    return;
  }
  const observer=new IntersectionObserver(entries=>{
    if(!entries.some(entry=>entry.isIntersecting)) return;
    observer.disconnect(); footballLazyModuleObservers.delete(key); run();
  // Sağlayıcı kotası için önden 600 px prefetch yapma: transfer verisi ancak
  // kullanıcı blok gerçekten viewport'a girdiğinde bu görünümün sahibi olur.
  },{rootMargin:'0px',threshold:0.01});
  footballLazyModuleObservers.set(key,observer);
  observer.observe(target);
}
function scheduleLeagueOverviewTransferFeed(root,leagueKey){
  if(!root||activeFootballLeague!==leagueKey||activeFootballSection!=='home'||leagueTransferCache.has(leagueKey)) return;
  const target=root.querySelector('.league-overview-lower');
  if(!target) return;
  target.id='leagueOverviewLower';
  if(!leagueTransferRequests.has(leagueKey)) delete target.dataset.lazySignature;
  scheduleFootballLazyModule(`league-overview-transfer-${leagueKey}`,target.id,async()=>{
    if(activeFootballLeague!==leagueKey||activeFootballSection!=='home'||!root.isConnected) return;
    await requestLeagueTransferFeed(leagueKey);
    if(activeFootballLeague!==leagueKey||activeFootballSection!=='home'||!root.isConnected) return;
    if(target.childElementCount) target.innerHTML=leagueOverviewLowerHTML();
  });
}
function footballHomeMatchState(match){
  const result=match.result || (typeof getResult==='function' ? getResult(match.id) : null);
  const status=normalizeClientFootballStatus(match.status);
  if(match.livePendingVerification) return {key:'unavailable',label:'DURUM DOĞRULANIYOR',score:result?`${result.home} - ${result.away}`:''};
  if(status==='live' || status==='halftime') return {key:'live',label:status==='halftime'?'DEVRE':match.minute?`${match.minute}' CANLI`:'CANLI',score:result?`${result.home} - ${result.away}`:''};
  if(status==='cancelled'||status==='postponed') return {key:'unavailable',label:status==='postponed'?'ERTELENDİ':'İPTAL',score:''};
  if(result || status==='finished') return {key:'finished',label:'MS',score:result?`${result.home} - ${result.away}`:''};
  const kickoff=Date.parse(match.kickoff);
  if(!Number.isFinite(kickoff)||kickoff<Date.now()) return {key:'unavailable',label:'DURUM BEKLENİYOR',score:''};
  const dayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  const label=dayKey(kickoff)===dayKey(Date.now())
    ? fmtTime(match.kickoff)
    : new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(kickoff));
  return {key:'upcoming',label,score:''};
}
function openFootballPredict(matchId,pick=''){
  const url=new URL('/',location.origin);
  url.searchParams.set('fixture',String(matchId));
  if(['1','X','2'].includes(pick)) url.searchParams.set('pick',pick);
  location.assign(url.toString());
}
let activeFootballHomeFilter='all';
function footballHomeMatchRow(match){
  const state=footballHomeMatchState(match);
  const canPredict=state.key==='upcoming';
  const result=match.result || (typeof getResult==='function' ? getResult(match.id) : null);
  const outcome=state.key==='finished'&&result&&Number.isFinite(Number(result.home))&&Number.isFinite(Number(result.away))
    ? (Number(result.home)===Number(result.away)?'is-draw':Number(result.home)>Number(result.away)?'home-win':'away-win')
    : '';
  return `<article class="scoreboard-match-row ${state.key} ${outcome}" data-home-fixture="${escapeHTML(String(match.id))}">
    <button class="scoreboard-match-main" type="button" onclick="openMatchCenter('${escapeHTML(String(match.id))}')" aria-label="${escapeHTML(match.ev)} ${escapeHTML(match.konuk)} maç merkezini aç">
      <span class="scoreboard-time">${escapeHTML(state.label)}</span>
      <span class="scoreboard-team home">${escapeHTML(match.ev)}${crestHTML(match.ev)}</span>
      <strong class="scoreboard-score">${escapeHTML(state.score||'—')}</strong>
      <span class="scoreboard-team away">${crestHTML(match.konuk)}${escapeHTML(match.konuk)}</span>
    </button>
    ${canPredict?`<button class="scoreboard-predict" type="button" onclick="openFootballPredict('${escapeHTML(String(match.id))}')">Predict</button>`:`<button class="scoreboard-predict is-detail" type="button" onclick="openMatchCenter('${escapeHTML(String(match.id))}')">Detay</button>`}
  </article>`;
}
function filterFootballHomeMatches(filter,button){
  const root=document.getElementById('footballScoreboardHome'); if(!root) return;
  activeFootballHomeFilter=['all','live','finished','upcoming'].includes(filter)?filter:'all';
  if(!button) button=root.querySelector(`[data-scoreboard-filter="${activeFootballHomeFilter}"]`);
  root.querySelectorAll('.scoreboard-filters button').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});
  root.querySelectorAll('.scoreboard-match-row').forEach(row=>{ row.hidden=filter!=='all'&&!row.classList.contains(filter); });
  root.querySelectorAll('.scoreboard-league-group').forEach(group=>{ group.hidden=![...group.querySelectorAll('.scoreboard-match-row')].some(row=>!row.hidden); });
  const empty=root.querySelector('#scoreboardFilterEmpty');
  if(empty) empty.hidden=[...root.querySelectorAll('.scoreboard-match-row')].some(row=>!row.hidden);
}
function footballHomeMiniStandings(leagueKey){
  const rows=Array.isArray(FOOTBALL_HOME_STANDINGS?.[leagueKey])?FOOTBALL_HOME_STANDINGS[leagueKey]:[];
  if(!rows.length) return '<p class="scoreboard-mini-empty">Puan tablosu sağlayıcıdan bekleniyor.</p>';
  return `<div class="scoreboard-mini-table"><div class="scoreboard-mini-head"><span>#</span><span>Takım</span><span>O</span><span>P</span></div>${rows.map((row,index)=>`<div class="scoreboard-mini-row"><b>${index+1}</b><span>${crestHTML(row.team,'xs')}<strong>${escapeHTML(row.team)}</strong></span><small>${escapeHTML(row.played??0)}</small><em>${escapeHTML(row.points??0)}</em></div>`).join('')}</div>`;
}
function footballHomeLeagueGroupContent(group){
  const headingId=`scoreboard-league-${group.key}`;
  return `<div class="scoreboard-league-head"><h2 id="${headingId}">${escapeHTML(group.label)}</h2><button type="button" onclick="selectFootballLeague('${group.key}')">Tümünü gör →</button></div>${group.matches.length?group.matches.map(footballHomeMatchRow).join(''):`<p class="scoreboard-empty">${group.available?'Yaklaşan program henüz açıklanmadı.':'Lig verisi şu anda alınamadı; diğer ligler çalışmaya devam ediyor.'}</p>`}`;
}
function footballHomeFeatureContent(featured,featuredState,tableLeague){
  return `${featured?`<div class="scoreboard-kicker">ÖNE ÇIKAN MAÇ</div><h2>${escapeHTML(featured.ev)}<br>${escapeHTML(featured.konuk)}</h2><div class="scoreboard-feature-score"><span>${crestHTML(featured.ev,'lg')}</span><strong>${escapeHTML(featuredState.score||featuredState.label)}</strong><span>${crestHTML(featured.konuk,'lg')}</span></div>${featuredState.key==='upcoming'?`<p>Kim kazanır?</p><div class="scoreboard-picks" aria-label="Maç sonucu tahmini"><button onclick="openFootballPredict('${escapeHTML(String(featured.id))}','1')">1</button><button onclick="openFootballPredict('${escapeHTML(String(featured.id))}','X')">X</button><button onclick="openFootballPredict('${escapeHTML(String(featured.id))}','2')">2</button></div><button class="scoreboard-open" onclick="openFootballPredict('${escapeHTML(String(featured.id))}')">Maç merkezi ve Predict →</button>`:`<p>${featuredState.key==='live'?'Maç şu anda oynanıyor.':'Karşılaşma tamamlandı.'}</p><button class="scoreboard-open" onclick="openMatchCenter('${escapeHTML(String(featured.id))}')">${featuredState.key==='live'?'Canlı maç merkezine git':'Maç detayını aç'} →</button>`}`:'<h2>Program hazırlanıyor</h2><p>Lig verileri yenilendiğinde burada görünecek.</p>'}<section class="scoreboard-mini-standings"><header><div><span>PUAN DURUMU</span><strong>${escapeHTML(competitionLabelBySlug(tableLeague))}</strong></div><button type="button" onclick="selectFootballLeague('${tableLeague}')">Tam tablo →</button></header>${footballHomeMiniStandings(tableLeague)}</section>`;
}
let footballHomeHydrationSequence=0;
function waitForEarlyFootballHomeHandoff(root){
  if(root.dataset.homeHandoffQueued==='true') return;
  root.dataset.homeHandoffQueued='true';
  let settled=false;
  let fallbackTimer=null;
  const resume=()=>{
    if(settled) return;
    settled=true;
    window.removeEventListener('xyz:football-home-early-ready',resume);
    if(fallbackTimer!==null) clearTimeout(fallbackTimer);
    setTimeout(()=>{
      delete root.dataset.homeHandoffQueued;
      if(!root.isConnected||activeFootballLeague!=='all'||activeFootballSection!=='home') return;
      if(root.dataset.earlyRendering==='true'){
        delete root.dataset.earlyRendering;
        delete root.dataset.earlyHydrated;
      }
      renderFootballScoreboardHome();
    },0);
  };
  window.addEventListener('xyz:football-home-early-ready',resume,{once:true});
  fallbackTimer=setTimeout(resume,1500);
}
function syncEarlyFootballScoreboard(root,{grouped,featured,featuredState,tableLeague}){
  if(root.dataset?.earlyHydrated!=='true') return false;
  const existingGroups=[...root.querySelectorAll('.scoreboard-league-group')];
  const feature=root.querySelector('.scoreboard-feature');
  if(existingGroups.length!==grouped.length||!feature) return false;
  const signature=grouped.map(group=>`${group.key}:${group.matches.map(match=>`${match.id}:${match.status||''}:${match.result?.home??''}-${match.result?.away??''}`).join(',')}`).join('|');
  if(root.dataset.homeHydrationSignature===signature) return true;
  root.dataset.homeHydrationSignature=signature;
  const hydrationSequence=++footballHomeHydrationSequence;
  const stillCurrent=()=>hydrationSequence===footballHomeHydrationSequence&&activeFootballLeague==='all'&&activeFootballSection==='home'&&root.isConnected&&!root.hidden;
  root.querySelectorAll('[data-league-switch]').forEach(button=>{
    const leagueKey=button.dataset.leagueSwitch;
    button.onclick=()=>selectFootballLeague(leagueKey);
  });
  root.querySelectorAll('[data-scoreboard-filter]').forEach(button=>{
    button.onclick=()=>filterFootballHomeMatches(button.dataset.scoreboardFilter,button);
  });
  let nextLeague=0;
  const upgradeLeague=()=>{
    if(!stillCurrent()) return;
    const group=grouped[nextLeague], target=existingGroups[nextLeague];
    if(group&&target){
      target.setAttribute('aria-labelledby',`scoreboard-league-${group.key}`);
      target.innerHTML=footballHomeLeagueGroupContent(group);
    }
    nextLeague+=1;
    if(nextLeague<grouped.length){ setTimeout(upgradeLeague,0); return; }
    setTimeout(()=>{
      if(!stillCurrent()) return;
      feature.innerHTML=footballHomeFeatureContent(featured,featuredState,tableLeague);
      filterFootballHomeMatches(activeFootballHomeFilter);
      root.dataset.fullHomeHydrated='true';
    },0);
  };
  setTimeout(upgradeLeague,0);
  return true;
}
function renderFootballScoreboardHome(){
  const root=document.getElementById('footballScoreboardHome'); if(!root) return;
  const focusedFixture=document.activeElement?.closest?.('[data-home-fixture]')?.dataset?.homeFixture||null;
  const focusedAction=document.activeElement?.classList?.contains('scoreboard-predict')?'predict':'main';
  setFootballOverviewChromeHidden(true);
  document.body.classList.remove('football-league-overview-mode');
  document.body.classList.add('football-aggregate-home'); root.hidden=false;
  const leagueOverview=document.getElementById('footballLeagueOverview'); if(leagueOverview) leagueOverview.hidden=true;
  if(root.dataset.earlyRendering==='true'){
    waitForEarlyFootballHomeHandoff(root);
    return;
  }
  const leagueKeys=['super-lig','premier-league','la-liga','bundesliga','serie-a'];
  const grouped=leagueKeys.map(key=>({key,label:competitionLabelBySlug(key),available:FOOTBALL_HOME_AVAILABILITY?.[key]!==false,matches:MATCHES.filter(match=>(match.league_key||competitionSlug(competitionName(match)))===key)}));
  const eligibleFeatured=MATCHES.filter(match=>footballHomeMatchState(match).key!=='unavailable');
  const featured=eligibleFeatured.find(match=>footballHomeMatchState(match).key==='live') || eligibleFeatured.find(match=>footballHomeMatchState(match).key==='upcoming') || eligibleFeatured.find(match=>footballHomeMatchState(match).key==='finished') || null;
  const featuredState=featured?footballHomeMatchState(featured):null;
  const tableLeague=featured?.league_key&&leagueKeys.includes(featured.league_key)?featured.league_key:'super-lig';
  if(syncEarlyFootballScoreboard(root,{grouped,featured,featuredState,tableLeague})) return;
  root.innerHTML=`<div class="scoreboard-shell">
    <aside class="scoreboard-leagues"><div class="scoreboard-kicker">FUTBOL</div><h1>Ligler</h1><p>Bir lig seç ve tüm ayrıntılara geç.</p><nav>${grouped.map(group=>`<button type="button" onclick="selectFootballLeague('${group.key}')" aria-label="${escapeHTML(group.label)} lig merkezini aç"><span>${escapeHTML(group.label)}</span><b>→</b></button>`).join('')}</nav></aside>
    <main class="scoreboard-fixtures"><header><div><span class="scoreboard-live-dot"></span> Bugün ve yaklaşan maçlar</div><span>${new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'})}</span></header>
      <div class="scoreboard-filters"><button data-scoreboard-filter="all" type="button" aria-pressed="false" onclick="filterFootballHomeMatches('all',this)">Tümü</button><button data-scoreboard-filter="live" type="button" aria-pressed="false" onclick="filterFootballHomeMatches('live',this)">Canlı</button><button data-scoreboard-filter="finished" type="button" aria-pressed="false" onclick="filterFootballHomeMatches('finished',this)">Biten</button><button data-scoreboard-filter="upcoming" type="button" aria-pressed="false" onclick="filterFootballHomeMatches('upcoming',this)">Yaklaşan</button></div>
      ${grouped.map(group=>{const headingId=`scoreboard-league-${group.key}`;return `<section class="scoreboard-league-group" aria-labelledby="${headingId}"><div class="scoreboard-league-head"><h2 id="${headingId}">${escapeHTML(group.label)}</h2><button type="button" onclick="selectFootballLeague('${group.key}')">Tümünü gör →</button></div>${group.matches.length?group.matches.map(footballHomeMatchRow).join(''):`<p class="scoreboard-empty">${group.available?'Yaklaşan program henüz açıklanmadı.':'Lig verisi şu anda alınamadı; diğer ligler çalışmaya devam ediyor.'}</p>`}</section>`;}).join('')}<p class="scoreboard-empty scoreboard-filter-empty" id="scoreboardFilterEmpty" hidden>Bu filtrede maç bulunmuyor.</p>
    </main>
    <aside class="scoreboard-feature">${featured?`<div class="scoreboard-kicker">ÖNE ÇIKAN MAÇ</div><h2>${escapeHTML(featured.ev)}<br>${escapeHTML(featured.konuk)}</h2><div class="scoreboard-feature-score"><span>${crestHTML(featured.ev,'lg')}</span><strong>${escapeHTML(featuredState.score||featuredState.label)}</strong><span>${crestHTML(featured.konuk,'lg')}</span></div>${featuredState.key==='upcoming'?`<p>Kim kazanır?</p><div class="scoreboard-picks" aria-label="Maç sonucu tahmini"><button onclick="openFootballPredict('${escapeHTML(String(featured.id))}','1')">1</button><button onclick="openFootballPredict('${escapeHTML(String(featured.id))}','X')">X</button><button onclick="openFootballPredict('${escapeHTML(String(featured.id))}','2')">2</button></div><button class="scoreboard-open" onclick="openFootballPredict('${escapeHTML(String(featured.id))}')">Maç merkezi ve Predict →</button>`:`<p>${featuredState.key==='live'?'Maç şu anda oynanıyor.':'Karşılaşma tamamlandı.'}</p><button class="scoreboard-open" onclick="openMatchCenter('${escapeHTML(String(featured.id))}')">${featuredState.key==='live'?'Canlı maç merkezine git':'Maç detayını aç'} →</button>`}`:'<h2>Program hazırlanıyor</h2><p>Lig verileri yenilendiğinde burada görünecek.</p>'}<section class="scoreboard-mini-standings"><header><div><span>PUAN DURUMU</span><strong>${escapeHTML(competitionLabelBySlug(tableLeague))}</strong></div><button type="button" onclick="selectFootballLeague('${tableLeague}')">Tam tablo →</button></header>${footballHomeMiniStandings(tableLeague)}</section></aside>
  </div>`;
  filterFootballHomeMatches(activeFootballHomeFilter);
  if(focusedFixture){
    const row=root.querySelector(`[data-home-fixture="${typeof CSS!=='undefined'&&CSS.escape?CSS.escape(focusedFixture):focusedFixture.replace(/["\\]/g,'\\$&')}"]`);
    const target=focusedAction==='predict'?row?.querySelector('.scoreboard-predict'):row?.querySelector('.scoreboard-match-main');
    if(target) target.focus({preventScroll:true});
  }
}
function leagueOverviewCountry(key){ return ({'super-lig':'Türkiye','premier-league':'İngiltere','la-liga':'İspanya','bundesliga':'Almanya','serie-a':'İtalya'})[key]||'Avrupa'; }
function leagueOverviewSeasonLabel(rows,matches){
  const explicit=[...(rows||[]),...(matches||[])].map(item=>item?.season_name||item?.season_label||item?.season).find(value=>/\d{4}\s*[\/-]\s*(?:\d{2}|\d{4})/.test(String(value||'')));
  if(explicit) return String(explicit).replace(/\s+/g,' ').trim();
  const now=new Date(),start=now.getMonth()>=6?now.getFullYear():now.getFullYear()-1;
  return `${start}/${String(start+1).slice(-2)}`;
}
function leagueOverviewFormHTML(value){
  const rows=String(value||'').toUpperCase().slice(-5).split('').filter(letter=>['W','D','L','G','B','M'].includes(letter));
  return rows.length?`<span class="league-overview-form">${rows.map(letter=>{const state=['W','G'].includes(letter)?'win':['L','M'].includes(letter)?'loss':'draw';return `<i class="${state}">${state==='win'?'G':state==='loss'?'M':'B'}</i>`;}).join('')}</span>`:'<span class="league-overview-form empty">—</span>';
}
function leagueOverviewTableRowsHTML(rows,rankOffset=0){
  return rows.map((row,index)=>`<tr data-league-overview-team="${escapeHTML(row.team)}"><td class="rank">${rankOffset+index+1}</td><th class="team" scope="row">${crestHTML(row.team,'xs')}<strong>${escapeHTML(row.team)}</strong></th><td>${escapeHTML(row.played??0)}</td><td>${escapeHTML(row.won??0)}</td><td>${escapeHTML(row.drawn??0)}</td><td>${escapeHTML(row.lost??0)}</td><td>${escapeHTML(row.goals_for??0)}-${escapeHTML(row.goals_against??0)}</td><td>${Number(row.goal_difference||0)>0?'+':''}${escapeHTML(row.goal_difference??0)}</td><td class="points">${escapeHTML(row.points??0)}</td><td>${leagueOverviewFormHTML(row.form)}</td></tr>`).join('');
}
function leagueOverviewTableHTML(rows){
  if(!rows.length) return footballEmpty('Puan durumu bekleniyor','Sağlayıcının doğrulanmış lig tablosu geldiğinde bu alan otomatik dolacak.');
  const badge=standingsSeasonBadge(rows);
  return `${standingsArchiveBannerHTML(rows)}<div class="league-overview-table-scroll"><table class="league-overview-table"><caption>${escapeHTML(competitionLabelBySlug(activeFootballLeague))} puan durumu</caption><thead><tr><th scope="col">#</th><th scope="col">Takım</th><th scope="col">O</th><th scope="col">G</th><th scope="col">B</th><th scope="col">M</th><th scope="col">AG-YG</th><th scope="col">AV</th><th scope="col">P</th><th scope="col">Form</th></tr></thead><tbody>${leagueOverviewTableRowsHTML(rows)}</tbody></table></div><footer class="league-overview-source"><span>${escapeHTML(badge.label)}</span><b>${escapeHTML(badge.note)}</b></footer>`;
}
function leagueOverviewFixtureRow(match){
  const state=footballHomeMatchState(match), result=match.result||getResult(match.id);
  return `<button class="league-overview-fixture ${state.key==='live'?'is-live':''} ${state.key==='unavailable'?'is-unavailable':''}" type="button" data-league-overview-match="${escapeHTML(match.id)}" aria-label="${escapeHTML(match.ev)} ${escapeHTML(match.konuk)} maç merkezini aç"><span class="state">${escapeHTML(state.label)}</span><span class="home"><b>${escapeHTML(match.ev)}</b>${crestHTML(match.ev,'xs')}</span><strong>${result?`${escapeHTML(result.home)}–${escapeHTML(result.away)}`:'—'}</strong><span class="away">${crestHTML(match.konuk,'xs')}<b>${escapeHTML(match.konuk)}</b></span></button>`;
}
function leagueOverviewFixturesHTML(matches){
  const live=matches.filter(footballStatusIsLive).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  const upcoming=matches.filter(match=>!footballStatusIsUnavailable(match)&&!footballStatusIsFinished(match)&&!footballStatusIsLive(match)&&!match.result&&!getResult(match.id)&&new Date(match.kickoff)>new Date()).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)).slice(0,6);
  const completed=matches.filter(match=>match.result||getResult(match.id)||footballStatusIsFinished(match)).sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff)).slice(0,6);
  const groups=[['Canlı',live],['Yaklaşan',upcoming],['Son sonuçlar',completed]].filter(([,items])=>items.length);
  if(!groups.length) return footballEmpty('Maç programı bekleniyor','Doğrulanmış fikstür yayınlandığında burada görünecek.');
  return groups.map(([label,items])=>`<div class="league-overview-fixture-group"><h3>${label}</h3>${items.map(leagueOverviewFixtureRow).join('')}</div>`).join('');
}
function leagueOverviewMetricCards(rows){
  if(!rows.length) return '';
  const leader=rows[0];
  const attack=[...rows].sort((a,b)=>(b.goals_for||0)-(a.goals_for||0))[0];
  const defence=[...rows].filter(row=>(row.played||0)>0).sort((a,b)=>(a.goals_against||0)-(b.goals_against||0))[0]||rows[0];
  const formPoints=row=>String(row.form||'').slice(-5).split('').reduce((total,value)=>total+(['W','G'].includes(value)?3:['D','B'].includes(value)?1:0),0);
  const form=[...rows].sort((a,b)=>formPoints(b)-formPoints(a))[0];
  const cards=[['Lider',leader,`${leader.points||0} puan`],['En iyi hücum',attack,`${attack.goals_for||0} gol`],['En iyi savunma',defence,`${defence.goals_against||0} gol yedi`],['Form takımı',form,`${formPoints(form)} / 15 puan`]];
  return cards.map(([label,row,value])=>`<article><span>${label}</span><div>${crestHTML(row.team,'sm')}<strong>${escapeHTML(row.team)}</strong></div><b>${escapeHTML(value)}</b></article>`).join('');
}
function leagueOverviewLowerHTML(){
  const stories=leagueEditorialBaseEntries().slice(0,4);
  const transfers=leagueTransferRecords('confirmed').slice(0,4);
  return `<section class="league-overview-panel"><header><div><small>LİG GÜNDEMİ</small><h2>Öne çıkanlar</h2></div><button type="button" onclick="openFootballSection('news')">Tüm haberler →</button></header><div class="league-overview-stories">${stories.length?stories.map(story=>`<article><span>${escapeHTML(story.label||'Gündem')}</span><h3>${escapeHTML(story.title)}</h3><p>${escapeHTML(story.text||'')}</p></article>`).join(''):footballEmpty('Gündem hazırlanıyor','Bu lig için doğrulanmış yeni kayıt geldiğinde burada görünecek.')}</div></section><aside class="league-overview-panel"><header><div><small>TRANSFER MERKEZİ</small><h2>Son işlemler</h2></div><button type="button" onclick="openFootballSection('transfers')">Tüm transferler →</button></header><div class="league-overview-transfer-list">${transfers.length?transfers.map(item=>`<article><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.from)} → ${escapeHTML(item.to)}</span><b>${escapeHTML(item.fee||item.status||'')}</b></article>`).join(''):footballEmpty('Transfer kaydı bekleniyor','Sportmonks bu lig için doğrulanmış kayıt yayınladığında alan dolar.')}</div></aside>`;
}
function bindLeagueOverviewDOM(root,leagueKey){
  root.querySelectorAll('[data-league-switch]').forEach(button=>{
    const target=button.dataset.leagueSwitch;
    const active=target===leagueKey;
    button.classList.toggle('active',active);
    if(active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    const competition=SELECTED_COMPETITIONS.find(item=>item.key===target);
    button.textContent=target==='all'?'Tüm ligler':(competition?.short||competition?.label||target);
    button.onclick=()=>selectFootballLeague(target);
  });
  root.querySelectorAll('[data-football-section]').forEach(button=>{
    const section=button.dataset.footballSection;
    button.onclick=()=>openFootballSection(section);
  });
  root.querySelectorAll('[data-league-overview-match]').forEach(button=>{
    button.onclick=()=>openMatchCenter(button.dataset.leagueOverviewMatch);
  });
}
function syncEarlyLeagueOverview(root,{leagueKey,label,country,seasonLabel,logo,initialRows,initialMatches}){
  const duplicateTabs=[...root.querySelectorAll(':scope > .league-overview-tabs')];
  duplicateTabs.slice(1).forEach(tab=>tab.remove());
  const identity=root.querySelector('.league-overview-identity');
  const tablePanel=root.querySelector('.league-table-panel');
  const fixtureBody=root.querySelector('.league-overview-fixtures-body');
  const tableHeader=tablePanel?.querySelector(':scope > header');
  if(!identity||!tablePanel||!tableHeader||!fixtureBody) return false;
  const title=identity.querySelector('h1'); if(title) title.textContent=label;
  const subtitle=identity.querySelector('p'); if(subtitle) subtitle.textContent=`${country} · ${seasonLabel} sezonu`;
  const logoRoot=identity.querySelector('.league-overview-logo');
  if(logoRoot){
    logoRoot.replaceChildren();
    if(logo){
      const image=document.createElement('img');
      image.src=logo; image.alt=`${label} logosu`; image.loading='eager'; image.referrerPolicy='no-referrer';
      logoRoot.append(image);
    }else logoRoot.textContent='⚽';
  }
  const tablist=root.querySelector('.league-overview-tabs');
  if(tablist) tablist.setAttribute('aria-label',`${label} bölümleri`);
  root.dataset.fullLeagueHydrated=leagueKey;
  setTimeout(()=>{
    if(!root.isConnected||activeFootballLeague!==leagueKey||root.dataset.fullLeagueHydrated!==leagueKey) return;
    [...tablePanel.children].filter(child=>child!==tableHeader).forEach(child=>child.remove());
    tablePanel.insertAdjacentHTML('beforeend',leagueOverviewTableHTML(initialRows));
    setTimeout(()=>{
      if(!root.isConnected||activeFootballLeague!==leagueKey||root.dataset.fullLeagueHydrated!==leagueKey) return;
      fixtureBody.innerHTML=leagueOverviewFixturesHTML(initialMatches);
      bindLeagueOverviewDOM(root,leagueKey);
    },0);
  },0);
  return true;
}
let leagueOverviewHydrationSequence=0;
function renderFootballLeagueOverview(){
  const root=document.getElementById('footballLeagueOverview'); if(!root) return;
  setFootballOverviewChromeHidden(true);
  const leagueKey=activeFootballLeague;
  if(root.dataset.leagueOverviewMounting===leagueKey){ root.dataset.leagueOverviewRefreshPending='true'; return; }
  const label=competitionLabelBySlug(leagueKey), country=leagueOverviewCountry(leagueKey);
  const rows=standingRowsForActiveLeague();
  const matches=matchesForActiveLeague();
  const seasonLabel=leagueOverviewSeasonLabel(rows,matches);
  const logo=safeExternalURL(rows[0]?.competition_logo||matches[0]?.competition_logo);
  const initialRows=rows.slice(0,1);
  const deferredRows=rows.slice(1);
  const initialMatch=matches.find(footballStatusIsLive)
    || matches.find(match=>footballHomeMatchState(match).key==='upcoming')
    || matches.find(match=>footballHomeMatchState(match).key==='finished')
    || matches[0];
  const initialMatches=initialMatch?[initialMatch]:[];
  document.body.classList.remove('football-aggregate-home','football-root-route');
  document.body.classList.add('football-league-overview-mode');
  root.hidden=false;
  const scoreboard=document.getElementById('footballScoreboardHome'); if(scoreboard) scoreboard.hidden=true;
  let reusedEarly=root.dataset.earlyLeagueHydrated===leagueKey||root.dataset.fullLeagueHydrated===leagueKey;
  if(reusedEarly){
    reusedEarly=syncEarlyLeagueOverview(root,{leagueKey,label,country,seasonLabel,logo,initialRows,initialMatches});
  }
  if(!reusedEarly){
    delete root.dataset.earlyLeagueHydrated;
    delete root.dataset.fullLeagueHydrated;
    delete root.dataset.leagueOverviewRefreshPending;
    root.dataset.leagueOverviewMounting=leagueKey;
    root.innerHTML=`<header class="league-overview-hero"><div class="league-overview-identity"><span class="league-overview-logo">${logo?`<img src="${escapeHTML(logo)}" alt="${escapeHTML(label)} logosu" loading="eager" referrerpolicy="no-referrer">`:'⚽'}</span><div><small>XYZSKOR · LİG MERKEZİ</small><h1>${escapeHTML(label)}</h1><p>${escapeHTML(country)} · ${escapeHTML(seasonLabel)} sezonu</p></div></div><div class="league-overview-switch" aria-label="Lig değiştir">${SELECTED_COMPETITIONS.filter(item=>item.key!=='all').map(item=>`<button class="${item.key===leagueKey?'active':''}" ${item.key===leagueKey?'aria-current="page"':''} type="button" data-league-switch="${item.key}" onclick="selectFootballLeague('${item.key}')">${escapeHTML(item.short)}</button>`).join('')}<button type="button" data-league-switch="all" onclick="selectFootballLeague('all')">Tüm ligler</button></div></header>`;
  }
  bindLeagueOverviewDOM(root,leagueKey);
  const hydrationSequence=++leagueOverviewHydrationSequence;
  const stillCurrent=()=>hydrationSequence===leagueOverviewHydrationSequence&&activeFootballLeague===leagueKey&&activeFootballSection==='home'&&root.isConnected;
  const deferOverviewTask=(callback,delay)=>setTimeout(callback,delay);
  const hydrateRemaining=()=>{
    deferOverviewTask(()=>{
      if(!stillCurrent()) return;
      const fixtureBody=root.querySelector('.league-overview-fixtures-body');
      if(fixtureBody){
        fixtureBody.innerHTML=leagueOverviewFixturesHTML(matches);
        fixtureBody.querySelectorAll('[data-league-overview-match]').forEach(button=>{button.onclick=()=>openMatchCenter(button.dataset.leagueOverviewMatch);});
      }
      const tableBody=root.querySelector('.league-overview-table tbody');
      let nextRow=0;
      const appendRowBatch=()=>{
        if(!stillCurrent()) return;
        const chunk=deferredRows.slice(nextRow,nextRow+1);
        if(tableBody&&chunk.length) tableBody.insertAdjacentHTML('beforeend',leagueOverviewTableRowsHTML(chunk,initialRows.length+nextRow));
        nextRow+=chunk.length;
        if(nextRow<deferredRows.length){ deferOverviewTask(appendRowBatch,60); return; }
        deferOverviewTask(()=>{
          if(!stillCurrent()) return;
          const metricsRoot=root.querySelector('.league-overview-metrics'); if(metricsRoot) metricsRoot.innerHTML=leagueOverviewMetricCards(rows);
          deferOverviewTask(()=>{
            if(!stillCurrent()) return;
            const lowerRoot=root.querySelector('.league-overview-lower');
            if(lowerRoot){
              lowerRoot.innerHTML=leagueOverviewLowerHTML();
              scheduleLeagueOverviewTransferFeed(root,leagueKey);
            }
          },0);
        },120);
      };
      deferOverviewTask(appendRowBatch,0);
    },650);
  };
  if(reusedEarly) hydrateRemaining();
  else deferOverviewTask(()=>{
    if(!stillCurrent()) return;
    root.querySelectorAll(':scope > .league-overview-tabs').forEach(tab=>tab.remove());
    root.insertAdjacentHTML('beforeend',`<nav class="league-overview-tabs" aria-label="${escapeHTML(label)} bölümleri"><button class="active" type="button" aria-current="page" data-football-section="home">Genel bakış</button><button type="button" data-football-section="standings">Puan durumu</button><button type="button" data-football-section="matches">Maçlar</button><button type="button" data-football-section="clubs">Takımlar</button><button type="button" data-football-section="transfers">Transferler</button><button type="button" data-football-section="news">Haberler</button></nav>`);
    bindLeagueOverviewDOM(root,leagueKey);
    deferOverviewTask(()=>{
      if(!stillCurrent()) return;
      root.querySelectorAll(':scope > .league-overview-layout, :scope > .league-overview-metrics, :scope > .league-overview-lower').forEach(section=>section.remove());
      root.insertAdjacentHTML('beforeend',`<div class="league-overview-layout"><section class="league-overview-panel league-table-panel"><header><div><small>GÜNCEL SEZON</small><h2>Puan durumu</h2></div><button type="button" data-football-section="standings">Tam tablo →</button></header></section><aside class="league-overview-panel league-fixtures-panel"><header><div><small>MAÇ AKIŞI</small><h2>Sonuçlar ve fikstür</h2></div><button type="button" data-football-section="matches">Tüm maçlar →</button></header><div class="league-overview-fixtures-body"></div></aside></div><section class="league-overview-metrics"></section><div class="league-overview-lower"></div>`);
      bindLeagueOverviewDOM(root,leagueKey);
      deferOverviewTask(()=>{
        if(!stillCurrent()) return;
        const tablePanel=root.querySelector('.league-table-panel');
        const fixtureBody=root.querySelector('.league-overview-fixtures-body');
        if(!tablePanel||!fixtureBody) return;
        tablePanel.insertAdjacentHTML('beforeend',leagueOverviewTableHTML(initialRows));
        fixtureBody.innerHTML=leagueOverviewFixturesHTML(initialMatches);
        root.dataset.fullLeagueHydrated=leagueKey;
        delete root.dataset.leagueOverviewMounting;
        bindLeagueOverviewDOM(root,leagueKey);
        hydrateRemaining();
        if(root.dataset.leagueOverviewRefreshPending==='true'){
          delete root.dataset.leagueOverviewRefreshPending;
          deferOverviewTask(()=>{ if(activeFootballLeague===leagueKey&&activeFootballSection==='home') renderFootballLeagueOverview(); },0);
        }
      },0);
    },0);
  },0);
}
function renderFootballHome(){
  if(activeFootballLeague==='all'){ renderFootballScoreboardHome(); return; }
  renderFootballLeagueOverview();
}
if(typeof window!=='undefined'&&!window.__xyzFootballHomeRefreshBound){
  window.__xyzFootballHomeRefreshBound=true;
  window.addEventListener('xyz:football-home-refreshed',event=>{
    const payload=event?.detail?.payload;
    if(activeFootballLeague!=='all'||!payload||typeof applyFootballCriticalBundle!=='function') return;
    applyFootballCriticalBundle(payload,'all');
    if(activeFootballSection==='home') renderFootballScoreboardHome();
    renderTicker();
  });
}
function scrollToLiveCenter(){ const target=document.getElementById('page-live'); if(target) target.scrollIntoView({behavior:'smooth',block:'start'}); }
function renderStory(){
  if(activeFootballSection==='home'){
    renderFootballHome();
    const featured=document.getElementById('storyFeaturedArea'); if(featured) featured.innerHTML='';
    const list=document.getElementById('storyMatchList'); if(list) list.innerHTML='';
    return;
  }
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
function renderFootballLeagueScope(){
  applyFootballLeagueTheme();
  renderTicker();
  if(activeFootballSection==='home') renderStory();
  else{
    renderMatchesLeagueFilters();
    updateLeagueScopedCopy();
    openFootballSection(activeFootballSection,null,false);
  }
  updateMobileNavActive();
  if(document.getElementById('page-story')?.classList.contains('active')) startLiveFeed();
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

/* ===================== SIDEBAR: ÜCRETSİZ KATILIM MESAJI ===================== */
function renderAsideNextMatch(){
  const area = document.getElementById('asideNextMatch'); if(!area) return;
  area.innerHTML = `
    <div class="aside-title">Burada paran geçmez</div>
    <div class="aside-next-match">Cüzdanı cebine koy, skor bilgin yeter.</div>
    <div class="aside-next-time mono">Katılım ücretsiz · Bahis yok · Para yatırma yok</div>
    <div class="aside-facts">Ödül varsa sponsordan gelir; kullanıcıdan para alınmaz. En fazla arkadaş ortamında “ben demiştim” deme hakkı kazanırsın.</div>
    <button class="btn ghost" style="width:100%;margin-top:10px;" onclick="switchMainTab('predict')">Ücretsiz tahmine git →</button>
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
  const u = getCurrentUser();
  if(!u){ setPredictionStatus(id,'Tahminini kaydetmek için giriş yap veya ücretsiz üye ol.','error'); openAuth('login'); return; }
  const button=document.getElementById('savePrediction-'+id);
  const pick = pickState[id]; if(!pick){ setPredictionStatus(id,'Önce 1 / X / 2 seç.','error'); return; }
  const sh = document.getElementById('sh-'+id).value; const sa = document.getElementById('sa-'+id).value;
  if((sh==='') !== (sa==='')){ setPredictionStatus(id,'Kesin skor için iki takımın skorunu da gir.','error'); return; }
  const scoreHome = sh==='' ? null : Number(sh); const scoreAway = sa==='' ? null : Number(sa);
  if(button){ button.disabled=true; button.textContent='Kaydediliyor…'; }
  setPredictionStatus(id,'Tahminin kaydediliyor…','');
  try{
    const res = await savePrediction(id, {pick, scoreHome, scoreAway});
    if(!res.ok){ if(/authentication_required|oturum|giriş/i.test(String(res.err||''))){ setPredictionStatus(id,'Seçimini kaydetmek için oturumunu yenile.','error'); openAuth('login'); } else setPredictionStatus(id,'Seçim kaydedilemedi. Lütfen tekrar dene.','error'); if(button){button.disabled=false;button.textContent='Seçimi kaydet';} return; }
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
  return `<div class="prediction-zone"><div class="prediction-label">Maç sonucu</div><div class="predict-form" id="form-${escapeHTML(m.id)}"><div class="pick-row"><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','1',this)">1 · ${escapeHTML(m.ev)}</button><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','X',this)">X · Berabere</button><button class="pick-btn" type="button" aria-pressed="false" onclick="setPick('${m.id}','2',this)">2 · ${escapeHTML(m.konuk)}</button></div><div class="mini-note">Kesin skor isteğe bağlıdır.</div><div class="score-row"><span class="mono" style="font-size:12px;color:var(--ink-dim);">Kesin skor</span><input type="number" min="0" max="99" id="sh-${escapeHTML(m.id)}" inputmode="numeric" placeholder="0" aria-label="${escapeHTML(m.ev)} gol sayısı"><span class="mono">—</span><input type="number" min="0" max="99" id="sa-${escapeHTML(m.id)}" inputmode="numeric" placeholder="0" aria-label="${escapeHTML(m.konuk)} gol sayısı"><button class="btn" type="button" id="savePrediction-${escapeHTML(m.id)}" onclick="submitPrediction('${m.id}')">Seçimi kaydet</button></div><div class="predict-save-status" id="saveStatus-${escapeHTML(m.id)}" role="status" aria-live="polite"></div></div></div>`;
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
      <header class="predict-card-head"><strong>${escapeHTML(competitionShortBySlug(m.challengeLeague||competitionSlug(competitionName(m))))}</strong><time datetime="${escapeHTML(m.kickoff)}">${escapeHTML(fmtTime(m.kickoff))}</time><span>${isLocked(m.kickoff)?'Tahmin kapandı':`Kapanış ${deadline.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`}</span></header>
      <div class="predict-faceoff"><div class="predict-faceoff-team home">${crestHTML(m.ev,'md')}<strong>${escapeHTML(m.ev)}</strong><small>Ev sahibi</small></div><div class="predict-versus"><span>VS</span><small>${escapeHTML(new Date(m.kickoff).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'}))}</small></div><div class="predict-faceoff-team away">${crestHTML(m.konuk,'md')}<strong>${escapeHTML(m.konuk)}</strong><small>Deplasman</small></div></div>
      <div class="predict-action">${predictionActionHTML(m)}</div>
      <div class="predict-evidence-row">${communityHTML}${dataDetails}</div>
      <div class="predict-match-footer"><button class="football-module-action" type="button" onclick="openMatchCenter('${m.id}')">Maç merkezi <span aria-hidden="true">→</span></button></div>
    </article>`;
}
function renderLeagueMatches(){
  const ms0 = weekMatches(activeWeek);
  if(!ms0.length){
    document.getElementById('leagueMatchList').innerHTML = predictChallengeReady
      ? `<div class="predict-empty-state"><strong>Challenge fikstürü alınamadı</strong><span>${predictChallengeFailures.length ? `${predictChallengeFailures.map(competitionShortBySlug).join(', ')} verisi sağlayıcıdan gelmedi.` : 'Bu hafta için uygun gelecek maç bulunmuyor.'} Fikstür verisini yeniden deneyebilirsin.</span><button type="button" onclick="loadPredictChallengeSelection()">Yeniden dene</button></div>`
      : '<p class="section-desc">6 Maç Challenge fikstürü sağlayıcıdan yükleniyor.</p>';
  }
  else{
    const groups = groupByDate(ms0);
    const quota=['super-lig','premier-league','la-liga'].map(key=>({key,count:ms0.filter(match=>match.challengeLeague===key).length}));
    const missing=quota.filter(item=>item.count<2).map(item=>`<article class="predict-missing-slot"><strong>${escapeHTML(competitionShortBySlug(item.key))}</strong><div><b>${item.count}/2 maç hazır</b><span>SportMonks fikstür kapsamı açıldığında gerçek maçlar otomatik eklenecek.</span></div></article>`).join('');
    document.getElementById('leagueMatchList').innerHTML = Object.entries(groups).map(([date, ms]) => `
      <div class="predict-date-group">${escapeHTML(date)}</div>
      ${ms.map(m => leagueRowHTML(m)).join('')}
    `).join('')+missing;
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
  renderWeeklyChallenge();
}

let weeklyChallengeTimer=0;
function weeklyChallengeDeadline(now=new Date()){
  const end=new Date(now); const utcDay=end.getUTCDay();
  const days=(8-utcDay)%7 || 7;
  end.setUTCDate(end.getUTCDate()+days); end.setUTCHours(7,0,0,0);
  return end;
}
function weeklyChallengeLevel(points){
  const levels=[{name:'Çaylak',min:0,color:'#9ba3ad'},{name:'Bronz',min:3,color:'#c57638'},{name:'Gümüş',min:6,color:'#b9c4cf'},{name:'Altın',min:10,color:'#e0ae2d'},{name:'Elmas',min:15,color:'#54dbe5'},{name:'Şampiyon',min:22,color:'#ef5b73'}];
  return [...levels].reverse().find(level=>points>=level.min)||levels[0];
}
function updateWeeklyChallengeCountdown(){
  const target=document.getElementById('weeklyChallengeCountdown'); if(!target) return;
  const diff=Math.max(0,weeklyChallengeDeadline().getTime()-Date.now());
  const days=Math.floor(diff/86400000), hours=Math.floor((diff%86400000)/3600000), minutes=Math.floor((diff%3600000)/60000);
  target.textContent=`${days}g ${hours}sa ${minutes}dk`;
}
function renderWeeklyChallenge(){
  const panel=document.getElementById('weeklyChallengePanel'); if(!panel) return;
  const user=getCurrentUser(), matches=weekMatches(activeWeek).filter(match=>match.status!=='iptal'&&match.status!=='ertelendi');
  const stats=user?.id?userStatsForWeek(user.id,activeWeek):null;
  const points=Number(stats?.toplam||0), level=weeklyChallengeLevel(points);
  const generalRows=sortRows(leaderboardFor('Genel',activeWeek),'week');
  const rank=user?.id?generalRows.findIndex(row=>row.uid===user.id)+1:0;
  const missing=matches.filter(match=>!user?.id||!getPrediction(match.id,user.id)).filter(match=>!isLocked(match.kickoff)).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)).slice(0,3);
  const levels=['Çaylak','Bronz','Gümüş','Altın','Elmas','Şampiyon'];
  const completion=stats?.toplamMac?Math.round((stats.tahminSayisi/stats.toplamMac)*100):0;
  panel.innerHTML=`<header class="weekly-challenge-head"><div><span>${activeWeek}. HAFTA · XYZSKOR</span><h1>Haftalık Challenge</h1><p>Maçları tahmin et, puan topla ve haftalık ligde yüksel.</p></div><b>ÜCRETSİZ · BAHİS YOK</b></header><div class="weekly-challenge-grid"><aside class="weekly-challenge-status"><article><span>KALAN SÜRE</span><strong id="weeklyChallengeCountdown">—</strong><small>Her pazartesi 10.00'da yeni hafta</small></article><article><span>MEVCUT SIRAN</span><strong>${rank||'—'}</strong><small>${generalRows.length?`${generalRows.length} katılımcı içinde`:'İlk tahminlerle sıralama açılır'}</small></article></aside><main class="weekly-challenge-main"><div class="challenge-levels">${levels.map(name=>`<span class="${name===level.name?'active':''}" style="--level:${name===level.name?level.color:'#424a53'}"><i>◆</i><b>${escapeHTML(name)}</b></span>`).join('')}</div><div class="challenge-user-progress"><div><span>BU HAFTA</span><strong>${points} puan · ${escapeHTML(level.name)}</strong></div><b>${completion}% tamamlandı</b><i><span style="width:${completion}%"></span></i></div>${!user?'<div class="challenge-join"><strong>Challenge’a katıl</strong><p>Tahminlerini kaydetmek ve haftalık sıralamaya girmek için hesabına giriş yap.</p><button type="button" onclick="openAuth(\'login\')">Giriş yap / Üye ol</button></div>':''}</main><aside class="weekly-challenge-missing"><h3>Kaçırma</h3><p>Henüz tahmin yapmadığın yaklaşan maçlar</p><div>${missing.length?missing.map(match=>`<button type="button" onclick="openMatchCenter('${escapeHTML(match.id)}')"><time>${escapeHTML(fmtTime(match.kickoff))}</time><span>${escapeHTML(match.ev)}<b>–</b>${escapeHTML(match.konuk)}</span><i>→</i></button>`).join(''):'<small>Bu haftanın açık tahminlerini tamamladın.</small>'}</div><details><summary>Nasıl puan kazanılır?</summary><p>Doğru sonuç +3, kesin skor +5 puan. Haftanın tüm maçlarına tahmin yaparsan +2 tamamlama bonusu alırsın. Tahminler maçtan 15 dakika önce kapanır.</p></details></aside></div>`;
  panel.innerHTML=panel.innerHTML.replace('<h1>Haftalık Challenge</h1><p>Maçları tahmin et, puan topla ve haftalık ligde yüksel.</p>','<h1>Haftalık Challenge</h1><p>Seçili maçların sonucunu tahmin et, puan topla ve aylık ödül kademende ilerle.</p>').replace('ÜCRETSİZ · BAHİS YOK','ÜCRETSİZ');
  if(stats?.toplamMac===6&&stats.sonuclananTahminSayisi===6&&stats.sonucSayisi===6) panel.classList.add('is-perfect'); else panel.classList.remove('is-perfect');
  updateWeeklyChallengeCountdown();
  if(!weeklyChallengeTimer) weeklyChallengeTimer=setInterval(updateWeeklyChallengeCountdown,60000);
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
function setTab(t){ activeTab = t; renderLeaderTabs(); if(typeof loadVisibleLeaderboards==='function') loadVisibleLeaderboards(); }
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
        ${(REWARDS[t]||[]).map((r,i) => rewardCardHTML(t, r, i===0)).join('')}
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
      ${[1,2,3].map(s => `<input style="margin-bottom:5px;" data-team="${t}" data-sira="${s}" class="rewardInput" value="${escapeHTML(REWARDS[t]?.[s-1]?.aciklama||'—')}" placeholder="${s}. sıra ödülü">`).join('')}
    </div>`).join('') + `<button class="btn" id="saveRewardsBtn">Ödülleri Kaydet</button><div class="status-msg" id="rewardStatus"></div>`;
  document.getElementById('saveRewardsBtn').onclick = async () => {
    const inputs = adminPanel.querySelectorAll('.rewardInput'); const newRewards = JSON.parse(JSON.stringify(REWARDS));
    inputs.forEach(inp => { const t = inp.dataset.team, s = parseInt(inp.dataset.sira); newRewards[t][s-1].aciklama = inp.value; });
    const ok = await saveRewardsData(newRewards);
    if(ok){ REWARDS=newRewards; renderRewards(); }
    const st = document.getElementById('rewardStatus'); if(st){ st.textContent=ok?'Kaydedildi.':'Kaydedilemedi; yetkini ve bağlantını kontrol et.'; st.classList.add('show'); }
  };
}
const adminRewardToggle=document.getElementById('adminRewardToggle');
if(adminRewardToggle) adminRewardToggle.onclick = () => document.getElementById('adminRewardPanel')?.classList.toggle('show');

function monthlyRewardProgress(uid, now=new Date()){
  const month=now.toISOString().slice(0,7), challenge=[...PREDICT_CHALLENGE_MATCHES,...MATCHES];
  const ids=[...new Set(challenge.filter(match=>String(match.kickoff||'').slice(0,7)===month).map(match=>match.id))];
  let points=0,correct=0,exact=0,settled=0,picks=0;
  ids.forEach(id=>{ const pred=ALL_PREDICTIONS[id]?.[uid], result=ALL_RESULTS[id]; if(pred)picks++; if(pred&&result){settled++; const score=computeMatchPoints(pred,result); points+=score.toplam; if(score.sonuc)correct++; if(score.kesinSkor)exact++;} });
  const tier=[...PREDICT_REWARD_TIERS].reverse().find(item=>points>=item.min)||PREDICT_REWARD_TIERS[0], next=PREDICT_REWARD_TIERS[PREDICT_REWARD_TIERS.indexOf(tier)+1]||null;
  return {month,points,correct,exact,settled,picks,tier,next,remaining:next?Math.max(0,next.min-points):0,accuracy:settled?Math.round(correct/settled*100):0};
}
function rewardProgressHTML(progress,variant='profile'){
  const pct=progress.next?Math.max(4,Math.min(100,((progress.points-progress.tier.min)/(progress.next.min-progress.tier.min))*100)):100;
  return `<section class="predict-reward-progress ${escapeHTML(variant)}"><div class="predict-reward-copy"><span>AYLIK ÖDÜL KADEMESİ</span><h3>${escapeHTML(progress.tier.name)} · ${progress.points} puan</h3><p>${escapeHTML(progress.tier.reward)} <small>${escapeHTML(progress.tier.budget)}</small></p></div>${progress.tier.image?`<img src="${escapeHTML(progress.tier.image)}" alt="${escapeHTML(progress.tier.reward)}" loading="lazy">`:''}<div class="predict-reward-meter"><i><span style="width:${pct}%"></span></i><b>${progress.next?`${progress.remaining} puan sonra ${escapeHTML(progress.next.name)}`:'En yüksek kademe'}</b></div><div class="predict-reward-stats"><span><b>%${progress.accuracy}</b> aylık doğruluk</span><span><b>${progress.correct}</b> doğru sonuç</span><span><b>${progress.exact}</b> kesin skor</span></div><small class="predict-reward-rule">Kademe ödül havuzuna katılım hakkıdır; fiziksel ürün sayısı aylık stok ve sponsor bütçesiyle sınırlıdır.</small></section>`;
}

/* ===================== PROFİL ===================== */
function renderProfile(){
  const u = getCurrentUser(); const panel = document.getElementById('profilePanel');
  if(!u || !u.id){ panel.style.display='none'; return; }
  const life = lifetimeStats(u.id); const weekS = userStatsForWeek(u.id, activeWeek);
  const teamRows = sortRows(leaderboardFor(u.team, activeWeek), 'season');
  const teamRank = teamRows.findIndex(r=>r.uid===u.id)+1;
  const genRows = sortRows(leaderboardFor('Genel', activeWeek), 'season');
  const genRank = genRows.findIndex(r=>r.uid===u.id)+1;
  const badges = computeBadges(u.id); const level = levelFor(life.toplam); const rewardProgress=monthlyRewardProgress(u.id);
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
    ${rewardProgressHTML(rewardProgress,'profile')}
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
    btn.onclick = async () => { const newTeam = teamSelect.value; if(await changeTeam(newTeam)){ await refreshAccountContext(); refreshVisibleAccountViews(); } };
  }
}

/* ===================== ADMIN: SONUÇ GİR ===================== */
const adminToggle=document.getElementById('adminToggle');
if(adminToggle) adminToggle.onclick = () => document.getElementById('adminPanel')?.classList.toggle('show');
const adminSaveBtn=document.getElementById('adminSaveBtn');
if(adminSaveBtn) adminSaveBtn.onclick = async () => {
  // Defense-in-depth: gerçek yetki kontrolü sunucu tarafında (RLS) yapılıyor,
  // bu sadece admin olmayan bir kullanıcı panele client tarafından erişirse
  // gereksiz bir Supabase çağrısı yapılmasını ve yanıltıcı hata mesajını önler.
  const currentUser = getCurrentUser();
  const statusElEarly = document.getElementById('adminStatus');
  if(!currentUser?.is_admin){ if(statusElEarly){ statusElEarly.textContent='Bu işlem için yetkin yok.'; statusElEarly.classList.add('show'); } return; }
  const matchId = document.getElementById('adminMatchSelect').value;
  const homeRaw = document.getElementById('adminHome').value; const awayRaw = document.getElementById('adminAway').value;
  const home = Number(homeRaw); const away = Number(awayRaw);
  const statusEl = document.getElementById('adminStatus');
  if(homeRaw==='' || awayRaw==='' || !Number.isInteger(home) || !Number.isInteger(away) || home<0 || away<0 || home>99 || away>99){ statusEl.textContent='0 ile 99 arasında geçerli skor gir.'; statusEl.classList.add('show'); return; }
  const ok = await setResult(matchId, home, away);
  if(ok){ ALL_RESULTS[matchId]={home,away,scoredAt:Date.now()}; renderAll(); }
  const nextStatusEl = document.getElementById('adminStatus');
  nextStatusEl.textContent = ok ? 'Sonuç kaydedildi, puanlar yeniden hesaplandı.' : 'Kaydedilemedi (yetkin yok olabilir).';
  nextStatusEl.classList.add('show');
};

/* ===================== MASTER RENDER ===================== */
/* Tek satirlik skeleton uretici; her modul kendi kart olcusunde iskelet gosterir
   boylece ilk boyamada hicbir alan "bombos kutu" olarak gorunmez. */
function skeletonRowsHTML(count,extraClass){
  return Array.from({length:Math.max(1,count)},()=>`<div class="skeleton skeleton-row ${extraClass||''}"></div>`).join('');
}
function skeletonCardsHTML(count,extraClass){
  return Array.from({length:Math.max(1,count)},()=>`<div class="skeleton skeleton-card ${extraClass||''}"></div>`).join('');
}
function fillSkeleton(id,html){
  const node=document.getElementById(id);
  if(!node || node.dataset.filled==='1') return;
  node.innerHTML=html;
}
function renderSkeletons(){
  const hero=document.getElementById('storyFeaturedArea'); if(hero) hero.innerHTML=`<div class="skeleton skeleton-hero"></div>`;
  fillSkeleton('storyMatchList',skeletonRowsHTML(3));
  fillSkeleton('leagueMatchList',skeletonRowsHTML(2));
  // Onceden iskeletsiz kalan ve bu yuzden bos kutu gibi gorunen moduller:
  fillSkeleton('footballQuickMatches',skeletonRowsHTML(3));
  fillSkeleton('footballFeaturedDevelopment',`<div class="skeleton skeleton-hero"></div>`);
  fillSkeleton('footballNewsStream',skeletonRowsHTML(3));
  fillSkeleton('footballStandingsCompact',skeletonRowsHTML(4));
  fillSkeleton('footballTransferStream',skeletonRowsHTML(3));
  fillSkeleton('clubSocialStage',skeletonCardsHTML(3,'club-social-skeleton'));
  fillSkeleton('youtubeMediaGrid',skeletonCardsHTML(3,'youtube-skeleton-card'));
  fillSkeleton('instagramFeedGrid',skeletonCardsHTML(3,'instagram-skeleton-card'));
  fillSkeleton('editorialLeadNews',skeletonRowsHTML(2));
  fillSkeleton('footballNewsFullStream',skeletonRowsHTML(4));
  fillSkeleton('standingsBody',skeletonRowsHTML(5));
  fillSkeleton('asideStandings',skeletonRowsHTML(4));
  fillSkeleton('historicStandingsTable',skeletonRowsHTML(6));
  fillSkeleton('leaderBody',skeletonRowsHTML(4));
}
function showLoadError(message){
  const box = `<div class="load-error"><p>${message || 'Veriler şu anda alınamıyor.'}</p><button class="btn gold" onclick="boot()">Tekrar dene</button></div>`;
  const featured=document.getElementById('storyFeaturedArea'); if(featured) featured.innerHTML = box;
  const matchList=document.getElementById('storyMatchList'); if(matchList) matchList.innerHTML = '';
  const navRight=document.getElementById('navRight'); if(navRight) navRight.innerHTML = `<button class="btn ghost" onclick="boot()">Tekrar dene</button>`;
  renderTicker();
}
function renderAll(){
  applyFootballLeagueTheme();
  const storyHome=document.getElementById('page-story').classList.contains('active')&&activeFootballSection==='home';
  const earlyCanonicalRoot=activeFootballLeague==='all'
    ? document.getElementById('footballScoreboardHome')?.dataset.earlyHydrated==='true'
    : document.getElementById('footballLeagueOverview')?.dataset.earlyLeagueHydrated===activeFootballLeague;
  if(storyHome&&earlyCanonicalRoot){
    // The early football renderer has already supplied the visible, scoped DOM.
    // Keep boot work in separate macrotasks instead of rebuilding navigation,
    // ticker, overview and live bindings in one DOMContentLoaded task.
    renderFootballHome();
    setTimeout(renderNav,0);
    setTimeout(renderTicker,0);
    setTimeout(updateMobileNavActive,0);
    setTimeout(startLiveFeed,0);
    return;
  }
  renderNav(); renderTicker();
  if(storyHome){
    renderFootballHome();
    updateMobileNavActive();
    startLiveFeed();
    return;
  }
  renderStory(); renderTeamBanner(); renderProgress(); renderLeagueMatches();
  renderLeaderTabs(); renderRewards(); renderStandings();
  const u = getCurrentUser();
  if(u && u.id) renderProfile(); else document.getElementById('profilePanel').style.display='none';
  updateMobileNavActive();
  if(document.getElementById('page-story').classList.contains('active')) startLiveFeed();
}
async function boot(){
  const productRoot=(location.pathname.split('/').filter(Boolean)[0]||'').toLowerCase();
  if(['basketbol','voleybol','ufc','motorsports'].includes(productRoot)){
    // Bağımsız branş merkezleri kendi veri katmanını yükler. Burada tüm futbol
    // fikstürü, transferleri ve sosyal akışlarını başlatmak geçişi gereksiz yere
    // birkaç saniye geciktirir ve ağ bağlantılarını tüketir.
    renderNav();
    return;
  }
  document.getElementById('navRight').innerHTML = `<span class="mono" style="font-size:14px;color:var(--ink-dim);">Yükleniyor…</span>`;
  const initialParsed = typeof parseAppLocation==='function' ? parseAppLocation() : parseHash();
  const explicitFixture=Boolean(new URLSearchParams(location.search).get('fixture'));
  const predictOnlyBoot=productRoot==='predict';
  if(!(initialParsed && initialParsed.type==='football-route' && initialParsed.league==='all')) renderSkeletons();
  lastLoadError = null;
  try{
    const parsed = initialParsed;
    if(parsed && parsed.type==='football-route'){
      activeFootballLeague = parsed.league || 'super-lig';
      activeFootballSection = parsed.section || 'home';
    }
    const matchOnlyBoot=explicitFixture||parsed?.type==='match';
    const fastFootballBoot=Boolean(!explicitFixture&&parsed&&parsed.type==='football-route');
    if(matchOnlyBoot||predictOnlyBoot){
      // Matchday ve Predict kendi gorunen, dar veri akislarinin sahibidir;
      // arkadaki football home/common zinciri bu rotalarda baslatilmaz.
    }
    else if(fastFootballBoot && typeof loadFootballCriticalData==='function') await loadFootballCriticalData();
    else await loadAllData();
    lastLoadError = null;
    const weeks = getAvailableWeeks();
    if(weeks.length){
      if(parsed && parsed.type==='week' && weeks.includes(parsed.value)) activeWeek = parsed.value;
      else activeWeek = weeks[0];
    }
    renderAll();
    if(parsed && parsed.type==='match'){ openMatchCenter(parsed.value, false); }
    else if(parsed && parsed.type==='football-route'){
      switchMainTab('football',false);
      if(parsed.section==='transfers') setTransferCenterTab(parsed.transferTab||'confirmed',null,false);
      if((parsed.section||'home')!=='home') openFootballSection(parsed.section,null,false);
      if(parsed.section==='clubs' && parsed.clubSlug) openClubProfileBySlug(parsed.clubSlug,false);
    }
    else if(parsed && parsed.type==='football-section'){ switchMainTab('football',false); if(parsed.value==='transfers') setTransferCenterTab(parsed.sub||'confirmed',null,false); openFootballSection(parsed.value,null,false); }
    else if(parsed && parsed.type==='product'){ switchMainTab(parsed.value, false); if(parsed.value==='predict') switchLeagueSection(parsed.section||'predict',false); }
    if(fastFootballBoot||matchOnlyBoot||predictOnlyBoot){
      // Ilk futbol boyamasindan sonra yalniz navigasyon icin gereken oturum ve
      // kullanicinin kendi profili hydrate edilir. Predict, odul ve ortak
      // tablolar kendi gorunumleri acilmadan sorgulanmaz.
      Promise.resolve().then(()=>loadAccountContext()).catch(error=>console.warn('[XYZSkor hesap baglami]',error));
    }
  }catch(e){
    console.error('[XYZSkor] boot() veri yükleme başarısız:', e);
    lastLoadError = e;
    showLoadError('Veriler şu anda alınamıyor. (' + e.message + ')');
  }
}

/* ===================== X FEED + AGENDA OVERRIDES ===================== */
function normalizeLoose(value){
  return String(value||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function xPostMediaHTML(club,post,targetURL){
  const media=(Array.isArray(post?.media)?post.media:[]).map(item=>({item,url:xMediaPreviewURL(item)})).filter(entry=>entry.url).slice(0,4);
  if(!media.length) return '';
  const countClass=`items-${media.length}`;
  return `<div class="club-social-media ${countClass}" aria-label="${escapeHTML(club.team)} paylaşım medyası">${media.map(({item,url})=>{
    const label=item.alt_text||`${club.team} resmî paylaşım görseli`;
    const kind=item.type==='video'?'Video':item.type==='animated_gif'?'GIF':'';
    const fitClass=Number(item?.height||0) > Number(item?.width||0) * 1.18 ? 'is-portrait' : Number(item?.width||0) > Number(item?.height||0) * 1.75 ? 'is-wide' : 'is-balanced';
    return `<a class="club-social-media-item ${fitClass}" href="${escapeHTML(targetURL)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(label)}"><img src="${escapeHTML(url)}" alt="${escapeHTML(label)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${kind?`<span class="club-social-media-kind"><b aria-hidden="true">${item.type==='video'?'▶':'GIF'}</b>${escapeHTML(kind)}</span>`:''}</a>`;
  }).join('')}</div>`;
}
function xEmptyFeedHTML(accounts,label,status){
  const unique=[...new Map((accounts||[]).filter(item=>item?.handle).map(item=>[String(item.handle).toLocaleLowerCase('tr-TR'),item])).values()].slice(0,6);
  const limited=/credit|402|payment/i.test(String(status||''));
  const paused=String(status||'')==='paused';
  const title=limited?'X veri kotası yenileniyor':paused?'Sosyal akış günlük kontrolde':'Yeni kulüp paylaşımı bulunamadı';
  const copy=limited?'Son doğrulanmış gönderiler korunuyor; kota yenilendiğinde akış otomatik güncellenecek.':paused?'Resmî hesaplar günde bir kez kontrol ediliyor. Yeni içerik geldiğinde bu alan kendiliğinden açılır.':`${label} kulüplerinin bağlı resmî hesaplarında yayımlanabilir yeni gönderi yok.`;
  const links=unique.map(account=>`<a href="${escapeHTML(account.url||`https://x.com/${account.handle}`)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(account.team)} hesabını X'te aç"><span>${crestHTML(account.team,'xs')}</span><b>${escapeHTML(account.team)}</b><small>@${escapeHTML(account.handle)}</small><i aria-hidden="true">↗</i></a>`).join('');
  return `<section class="club-social-empty" aria-label="${escapeHTML(label)} sosyal akış durumu"><div class="club-social-empty-mark" aria-hidden="true">𝕏</div><div class="club-social-empty-copy"><span>RESMÎ HESAPLAR</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(copy)}</p></div>${links?`<nav class="club-social-empty-accounts" aria-label="Bağlı resmî hesaplar">${links}</nav>`:''}</section>`;
}
function xPostCardHTML(club){
  const post=club.post||null;
  const cleanPostText=String(post?.text||'').replace(/https:\/\/t\.co\/\S+/gi,'').replace(/\s{2,}/g,' ').trim();
  const metrics=post&&post.metrics?post.metrics:{};
  const targetURL=post?.url||club.url;
  const mediaBody=xPostMediaHTML(club,post,targetURL);
  const translated=post?.translated_text_tr && normalizeLoose(post.translated_text_tr)!==normalizeLoose(post.text) ? `<div class="club-social-translation"><span>TR</span><p>${escapeHTML(post.translated_text_tr)}</p></div>` : '';
  const postBody=post?`<p class="club-social-copy">${escapeHTML(cleanPostText)}</p>${translated}${mediaBody}
    <div class="club-social-meta" aria-label="Paylaşım etkileşimleri">
      <span aria-label="${escapeHTML(xMetric(metrics.reply_count))} yanıt"><i aria-hidden="true">◌</i>${escapeHTML(xMetric(metrics.reply_count))}</span>
      <span aria-label="${escapeHTML(xMetric(metrics.retweet_count))} yeniden paylaşım"><i aria-hidden="true">↻</i>${escapeHTML(xMetric(metrics.retweet_count))}</span>
      <span aria-label="${escapeHTML(xMetric(metrics.like_count))} beğeni"><i aria-hidden="true">♡</i>${escapeHTML(xMetric(metrics.like_count))}</span>
      <span aria-label="${escapeHTML(xMetric(metrics.impression_count))} görüntülenme"><i aria-hidden="true">◒</i>${escapeHTML(xMetric(metrics.impression_count))}</span>
    </div>`:club.account_found===false?`<div class="club-social-pending"><strong>Resmî sosyal hesap doğrulanıyor</strong><span>Hesap kataloğu güncellenirken bu kulüp için akış bağlantısı hazırlanıyor.</span></div>`:`<div class="club-social-pending"><strong>Henüz yeni paylaşım yok</strong><span>Resmî hesap bağlı; yeni gönderi geldiğinde burada yayınlanır.</span></div>`;
  const verifiedMark=club.verified===false?'':`<span class="club-social-verified" aria-label="Doğrulanmış hesap">✓</span>`;
  const accountLabel=club.publisher?'Editoryal kaynak':competitionShortBySlug(activeFootballLeague);
  return `<article class="club-social-card ${club.publisher?'publisher-card ':''}${mediaBody?'has-media':''}">
    <header class="club-social-card-head"><span class="club-social-avatar">${crestHTML(club.team,'xs')}</span><div class="club-social-identity"><span class="club-social-team-line"><strong>${escapeHTML(club.team)}</strong>${verifiedMark}</span><small>${accountLabel}${accountLabel?' · ':''}@${escapeHTML(club.handle)}</small></div><span class="club-social-platform-mark" aria-label="X platformu" aria-hidden="true">𝕏</span></header>
    <div class="club-social-post">${postBody}<footer class="club-social-card-foot"><time datetime="${escapeHTML(post?.created_at||'')}">${post?escapeHTML(xPostDate(post.created_at)):'Günlük yenilenir'}</time><a class="club-social-profile-link" href="${escapeHTML(targetURL)}" target="_blank" rel="noopener noreferrer">${post?'Gönderiyi görüntüle':'Hesabı aç'} <span aria-hidden="true">↗</span></a></footer></div>
  </article>`;
}
function preseasonCardHTML(club){
  const post=club.preseason_post||null;
  const cleanPostText=String(post?.text||'').replace(/https:\/\/t\.co\/\S+/gi,'').replace(/\s{2,}/g,' ').trim();
  const targetURL=post?.url||club.url;
  const mediaBody=post?xPostMediaHTML(club,post,targetURL):'';
  const verifiedMark=club.verified===false?'':`<span class="club-social-verified" aria-label="Doğrulanmış hesap">✓</span>`;
  const translated=post?.translated_text_tr && normalizeLoose(post.translated_text_tr)!==normalizeLoose(post.text) ? `<div class="club-social-translation preseason-social-translation"><span>TR</span><p>${escapeHTML(post.translated_text_tr)}</p></div>` : '';
  const body=post?`<div class="preseason-social-topline"><span class="preseason-social-label">HAZIRLIK</span>${post.scoreline?`<strong class="preseason-social-score">${escapeHTML(post.scoreline)}</strong>`:''}</div><p class="club-social-copy preseason-social-copy">${escapeHTML(cleanPostText)}</p>${translated}${mediaBody}
    <div class="club-social-meta preseason-social-meta" aria-label="Paylaşım etkileşimleri">
      <span aria-label="${escapeHTML(xMetric(post.metrics?.reply_count))} yanıt"><i aria-hidden="true">◌</i>${escapeHTML(xMetric(post.metrics?.reply_count))}</span>
      <span aria-label="${escapeHTML(xMetric(post.metrics?.retweet_count))} yeniden paylaşım"><i aria-hidden="true">↻</i>${escapeHTML(xMetric(post.metrics?.retweet_count))}</span>
      <span aria-label="${escapeHTML(xMetric(post.metrics?.like_count))} beğeni"><i aria-hidden="true">♡</i>${escapeHTML(xMetric(post.metrics?.like_count))}</span>
      <span aria-label="${escapeHTML(xMetric(post.metrics?.impression_count))} görüntülenme"><i aria-hidden="true">◔</i>${escapeHTML(xMetric(post.metrics?.impression_count))}</span>
    </div>`:`<div class="club-social-pending preseason-social-pending"><strong>Hazırlık maçı paylaşımı bulunamadı</strong><span>Resmî hesapta son kamp veya hazırlık maçı gönderisi düştüğünde burada görünür.</span></div>`;
  return `<article class="club-social-card preseason-social-card ${mediaBody?'has-media':''}">
    <header class="club-social-card-head"><span class="club-social-avatar">${crestHTML(club.team,'xs')}</span><div class="club-social-identity"><span class="club-social-team-line"><strong>${escapeHTML(club.team)}</strong>${verifiedMark}</span><small>${escapeHTML(competitionShortBySlug(activeFootballLeague))} · @${escapeHTML(club.handle)}</small></div><span class="club-social-platform-mark" aria-hidden="true">◎</span></header>
    <div class="club-social-post preseason-social-post">${body}<footer class="club-social-card-foot"><time datetime="${escapeHTML(post?.created_at||'')}">${post?escapeHTML(xPostDate(post.created_at)):'Günlük taranır'}</time><a class="club-social-profile-link" href="${escapeHTML(targetURL)}" target="_blank" rel="noopener noreferrer">${post?'Gönderiyi görüntüle':'Hesabı aç'} <span aria-hidden="true">↗</span></a></footer></div>
  </article>`;
}
function renderFootballNews(){
  const area=document.getElementById('footballNewsStream'); if(!area) return;
  EDITORIAL_NEWS_CACHE=contextualEditorialEntries();
  if(DATA_ERRORS.weekly_stories && !EDITORIAL_NEWS_CACHE.length){ area.innerHTML=footballEmpty('Gelişmeler alınamadı','Bu modüldeki hata maç listesi ve puan durumundan bağımsızdır.'); return; }
  if(!EDITORIAL_NEWS_CACHE.length){
    const label=competitionLabelBySlug(activeFootballLeague);
    area.innerHTML=footballEmpty(`${label} gündemi hazırlanıyor`,'Bu lig için doğrulanmış haber, fikstür ve transfer kayıtları burada akacak.');
    return;
  }
  area.innerHTML=`<div class="football-news-list">${EDITORIAL_NEWS_CACHE.slice(0,5).map((item,index)=>footballNewsCardHTML(item,index)).join('')}</div>`;
  area.querySelectorAll('[data-editorial-index]').forEach(article=>{ article.onclick=event=>{ if(!event.target.closest('[data-news-match]')) openEditorialEntry(Number(article.dataset.editorialIndex)); }; article.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){event.preventDefault();openEditorialEntry(Number(article.dataset.editorialIndex));} }; });
  area.querySelectorAll('[data-news-match]').forEach(button=>{ button.onclick=()=>openMatchCenter(button.dataset.newsMatch); });
}
