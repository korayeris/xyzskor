import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/matchday-live.js', import.meta.url), 'utf8');

async function runScenario({ search = '', matches = [], seasonResponses = null, detailFixture = {} }) {
  const requests = [];
  const listeners = new Map();
  const timers = [];
  let seasonRequest = 0;
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { id, hidden:false, textContent:'', innerHTML:'', classList:{ toggle() {} }, nextElementSibling:null, appendChild() {}, addEventListener() {} });
    return elements.get(id);
  };
  const title = element('matchdayTitle');
  title.nextElementSibling = element('matchdayIntro');
  element('matchdayLiveRoot'); element('matchdaySync'); element('matchdayCommand');
  const context = {
    URL, URLSearchParams, Intl, Map, Array, String, Number, Boolean, RegExp, Math, Promise,
    Date,
    location:{ search, origin:'https://xyzskor.test', assign() {} },
    document:{
      body:{ classList:{ toggle() {} } }, hidden:false, readyState:'complete',
      getElementById:element,
      createElement:() => ({ hidden:false, dataset:{}, className:'', textContent:'', addEventListener() {} }),
      querySelector:() => ({ appendChild() {} }), querySelectorAll:() => [], addEventListener:(name,handler) => listeners.set(name,handler)
    },
    window:{ addEventListener() {}, location:{ hash:'' } },
    setTimeout:(handler) => { timers.push(handler); return timers.length; }, clearTimeout() {},
    fetch:async (url) => {
      requests.push(String(url));
      if (String(url).includes('/season?')) {
        const available = seasonResponses || [matches];
        const selected = available[Math.min(seasonRequest, available.length - 1)];
        seasonRequest += 1;
        return { ok:true, json:async () => ({ matches:selected }) };
      }
      return { ok:true, json:async () => ({ updatedAt:new Date().toISOString(), fixture:detailFixture, details:{} }) };
    }
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

const liveRun = await runScenario({ matches:[completed, upcoming, live], detailFixture:{ ...live, minute:32, score:{home:1, away:0} } });
assert.equal(liveRun.requests[0], '/api/football/season?league=super-lig', 'Parametre yokken sezon fikstürü çözülmeli.');
assert.match(liveRun.requests[1], /fixture=10003$/, 'Canlı maç ilk sırada seçilmeli.');
assert.match(liveRun.elements.get('matchdayLiveRoot').innerHTML, />İB<.*>ÇR</s, 'Türkçe takım kısaltmaları isimlerden türetilmeli.');

const futureRun = await runScenario({ matches:[completed, { ...live, kickoff:iso(-18000000) }, upcoming], detailFixture:{ ...upcoming, score:{} } });
assert.match(futureRun.requests[1], /fixture=10002$/, 'Bayat canlı durum yerine en yakın gelecek maç seçilmeli.');
assert.doesNotMatch(futureRun.elements.get('matchdayLiveRoot').innerHTML, /CANLI/, 'Gelecek maç canlı olarak etiketlenmemeli.');

const completedRun = await runScenario({ matches:[completed], detailFixture:{ ...completed, score:{home:1, away:0} } });
assert.match(completedRun.requests[1], /fixture=10001$/, 'Gelecek maç yoksa son tamamlanan maç seçilmeli.');

const staleLiveRun = await runScenario({ search:'?fixture=10003', detailFixture:{ ...live, kickoff:iso(-18000000), minute:90, score:{home:1, away:1} } });
assert.doesNotMatch(staleLiveRun.elements.get('matchdayLiveRoot').innerHTML, /<em>(?:90' )?CANLI<\/em>/, 'Geçmiş kickoff taşıyan maç canlı etiketi göstermemeli.');

const overrideRun = await runScenario({ search:'?fixture=987654', detailFixture:{ id:'sportmonks:987654', ev:'Başka Ev', konuk:'Başka Konuk', kickoff:iso(3600000), score:{} } });
assert.equal(overrideRun.requests.length, 1, 'Fixture override sezon isteğini atlamalı.');
assert.match(overrideRun.requests[0], /fixture=987654$/, 'Fixture override aynen kullanılmalı.');

const emptyRun = await runScenario({ matches:[] });
assert.equal(emptyRun.elements.get('matchdayTitle').textContent, 'Program bekleniyor', 'Boş fikstür sahte maç üretmemeli.');
assert.match(emptyRun.elements.get('matchdayLiveRoot').innerHTML, /Program bekleniyor/, 'Boş fikstür dürüst durum göstermeli.');

const recoveredRun = await runScenario({ seasonResponses:[[],[upcoming]], detailFixture:{ ...upcoming, score:{} } });
assert.equal(recoveredRun.requests.length, 1, 'İlk boş sezonda yalnız sezon isteği yapılmalı.');
recoveredRun.listeners.get('visibilitychange')();
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(recoveredRun.requests[1], '/api/football/season?league=super-lig', 'Fixture yokken görünürlük değişimi sezonu yeniden çözmeli.');
assert.match(recoveredRun.requests[2], /\/api\/football\/matchday\?fixture=10002$/, 'Sonradan gelen fixture geçerli detay URL’siyle yüklenmeli.');

console.log('Matchday resolver checks passed.');
