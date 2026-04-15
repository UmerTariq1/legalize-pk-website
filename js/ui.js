/* Shared UI utilities: links, formatting, footer year, small wiring. */

(function () {
  function getRepoUrl() {
    const cfg = window.APP_CONFIG;
    if (!cfg?.REPO_OWNER || !cfg?.REPO_NAME) return null;
    return `https://github.com/${cfg.REPO_OWNER}/${cfg.REPO_NAME}`;
  }

  function setGithubLinks() {
    const url = getRepoUrl();
    const els = document.querySelectorAll("[data-github-link]");
    for (const el of els) {
      if (!url) {
        el.setAttribute("href", "https://github.com/");
        el.setAttribute("title", "Set REPO_OWNER/REPO_NAME in js/config.js");
      } else {
        el.setAttribute("href", url);
      }
    }
  }

  function formatDateLong(isoDate) {
    if (!isoDate) return "—";
    const d = new Date(isoDate.length === 4 ? `${isoDate}-01-01` : isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "2-digit" });
  }

  function setFooterYear() {
    const year = new Date().getFullYear();
    const els = document.querySelectorAll("[data-footer-year]");
    for (const el of els) el.textContent = year;
  }

  function setLastUpdate() {
    const targets = document.querySelectorAll("[data-last-update]");
    if (!targets.length) return;
    for (const el of targets) el.textContent = "—";
    if (!window.Api?.listAmendments) return;

    window.Api.listAmendments()
      .then((items) => {
        const dates = (items || [])
          .map((x) => x?.assentDate)
          .filter(Boolean)
          .map((d) => new Date(d).getTime())
          .filter((t) => !Number.isNaN(t));
        if (!dates.length) return;
        const last = new Date(Math.max(...dates)).toISOString().slice(0, 10);
        const text = formatDateLong(last);
        for (const el of targets) el.textContent = text;
      })
      .catch((e) => {
        if (typeof window.LPK?.api === "function") window.LPK.api("lastUpdate failed", String(e?.message || e));
      });
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  window.UI = { formatDateLong, qs };

  function init() {
    setGithubLinks();
    setLastUpdate();
    setFooterYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
