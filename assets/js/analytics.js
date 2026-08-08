(() => {
  const GA_ID = window.XYZ_GA4_ID || '';
  const CONSENT_KEY = 'xyzskor_consent_v1';
  const MAX_EVENT_NAME = 64;
  const MAX_PROPS = 24;
  const SAFE_KEY = /^[a-zA-Z0-9_:-]{1,48}$/;

  function readConsent(){
    if(window.XYZConsent?.get) return window.XYZConsent.get();
    try{ return JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}'); }
    catch(_error){ return {}; }
  }

  function analyticsAllowed(){
    return Boolean(readConsent().analytics);
  }

  function eventId(){
    if(crypto?.randomUUID) return crypto.randomUUID();
    return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function cleanValue(value){
    if(value == null) return null;
    if(typeof value === 'boolean') return value;
    if(typeof value === 'number') return Number.isFinite(value) ? value : null;
    return String(value).slice(0, 180);
  }

  function sanitizePayload(payload){
    const clean = {};
    Object.entries(payload || {}).slice(0, MAX_PROPS).forEach(([key, value]) => {
      if(!SAFE_KEY.test(key)) return;
      if(/email|phone|token|jwt|secret|password|address|ip/i.test(key)) return;
      const next = cleanValue(value);
      if(next !== null) clean[key] = next;
    });
    return clean;
  }

  function setGAConsent(consent){
    if(typeof window.gtag !== 'function') return;
    window.gtag('consent', 'update', {
      analytics_storage: consent?.analytics ? 'granted' : 'denied',
      ad_storage: consent?.marketing ? 'granted' : 'denied',
      ad_user_data: consent?.marketing ? 'granted' : 'denied',
      ad_personalization: consent?.marketing ? 'granted' : 'denied'
    });
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
  setGAConsent(readConsent());
  window.addEventListener('xyz:consent-updated', (event) => setGAConsent(event.detail || {}));

  window.trackEvent = async function trackEvent(name, payload = {}, options = {}){
    const eventName = String(name || '').trim().slice(0, MAX_EVENT_NAME);
    if(!eventName || !analyticsAllowed()) return { ok:false, skipped:'consent_denied' };
    const properties = sanitizePayload(payload);
    const id = options.eventId || eventId();
    let analyticsUserId = null;
    try{
      const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      analyticsUserId = user?.analytics_user_id || user?.id || null;
    }catch(_error){}

    if(typeof window.gtag === 'function' && GA_ID){
      window.gtag('event', eventName, { ...properties, event_id:id, user_id:analyticsUserId || undefined });
    }

    try{
      const headers = { 'Content-Type':'application/json', Accept:'application/json' };
      if(typeof sb !== 'undefined' && sb?.auth?.getSession){
        const { data } = await sb.auth.getSession();
        if(data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      await fetch('/api/analytics/event', {
        method:'POST',
        headers,
        body:JSON.stringify({ event_uuid:id, name:eventName, properties, analytics_user_id:analyticsUserId })
      });
    }catch(_error){}
    return { ok:true, eventId:id };
  };
})();
