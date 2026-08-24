import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/matchday-live.js', import.meta.url), 'utf8');

async function runScenario({ pathname = '/super-lig', search = '', matches = [], seasonResponses = null, detailFixture = {}, detailDetails = {}, fixtureFallback = null, matchdayFailures = 0, sessionToken = '' }) {
  const requests = [];
  const listeners = new Map();
  const timers = [];
  let seasonRequest = 0;
  let matchdayRequest = 0;
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { id, hidden:false, isConnected:true, textContent:'', innerHTML:'', style:{}, classList:{ toggle() {}, add() {}, remove() {} }, nextElementSibling:null, appendChild() {}, addEventListener() {}, querySelectorAll:() => [] });
    return elements.get(id);
  };
  const title = element('matchdayTitle');
  title.nextElementSibling = element('matchdayIntro');
  element('matchdayLiveRoot'); element('matchdaySync'); element('matchdayCommand');
  const context = {
    URL, URLSearchParams, Intl, Map, Array, String, Number, Boolean, RegExp, Math, Promise,
    Date,
    location:{ pathname, search, origin:'https://xyzskor.test', assign() {} },
    document:{
      body:{ classList:{ toggle() {} } }, hidden:false, readyState:'complete',
      getElementById:element,
      createElement:() => ({ hidden:false, dataset:{}, className:'', textContent:'', addEventListener() {} }),
      querySelector:() => ({ appendChild() {} }), querySelectorAll:() => [], addEventListener:(name,handler) => listeners.set(name,handler)
    },
    window:{ addEventListener:(name,handler) => listeners.set(`window:${name}`,handler), location:{ hash:'' } },
    setTimeout:(handler) => { timers.push(handler); return timers.length; }, clearTimeout() {},
    fetch:async (url, options = {}) => {
      requests.push(String(url));
      if (String(url).includes('/api/football/prediction?')) {
        return { ok:true, json:async () => ({ prediction:null }) };
      }
      if (String(url).includes('/api/football/fixture?')) {
        return { ok:true, json:async () => ({ updatedAt:new Date().toISOString(), fixture:fixtureFallback || detailFixture, details:{} }) };
      }
      if (String(url).includes('/api/football/matchday?')) {
        matchdayRequest += 1;
        if (matchdayRequest <= matchdayFailures) return { ok:false, status:503, json:async () => ({ error:'sync_in_progress' }) };
        return { ok:true, json:async () => ({ updatedAt:new Date().toISOString(), fixture:detailFixture, details:detailDetails }) };
      }
      if (String(url).includes('/season?')) {
        const available = seasonResponses || [matches];
        const selected = available[Math.min(seasonRequest, available.length - 1)];
        seasonRequest += 1;
        return { ok:true, json:async () => ({ matches:selected }) };
      }
      return { ok:true, json:async () => ({ updatedAt:new Date().toISOString(), fixture:detailFixture, details:detailDetails }) };
    },
    sb:sessionToken ? { auth:{ getSession:async () => ({ data:{ session:{ access_token:sessionToken } } }) } } : undefined
  };
  vm.runInNewContext(source, context, { filename:'matchday-live.js' });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return { requests, elements, listeners, timers };
}

const now = Date.now();
const iso = (offset) => new Date(now + offset).toISOString();
const completed = { id:'sportmonks:10001', ev:'Eski Ev', konuk:'Eski Konuk', kickoff:iso(-86400000), status:'bitti', result:{ home:1, away:0 } };
const upcoming = { id:'sportmonks:10002', ev:'Yakın Ev', konuk:'Yakın Konuk', kickoff:iso(7200000), status:null };
const live = { id:'sportmonks:10003', ev:'İstanbul Başakşehir', konuk:'Çaykur Rizespor', kickoff:iso(-1800000), status:'canlı' };

