// Central configuration. Do not hardcode owner/name anywhere else.
// Logging: on localhost logs by default; use ?lpk_debug=0 to silence, ?lpk_debug=1 to force on any host.
// Persist: localStorage.setItem("lpk_debug", "1")

(function () {
  const params = new URLSearchParams(window.location.search);
  const forceOff = params.get("lpk_debug") === "0";
  const forceOn = params.get("lpk_debug") === "1";
  const stored = localStorage.getItem("lpk_debug") === "1";
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  window.LPK_DEBUG = !forceOff && (forceOn || stored || isLocal);

  window.LPK = {
    enabled: function () {
      return Boolean(window.LPK_DEBUG);
    },
    ui: function (msg, detail) {
      if (!window.LPK_DEBUG) return;
      if (detail !== undefined) console.log("[legalize-pk][ui]", msg, detail);
      else console.log("[legalize-pk][ui]", msg);
    },
    api: function (msg, detail) {
      if (!window.LPK_DEBUG) return;
      if (detail !== undefined) console.log("[legalize-pk][api]", msg, detail);
      else console.log("[legalize-pk][api]", msg);
    },
  };
})();

(function () {
  // Live GitHub data for legalize-pk. Override only here.
  const DEFAULTS = {
    REPO_OWNER: "UmerTariq1",
    REPO_NAME: "legalize-pk",
  };

  const params = new URLSearchParams(window.location.search);

  window.APP_CONFIG = {
    REPO_OWNER: DEFAULTS.REPO_OWNER,
    REPO_NAME: DEFAULTS.REPO_NAME,
  };

  if (window.LPK?.enabled?.()) {
    window.LPK.ui("config", { repo: `${window.APP_CONFIG.REPO_OWNER}/${window.APP_CONFIG.REPO_NAME}`, path: location.pathname + location.search });
  }
})();

