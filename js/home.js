/* index.html page logic */

(function () {
  function init() {
    // Reserved for future enhancements; shared wiring is in js/ui.js.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

