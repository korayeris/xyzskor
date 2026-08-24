(() => {
  const leagueProviderHealth = (leagueKey=activeFootballLeague) => {
    const standings = standingRowsForActiveLeague();
    const matches = matchesForActiveLeague();
    const transferState = leagueTransferCache.get(leagueKey);
    const transferCount = (transferState?.confirmed?.length || 0) + (transferState?.rumours?.length || 0);
    return {
      hasMatches: matches.length > 0,
      hasStandings: standings.length > 0,
      hasTransfers: transferCount > 0,
      transferErrors: Array.isArray(transferState?.errors) ? transferState.errors : []
    };
  };
  const leagueProviderUnavailable = (leagueKey=activeFootballLeague) => {
    if(footballCoverageUnavailable(leagueKey)) return true;
    if(leagueKey==='super-lig' || leagueKey==='all') return false;
    const state = leagueProviderHealth(leagueKey);
    return !state.hasMatches && !state.hasStandings;
  };
  const providerUnavailableMessage = (leagueKey=activeFootballLeague) => {
    if(footballCoverageUnavailable(leagueKey)) return footballCoverageMessage(leagueKey);
    const label = competitionLabelBySlug(leagueKey);
    const transferState = leagueTransferCache.get(leagueKey);
    const specificError = (transferState?.errors || []).find(item => item?.message)?.message || '';
    if(/403|restricted|access/i.test(String(specificError))) return `${label} için mevcut plan tüm veri uçlarını açmıyor.`;
    return `${label} için doğrulanmış sezon verisi şu anda dönmüyor.`;
  };

  leagueEditorialBaseEntries = function(){
    const league=activeFootballLeague;
    if(leagueProviderUnavailable(league)) return [];
    const label=competitionLabelBySlug(league);
    const summary=officialSeasonSummaryForLeague(league);
    const standings=standingRowsForActiveLeague().slice(0,5);
    const upcoming=matchesForActiveLeague().filter(match=>matchInActiveTeam(match)&&matchIsCurrentFixture(match)).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff)).slice(0,3);
    const transfers=leagueTransferRecords('confirmed').slice(0,4);
    const rumours=leagueTransferRecords('rumours').slice(0,3);
    const entries=[];
    if(summary) entries.push({ kind:'summary', title:`${label} ${summary.season} sezon özeti`, text:`Şampiyon ${summary.champion}. ${summary.standoutLabel}: ${summary.standout}.`, source:summary.championNote||'Resmî sezon kaydı', label:'Sezon özeti', time:'', image:null, imageType:'none', sourceUrl:summary.sourceLinks?.[0]?.url || null, routeTarget:'standings' });
    if(standings.length){
      const first=standings[0];
      const second=standings[1];
      entries.push({ kind:'standing', title:`${label} zirvesi`, text:second ? `${first.team} ${first.points} puanla önde. Takipçisi ${second.team} ${second.points} puanda.` : `${first.team} son tabloda ${first.points} puanla lider.`, source:'Lig tablosu', label:'Tablo', time:'', image:null, imageType:'none', routeTarget:'standings' });
    }
    upcoming.forEach((match,index)=>entries.push({ kind:'fixture', title:index===0?`${label} sıradaki maç`:`${match.ev} – ${match.konuk}`, text:`${match.ev} ile ${match.konuk} ${fmtKickoff(match.kickoff)} saatinde karşılaşıyor.`, source:match.competition||label, label:index===0?'Maç takvimi':'Fikstür', time:match.kickoff||'', image:null, imageType:'none', matchId:match.id, routeTarget:'matches' }));
    transfers.forEach(item=>entries.push({ kind:'transfer', title:`${item.name}: ${item.from} → ${item.to}`, text:`${item.fee} · ${item.status||'Resmî işlem'}`, source:item.source||`${label} transfer kaydı`, label:'Transfer', time:'', image:TRANSFER_PLAYER_PHOTOS[item.name]||null, imageType:(TRANSFER_PLAYER_PHOTOS[item.name]?'portrait':'none'), sourceUrl:item.sourceUrl||null, routeTarget:'transfers' }));
    rumours.forEach(item=>entries.push({ kind:'rumour', title:`${item.name} için ${item.to} hattı`, text:item.detail||`${item.status||'Söylenti'} · ${item.fee||'Bedel açıklanmadı'}`, source:item.source||`${label} söylenti hattı`, label:'Söylenti', time:'', image:TRANSFER_PLAYER_PHOTOS[item.name]||null, imageType:(TRANSFER_PLAYER_PHOTOS[item.name]?'portrait':'none'), sourceUrl:item.sourceUrl||null, routeTarget:'transfers' }));
    return entries;
  };

  const featuredMatchPredictionCache=new Map();
  function featuredFixtureId(match){
    return String(match?.provider_fixture_id||match?.fixture_id||match?.provider_id||match?.id||'').replace(/^sportmonks:/,'');
  }
  function featuredPredictionValue(value){
    const number=Number(value);
    return Number.isFinite(number)?Math.max(0,Math.min(100,number)):null;
  }
  async function loadFeaturedMatchPrediction(match,league){
    const fixtureId=featuredFixtureId(match);
    if(!fixtureId || featuredMatchPredictionCache.has(fixtureId)) return;
    featuredMatchPredictionCache.set(fixtureId,{loading:true,result:null});
    try{
      const response=await fetch(`/api/football/matchday?fixture=${encodeURIComponent(fixtureId)}`,{headers:{Accept:'application/json'}});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      const row=(payload?.details?.predictions||[]).find(item=>Number(item?.type_id)===237);
      const raw=row?.predictions||{};
      const result={home:featuredPredictionValue(raw.home),draw:featuredPredictionValue(raw.draw),away:featuredPredictionValue(raw.away)};
      featuredMatchPredictionCache.set(fixtureId,{loading:false,result:Object.values(result).some(value=>value!==null)?result:null});
    }catch(_error){
      featuredMatchPredictionCache.set(fixtureId,{loading:false,result:null,error:true});
    }
    if(activeFootballLeague===league) renderFootballFeatured();
  }
  function featuredProbabilityHTML(label,name,value){
    const percentage=value===null?'—':`${Math.round(value)}%`;
    const width=value===null?0:value;
    return `<div class="featured-match-probability"><span><b>${escapeHTML(label)}</b>${escapeHTML(name)}</span><strong>${escapeHTML(percentage)}</strong><i><em style="width:${width}%"></em></i></div>`;
  }

  renderFootballFeatured = function(){
    const area=document.getElementById('footballFeaturedDevelopment'); if(!area) return;
    const league=activeFootballLeague;
    const label=competitionLabelBySlug(league);
    if(leagueProviderUnavailable(league)){
      area.innerHTML=footballEmpty(`${label} maçı bekleniyor`,providerUnavailableMessage(league));
      return;
    }
    const match=homeFeaturedMatch();
    if(!match){
      area.innerHTML=footballEmpty(`${label} maçı bekleniyor`,'En yakın tarihli doğrulanmış fikstür geldiğinde bu alan otomatik güncellenecek.');
      return;
    }
    const fixtureId=featuredFixtureId(match);
    const cached=featuredMatchPredictionCache.get(fixtureId);
    if(!cached) loadFeaturedMatchPrediction(match,league);
    const odds=cached?.result||{home:null,draw:null,away:null};
    const predictionNote=cached?.loading?'SportMonks olasılıkları yükleniyor':cached?.result?'SportMonks maç sonucu olasılıkları':'Bu maç için olasılık henüz yayınlanmadı';
    area.classList.add('featured-match-stage');
    const state=explicitMatchState(match);
    area.innerHTML=`<div class="featured-match-head"><div><div class="football-module-kicker">${escapeHTML(label)}</div><h2>Günün öne çıkan maçı</h2></div><div class="featured-match-when"><span>${escapeHTML(fmtEditorialDate(match.kickoff))}</span><time>${escapeHTML(fmtTime(match.kickoff))}</time></div></div><button class="featured-match-faceoff" type="button" onclick="openMatchCenter('${escapeHTML(match.id)}')" aria-label="${escapeHTML(match.ev)} ${escapeHTML(match.konuk)} maç merkezini aç"><span>${crestHTML(match.ev,'md')}<b>${escapeHTML(match.ev)}</b></span><i><small>${escapeHTML(state.label)}</small><strong>VS</strong></i><span>${crestHTML(match.konuk,'md')}<b>${escapeHTML(match.konuk)}</b></span></button><div class="featured-match-odds"><header><b>1-X-2 olasılıkları</b><span>${escapeHTML(predictionNote)}</span></header><div class="featured-match-probabilities">${featuredProbabilityHTML('1',match.ev,odds.home)}${featuredProbabilityHTML('X','Beraberlik',odds.draw)}${featuredProbabilityHTML('2',match.konuk,odds.away)}</div></div><div class="week-one-footer"><span>Bahis değildir · bilgilendirme amaçlıdır</span><button type="button" onclick="openMatchCenter('${escapeHTML(match.id)}')">Maç merkezini aç →</button></div>`;
  };

  renderFootballNews = function(){
    const area=document.getElementById('footballNewsStream'); if(!area) return;
    if(leagueProviderUnavailable(activeFootballLeague)){
      area.innerHTML=footballEmpty(`${competitionLabelBySlug(activeFootballLeague)} gündemi hazırlanıyor`, providerUnavailableMessage(activeFootballLeague));
      return;
    }
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
  };

  function editorialHighlightVisualHTML(item){
    if(item.image) return `<span class="editorial-highlight-image ${item.imageType==='portrait'?'portrait':'photo'}"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.editorial-highlight-image').remove()"></span>`;
    const match=item.matchId?MATCHES.find(entry=>entry.id===item.matchId):null;
    if(match) return `<span class="editorial-highlight-image fixture-crests" aria-label="${escapeHTML(match.ev)} ve ${escapeHTML(match.konuk)} armaları">${crestHTML(match.ev,'xs')}${crestHTML(match.konuk,'xs')}</span>`;
    return `<span class="editorial-highlight-mark editorial-data-mark"><b>${escapeHTML(String(item.label||'VERİ').slice(0,2).toLocaleUpperCase('tr-TR'))}</b></span>`;
  }

  renderEditorialNews = function(){
    const lead=document.getElementById('editorialLeadNews'); const list=document.getElementById('editorialHighlights'); if(!lead||!list) return;
    if(leagueProviderUnavailable(activeFootballLeague)){
      lead.innerHTML=footballEmpty(`${competitionLabelBySlug(activeFootballLeague)} yayın akışı hazırlanıyor`, providerUnavailableMessage(activeFootballLeague));
      list.innerHTML='';
      return;
    }
    const featured=homeFeaturedMatch();
    const seen=new Set();
    const editorialEntries=contextualEditorialEntries().filter(item=>{
      if(featured && item.matchId===featured.id) return false;
      const key=item.matchId?`match:${item.matchId}`:`title:${String(item.title||'').trim().toLocaleLowerCase('tr-TR')}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const visualLead=editorialEntries.find(item=>item.image||item.matchId);
    EDITORIAL_NEWS_CACHE=visualLead?[visualLead,...editorialEntries.filter(item=>item!==visualLead)]:editorialEntries;
    const primary=EDITORIAL_NEWS_CACHE[0];
    if(!primary){ lead.innerHTML=footballEmpty('Yayın masası hazırlanıyor','Kaynağı doğrulanmış ilk içerik yayınlandığında burada görünür.'); list.innerHTML=''; return; }
    const matchVisual=editorialMatchVisualHTML(primary);
    const leadMedia=primary.image?`<span class="editorial-portrait-shell"><img src="${escapeHTML(primary.image)}" alt="${escapeHTML(primary.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('.editorial-portrait-shell').remove()"></span>`:matchVisual||'<div class="editorial-media-fallback"><span>●</span><small>Kaynaklı yayın</small></div>';
    const leadMediaType=primary.imageType==='portrait'?'portrait':matchVisual?'match':'photo';
    lead.innerHTML=`<article class="editorial-lead-card" tabindex="0" role="button" data-editorial-index="0" aria-label="${escapeHTML(primary.title)} haberini aç"><div class="editorial-lead-media ${leadMediaType}">${leadMedia}</div><div class="editorial-lead-copy"><span class="editorial-news-label">${escapeHTML(primary.label)}</span><h3>${escapeHTML(primary.title)}</h3><p>${escapeHTML(primary.text)}</p><footer><strong>${escapeHTML(primary.source)}</strong>${primary.time?`<time>${escapeHTML(fmtEditorialDate(primary.time))}</time>`:''}</footer></div></article>`;
    list.innerHTML=`<div class="editorial-highlights-title">Öne çıkanlar</div>${EDITORIAL_NEWS_CACHE.slice(1,6).map((item,index)=>`<article class="editorial-highlight-row" tabindex="0" role="button" data-editorial-index="${index+1}" aria-label="${escapeHTML(item.title)} haberini aç"><span class="editorial-highlight-rank">${index+1}</span><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.source)}${item.time?` · ${escapeHTML(fmtEditorialDate(item.time))}`:''}</p></div>${editorialHighlightVisualHTML(item)}</article>`).join('')}`;
    bindEditorialEntries(lead); bindEditorialEntries(list);
  };

  renderNewsHub = function(){
    const area=document.getElementById('footballNewsFullStream'); const sidebar=document.getElementById('footballNewsHubSidebar'); if(!area||!sidebar) return;
    if(leagueProviderUnavailable(activeFootballLeague)){
      area.innerHTML=footballEmpty(`${competitionLabelBySlug(activeFootballLeague)} haber merkezi hazırlanıyor`, providerUnavailableMessage(activeFootballLeague));
      sidebar.innerHTML='';
      return;
    }
    EDITORIAL_NEWS_CACHE=contextualEditorialEntries();
    if(DATA_ERRORS.weekly_stories&&!EDITORIAL_NEWS_CACHE.length){ area.innerHTML=footballEmpty('Gündem alınamadı','Kaynaklı içerik akışı şu anda kullanılamıyor.'); sidebar.innerHTML=''; return; }
    if(!EDITORIAL_NEWS_CACHE.length){ const label=competitionLabelBySlug(activeFootballLeague); area.innerHTML=footballEmpty(`${label} yayın akışı hazırlanıyor`,'Kaynağı doğrulanan ilk kayıt burada tam ayrıntısıyla görünür.'); sidebar.innerHTML=''; return; }
    area.innerHTML=`<div class="news-hub-list">${EDITORIAL_NEWS_CACHE.map((item,index)=>`<article class="news-hub-card" tabindex="0" role="button" data-editorial-index="${index}" aria-label="${escapeHTML(item.title)} haberini aç"><div class="news-hub-card-media ${item.imageType==='portrait'?'portrait':'photo'}">${item.image?`<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:'<span>●</span>'}</div><div class="news-hub-card-copy"><div class="news-hub-card-meta"><span>${escapeHTML(item.label||'Güncel')}</span><b>${escapeHTML(item.source||'Editoryal kayıt')}</b>${item.time?`<time>${escapeHTML(fmtEditorialDate(item.time))}</time>`:''}</div><h3>${escapeHTML(item.title)}</h3>${item.text?`<p>${escapeHTML(item.text)}</p>`:''}<small>Kaydı aç <b aria-hidden="true">→</b></small></div></article>`).join('')}</div>`;
    const sourced=EDITORIAL_NEWS_CACHE.filter(item=>item.source).length; const official=EDITORIAL_NEWS_CACHE.filter(item=>/resm/i.test(item.label||'')).length;
    sidebar.innerHTML=`<section class="news-hub-count"><span>YAYIN MASASI</span><strong>${escapeHTML(EDITORIAL_NEWS_CACHE.length)}</strong><p>güncel kayıt</p><dl><div><dt>Kaynaklı</dt><dd>${escapeHTML(sourced)}</dd></div><div><dt>Resmî</dt><dd>${escapeHTML(official)}</dd></div></dl></section><section class="news-standard-card"><span>GÜVEN STANDARDI</span><ul><li><b>Resmî</b><small>Kulüp veya kurum açıklaması</small></li><li><b>Güçlü iddia</b><small>Birden fazla güvenilir kayıt</small></li><li><b>Söylenti</b><small>Kesinleşmemiş, açıkça etiketli</small></li><li><b>Veri analizi</b><small>Yayınlanmış futbol verisinden hesaplama</small></li></ul></section><button type="button" onclick="openFootballSection('home')">Anasayfa özetine dön <span aria-hidden="true">→</span></button>`;
    bindEditorialEntries(area);
  };

  renderFootballTransfers = function(){
    const area=document.getElementById('footballTransferStream'); if(!area) return;
    const isHeadline=item=>item && !['transfer','rumour','transfer_development','fixture','standing','summary'].includes(String(item.kind||item.category||item.type||'').toLocaleLowerCase('tr-TR')) && !/salah/i.test(`${item.title||''} ${item.text||''}`);
    const apiEntries=editorialNewsEntries().filter(isHeadline);
    const primary=apiEntries[0] || contextualEditorialEntries().find(isHeadline);
    if(!primary){
      const label=competitionLabelBySlug(activeFootballLeague);
      area.innerHTML=`<article class="transfer-visual-lead league-focus"><div class="transfer-visual-media"><span class="transfer-league-mark">${escapeHTML((SELECTED_COMPETITIONS.find(item=>item.key===activeFootballLeague)?.short||label).slice(0,4))}</span></div><div class="transfer-visual-copy"><small>${escapeHTML(label)} · LİG GÜNDEMİ</small><h3>Doğrulanmış manşet bekleniyor</h3><p>Kaynaklı haber geldiğinde bu görsel kart otomatik güncellenir.</p><strong>Kaynak gelmeden bilgi üretilmez</strong></div></article>`;
      return;
    }
    const image=primary.image?`<img src="${escapeHTML(primary.image)}" alt="${escapeHTML(primary.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:'<span class="transfer-league-mark">●</span>';
    area.innerHTML=`<article class="transfer-visual-lead news-focus" tabindex="0" role="button" aria-label="${escapeHTML(primary.title)} haberini aç"><div class="transfer-visual-media">${image}</div><div class="transfer-visual-copy"><small>${escapeHTML(primary.label||'SON DAKİKA')} · ${escapeHTML(primary.source||'Kaynaklı yayın')}</small><h3>${escapeHTML(primary.title)}</h3>${primary.text?`<p>${escapeHTML(primary.text)}</p>`:''}<strong>${primary.time?escapeHTML(primary.time.includes('T')?fmtEditorialDate(primary.time):primary.time):'Güncel kayıt'}</strong></div></article><button class="football-module-full-link" type="button" onclick="openFootballSection('news')">Tüm gündemi aç →</button>`;
    const card=area.querySelector('.transfer-visual-lead');
    if(card){ card.onclick=()=>openFootballSection('news'); card.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){event.preventDefault();openFootballSection('news');} }; }
  };

  renderFootballStandingsCompact = function(){
    const area=document.getElementById('footballStandingsCompact'); if(!area) return;
    const rows=standingRowsForActiveLeague().slice(0,6);
    const honors=document.getElementById('footballSeasonHonors');
    if(honors){ honors.innerHTML=''; honors.hidden=true; }
    // Arşiv tablosu gösterilirken "CANLI YARIŞ" ifadesi yanıltıcı olur; kicker
    // ve başlık tablonun gerçek kaynağına göre yazılır.
    const raceBadge=standingsSeasonBadge(rows);
    const standingsKicker=document.getElementById('footballStandingsKicker');
    if(standingsKicker) standingsKicker.textContent=raceBadge.archive
      ? `${competitionShortBySlug(activeFootballLeague)} · ${STANDINGS_ARCHIVE_SEASON} ARŞİV`
      : `${competitionShortBySlug(activeFootballLeague)} · CANLI YARIŞ`;
    const standingsTitle=document.getElementById('footballStandingsTitle');
    if(standingsTitle) standingsTitle.textContent=raceBadge.archive ? 'Geçmiş sezon zirvesi' : 'Zirve hattı';
    if(activeFootballLeague!=='super-lig' && !rows.length){
      area.innerHTML=`<div class="league-module-waiting"><strong>${escapeHTML(competitionLabelBySlug(activeFootballLeague))} puan durumu bekleniyor</strong><p>${escapeHTML(providerUnavailableMessage(activeFootballLeague))}</p></div><button class="football-module-full-link" type="button" onclick="openFootballSection('standings')">Puan durumu alanını aç →</button>`;
      return;
    }
    if(!rows.length){
      area.innerHTML=`<div class="league-module-waiting"><strong>Puan durumu hazırlanıyor</strong><p>Sportmonks sezon tablosu geldiğinde lig yarışı burada görünecek.</p></div>`;
      return;
    }
    const leader=rows[0];
    const chasers=rows.slice(1);
    const goalDiff=Number(leader.goal_difference||0);
    const form=String(leader.form||'').slice(-5);
    area.innerHTML=`${standingsArchiveBannerHTML(rows)}<div class="league-race-board">
      <article class="league-race-leader">
        <div class="league-race-rank"><span>01</span><small>LİDER</small></div>
        <div class="league-race-club">${crestHTML(leader.team,'md')}<div><strong>${escapeHTML(leader.team)}</strong><small>${Number(leader.played||0)} maç · ${goalDiff>0?'+':''}${goalDiff} averaj</small></div></div>
        <div class="league-race-points"><strong>${Number(leader.points||0)}</strong><span>PUAN</span></div>
      </article>
      <div class="league-race-status"><span>Zirve takibi</span><small>${form?`Liderin son 5 formu: ${escapeHTML(form)}`:'Güncel lig sıralaması'}</small></div>
      <div class="league-race-chasers">${chasers.map((row,index)=>{
        const gap=Math.max(0,Number(leader.points||0)-Number(row.points||0));
        const diff=Number(row.goal_difference||0);
        return `<button class="league-race-row" type="button" onclick="openFootballSection('standings')" aria-label="${escapeHTML(row.team)} puan durumu">
          <span class="league-race-position">${String(index+2).padStart(2,'0')}</span>
          <span class="league-race-team">${crestHTML(row.team,'xs')}<b>${escapeHTML(row.team)}</b></span>
          <span class="league-race-gap">${gap?`-${gap}`:'EŞİT'}<small>FARK</small></span>
          <span class="league-race-score">${Number(row.points||0)}<small>P</small></span>
          <span class="league-race-diff">${diff>0?'+':''}${diff}<small>AV</small></span>
        </button>`;
      }).join('')}</div>
    </div><button class="football-module-full-link league-race-full" type="button" onclick="openFootballSection('standings')"><span>Tüm tablo ve form grafiği</span><b>Tabloyu aç →</b></button>`;
  };

  const renderPortalSponsorBase=renderPortalSponsor;
  renderPortalSponsor = function(){
    renderPortalSponsorBase();
    const rail=document.getElementById('portalSponsorRail'); if(!rail) return;
    const predictUrl='https://xyzskor-tr.korayeris2002.chatgpt.site/predict/';
    rail.innerHTML=`<a class="predict-ad predict-ad-skyscraper" href="${predictUrl}" target="_self"><span class="predict-ad-brand"><b>X</b><strong>XYZSKOR</strong><small>FOOTBALL INTELLIGENCE</small></span><span class="predict-ad-pill">🏆 Haftanın maç challenge'ı</span><span class="predict-ad-copy"><strong>Skorunu tahmin et!</strong><small>Orijinal forma + 2x VIP maç bileti kazanma şansı.</small></span><span class="predict-ad-score"><small>Haftanın maçı</small><b>2</b><i>−</i><b>1</b></span><span class="predict-ad-cta">Hemen tahmin yap →</span><small class="predict-ad-legal">Katılım ücretsizdir. Bahis yoktur.</small></a>`;
  };

  function initSideWidgets(){
    const form=document.getElementById('sideChatForm');
    const input=document.getElementById('sideChatInput');
    const feed=document.getElementById('sideChatFeed');
    const chatPanel=form?.closest('.side-chat-prototype') || feed?.closest('.side-chat-prototype');
    if(chatPanel && !chatPanel.dataset.closeReady){
      chatPanel.dataset.closeReady='1';
      const closedKey='xyzskor_side_chat_closed_v1';
      try{
        if(localStorage.getItem(closedKey)!=='open') chatPanel.hidden=true;
      }catch(_error){}
      let bubble=document.getElementById('sideChatBubble');
      if(!bubble){
        bubble=document.createElement('button');
        bubble.type='button';
        bubble.id='sideChatBubble';
        bubble.className='side-chat-bubble';
        bubble.setAttribute('aria-label','Canlı Tribün sohbetini aç');
        bubble.innerHTML='<span>Canlı Tribün</span><b><i></i><i></i><i></i></b>';
        document.body.appendChild(bubble);
      }
      bubble.classList.toggle('is-open', !chatPanel.hidden);
      const header=chatPanel.querySelector('header') || chatPanel;
      const closeButton=document.createElement('button');
      closeButton.type='button';
      closeButton.className='side-chat-close';
      closeButton.setAttribute('aria-label','Sohbet alanını kapat');
      closeButton.textContent='x';
      header.appendChild(closeButton);
      bubble.addEventListener('click',()=>{
        chatPanel.hidden=false;
        bubble.classList.add('is-open');
        try{ localStorage.setItem(closedKey,'open'); }catch(_error){}
      });
      closeButton.addEventListener('click',()=>{
        chatPanel.hidden=true;
        bubble.classList.remove('is-open');
        try{ localStorage.setItem(closedKey,'closed'); }catch(_error){}
      });
    }
    if(form && input && feed && !form.dataset.ready){
      form.dataset.ready='1';
      form.addEventListener('submit',(event)=>{
        event.preventDefault();
        const text=input.value.trim();
        if(!text) return;
        const article=document.createElement('article');
        article.innerHTML=`<b>Sen</b><p>${escapeHTML(text)}</p>`;
        feed.appendChild(article);
        input.value='';
        feed.scrollTop=feed.scrollHeight;
      });
    }
    if(!miniGoalGameController) miniGoalGameController = initMiniGoalGame();
    initFootballIntro();
  }

  let miniGoalGameController = null;
  let introLoopId = 0;

  function initFootballIntro(){
    const trigger = document.getElementById('miniGoalTrigger');
    if(!trigger || trigger.dataset.footballIntroReady) return;
    if(!miniGoalGameController) miniGoalGameController = initMiniGoalGame();
    if(!miniGoalGameController) return;
    trigger.dataset.footballIntroReady='1';

    const label = trigger.querySelector('span') || trigger;
    label.textContent = '-';
    trigger.classList.add('interactive-football','show');
    trigger.setAttribute('aria-label', 'Golü At oyunu');
    trigger.setAttribute('title', 'Golü At oyunu');

    const root=document.createElement('div');
    root.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9999';
    document.body.appendChild(root);

    const miniGame = miniGoalGameController;

      function corridorBounds(){
        if(window.innerWidth < 900){
          const y = Math.max(96, window.innerHeight - 150);
          return { xMin: 12, xMax: 110, yMin: y, yMax: y + 2 };
        }
        const wrap = document.querySelector('.wrap');
        const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
        const contentLeft = wrapRect ? Math.round(wrapRect.left) : Math.round(Math.max(360, (window.innerWidth - 1180) / 2));
        const xMin = 20;
        const xMax = Math.max(118, Math.min(340, contentLeft - 34));
        const yMin = Math.max(150, Math.min(Math.floor(window.innerHeight * 0.28), 245));
        const yMax = Math.max(yMin + 2, Math.min(window.innerHeight - 136, yMin + 4));
        return {xMin: Math.min(xMin, xMax - 60), xMax, yMin, yMax};
      }

    function randomBetween(minimum, maximum){
      return minimum + Math.random() * Math.max(1, maximum - minimum);
    }

    function createBall(element, options){
      const size = options.size || 34;
      const radius = size / 2;
      const speed = options.speed || (0.6 + Math.random() * 0.8);
      const angle = options.angle || (Math.random() * Math.PI * 2);
      const bounds = corridorBounds();
      const vx = options.vx != null ? options.vx : Math.cos(angle) * speed * (options.slow ? 0.7 : 1);
      const vy = options.vy != null ? options.vy : Math.sin(angle) * speed * (options.slow ? 0.7 : 1);
      const startX = Number.isFinite(options.x) ? options.x : randomBetween(bounds.xMin + radius, Math.max(bounds.xMin + radius + 1, bounds.xMax - radius));
      const startY = Number.isFinite(options.y) ? options.y : randomBetween(bounds.yMin + radius, Math.max(bounds.yMin + radius + 1, bounds.yMax - radius));
      return {
        el: element,
        size,
        r: radius,
        x: startX,
        y: startY,
        vx: options.vx != null ? vx : Math.cos(angle) * speed * (options.slow ? 0.7 : 1),
        vy: options.vy != null ? vy : Math.sin(angle) * speed * (options.slow ? 0.7 : 1),
        interactive: !!options.interactive
      };
    }

    function placeBall(ball){
      ball.el.style.transform = `translate3d(${Math.round(ball.x - ball.r)}px, ${Math.round(ball.y - ball.r)}px, 0)`;
    }

    function moveBall(ball, step, bounds){
      ball.x += ball.vx * step * 1.55;

      if(ball.x - ball.r < bounds.xMin){
        ball.x = bounds.xMin + ball.r;
        ball.vx = Math.abs(ball.vx);
      } else if(ball.x + ball.r > bounds.xMax){
        ball.x = bounds.xMax - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }

      ball.y = bounds.yMin + ball.r;

      placeBall(ball);
    }

    const balls = [];
    const introBounds = corridorBounds();
    const master = createBall(
      trigger,
      {
        size: 62,
        speed: 1.1,
        slow: true,
        interactive: true,
        x: introBounds.xMax - 29,
        vx: -(0.95 + Math.random() * 0.85),
        vy: 0
      }
    );
    master.size = 58;
    master.r = 29;
    placeBall(master);
    balls.push(master);

    function frame(now){
      if(!introLoopId) return;
      const bounds = corridorBounds();
      if(!frame.lastTime){
        frame.lastTime = now;
      }
      const dt = Math.min(2.25, Math.max(0.8, (now - frame.lastTime) / 16.67));
      frame.lastTime = now;
      balls.forEach(ball => moveBall(ball, dt, bounds));
      introLoopId = requestAnimationFrame(frame);
    }
    frame.lastTime = 0;

    let lastPointerOpenAt = 0;
    const openFromTrigger = (event)=>{
      if(event){
        event.preventDefault();
        event.stopPropagation();
        if(event.type === 'click' && Date.now() - lastPointerOpenAt < 500) return;
        if(event.type === 'pointerup') lastPointerOpenAt = Date.now();
      }
      miniGame.open();
    };
    trigger.addEventListener('click', openFromTrigger);
    trigger.addEventListener('pointerup', openFromTrigger);
    miniGame.restart?.();
    introLoopId = requestAnimationFrame(frame);
    window.addEventListener('resize', () => {
      const bounds = corridorBounds();
      balls.forEach(ball => {
        const maxX = Math.max(bounds.xMin + ball.r + 1, bounds.xMax - ball.r);
        const maxY = Math.max(bounds.yMin + ball.r + 1, bounds.yMax - ball.r);
        ball.x = Math.max(bounds.xMin + ball.r, Math.min(maxX, ball.x));
        ball.y = Math.max(bounds.yMin + ball.r, Math.min(maxY, ball.y));
      });
    });
    window.addEventListener('beforeunload', () => {
      if(introLoopId){
        cancelAnimationFrame(introLoopId);
        introLoopId = 0;
      }
    });

    const stop = () => {
      if(introLoopId){
        cancelAnimationFrame(introLoopId);
        introLoopId = 0;
      }
    };
    const start = () => {
      if(introLoopId) return;
      frame.lastTime = 0;
      introLoopId = requestAnimationFrame(frame);
    };
    trigger.addEventListener('blur', stop);
    trigger.addEventListener('focus', start);
    window.addEventListener('visibilitychange', () => {
      if(document.hidden){ stop(); } else { start(); }
    });
  }

  function initMiniGoalGame(){
    const trigger=document.getElementById('miniGoalTrigger');
    const overlay=document.getElementById('miniGoalOverlay');
    if(window.initPredictMiniGame){
      const upgraded = window.initPredictMiniGame({ trigger, overlay });
      if(upgraded) return upgraded;
    }
    const close=document.getElementById('miniGoalClose');
    const restart=document.getElementById('miniGoalRestart');
    const canvas=document.getElementById('miniGoalCanvas');
    const pointsEl=document.getElementById('miniGoalPoints');
    const missesEl=document.getElementById('miniGoalRemainingMisses');
    if(!trigger || !overlay || !canvas || !pointsEl || !missesEl || trigger.dataset.ready) return;
    trigger.dataset.ready='1';

    const MAX_GOALS = 10;
    const MAX_MISSES = 5;

    const game={
      ready:false,
      open:false,
      raf:0,
      last:0,
      goals:0,
      misses:0,
      points:0,
      remainingMisses:MAX_MISSES,
      gameOver:false,
      renderedPoints:-1,
      renderedMisses:-1,
      goalFlashUntil:0,
      w:420,
      h:560,
      keys:new Set(),
      ball:{x:210,y:96,vx:2.2,vy:0,r:18},
      bar:{x:152,y:468,w:96,h:14,speed:8.4,vx:0},
      goal:{x:155,y:22,w:110,h:38}
    };
    const ctx=canvas.getContext('2d');
    let isPointerDown=false;

    function setupCanvas(){
      const ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1));
      canvas.width=game.w*ratio;
      canvas.height=game.h*ratio;
      ctx.setTransform(ratio,0,0,ratio,0,0);
    }
    function resetBall(scored=false){
      game.ball.x=game.w/2;
      game.ball.y=96;
      game.ball.vx=(Math.random()>.5?1:-1)*(3.1+Math.random()*2.0);
      game.ball.vy=0;
    }
    function restartGame(){
      game.goals=0;
      game.misses=0;
      game.points=0;
      game.remainingMisses=MAX_MISSES;
      game.gameOver=false;
      game.renderedPoints=-1;
      game.renderedMisses=-1;
      game.goalFlashUntil=0;
      game.bar.vx=0;
      game.bar.x=(game.w-game.bar.w)/2;
      game.goal.x=(game.w-game.goal.w)/2;
      resetBall(false);
      renderScore();
      draw();
    }
    function renderScore(){
      if(game.renderedPoints!==game.points){
        pointsEl.textContent=`Predict Puanı: ${game.points}`;
        game.renderedPoints=game.points;
      }
      if(game.renderedMisses!==game.remainingMisses){
        missesEl.textContent=`Kalan Hak: ${game.remainingMisses}`;
        game.renderedMisses=game.remainingMisses;
      }
    }
    function maybeEndGame(){
      if(game.gameOver){
        return true;
      }
      if(game.goals >= MAX_GOALS || game.misses >= MAX_MISSES){
        game.gameOver=true;
        renderScore();
        return true;
      }
      return false;
    }
    function registerGoal(){
      if(game.gameOver) return;
      game.goals += 1;
      game.points = Math.min(game.goals * 5, 50);
      game.goalFlashUntil=performance.now()+1100;
      renderScore();
      if(!maybeEndGame()){
        resetBall(true);
      }
    }
    function registerMiss(){
      if(game.gameOver) return;
      game.misses += 1;
      game.remainingMisses = Math.max(0, MAX_MISSES - game.misses);
      renderScore();
      if(!maybeEndGame()){
        resetBall(false);
      }
    }
    function openGame(){
      if(!game.ready){
        setupCanvas();
        game.ready=true;
        draw();
      }
      game.gameOver=false;
      game.open=true;
      overlay.hidden=false;
      trigger.setAttribute('aria-expanded','true');
      renderScore();
      game.last=performance.now();
      game.raf=requestAnimationFrame(loop);
    }
    function closeGame(){
      game.open=false;
      overlay.hidden=true;
      trigger.setAttribute('aria-expanded','false');
      if(game.raf) cancelAnimationFrame(game.raf);
      game.raf=0;
    }
    function update(dt){
      if(game.gameOver){
        return;
      }
      const step=Math.min(2,dt/16.67);
      const movingLeft=game.keys.has('ArrowLeft') || game.keys.has('KeyA');
      const movingRight=game.keys.has('ArrowRight') || game.keys.has('KeyD');
      if(movingLeft) game.bar.vx-=0.92*step;
      if(movingRight) game.bar.vx+=0.92*step;
      if(!movingLeft && !movingRight) game.bar.vx*=0.90;
      game.bar.vx=Math.max(-game.bar.speed,Math.min(game.bar.speed,game.bar.vx));
      game.bar.x+=game.bar.vx*step;
      if(game.bar.x<12){ game.bar.x=12; game.bar.vx=Math.abs(game.bar.vx)*0.45; }
      if(game.bar.x>game.w-game.bar.w-12){ game.bar.x=game.w-game.bar.w-12; game.bar.vx=-Math.abs(game.bar.vx)*0.45; }
      game.bar.x=Math.max(12,Math.min(game.w-game.bar.w-12,game.bar.x));

      const b=game.ball;
      b.vy+=0.22*step;
      b.x+=b.vx*step;
      b.y+=b.vy*step;

      if(b.x-b.r<10){ b.x=10+b.r; b.vx=Math.abs(b.vx)*0.94; }
      if(b.x+b.r>game.w-10){ b.x=game.w-10-b.r; b.vx=-Math.abs(b.vx)*0.94; }
      if(b.y-b.r<10){ b.y=10+b.r; b.vy=Math.abs(b.vy)*0.72; }

      const bar=game.bar;
      const hitBar=b.vy>0 && b.y+b.r>=bar.y && b.y+b.r<=bar.y+bar.h+12 && b.x+b.r>bar.x && b.x-b.r<bar.x+bar.w;
      if(hitBar){
        b.y=bar.y-b.r;
        b.vy=-15.8;
        b.vx+=(b.x-(bar.x+bar.w/2))*0.104;
        b.vx+=game.bar.vx*0.22;
        b.vx=Math.max(-9.4,Math.min(9.4,b.vx));
      }

      const g=game.goal;
      const scored=b.vy<0 && b.x>g.x && b.x<g.x+g.w && b.y-b.r<g.y+g.h && b.y+b.r>g.y;
      if(scored){
        registerGoal();
      }else if(b.y-b.r>game.h){
        registerMiss();
      }
    }
    function drawBall(){
      const b=game.ball;
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.fillStyle='#f8fafc';
      ctx.beginPath();
      ctx.arc(0,0,b.r,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='#151922';
      ctx.lineWidth=2;
      ctx.stroke();
      ctx.strokeStyle='#11151d';
      ctx.lineWidth=2.4;
      for(let i=0;i<5;i+=1){
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(Math.cos(i*1.256)*b.r*.78,Math.sin(i*1.256)*b.r*.78);
        ctx.stroke();
      }
      ctx.restore();
    }
    function draw(){
      ctx.clearRect(0,0,game.w,game.h);
      const grd=ctx.createLinearGradient(0,0,0,game.h);
      grd.addColorStop(0,'#18202a');
      grd.addColorStop(1,'#0c1118');
      ctx.fillStyle=grd;
      ctx.fillRect(0,0,game.w,game.h);

      ctx.strokeStyle='rgba(255,255,255,.08)';
      ctx.lineWidth=2;
      ctx.strokeRect(10,10,game.w-20,game.h-20);
      ctx.beginPath();
      ctx.moveTo(10,game.h/2);
      ctx.lineTo(game.w-10,game.h/2);
      ctx.stroke();

      const g=game.goal;
      ctx.fillStyle='rgba(255,149,0,.18)';
      ctx.strokeStyle='#ff9500';
      ctx.lineWidth=3;
      ctx.fillRect(g.x,g.y,g.w,g.h);
      ctx.strokeRect(g.x,g.y,g.w,g.h);
      ctx.strokeStyle='rgba(255,255,255,.22)';
      ctx.lineWidth=1;
      for(let x=g.x+12;x<g.x+g.w;x+=12){
        ctx.beginPath();
        ctx.moveTo(x,g.y);
        ctx.lineTo(x,g.y+g.h);
        ctx.stroke();
      }
      for(let y=g.y+10;y<g.y+g.h;y+=10){
        ctx.beginPath();
        ctx.moveTo(g.x,y);
        ctx.lineTo(g.x+g.w,y);
        ctx.stroke();
      }
      ctx.fillStyle='#00e5ff';
      ctx.shadowColor='rgba(0,229,255,.35)';
      ctx.shadowBlur=14;
      ctx.fillRect(game.bar.x,game.bar.y,game.bar.w,game.bar.h);
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,255,255,.16)';
      ctx.fillRect(game.bar.x,game.bar.y-4,game.bar.w,4);

      drawBall();

      if(game.goalFlashUntil>performance.now()){
        const remaining=Math.max(0,game.goalFlashUntil-performance.now());
        const alpha=Math.min(1,remaining/260);
        ctx.save();
        ctx.globalAlpha=alpha;
        ctx.fillStyle='rgba(255,149,0,.16)';
        ctx.fillRect(0,0,game.w,game.h);
        ctx.shadowColor='rgba(255,149,0,.72)';
        ctx.shadowBlur=28;
        ctx.fillStyle='#ffb04a';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.font='950 62px Inter, sans-serif';
        ctx.fillText('+5',game.w/2,game.h/2-18);
        ctx.restore();
      }
    }
    function loop(now){
      if(!game.open) return;
      update(now-game.last);
      draw();
      if(game.gameOver){
        return;
      }
      game.last=now;
      game.raf=requestAnimationFrame(loop);
    }
    function pointerToBar(event){
      const rect=canvas.getBoundingClientRect();
      const clientX=event.touches?.[0]?.clientX ?? event.clientX;
      const x=(clientX-rect.left)/rect.width*game.w;
      const target=Math.max(12,Math.min(game.w-game.bar.w-12,x-game.bar.w/2));
      game.bar.vx=Math.max(-game.bar.speed,Math.min(game.bar.speed,(target-game.bar.x)*0.18));
    }

    close?.addEventListener('click',closeGame);
    restart?.addEventListener('click',restartGame);
    window.addEventListener('keydown',(event)=>{
      if(!game.open) return;
      if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(event.code)){
        event.preventDefault();
        game.keys.add(event.code);
      }
      if(event.code==='Escape') closeGame();
    });
    window.addEventListener('keyup',(event)=>game.keys.delete(event.code));
    canvas.addEventListener('pointerdown',(event)=>{ if(game.open){ isPointerDown=true; event.preventDefault(); canvas.setPointerCapture(event.pointerId); pointerToBar(event); } });
    canvas.addEventListener('pointermove',(event)=>{ if(game.open && isPointerDown){ pointerToBar(event); } });
    canvas.addEventListener('pointerup',()=>{ isPointerDown=false; });
    canvas.addEventListener('pointercancel',()=>{ isPointerDown=false; });
    canvas.addEventListener('pointerleave',()=>{ isPointerDown=false; });
    canvas.addEventListener('click',(event)=>{ if(game.open){ event.preventDefault(); pointerToBar(event); } });
    window.addEventListener('resize',()=>{ if(game.ready) setupCanvas(); });
    window.addEventListener('beforeunload',()=>{ if(game.raf) cancelAnimationFrame(game.raf); });
    return {
      open: openGame,
      close: closeGame,
      restart: restartGame
    };
  }

  initSideWidgets();
  window.__XYZ_UI_EXTRAS_READY__ = true;

})();
