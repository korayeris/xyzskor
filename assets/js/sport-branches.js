(() => {
  const primary = [
    ["football", "Ana Sayfa", "/"],
    ["basketball", "Basketbol", "/basketbol/"],
    ["volleyball", "Voleybol", "/voleybol/"],
    ["motorsports", "Motor Sporları", "/motorsports/"],
    ["mma", "UFC", "/ufc/"]
  ];
  const routeMap = {
    basketbol: "basketball",
    ufc: "mma",
    voleybol: "volleyball",
    motorsports: "motorsports"
  };
  const active = routeMap[location.pathname.split("/").filter(Boolean)[0]] || "football";

  function renderMetrics(payload, sport) {
    const hub = document.getElementById("multiSportHub");
    if (!hub || !["basketball", "volleyball"].includes(sport)) return;
    let metrics = document.getElementById("multiSportMetrics");
    if (!metrics) {
      metrics = document.createElement("section");
      metrics.id = "multiSportMetrics";
      metrics.className = "multisport-metrics";
      hub.querySelector(".multisport-switcher")?.before(metrics);
    }
    const events = (payload?.sports?.[sport] || []).filter((item) => !item?.sport || item.sport === sport);
    const live = events.filter((item) => /live|quarter|period|halftime|in progress/i.test(item.status || "")).length;
    const ended = events.filter((item) => /finished|after|ended|ft/i.test(item.status || "")).length;
    const leagues = new Set(events.map((item) => item.league || item.category).filter(Boolean)).size;
    metrics.innerHTML = `<span><b>${events.length}</b><small>Gunluk etkinlik</small></span><span class="is-live"><b>${live}</b><small>Canli</small></span><span><b>${ended}</b><small>Tamamlanan</small></span><span><b>${leagues}</b><small>Lig / organizasyon</small></span>`;
  }

  function refreshMetrics() {
    const sport=document.getElementById("multiSportHub")?.dataset?.sport || active;
    if (!["basketball", "volleyball"].includes(sport)) return;
    const payloads=window.__XYZ_MULTISPORT_PAYLOADS__;
    const payload=payloads instanceof Map ? payloads.get(sport) : null;
    if(payload) renderMetrics(payload,sport);
  }

  function mount() {
    const header = document.querySelector(".global-header");
    if (!header) return;
    const miniGame = document.getElementById("miniGoalGame");
    if (miniGame && active !== "football") miniGame.remove();
    const nav = document.createElement("nav");
    nav.className = "sport-branch-nav sport-branch-nav-compact";
    nav.setAttribute("aria-label", "Spor branslari");
    nav.innerHTML = `<div class="sport-branch-main">
      ${primary.map(([key, label, url]) => `<button class="sport-branch-button ${key === active ? "active" : ""}" data-branch="${key}" data-url="${url}">${label}</button>`).join("")}
      <button class="sport-branch-button sport-predict-button" data-action="predict">Predict</button>
    </div>`;
    header.after(nav);

    nav.querySelectorAll("[data-url]").forEach((button) => {
      button.addEventListener("click", () => location.assign(button.dataset.url));
    });
    nav.querySelector("[data-action='predict']")?.addEventListener("click", () => {
      const existing = [...document.querySelectorAll(".primary-nav .maintab")].find((item) => /predict/i.test(item.textContent));
      if (existing) existing.click();
      else location.assign("/predict/");
    });
    if (active !== "football" && active !== "motorsports") setTimeout(refreshMetrics);
  }

  window.addEventListener("xyz:multisport-payload", (event) => {
    const sport=event?.detail?.sport;
    const current=document.getElementById("multiSportHub")?.dataset?.sport || active;
    if(sport===current) renderMetrics(event.detail.payload,sport);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
