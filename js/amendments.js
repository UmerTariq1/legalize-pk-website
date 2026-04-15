/* amendments.html logic: render archive + era filters. */

(function () {
  function eraFromDate(isoDate) {
    if (!isoDate) return "modern";
    const y = parseInt(String(isoDate).slice(0, 4), 10);
    if (Number.isNaN(y)) return "modern";
    if (y >= 1974 && y <= 1977) return "bhutto";
    if (y >= 1985 && y <= 1987) return "zia";
    if (y >= 1991 && y <= 1999) return "democratic";
    if (y === 2003) return "musharraf";
    return "modern";
  }

  function eraLabel(era) {
    const labels = { bhutto: "Bhutto Era", zia: "Zia Era", democratic: "Democratic Era", musharraf: "Musharraf Era", modern: "Modern Era" };
    return labels[era] || "Modern Era";
  }

  function oneLineFallback(a) {
    if (a.number === 0) return "Original enactment of the 1973 Constitution.";
    if (a.number === 18) return "A landmark reform package strengthening parliamentary democracy and provinces.";
    if (a.number === 25) return "Merged FATA with Khyber Pakhtunkhwa, mainstreaming representation and governance.";
    if (a.number === 21) return "Enabled time-bound military courts for certain terrorism-related cases.";
    return "Constitutional amendment with targeted changes to governance and institutions.";
  }

  function articlesAffectedFallback(a) {
    // Only used when the API-returned count is null (e.g. fetch failed).
    if (a.number === 18) return 100;
    if (a.number === 8) return 30;
    if (a.number === 25) return 15;
    if (a.number === 26 || a.number === 27) return 20;
    return null; // Unknown — do not display a made-up number
  }

  // Extract usable summary text from markdown — more lenient than history.js version.
  function extractSummaryText(md) {
    if (!md) return null;
    const lines = String(md).split("\n").map((l) => l.trim()).filter(Boolean);
    // Try to find a plain paragraph first (no markdown prefix).
    const plain = lines.find((l) => !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("|") && !l.startsWith("---"));
    if (plain) {
      // Strip leading bullet/dash markers for cleaner display.
      return plain.replace(/^[-*•]\s+/, "");
    }
    return null;
  }

  // Match summaries to amendments by number, returning enriched amendment objects.
  function mergeSummaries(items, summaries) {
    return items.map((a) => {
      if (a.number == null) return a;
      const hit = (summaries || []).find((s) => s.number === a.number);
      if (!hit) return a;

      const text = hit.text || "";
      const summaryText = extractSummaryText(text);

      // Extract a short oneLine from first non-heading line, and longer summary from next paragraph.
      const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.replace(/^#+\s*/, "").trim())
        .filter((p) => p && !p.startsWith("|") && !p.startsWith("---"))
        .map((p) => p.replace(/^[-*•]\s+/, ""));

      const oneLine = paragraphs[0] || summaryText || null;
      const summary = paragraphs[1] || summaryText || null;

      return { ...a, oneLine, summary };
    });
  }

  function renderCard(a) {
    const card = document.createElement("article");
    card.className = "amendment-card";
    const era = eraFromDate(a.assentDate);
    card.dataset.era = era;

    const head = document.createElement("div");
    head.className = "amendment-card__head";
    head.tabIndex = 0;
    head.setAttribute("role", "button");
    head.setAttribute("aria-expanded", "false");

    // Amendment number badge — dominant visual element
    const numBadge = document.createElement("div");
    numBadge.className = "amendment-card__num";
    if (a.number != null && a.number > 0) {
      numBadge.textContent = `#${a.number}`;
    } else if (a.number === 0) {
      numBadge.textContent = "OG";
    } else {
      numBadge.textContent = "—";
    }

    const left = document.createElement("div");
    left.className = "amendment-card__left";

    const title = document.createElement("div");
    title.className = "amendment-card__title";
    title.textContent = a.name;
    const meta = document.createElement("div");
    meta.className = "amendment-card__meta";
    const dateStr = window.UI?.formatDateLong?.(a.assentDate) || a.assentDate || "—";
    // Always use the actual president name from commit data. Never fall back to era labels.
    const presidentStr = a.president ? ` · ${a.president}` : "";
    meta.textContent = `${dateStr}${presidentStr}`;
    meta.title = a.president ? `President: ${a.president}` : "";
    left.appendChild(title);
    left.appendChild(meta);

    const tags = document.createElement("div");
    tags.className = "amendment-card__tags";

    const pillEra = document.createElement("div");
    pillEra.className = "pill";
    pillEra.textContent = eraLabel(era);

    const pillAffected = document.createElement("div");
    pillAffected.className = "pill gold";
    const affected = a.articlesAffected ?? articlesAffectedFallback(a);
    // Only show the pill if we have a real count (not null/undefined).
    if (affected != null) {
      pillAffected.textContent = `${affected} article${affected === 1 ? "" : "s"}`;
    } else {
      pillAffected.textContent = "—";
      pillAffected.title = "Article count unavailable";
    }

    tags.appendChild(pillEra);
    tags.appendChild(pillAffected);

    // Expand chevron indicator
    const chevron = document.createElement("div");
    chevron.className = "amendment-card__chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "▾";

    head.appendChild(numBadge);
    head.appendChild(left);
    head.appendChild(tags);
    head.appendChild(chevron);

    const body = document.createElement("div");
    body.className = "amendment-card__body";
    body.hidden = true;

    const oneLine = a.oneLine || oneLineFallback(a);
    const summaryText = a.summary || "Detailed summary information is sourced live from the repository amendment files.";

    const p1 = document.createElement("p");
    p1.className = "amendment-card__oneline";
    p1.textContent = oneLine;
    body.appendChild(p1);

    if (a.summary) {
      const p2 = document.createElement("p");
      p2.className = "amendment-card__summary";
      p2.textContent = summaryText;
      body.appendChild(p2);
    }

    // Navigation buttons inside the collapsible
    const navRow = document.createElement("div");
    navRow.className = "amendment-card__nav";

    const historyBtn = document.createElement("a");
    historyBtn.className = "btn btn-ghost btn-sm";
    historyBtn.href = `explorer.html?mode=history`;
    historyBtn.title = "Open Article Explorer to view history for any article affected by this amendment";
    historyBtn.textContent = "Browse Articles →";

    const compareBtn = document.createElement("a");
    compareBtn.className = "btn btn-primary btn-sm";
    compareBtn.href = `explorer.html?mode=compare`;
    compareBtn.title = "Open Article Explorer to compare any article before and after this amendment";
    compareBtn.textContent = "Compare Versions →";

    navRow.appendChild(historyBtn);
    navRow.appendChild(compareBtn);
    body.appendChild(navRow);

    const toggle = () => {
      const open = body.hidden;
      body.hidden = !open;
      head.setAttribute("aria-expanded", open ? "true" : "false");
      chevron.style.transform = open ? "rotate(180deg)" : "";
      chevron.style.transition = "transform 250ms ease";
      if (typeof window.LPK?.ui === "function") window.LPK.ui("amendments: card " + (open ? "expand" : "collapse"), { name: a.name });
    };
    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  function applyFilter(era) {
    const cards = document.querySelectorAll(".amendment-card");
    let visible = 0;
    for (const c of cards) {
      const show = era === "all" || c.dataset.era === era;
      c.style.display = show ? "" : "none";
      if (show) visible++;
    }

    let emptyEl = document.getElementById("amendmentCardsEmpty");
    if (!visible) {
      if (!emptyEl) {
        emptyEl = document.createElement("div");
        emptyEl.id = "amendmentCardsEmpty";
        emptyEl.className = "empty-state";
        emptyEl.innerHTML = `<div class="empty-state__icon">○</div><div class="empty-state__title">No amendments in this era</div><div class="empty-state__text">Try selecting a different era filter above.</div>`;
        document.getElementById("amendmentCards")?.appendChild(emptyEl);
      }
      emptyEl.hidden = false;
    } else if (emptyEl) {
      emptyEl.hidden = true;
    }
  }

  function wireFilters() {
    const btns = document.querySelectorAll(".filter-btn");
    for (const b of btns) {
      b.addEventListener("click", () => {
        for (const x of btns) x.classList.toggle("is-active", x === b);
        if (typeof window.LPK?.ui === "function") window.LPK.ui("amendments: filter", { era: b.dataset.era });
        applyFilter(b.dataset.era);
      });
    }
  }

  async function init() {
    const wrap = document.getElementById("amendmentCards");
    if (!wrap) return;

    wrap.innerHTML = `<div class="loading-row"><span class="spinner"></span> Loading amendments…</div>`;

    let items;
    let summaries = [];

    try {
      // Load amendments and summaries in parallel.
      [items, summaries] = await Promise.all([
        window.Api.listAmendments(),
        window.Api.listAmendmentSummaries?.().catch(() => []) ?? Promise.resolve([]),
      ]);
    } catch (err) {
      console.error("[legalize-pk] amendments: failed to load", err);
      wrap.innerHTML = `
        <div class="error-state">
          <span class="error-state__icon">!</span>
          <div class="error-state__body">
            <div class="error-state__title">Could not load amendments</div>
            <div class="error-state__text">${err?.message || "Failed to connect to the repository. Please refresh or try again."}</div>
          </div>
        </div>`;
      return;
    }

    wrap.innerHTML = "";

    if (!items?.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">○</div>
          <div class="empty-state__title">No amendments found</div>
          <div class="empty-state__text">The repository does not appear to contain any amendment commits yet.</div>
        </div>`;
      return;
    }

    // Chronological order, then merge summaries.
    items.sort((a, b) => new Date(a.assentDate).getTime() - new Date(b.assentDate).getTime());
    const enriched = mergeSummaries(items, summaries);

    for (const a of enriched) wrap.appendChild(renderCard(a));
    if (typeof window.LPK?.ui === "function") window.LPK.ui("amendments: loaded", { count: items.length });
    wireFilters();
    applyFilter("all");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