for (const pathname of ['/', '/all', '/super-lig', '/premier-league', '/la-liga', '/bundesliga', '/serie-a']) {
  const homeRun = await runScenario({ pathname, matches:[completed, upcoming, live] });
  assert.equal(homeRun.requests.length, 0, `${pathname} without a fixture must not issue season/matchday requests.`);
  assert.equal(homeRun.elements.get('matchdayCommand').hidden, true, `${pathname} without a fixture must hide the matchday command.`);
  homeRun.elements.get('matchdayCommand').hidden = false;
  assert.equal(homeRun.elements.get('matchdayCommand').style.display, 'none', `${pathname} must remain visually hidden if another UI layer clears the hidden property.`);
  assert.equal(homeRun.listeners.has('window:xyz:football-league-change'), false, `${pathname} without a fixture must not install the matchday league listener.`);
  assert.equal(homeRun.listeners.has('visibilitychange'), false, `${pathname} without a fixture must not install polling lifecycle listeners.`);
}

const detailedRun = await runScenario({
  pathname:'/',
  search:'?fixture=10001',
  detailFixture:{ id:'sportmonks:10001', ev:'Ev', konuk:'Konuk', status:'bitti', home_logo:'https://cdn.sportmonks.com/home.png', away_logo:'https://cdn.sportmonks.com/away.png', score:{home:2,away:2} },
  detailDetails:{
    events:[{ minute:53, type_id:14, team:'Ev', player:'Oyuncu', player_image:'https://cdn.sportmonks.com/player.png', result:'1-0' }],
    statistics:[{ label:'Corners', location:'home', value:8 },{ label:'Ball Possession %', location:'away', value:64 }],
    lineups:[{ team:'Ev', player_name:'Kaleci', player_image:'https://cdn.sportmonks.com/keeper.png', number:1, type_id:11 }],
    xg:[{ location:'home', value:1.76 },{ location:'away', value:1.38 }],
    predictions:[{ type_id:237, predictions:{home:41.53,draw:24.07,away:34.36} }]
  }
});
assert.equal(detailedRun.requests.length, 1, 'Explicit root fixture must make exactly one initial matchday request.');
assert.match(detailedRun.requests[0], /\/api\/football\/matchday\?fixture=10001$/, 'Explicit root fixture must request its own detail payload directly.');
assert.equal(detailedRun.elements.get('matchdayCommand').hidden, false, 'Explicit root fixture must keep the matchday command available.');
assert.equal(detailedRun.elements.get('matchdayIntro').textContent, 'Maç tamamlandı · Sportmonks tarafından doğrulanan maç verisi', 'Tarihi eksik biten maç program bekleniyor dememeli.');
assert.match(detailedRun.elements.get('matchdayLiveRoot').innerHTML, /matchday-jump[\s\S]*Olaylar <b>1<\/b>[\s\S]*İstatistikler <b>2<\/b>/, 'Fixture ayrıntıları sayılı hızlı gezinme sunmalı.');
assert.match(detailedRun.elements.get('matchdayLiveRoot').innerHTML, /href="\/\?fixture=10001#matchdayLineups" data-matchday-section="matchdayLineups"/, 'Kadro bağlantısı fixture kimliğini korumalı; kök base URL yüzünden maçtan çıkmamalı.');
assert.match(detailedRun.elements.get('matchdayLiveRoot').innerHTML, /matchday-stat-comparison[\s\S]*Topa sahip olma[\s\S]*matchday-stat-bar[\s\S]*Korner/, 'Sağlayıcı istatistikleri öncelikli, Türkçe ve oranlı karşılaştırma çubuklarıyla sunulmalı.');
assert.match(detailedRun.elements.get('matchdayLiveRoot').innerHTML, /matchday-team-logo[\s\S]*matchday-event-player[\s\S]*matchday-player-photo/, 'Takım ve oyuncu görselleri kadro sunumunda kullanılmalı.');
assert.match(detailedRun.elements.get('matchdayLiveRoot').innerHTML, /Yanlış diziliş yerine resmî ilk 11 listeleniyor/, 'Eksik saha koordinatı uydurma diziliş üretmemeli.');
assert.match(detailedRun.elements.get('matchdayLiveRoot').innerHTML, /BEKLENEN GOL[\s\S]*41,5%/, 'xG ve maç sonucu olasılığı görselleştirilmeli.');

