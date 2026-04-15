/* timeline.html logic: visual chronological amendment timeline. */

(function () {
  function ordinalLabel(n) {
    if (!n || n === 0) return "Original";
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]} Amendment`;
  }

  function renderTimeline(items) {
    const root = document.getElementById("timelineRoot");
    if (!root) return;
    root.innerHTML = "";

    // Group amendments by year for year markers.
    let lastYear = null;

    const wrap = document.createElement("div");
    wrap.className = "amend-timeline";

    const line = document.createElement("div");
    line.className = "amend-timeline__line";
    line.setAttribute("aria-hidden", "true");
    wrap.appendChild(line);

    // Filter to only real amendments (non-null date).
    const amendments = items.filter((a) => a.assentDate);

    if (!amendments.length) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">○</div>
          <div class="empty-state__title">No amendments found</div>
          <div class="empty-state__text">The repository does not appear to contain any amendment commits yet.</div>
        </div>`;
      return;
    }

    // Track amendment index separately from DOM child index so year markers
    // don't break the odd/even alternation.
    let amendmentIndex = 0;

    amendments.forEach((a) => {
      const year = a.assentDate?.slice(0, 4);

      // Year marker when year changes.
      if (year && year !== lastYear) {
        lastYear = year;
        const marker = document.createElement("div");
        marker.className = "amend-year-marker";
        marker.innerHTML = `<span class="amend-year-marker__label">📅 ${year}</span>`;
        wrap.appendChild(marker);
      }

      // Odd index (0, 2, 4…) → left side; even index (1, 3, 5…) → right side.
      const isLeft = amendmentIndex % 2 === 0;
      amendmentIndex++;

      const entry = document.createElement("div");
      entry.className = isLeft ? "amend-entry amend-entry--left" : "amend-entry amend-entry--right";

      // Dot in the centre
      const dotWrap = document.createElement("div");
      dotWrap.className = "amend-entry__dot-wrap";
      dotWrap.setAttribute("aria-hidden", "true");

      const dot = document.createElement("div");
      dot.className = "amend-entry__dot";
      dot.textContent = a.number != null ? `#${a.number}` : "—";
      dotWrap.appendChild(dot);

      // Info card
      const info = document.createElement("div");
      info.className = "amend-entry__info";

      const numEl = document.createElement("div");
      numEl.className = "amend-entry__num";
      numEl.textContent = a.number != null && a.number > 0 ? `#${a.number}` : "Original";

      const nameEl = document.createElement("div");
      nameEl.className = "amend-entry__name";
      nameEl.textContent = a.name || ordinalLabel(a.number);

      const dateEl = document.createElement("div");
      dateEl.className = "amend-entry__date";
      dateEl.textContent = window.UI?.formatDateLong?.(a.assentDate) || a.assentDate || "—";

      const presidentEl = document.createElement("div");
      presidentEl.className = "amend-entry__president";
      presidentEl.textContent = a.president ? `Under ${a.president}` : "";

      // Link to explorer
      const link = document.createElement("a");
      link.className = "amend-entry__link";
      link.href = `explorer.html?mode=history`;
      link.textContent = "View in Explorer →";

      info.appendChild(numEl);
      info.appendChild(nameEl);
      info.appendChild(dateEl);
      if (a.president) info.appendChild(presidentEl);
      info.appendChild(link);

      // Spacer (empty cell for alternating layout)
      const spacer = document.createElement("div");
      spacer.className = "amend-entry__spacer";

      // Left entries: info | dot | spacer
      // Right entries: spacer | dot | info
      if (isLeft) {
        entry.appendChild(info);
        entry.appendChild(dotWrap);
        entry.appendChild(spacer);
      } else {
        entry.appendChild(spacer);
        entry.appendChild(dotWrap);
        entry.appendChild(info);
      }

      wrap.appendChild(entry);
    });

    root.appendChild(wrap);
  }

  async function init() {
    const root = document.getElementById("timelineRoot");
    if (!root) return;

    try {
      const items = await window.Api.listAmendments();
      // Chronological, oldest first.
      items.sort((a, b) => {
        if (!a.assentDate && !b.assentDate) return 0;
        if (!a.assentDate) return 1;
        if (!b.assentDate) return -1;
        return new Date(a.assentDate).getTime() - new Date(b.assentDate).getTime();
      });
      renderTimeline(items);
    } catch (err) {
      console.error("[legalize-pk] timeline: failed to load", err);
      root.innerHTML = `
        <div class="error-state">
          <span class="error-state__icon">!</span>
          <div class="error-state__body">
            <div class="error-state__title">Could not load amendments</div>
            <div class="error-state__text">${err?.message || "Failed to connect to the repository. Please refresh or try again."}</div>
          </div>
        </div>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
