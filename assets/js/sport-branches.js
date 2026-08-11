(() => {
  const primary = [
    ["football", "Futbol", "/"],
    ["basketball", "Basketbol", "/basketbol/"],
    ["volleyball", "Voleybol", "/voleybol/"],
    ["motorsports", "Motor Sporlari", "/motorsports/"],
    ["mma", "UFC", "/ufc/"],
    ["americanFootball", "Amerikan Futbolu", "/amerikan-futbolu/"]
  ];
  const secondary = [
    ["hockey", "Buz Hokeyi", "/buz-hokeyi/"],
    ["rugby", "Rugby", "/rugby/"],
    ["baseball", "Beyzbol", "/beyzbol/"],
    ["handball", "Hentbol", "/hentbol/"],
    ["australianFootball", "Avustralya Futbolu", "/avustralya-futbolu/"]
  ];
  const routeMap = {
    basketbol: "basketball",
    ufc: "mma",
    voleybol: "volleyball",
    "buz-hokeyi": "hockey",
    rugby: "rugby",
    beyzbol: "baseball",
    hentbol: "handball",
    "amerikan-futbolu": "americanFootball",
    "avustralya-futbolu": "australianFootball",
    motorsports: "motorsports"
  };
  const active = routeMap[location.pathname.split("/").filter(Boolean)[0]] || "football";

  async function refreshContextTicker() {
    if (active !== "mma") return;
    const ticker = document.getElementById("liveTicker");
    if (!ticker) return;
    try {
      const payload = await (await fetch("/api/ufc/events/upcoming", { cache: "no-store" })).json();
      const raw = payload?.data?.events || payload?.data || payload?.events || [];
      const events = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
      const event = events[0];
      const name = event?.name || event?.title || event?.eventName || "UFC programi bekleniyor";
      const date = event?.date || event?.startDate || event?.scheduledAt || "";
      ticker.innerHTML = `<span class="ticker-dot"></span><span class="ticker-label">YAKLASAN DOVUS</span><span class="ticker-match">${name}</span><span class="ticker-time mono">${date}</span>`;
    } catch (_) {
      ticker.innerHTML = '<span class="ticker-dot"></span><span class="ticker-label">YAKLASAN DOVUS</span><span class="ticker-match">Dovus programi yenileniyor</span>';
    }
  }

  async function refreshMetrics() {
    const hub = document.getElementById("multiSportHub");
    if (!hub || active === "football" || active === "motorsports") return;
    let metrics = document.getElementById("multiSportMetrics");
    if (!metrics) {
      metrics = document.createElement("section");
      metrics.id = "multiSportMetrics";
      metrics.className = "multisport-metrics";
      hub.querySelector(".multisport-switcher")?.before(metrics);
    }
    try {
      const payload = await (await fetch("/api/sports/today?client=v5", { cache: "no-store" })).json();
      const events = payload?.sports?.[active] || [];
      const live = events.filter((item) => /live|quarter|period|halftime|in progress/i.test(item.status || "")).length;
      const ended = events.filter((item) => /finished|after|ended|ft/i.test(item.status || "")).length;
      const leagues = new Set(events.map((item) => item.league || item.category).filter(Boolean)).size;
      metrics.innerHTML = `<span><b>${events.length}</b><small>Gunluk etkinlik</small></span><span class="is-live"><b>${live}</b><small>Canli</small></span><span><b>${ended}</b><small>Tamamlanan</small></span><span><b>${leagues}</b><small>Lig / organizasyon</small></span>`;
    } catch (_) {
      metrics.innerHTML = "<span><b>!</b><small>Canli veri yenileniyor</small></span>";
    }
  }

  function mount() {
    const header = document.querySelector(".global-header");
    if (!header) return;
    const miniGame = document.getElementById("miniGoalGame");
    if (miniGame && active !== "football") miniGame.remove();
    const activeSecondary = secondary.find(([key]) => key === active);
    const nav = document.createElement("nav");
    nav.className = "sport-branch-nav sport-branch-nav-compact";
    nav.setAttribute("aria-label", "Spor branslari");
    nav.innerHTML = `<div class="sport-branch-main">
      ${primary.map(([key, label, url]) => `<button class="sport-branch-button ${key === active ? "active" : ""}" data-branch="${key}" data-url="${url}">${label}</button>`).join("")}
      <div class="sport-more-wrap">
        <button class="sport-branch-button sport-more-button ${activeSecondary ? "active" : ""}" aria-expanded="false">${activeSecondary ? activeSecondary[1] : "Diger"}<span>+</span></button>
        <div class="sport-more-menu" hidden>
          ${secondary.map(([key, label, url]) => `<button class="sport-more-item ${key === active ? "active" : ""}" data-url="${url}">${label}</button>`).join("")}
        </div>
      </div>
      <button class="sport-branch-button sport-predict-button" data-action="predict">Predict</button>
    </div>`;
    header.after(nav);

    nav.querySelectorAll("[data-url]").forEach((button) => {
      button.addEventListener("click", () => location.assign(button.dataset.url));
    });
    nav.querySelector("[data-action='predict']")?.addEventListener("click", () => {
      const existing = [...document.querySelectorAll(".primary-nav .maintab")].find((item) => /predict/i.test(item.textContent));
      if (existing) existing.click();
      else location.assign("/?tab=predict");
    });
    const moreButton = nav.querySelector(".sport-more-button");
    const menu = nav.querySelector(".sport-more-menu");
    const close = () => { menu.hidden = true; moreButton.setAttribute("aria-expanded", "false"); };
    moreButton.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      moreButton.setAttribute("aria-expanded", String(!menu.hidden));
    });
    document.addEventListener("click", close);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    refreshContextTicker();
    if (active !== "football" && active !== "motorsports") setTimeout(refreshMetrics);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
