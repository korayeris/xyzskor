(() => {
  const KEY = 'xyzskor_consent_v1';
  const defaults = { necessary:true, functional:false, analytics:false, marketing:false, updatedAt:null, version:1 };
  const safeParse = (raw) => { try { return { ...defaults, ...JSON.parse(raw || '{}') }; } catch { return { ...defaults }; } };
  let state = safeParse(localStorage.getItem(KEY));
  const persist = (next) => {
    state = { ...defaults, ...next, necessary:true, updatedAt:new Date().toISOString(), version:1 };
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('xyz:consent-updated', { detail:{ ...state } }));
    closeAll();
  };
  const cookiePolicyHref = document.body?.classList.contains('legal-body') ? 'cerez-politikasi.html' : 'legal/cerez-politikasi.html';
  const banner = document.createElement('section');
  banner.className = 'consent-banner'; banner.setAttribute('role','dialog'); banner.setAttribute('aria-label','Çerez tercihleri');
  banner.innerHTML = `<div class="consent-row"><div class="consent-copy"><strong>Gizlilik tercihlerinizi siz yönetin</strong>XYZSKOR zorunlu depolama teknolojilerini hizmetin çalışması için kullanır. Analitik ve pazarlama teknolojileri yalnızca seçiminizle etkinleştirilir. <a href="${cookiePolicyHref}">Çerez Politikası</a></div><div class="consent-actions"><button class="consent-btn" data-consent-reject>Tümünü reddet</button><button class="consent-btn" data-consent-manage>Tercihleri yönet</button><button class="consent-btn primary" data-consent-accept>Tümünü kabul et</button></div></div>`;
  const modal = document.createElement('div'); modal.className='consent-modal'; modal.setAttribute('aria-hidden','true');
  modal.innerHTML = `<div class="consent-panel" role="dialog" aria-modal="true" aria-labelledby="consentTitle"><h2 id="consentTitle">Çerez ve izleme tercihleri</h2><p style="color:#9caf9f;font-size:13px">Zorunlu kategori kapatılamaz. Diğer kategorileri dilediğiniz zaman değiştirebilirsiniz.</p>
  ${category('necessary','Zorunlu','Oturum, güvenlik, tercih kaydı ve temel işlevler.',true)}
  ${category('functional','İşlevsel','Arayüz tercihleri ve isteğe bağlı kişiselleştirme.',false)}
  ${category('analytics','Analitik','Trafik, hata ve kullanım ölçümü.',false)}
  ${category('marketing','Pazarlama','Kampanya ölçümü ve reklam kişiselleştirmesi.',false)}
  <div class="consent-panel-actions"><button class="consent-btn" data-consent-close>Vazgeç</button><button class="consent-btn primary" data-consent-save>Tercihleri kaydet</button></div></div>`;
  function category(key,title,desc,disabled){return `<div class="consent-category"><div><strong>${title}</strong><p>${desc}</p></div><button class="consent-switch" type="button" data-consent-switch="${key}" aria-label="${title}" aria-pressed="${disabled?'true':'false'}" ${disabled?'disabled':''}></button></div>`}
  function openManager(){ syncSwitches(); modal.classList.add('is-open'); modal.setAttribute('aria-hidden','false'); }
  function closeAll(){ banner.classList.remove('is-open'); modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); }
  function syncSwitches(){ modal.querySelectorAll('[data-consent-switch]').forEach((b)=>b.setAttribute('aria-pressed', String(Boolean(state[b.dataset.consentSwitch])))); }
  function selected(){ const next={}; modal.querySelectorAll('[data-consent-switch]').forEach((b)=>next[b.dataset.consentSwitch]=b.getAttribute('aria-pressed')==='true'); return next; }
  document.addEventListener('DOMContentLoaded',()=>{
    document.body.append(banner,modal);
    banner.querySelector('[data-consent-accept]').onclick=()=>persist({necessary:true,functional:true,analytics:true,marketing:true});
    banner.querySelector('[data-consent-reject]').onclick=()=>persist({necessary:true,functional:false,analytics:false,marketing:false});
    banner.querySelector('[data-consent-manage]').onclick=openManager;
    modal.querySelector('[data-consent-close]').onclick=()=>{modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true')};
    modal.querySelector('[data-consent-save]').onclick=()=>persist(selected());
    modal.querySelectorAll('[data-consent-switch]:not(:disabled)').forEach((b)=>b.onclick=()=>b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true')));
    document.querySelectorAll('[data-open-consent]').forEach((b)=>b.addEventListener('click',(e)=>{e.preventDefault();openManager()}));
    if (!state.updatedAt) banner.classList.add('is-open');
  });
  window.XYZConsent = {
    get:()=>({...state}),
    has:(category)=>category==='necessary' || Boolean(state[category]),
    open:openManager,
    reset:()=>{localStorage.removeItem(KEY);state={...defaults};banner.classList.add('is-open')},
    whenAllowed:(category,callback)=>{
      if (category==='necessary' || state[category]) callback();
      else window.addEventListener('xyz:consent-updated',(e)=>{if(e.detail[category])callback()},{once:true});
    }
  };
})();