const staleLiveRun = await runScenario({ search:'?fixture=10003', detailFixture:{ ...live, kickoff:iso(-18000000), minute:90, score:{home:1, away:1} } });
assert.equal(staleLiveRun.requests.length, 1, 'Explicit single-league fixture must make exactly one initial matchday request.');
assert.match(staleLiveRun.requests[0], /\/api\/football\/matchday\?fixture=10003$/, 'Explicit single-league fixture must request its own detail payload directly.');
assert.equal(staleLiveRun.listeners.has('visibilitychange'), true, 'Explicit single-league fixture must retain its refresh lifecycle.');
assert.doesNotMatch(staleLiveRun.elements.get('matchdayLiveRoot').innerHTML, /<em>(?:90' )?CANLI<\/em>/, 'Geçmiş kickoff taşıyan maç canlı etiketi göstermemeli.');

const overrideRun = await runScenario({ pathname:'/all', search:'?fixture=987654', detailFixture:{ id:'sportmonks:987654', ev:'Başka Ev', konuk:'Başka Konuk', kickoff:iso(3600000), score:{} } });
assert.equal(overrideRun.requests.length, 1, 'Fixture override sezon isteğini atlamalı.');
assert.match(overrideRun.requests[0], /fixture=987654$/, 'Fixture override aynen kullanılmalı.');

const overrideLeagueRun = await runScenario({ search:'?fixture=987654', detailFixture:{ id:'sportmonks:987654', ev:'Aynı Ev', konuk:'Aynı Konuk', kickoff:iso(10800000), status:null, score:{} } });
overrideLeagueRun.listeners.get('window:xyz:football-league-change')({ detail:{ league:'premier-league' } });
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(overrideLeagueRun.requests.length, 2, 'Lig değişimi yalnız görünür fixture isteğini bir kez yenilemeli.');
assert.match(overrideLeagueRun.requests[1], /\/api\/football\/matchday\?fixture=987654$/, 'Lig değişimi explicit fixture kimliğini korumalı.');
assert.equal(overrideLeagueRun.requests.filter((url) => /\/(?:home|season)(?:\?|$)/.test(url)).length, 0, 'Explicit fixture lig değişiminde home/season paketi istememeli.');

const fallbackFixture = { id:'sportmonks:30001', ev:'Fallback Ev', konuk:'Fallback Konuk', kickoff:iso(3600000), status:null, score:{} };
const fallbackRun = await runScenario({
  search:'?fixture=30001',
  detailFixture:fallbackFixture,
  fixtureFallback:fallbackFixture,
  matchdayFailures:1
});
assert.deepEqual(fallbackRun.requests.slice(0, 2), [
  '/api/football/matchday?fixture=30001',
  '/api/football/fixture?id=30001'
], 'Matchday 5xx yalnız aynı fixture için tek, sınırlı fallback yapmalı.');
assert.equal(fallbackRun.requests.filter((url) => /\/api\/football\/season(?:\?|$)/.test(url)).length, 0, 'Matchday fallback hiçbir koşulda tüm sezonu istememeli.');

const predictionRun = await runScenario({
  search:'?fixture=40001',
  detailFixture:{ id:'sportmonks:40001', ev:'Tahmin Ev', konuk:'Tahmin Konuk', kickoff:iso(3600000), status:null, score:{} },
  sessionToken:'prediction-token'
});
for (let poll = 0; poll < 2; poll += 1) {
  const nextPoll = predictionRun.timers.shift();
  assert.equal(typeof nextPoll, 'function', `Poll ${poll + 1} zamanlayıcısı kurulmalı.`);
  nextPoll();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}
assert.equal(predictionRun.requests.filter((url) => url.includes('/api/football/matchday?fixture=40001')).length, 3, 'İlk render ve iki skor poll aynı fixture detayını yenilemeli.');
assert.equal(predictionRun.requests.filter((url) => url.includes('/api/football/prediction?fixture=40001')).length, 1, 'Aynı fixture ve auth bağlamında tahmin GET yalnız bir kez yapılmalı.');

console.log('Matchday resolver checks passed.');
