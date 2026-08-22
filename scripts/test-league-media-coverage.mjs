import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker=fs.readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/ui.js',import.meta.url),'utf8');

for(const league of ['super-lig','premier-league','la-liga','bundesliga','serie-a']){
  assert.match(worker,new RegExp(`"${league}"\\s*:`),`${league} için YouTube sorgusu bulunmalı`);
}
assert.match(worker,/youtube-stale-v3\/\$\{encodeURIComponent\(league\)\}/,'YouTube stale cache lig bazında ayrılmalı');
assert.match(worker,/fetchYouTubeMedia\(env\.YOUTUBE_API_KEY, league\)/,'YouTube sorgusu seçili ligi kullanmalı');
assert.match(ui,/\/api\/media\/youtube\?league=\$\{encodeURIComponent\(league\)\}/,'istemci seçili ligi göndermeli');
assert.match(ui,/if\(activeFootballLeague!==league\) return/,'geç dönen başka lig yanıtı ekrana basılmamalı');
assert.match(ui,/\$\{unavailable\?'disabled':''\}/,'paket dışı lig seçimi devre dışı olmalı');
console.log('Lig kapsamı ve lig bazlı YouTube akışı kontrolleri başarılı.');
