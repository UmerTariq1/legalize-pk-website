/* history.html logic: vertical timeline with collapsible diffs + floating sidebar summary. */

(function () {
  async function buildTimelineEntries(article) {
    const commits = await window.Api.listCommitsForArticle(article);
    const list = (commits || []).map((c) => ({
      sha: c.sha,
      title: c.commit?.message?.split("\n")[0] || c.sha,
      date: c.commit?.author?.date || c.commit?.committer?.date || null,
    }));

    const entries = [];
    for (let i = 0; i < list.length; i++) {
      const after = list[i].sha;
      const before = list[i + 1]?.sha || null;
      let patch = null;
      if (before) {
        const cmp = await window.Api.compareArticleBetween(article, before, after);
        patch = cmp?.patch || (cmp?.files || [])[0]?.patch || null;
      } else {
        // Oldest entry: show full initial text as additions.
        const text = await window.Api.getArticleAtSha(article, after);
        patch =
          `--- a/federal-constitution/article-${article}.md\n` +
          `+++ b/federal-constitution/article-${article}.md\n` +
          `@@ -0,0 +1,${String(text).split("\n").length} @@\n` +
          String(text)
            .split("\n")
            .map((l) => `+${l}`)
            .join("\n");
      }
      entries.push({
        kind: "live",
        sha: after,
        before,
        after,
        date: list[i].date,
        title: list[i].title,
        patch,
        amendmentKey: null,
      });
    }

    return entries;
  }

  function extractAmendmentNumberFromTitle(title) {
    if (window.Api?.amendmentNumberFromCommitMessage) {
      return window.Api.amendmentNumberFromCommitMessage(title);
    }
    const m = String(title || "").match(/(\d+)(st|nd|rd|th)\b/i);
    return m ? parseInt(m[1], 10) : null;
  }

  // Improved: try plain paragraphs first, fall back to bullet/list lines.
  function firstParagraphFromMarkdown(md) {
    const lines = String(md || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // First pass: prefer a non-markdown-prefixed line.
    const plain = lines.find((l) => l && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("|") && !l.startsWith("---"));
    if (plain) {
      // Strip leading bullet/dash markers.
      return plain.replace(/^[-*•]\s+/, "");
    }

    // Second pass: accept bullet lines if nothing else is available.
    const bullet = lines.find((l) => l.startsWith("-") || l.startsWith("*") || l.startsWith("•"));
    if (bullet) return bullet.replace(/^[-*•]\s+/, "");

    return null;
  }

  // Render timeline stats card into the provided container element.
  function renderStatsCard(entries, container) {
    if (!container || !entries?.length) return;

    const total = entries.length;

    // entries are newest-first (GitHub API order).
    // The original commit has before === null (it has no parent).
    // "First Amended" = oldest non-original entry = last amendment before the original.
    // "Last Changed"  = newest entry = entries[0].
    //
    // Sort all dates oldest→newest for reliable min/max.
    const allDates = entries.map((e) => e.date).filter(Boolean).sort();

    // Non-original entries (entries where before !== null have a parent, meaning they're amendments).
    const amendmentDates = entries
      .filter((e) => e.before !== null)
      .map((e) => e.date)
      .filter(Boolean)
      .sort();

    // Oldest amendment date (first real amendment after the original commit).
    const firstAmended = amendmentDates[0] || null;
    // Most recent commit date (newest regardless of type).
    const lastChanged = allDates[allDates.length - 1] || null;

    const fmt = (d) => window.UI?.formatDateLong?.(d?.slice(0, 10)) || d || "—";

    container.innerHTML = `
      <div class="stats-card">
        <div class="stats-card__title">
          <span class="stats-card__icon" aria-hidden="true">📊</span>
          Timeline Stats
        </div>
        <div class="stats-card__grid">
          <div class="stats-card__item">
            <div class="stats-card__label">Total Revisions</div>
            <div class="stats-card__value">${total}</div>
          </div>
          <div class="stats-card__item">
            <div class="stats-card__label">First Amended</div>
            <div class="stats-card__value">${fmt(firstAmended)}</div>
          </div>
          <div class="stats-card__item">
            <div class="stats-card__label">Last Changed</div>
            <div class="stats-card__value">${fmt(lastChanged)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function showError(message) {
    const timeline = document.getElementById("timeline");
    const loading = document.getElementById("timelineLoading");
    if (loading) loading.remove();
    if (!timeline) return;
    timeline.innerHTML = `
      <div class="error-state">
        <span class="error-state__icon">!</span>
        <div class="error-state__body">
          <div class="error-state__title">Failed to load timeline</div>
          <div class="error-state__text">${message || "An unexpected error occurred. Please refresh or try again."}</div>
        </div>
      </div>`;
  }

  function showEmpty() {
    const timeline = document.getElementById("timeline");
    const loading = document.getElementById("timelineLoading");
    if (loading) loading.remove();
    if (!timeline) return;
    timeline.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">○</div>
        <div class="empty-state__title">No history found</div>
        <div class="empty-state__text">This article has no recorded amendments in the repository.</div>
      </div>`;
  }

  function renderTimeline(entries, summariesPromise) {
    const timeline = document.getElementById("timeline");
    const loading = document.getElementById("timelineLoading");
    if (!timeline) return;
    if (loading) loading.remove();

    // Add alternating class to timeline container for CSS layout
    timeline.classList.add("timeline--alternating");

    entries.forEach((e, idx) => {
      const isFirst = idx === 0;
      // Alternate: even index → left side, odd index → right side
      const isLeft = idx % 2 === 0;

      const row = document.createElement("div");
      row.className = "timeline-row" + (isLeft ? " timeline-row--left" : " timeline-row--right");

      // Center dot
      const dotWrap = document.createElement("div");
      dotWrap.className = "timeline-dot-wrap";

      const dot = document.createElement("div");
      dot.className = "timeline-dot pulse-dot";
      if (isFirst) dot.classList.add("timeline-dot--current");
      dotWrap.appendChild(dot);

      // Content card
      const item = document.createElement("article");
      item.className = "timeline-item";
      if (isFirst) item.classList.add("is-current");
      item.tabIndex = 0;
      item.dataset.sha = e.after;

      // Head (always visible)
      const head = document.createElement("div");
      head.className = "timeline-head";

      const date = document.createElement("div");
      date.className = "timeline-date";
      date.textContent = window.UI?.formatDateLong?.(e.date) || String(e.date || "—");

      const title = document.createElement("div");
      title.className = "timeline-title";
      title.textContent = e.title;

      head.appendChild(date);
      head.appendChild(title);

      if (isFirst) {
        const badge = document.createElement("div");
        badge.className = "badge badge-current";
        badge.textContent = "CURRENT";
        head.appendChild(badge);
      }

      // Meta row (hash + toggle button — always visible)
      const meta = document.createElement("div");
      meta.className = "timeline-meta";

      const hash = document.createElement("div");
      hash.className = "hash";
      hash.textContent = String(e.after || "").slice(0, 7);
      meta.appendChild(hash);

      // Toggle button
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "timeline-toggle" + (isFirst ? " is-open" : "");
      toggleBtn.type = "button";
      toggleBtn.setAttribute("aria-expanded", isFirst ? "true" : "false");
      toggleBtn.innerHTML = `<em class="timeline-toggle__chevron" aria-hidden="true">▾</em>${isFirst ? "Hide diff" : "Show diff"}`;
      meta.appendChild(toggleBtn);

      // Collapsible body (diff + actions)
      const body = document.createElement("div");
      body.className = "timeline-body";
      if (!isFirst) body.hidden = true;

      // Diff
      const diffWrap = document.createElement("div");
      diffWrap.innerHTML = window.DiffRenderer.renderUnifiedHtml(e.patch);
      body.appendChild(diffWrap.firstElementChild || diffWrap);

      // Actions
      const actions = document.createElement("div");
      actions.className = "timeline-actions";
      if (e.before) {
        const a = document.createElement("a");
        a.className = "btn btn-ghost btn-sm";
        a.href = `compare.html?article=${encodeURIComponent(window.UI.qs("article"))}&before=${encodeURIComponent(e.before)}&after=${encodeURIComponent(e.after)}`;
        a.textContent = "Compare with Previous →";
        actions.appendChild(a);
      }
      if (actions.childNodes.length) body.appendChild(actions);

      // Toggle logic
      toggleBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const open = body.hidden;
        body.hidden = !open;
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
        toggleBtn.classList.toggle("is-open", open);
        toggleBtn.innerHTML = `<em class="timeline-toggle__chevron" aria-hidden="true">▾</em>${open ? "Hide diff" : "Show diff"}`;
        if (open) updateSummary();
      });

      // Sidebar summary on hover/focus of whole item
      const updateSummary = () => {
        const titleEl = document.getElementById("summaryTitle");
        const metaEl = document.getElementById("summaryMeta");
        const bodyEl = document.getElementById("summaryBody");
        if (!titleEl || !metaEl || !bodyEl) return;

        titleEl.textContent = e.title;
        metaEl.textContent = window.UI?.formatDateLong?.(e.date) || "—";
        bodyEl.textContent = "Loading summary…";

        const n = extractAmendmentNumberFromTitle(e.title);
        if (!summariesPromise || n == null) {
          bodyEl.textContent = "No summary available for this entry.";
          return;
        }

        summariesPromise.then((items) => {
          const hit = (items || []).find((x) => x.number === n);
          const text = firstParagraphFromMarkdown(hit?.text);
          bodyEl.textContent = text || "No summary available for this entry.";
        });
      };

      item.addEventListener("mouseenter", updateSummary);
      item.addEventListener("focus", updateSummary);

      // Assemble item
      item.appendChild(head);
      item.appendChild(meta);
      item.appendChild(body);

      // Assemble row: content left | dot center | spacer right (or spacer | dot | content)
      const spacer = document.createElement("div");
      spacer.className = "timeline-spacer";

      if (isLeft) {
        row.appendChild(item);
        row.appendChild(dotWrap);
        row.appendChild(spacer);
      } else {
        row.appendChild(spacer);
        row.appendChild(dotWrap);
        row.appendChild(item);
      }

      timeline.appendChild(row);
    });
  }

  async function init() {
    const article = (window.UI?.qs?.("article") || "").padStart(3, "0");
    const focus = window.UI?.qs?.("focus");
    if (!article || article === "000") {
      showError("No article specified. Please go back and select an article.");
      return;
    }

    const articleNum = parseInt(article, 10);
    if (typeof window.LPK?.ui === "function") window.LPK.ui("history: load", { article: articleNum });

    // Dynamic page title
    document.title = `Article ${articleNum} History — legalize-pk`;

    const tag = document.getElementById("articleTopicTag");
    const heading = document.getElementById("historyHeading");
    const subtitle = document.getElementById("historySubtitle");
    if (tag) tag.textContent = `ARTICLE ${articleNum}`;
    if (heading) heading.textContent = `History of Article ${articleNum}`;
    if (subtitle) subtitle.textContent = `All recorded amendments to Article ${articleNum}, from 1973 to present.`;

    // Show spinner in loading state
    const loadingEl = document.getElementById("timelineLoading");
    if (loadingEl) {
      loadingEl.innerHTML = `<span class="spinner"></span> Loading timeline…`;
    }

    let summariesPromise = null;
    if (window.Api?.listAmendmentSummaries) {
      summariesPromise = window.Api.listAmendmentSummaries().catch(() => []);
    }

    let entries;
    try {
      entries = await buildTimelineEntries(article);
    } catch (err) {
      console.error("[legalize-pk] history: failed to build timeline", err);
      showError(err?.message || "Could not load article history from the repository.");
      return;
    }

    if (!entries?.length) {
      showEmpty();
      return;
    }

    // Render timeline stats card.
    const statsContainer = document.getElementById("timelineStatsContainer");
    renderStatsCard(entries, statsContainer);

    renderTimeline(entries, summariesPromise);

    if (typeof window.Animations?.animateTimeline === "function") window.Animations.animateTimeline();
    if (typeof window.Animations?.animateDiffLines === "function") window.Animations.animateDiffLines(document);

    if (focus) {
      const hit = document.querySelector(`.timeline-item[data-sha="${CSS.escape(focus)}"]`);
      if (hit) {
        const body = hit.querySelector(".timeline-body");
        const toggleBtn = hit.querySelector(".timeline-toggle");
        if (body && body.hidden) {
          body.hidden = false;
          if (toggleBtn) {
            toggleBtn.setAttribute("aria-expanded", "true");
            toggleBtn.classList.add("is-open");
            toggleBtn.innerHTML = `<em class="timeline-toggle__chevron" aria-hidden="true">▾</em>Hide diff`;
          }
        }
        hit.classList.add("is-focused");
        // Scroll the parent row into view
        const row = hit.closest(".timeline-row") || hit;
        row.scrollIntoView({ block: "start", behavior: "smooth" });
        hit.dispatchEvent(new Event("focus"));
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
