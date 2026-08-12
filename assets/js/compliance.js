(function(){
  'use strict';

  const BLOCKED_COMMERCE = /(?:^|[.\/-])(bet|betting|bookmaker|casino|draftkings|fanduel|betonline|iddaa)(?:[.\/-]|$)/i;
  const ALLOWED_EXTERNAL_IMAGE_HOSTS = new Set(['i.ytimg.com','img.youtube.com','cdn.sportmonks.com','cdn.sportmonks.io','images.sportmonks.com','api.citoapi.com','ufc.com','www.ufc.com']);

  function isLocalUrl(raw){
    if(!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return true;
    try{ return new URL(raw, location.href).origin === location.origin; }catch(_){ return false; }
  }

  function protectImage(img){
    if(!img || img.dataset.licenseChecked==='true') return;
    img.dataset.licenseChecked='true';
    const raw=img.currentSrc || img.getAttribute('src') || '';
    if(isLocalUrl(raw)) return;
    let host='';
    try{ host=new URL(raw, location.href).hostname.toLowerCase(); }catch(_){ host=''; }
    if(ALLOWED_EXTERNAL_IMAGE_HOSTS.has(host) || host.endsWith('.sportmonks.com') || host.endsWith('.sportmonks.io')){
      img.referrerPolicy='no-referrer';
      return;
    }
    img.removeAttribute('src');
    img.removeAttribute('srcset');
    img.hidden=true;
    const parent=img.parentElement;
    if(parent){
      parent.classList.add('license-safe-placeholder');
      parent.setAttribute('aria-label', img.alt ? `${img.alt} görseli lisans doğrulaması tamamlanana kadar gizlendi` : 'Lisans doğrulaması bekleyen görsel');
    }
  }

  function protectBackground(el){
    const style=el.getAttribute?.('style') || '';
    const match=style.match(/url\((['"]?)(.*?)\1\)/i);
    if(!match || isLocalUrl(match[2])) return;
    el.style.backgroundImage='none';
    el.classList.add('license-safe-placeholder');
  }

  function protectLink(link){
    const href=link.getAttribute('href') || '';
    if(/^https?:/i.test(href)) link.rel='noopener noreferrer';
    if(BLOCKED_COMMERCE.test(href)){
      link.removeAttribute('href');
      link.setAttribute('aria-disabled','true');
      link.classList.add('compliance-link-blocked');
      link.title='Bahis ve para yatırma yönlendirmeleri XYZSKOR güvenli beta politikasında kapalıdır.';
    }
  }

  function scan(root){
    if(root.nodeType!==1 && root!==document) return;
    if(root.matches?.('img')) protectImage(root);
    if(root.matches?.('[style*="background"]')) protectBackground(root);
    if(root.matches?.('a[href]')) protectLink(root);
    root.querySelectorAll?.('img').forEach(protectImage);
    root.querySelectorAll?.('[style*="background"]').forEach(protectBackground);
    root.querySelectorAll?.('a[href]').forEach(protectLink);
  }

  function addSourceNotice(){
    if(document.getElementById('complianceSourceNotice')) return;
    const anchor=document.getElementById('dataStatusLine') || document.querySelector('.live-ticker');
    if(!anchor) return;
    const notice=document.createElement('div');
    notice.id='complianceSourceNotice';
    notice.className='compliance-source-notice';
    notice.innerHTML='<strong>Kaynak şeffaflığı</strong><span>Skor ve istatistikler sağlayıcı API kayıtlarından gelir. Sağlayıcı etiketi ve güncellenme zamanı bulunan kayıtlar gösterilir; lisansı belirsiz medya kullanılmaz.</span>';
    anchor.insertAdjacentElement('afterend',notice);
  }

  document.documentElement.dataset.complianceMode='safe-beta';
  document.addEventListener('DOMContentLoaded',()=>{
    scan(document);
    addSourceNotice();
    const observer=new MutationObserver((changes)=>{
      changes.forEach((change)=>{
        change.addedNodes.forEach((node)=>scan(node));
        if(change.type==='attributes') scan(change.target);
      });
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','href','style']});
  });
})();
