import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/live.js', import.meta.url), 'utf8');
const detailStart=source.indexOf('function liveDetailRows('), detailEnd=source.indexOf('function renderLiveFeed(',detailStart);
assert.ok(detailStart>=0 && detailEnd>detailStart,'Canlı detay yardımcıları birlikte bulunmalı.');
const context=vm.createContext({ Map, Array, String });
new vm.Script(`function escapeLiveHTML(value){ return String(value ?? '').replace(/[&<>'"]/g, char=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }\n${source.slice(detailStart,detailEnd)}`).runInContext(context);

const full={home:{name:'Ev'},away:{name:'Konuk'},details:{events:[
  {minute:12,type:'Goal',player:'Golcü',team:'Ev'},
  {minute:28,type:'Yellow Card',player:'Savunmacı',team:'Konuk'},
  {minute:55,type:'Red Card',player:'Kaptan',team:'Ev'},
  {minute:70,type:'Substitution',player:'Giren',relatedPlayer:'Çıkan',team:'Konuk'}
],statistics:[{team:'Ev',label:'Şut',value:8},{team:'Konuk',label:'Şut',value:5}]}};
const fullHtml=context.renderLiveDetails(full);
for(const label of ['GOL','SARI KART','KIRMIZI KART','OYUNCU DEĞİŞİKLİĞİ','Şut']) assert.match(fullHtml,new RegExp(label),`${label} render edilmeli.`);
assert.match(fullHtml,/8[\s\S]*5/,'Ev ve konuk istatistikleri eşleşmeli.');

const emptyHtml=context.renderLiveDetails({home:{name:'Ev'},away:{name:'Konuk'},details:{}});
assert.match(emptyHtml,/akışı yayınlanmadı/,'Boş olaylar dürüst durum göstermeli.');
assert.match(emptyHtml,/istatistikleri yayınlanmadı/,'Boş istatistikler dürüst durum göstermeli.');

const partialHtml=context.renderLiveDetails({home:{name:'Ev'},away:{name:'Konuk'},details:{events:[{type:'Goal',player:'A'}]}});
assert.match(partialHtml,/GOL/,'Kısmi olay verisi gösterilmeli.');
assert.match(partialHtml,/istatistikleri yayınlanmadı/,'Eksik istatistik dalı kartı bozmamalı.');

const attack='<img src=x onerror=alert(1)>';
const xssHtml=context.renderLiveDetails({home:{name:'Ev'},away:{name:'Konuk'},details:{events:[{type:'Goal',player:attack,team:attack}],statistics:[{team:'Ev',label:attack,value:attack}]}});
assert.doesNotMatch(xssHtml,/<img/,'Provider HTML alanları çalıştırılmamalı.');
assert.match(xssHtml,/&lt;img src=x onerror=alert\(1\)&gt;/,'Provider metni escape edilerek gösterilmeli.');

console.log('Live details checks passed.');
