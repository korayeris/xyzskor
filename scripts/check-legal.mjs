import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cfg = await readFile(resolve(root,'assets/legal/legal-config.js'),'utf8');
const required = ['TİCARİ UNVAN','ALAN-ADINIZ','AÇIK TEBLİGAT ADRESİ','KVKK BAŞVURU','YAYINDAN ÖNCE HUKUKİ MEKANİZMAYI','YETKİLİ MAHKEME'];
const unresolved = required.filter((token)=>cfg.includes(`[${token}`));
const pages = await readdir(resolve(root,'legal'));
if (pages.length < 10) throw new Error('Yasal sayfalar eksik.');
if (unresolved.length) {
  console.error('Yayın öncesi doldurulmamış kritik alanlar:', unresolved.join(', '));
  process.exit(1);
}
console.log('XYZSKOR yasal merkez temel kontrolü başarılı.');
