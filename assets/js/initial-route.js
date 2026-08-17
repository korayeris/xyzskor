(function () {
  "use strict";
  try {
    var route = new URLSearchParams(location.search);
    if (route.get("fixture") && route.get("view") !== "home") document.body.classList.add("matchday-detail-open");
  } catch (_) {}
})();
