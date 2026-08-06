(() => {
  const cfg = window.XYZ_LEGAL_CONFIG || {};
  const get = (path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), cfg);
  const missing = (value) => value == null || String(value).trim() === '' || /\[[^\]]+\]/.test(String(value)) || /şirket kuruluşundan sonra/i.test(String(value));
  const pendingLabel = 'Şirket kuruluşundan sonra yayımlanacak';

  const brand = document.querySelector('.legal-brand');
  if (brand) brand.innerHTML = '<span class="legal-brand-mark" aria-hidden="true">X</span><span class="legal-brand-copy"><strong>XYZSKOR</strong><small>SÜPER LİG INTELLIGENCE</small></span>';

  document.querySelectorAll('.legal-card h2').forEach((heading) => {
    if (heading.textContent.trim() !== 'Yayın öncesi kontrol') return;
    heading.textContent = 'Kuruluş hazırlığı';
    const copy = heading.nextElementSibling;
    if (copy) copy.textContent = 'XYZSKOR henüz şirketleşme aşamasındadır. Bu merkez, ürünün hukuki ve operasyonel hazırlığını şeffaf biçimde göstermek için taslak olarak yayımlanmıştır. Resmî şirket bilgileri kuruluş tamamlanınca doğrulanarak eklenecektir.';
  });

  document.querySelectorAll('[data-config]').forEach((el) => {
    const value = get(el.dataset.config);
    el.textContent = missing(value) ? pendingLabel : String(value);
    if (missing(value)) el.classList.add('placeholder');
  });

  document.querySelectorAll('[data-config-href]').forEach((el) => {
    const value = get(el.dataset.configHref);
    if (value && !missing(value)) el.href = value;
    else { el.href = '#'; el.classList.add('placeholder'); }
  });

  const cookieRows = document.querySelector('[data-cookie-table]');
  if (cookieRows && Array.isArray(cfg.cookies)) {
    cookieRows.innerHTML = cfg.cookies.map((c) => `<tr>
      <td>${escapeHTML(missing(c.name) ? pendingLabel : c.name)}</td><td>${escapeHTML(missing(c.provider) ? pendingLabel : c.provider)}</td><td>${escapeHTML(missing(c.purpose) ? pendingLabel : c.purpose)}</td>
      <td>${escapeHTML(missing(c.category) ? pendingLabel : c.category)}</td><td>${escapeHTML(missing(c.duration) ? pendingLabel : c.duration)}</td><td>${escapeHTML(missing(c.storage) ? pendingLabel : c.storage)}</td>
    </tr>`).join('');
    cookieRows.querySelectorAll('td').forEach((td) => { if (/\[[^\]]+\]/.test(td.textContent)) td.classList.add('placeholder'); });
  }

  const required = [
    'company.legalName','company.registeredAddress','company.generalEmail','company.kvkkEmail',
    'company.taxNumber','service.jurisdictionCity','infrastructure.crossBorderMechanism','effectiveDate','siteUrl'
  ];
  const unresolved = required.filter((key) => missing(get(key)));
  const warning = document.querySelector('[data-legal-warning]');
  if (warning) {
    if (unresolved.length) {
      warning.className = 'legal-alert pending';
      warning.innerHTML = '<strong>Şirket kuruluşu bekleniyor.</strong><br>Bu merkez şimdilik hazırlık ve şeffaflık amacıyla yayımlanan taslakları içerir. Ticari unvan, sicil, vergi, adres ve resmî iletişim bilgileri şirket kuruluşu tamamlandıktan sonra doğrulanarak eklenecektir.';
    } else {
      warning.className = 'legal-alert success';
      warning.innerHTML = '<strong>Temel yapılandırma alanları doldurulmuş görünüyor.</strong> Yine de hukuk ve operasyon kontrolü yapılmalıdır.';
    }
  }

  document.querySelectorAll('[data-print]').forEach((button) => button.addEventListener('click', () => window.print()));
  document.querySelectorAll('[data-current-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
})();
