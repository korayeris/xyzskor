(()=>{const b=[['football','Futbol'],['basketball','Basketbol'],['mma','UFC'],['volleyball','Voleybol'],['hockey','Buz Hokeyi'],['rugby','Rugby'],['baseball','Beyzbol'],['handball','Hentbol'],['americanFootball','Amerikan Futbolu']],r=()=>({basketbol:'basketball',ufc:'mma',voleybol:'volleyball','buz-hokeyi':'hockey',rugby:'rugby',beyzbol:'baseball',hentbol:'handball','amerikan-futbolu':'americanFootball'})[location.pathname.split('/').filter(Boolean)[0]]||'football';let a=r();function s(k){a=k;document.querySelectorAll('.sport-branch-button').forEach(x=>x.classList.toggle('active',x.dataset.branch===k));if(k==='football'){document.getElementById('tabBtnFootball')?.click();if(location.pathname!=='/')history.pushState({},'','/');return}document.querySelector('.primary-nav .multisport-nav-button[data-multi-sport="'+k+'"]')?.click()}async function m(){const h=document.getElementById('multiSportHub');if(!h||a==='football')return;let e=document.getElementById('multiSportMetrics');if(!e){e=document.createElement('section');e.id='multiSportMetrics';e.className='multisport-metrics';h.querySelector('.multisport-switcher')?.before(e)}try{const p=await(await fetch('/api/sports/today')).json(),i=p?.sports?.[a]||[],l=i.filter(x=>/live|quarter|period|halftime|in progress/i.test(x.status||'')).length,f=i.filter(x=>/finished|after|ended|ft/i.test(x.status||'')).length,g=new Set(i.map(x=>x.league||x.category).filter(Boolean)).size;e.innerHTML='<span><b>'+i.length+'</b><small>Gunluk etkinlik</small></span><span class="is-live"><b>'+l+'</b><small>Canli</small></span><span><b>'+f+'</b><small>Tamamlanan</small></span><span><b>'+g+'</b><small>Lig / organizasyon</small></span>'}catch(_){e.innerHTML='<span><b>!</b><small>Canli veri yenileniyor</small></span>'}}function n(){const h=document.querySelector('.global-header');if(!h)return;const n=document.createElement('nav');n.className='sport-branch-nav';n.innerHTML='<span>BRANSLAR</span><div>'+b.map(([k,l])=>'<button class="sport-branch-button '+(k===a?'active':'')+'" data-branch="'+k+'">'+l+'</button>').join('')+'</div>';h.after(n);n.querySelectorAll('button').forEach(x=>x.onclick=async()=>{s(x.dataset.branch);await m()});if(a!=='football')setTimeout(m)}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',n,{once:true}):n()})();

;(() => {
  const jokes = [
    'Senin paran burada ge\u00e7mez; \u00e7\u00fcnk\u00fc burada para ge\u00e7mez.',
    'C\u00fczdan\u0131n\u0131 \u00e7\u0131karma, hakem oyunu durdurur.',
    'Kart\u0131n\u0131 cebine koy; burada tek kart sar\u0131 kart.',
    'Kasaya gitme, burada kasa yok.',
    '\u00dccret 0 TL; pazarl\u0131k yaparsan yine 0 TL.'
  ];
  function startMoneyTicker(){
    const ticker=document.getElementById('liveTicker');
    if(!ticker||ticker.dataset.moneyJokes==='1')return;
    ticker.dataset.moneyJokes='1';
    let index=0;
    const paint=()=>{ticker.innerHTML='<span class="money-joke-dot"></span><strong>UCRETSIZ TRIBUN</strong><span>'+jokes[index++%jokes.length]+'</span>';};
    paint();
    setInterval(paint,8000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startMoneyTicker,{once:true});else startMoneyTicker();
})();
;(() => {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.sport-branch-button');
    const sport = button?.dataset?.branch;
    if(!sport || sport === 'football') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelectorAll('.sport-branch-button').forEach((item) => item.classList.toggle('active', item === button));
    window.openMultiSportHub?.(sport, 'home', true);
  }, true);
})();