import fs from 'node:fs';
import assert from 'node:assert/strict';

const live=fs.readFileSync(new URL('../assets/js/live.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/ui.js',import.meta.url),'utf8');
const data=fs.readFileSync(new URL('../assets/js/data.js',import.meta.url),'utf8');
const branches=fs.readFileSync(new URL('../assets/js/sport-branches.js',import.meta.url),'utf8');

assert.match(live,/\/clubs\/\$\{encodeURIComponent\(clubSlug\)\}/,'kulüp rotası takım slugını taşımalı');
assert.match(live,/clubSlug:section==='clubs'/,'kulüp rotası ayrıştırılmalı');
assert.match(ui,/const cacheId=`\$\{activeFootballLeague\}:\$\{team\}`/,'kulüp önbelleği lig bazında ayrılmalı');
assert.match(ui,/class="club-pitch"/,'ilk 11 saha üzerinde gösterilmeli');
assert.match(ui,/openClubProfile\(activeFootballTeam,true\)/,'takım seçimi kulüp sayfasını açmalı');
assert.match(ui,/openAuth\('login'\)/,'misafir Predict seçimi giriş akışını açmalı');
assert.match(branches,/location\.assign\("\/predict\/"\)/,'Predict yedeği gerçek rotaya gitmeli');
assert.match(data,/emailRedirectTo: `\$\{location\.origin\}\/\?auth=confirmed`/,'e-posta dönüş adresi canlı köke bağlanmalı');

console.log('Kulüp rotası, saha dizilişi, Predict ve üyelik regresyonları başarılı.');
