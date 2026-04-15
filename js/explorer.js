/* explorer.html logic: mode-aware selectors and routing. */

(function () {
  function setModeCopy(mode) {
    const labelEl = document.querySelector("[data-mode-label]");
    const kickerEl = document.querySelector("[data-mode-kicker]");
    const titleEl = document.querySelector("[data-mode-title]");
    const subtitleEl = document.querySelector("[data-mode-subtitle]");

    const map = {
      "last-changed": {
        label: "Last Changed",
        title: "Find the latest change",
        subtitle: "Select an article to jump directly to its most recent amendment.",
      },
      history: {
        label: "Article History",
        title: "Browse article history",
        subtitle: "Select an article to view every amendment that touched it, from 1973 to present.",
      },
      compare: {
        label: "Compare",
        title: "Compare before & after",
        subtitle: "Select an article and an amendment to generate a legislative comparison.",
      },
    };

    const c = map[mode] || {
      label: "Explorer",
      title: "Explorer",
      subtitle: "Select an objective, then choose an article to continue.",
    };

    if (labelEl) labelEl.textContent = c.label;
    if (kickerEl) kickerEl.textContent = "CONSTITUTIONAL EXPLORER";
    if (titleEl) titleEl.textContent = c.title;
    if (subtitleEl) subtitleEl.textContent = c.subtitle;
  }

  function showModePickerIfNeeded(mode) {
    const modePicker = document.getElementById("modePicker");
    const form = document.getElementById("explorerForm");
    if (!mode) {
      if (modePicker) modePicker.hidden = false;
      if (form) form.hidden = true;
      return true;
    }
    if (modePicker) modePicker.hidden = true;
    if (form) form.hidden = false;
    return false;
  }

  function showArticleLoadingSpinner(select) {
    select.innerHTML = `<option value="" selected disabled>Loading articles…</option>`;
  }

  async function populateArticles() {
    const select = document.getElementById("articleSelect");
    if (!select) return;
    showArticleLoadingSpinner(select);
    try {
      const articles = await window.Api.listArticles();
      if (!articles?.length) {
        select.innerHTML = `<option value="" selected disabled>No articles found</option>`;
        return;
      }
      select.innerHTML = `<option value="" selected disabled>Select an article…</option>`;
      for (const a of articles) {
        const opt = document.createElement("option");
        opt.value = a.number;
        opt.textContent = a.label || `Article ${parseInt(a.number, 10)}`;
        select.appendChild(opt);
      }
    } catch (err) {
      console.error("[legalize-pk] explorer: failed to load articles", err);
      select.innerHTML = `<option value="" selected disabled>Could not load articles — check connection</option>`;
      const help = document.getElementById("articleHelp");
      if (help) {
        help.innerHTML = `<span class="error-state__text">Failed to load article list. Please refresh or try again later.</span>`;
      }
    }
  }

  // Show a placeholder state in the amendment list (no article chosen yet).
  function showAmendmentPlaceholder() {
    const list = document.getElementById("amendmentList");
    const hidden = document.getElementById("amendmentAfterSha");
    const help = document.getElementById("amendmentHelp");
    if (list) {
      list.innerHTML = `<div class="amendment-placeholder">Select an article above to see its amendments.</div>`;
    }
    if (hidden) hidden.value = "";
    if (help) help.textContent = "Select an article first, then choose the amendment to compare.";
  }

  // Fetch commits that touched the given article and render the amendment list.
  async function populateAmendments(article) {
    const list = document.getElementById("amendmentList");
    const hidden = document.getElementById("amendmentAfterSha");
    const help = document.getElementById("amendmentHelp");
    if (!list || !hidden) return;

    list.innerHTML = `<div class="loading-row"><span class="spinner"></span> Loading amendments for this article…</div>`;
    hidden.value = "";

    let commits;
    try {
      // listCommitsForArticle returns only commits that touched this article.
      commits = await window.Api.listCommitsForArticle(article);
    } catch (err) {
      console.error("[legalize-pk] explorer: failed to load amendments for article", err);
      list.innerHTML = `<div class="error-state"><span class="error-state__icon">!</span><div class="error-state__body"><div class="error-state__title">Could not load amendments</div><div class="error-state__text">Please refresh or try again later.</div></div></div>`;
      return;
    }

    list.innerHTML = "";

    if (!commits?.length) {
      list.innerHTML = `<div class="amendment-placeholder">No amendments found for this article.</div>`;
      if (help) help.textContent = "This article has no recorded amendments in the repository.";
      return;
    }

    // Shape raw commits into display objects (newest-first from GitHub, oldest-first for display).
    const items = commits
      .map((c) => {
        const message = c?.commit?.message?.split("\n")[0] || "Amendment";
        const rawDate = c?.commit?.author?.date || c?.commit?.committer?.date || null;
        const assentDate = rawDate ? rawDate.slice(0, 10) : null;
        return { sha: c.sha, name: message, assentDate };
      })
      .reverse(); // oldest → newest so the Original appears first

    if (help) help.textContent = `${items.length} amendment${items.length === 1 ? "" : "s"} touched this article. Select one to compare.`;

    for (const a of items) {
      const el = document.createElement("div");
      el.className = "amendment-item";
      el.setAttribute("role", "option");
      el.tabIndex = 0;

      const title = document.createElement("div");
      title.className = "amendment-item__title";
      title.textContent = a.name;

      const meta = document.createElement("div");
      meta.className = "amendment-item__meta";
      meta.textContent = window.UI?.formatDateLong?.(a.assentDate) || a.assentDate || "—";

      el.appendChild(title);
      el.appendChild(meta);

      const selectIt = () => {
        for (const n of list.querySelectorAll(".amendment-item")) n.classList.remove("is-selected");
        el.classList.add("is-selected");
        hidden.value = a.sha;
        if (typeof window.LPK?.ui === "function") window.LPK.ui("explorer: amendment selected", { sha: a.sha?.slice(0, 7), name: a.name });
      };

      el.addEventListener("click", selectIt);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectIt();
        }
      });

      list.appendChild(el);
    }

    // Auto-select the first (oldest) item.
    const first = list.querySelector(".amendment-item");
    if (first) first.click();
  }

  function initSubmit(mode) {
    const form = document.getElementById("explorerForm");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const article = document.getElementById("articleSelect")?.value;
      if (!article) return;

      if (mode === "history" || mode === "last-changed") {
        if (typeof window.LPK?.ui === "function") window.LPK.ui("explorer: submit → history", { mode, article });
        window.location.href = `history.html?article=${encodeURIComponent(article)}`;
        return;
      }

      if (mode === "compare") {
        const after = document.getElementById("amendmentAfterSha")?.value;
        if (!after) {
          alert("Select an amendment first.");
          return;
        }
        if (typeof window.LPK?.ui === "function") window.LPK.ui("explorer: submit → compare", { article, after: after.slice(0, 7) });
        window.location.href = `compare.html?article=${encodeURIComponent(article)}&after=${encodeURIComponent(after)}`;
        return;
      }
    });
  }

  async function init() {
    if (!window.Api) return;

    const mode = (window.UI?.qs?.("mode") || "").trim();
    setModeCopy(mode);
    const picked = showModePickerIfNeeded(mode);
    if (typeof window.LPK?.ui === "function") window.LPK.ui("explorer: init", { mode: mode || "(pick mode)", modePicker: picked });
    if (picked) {
      const select = document.getElementById("articleSelect");
      if (select) {
        select.innerHTML = `<option value="" selected disabled>Pick a mode above, then choose an article</option>`;
      }
      return;
    }

    await populateArticles();

    const amendmentField = document.getElementById("amendmentField");
    const articleSelect = document.getElementById("articleSelect");

    // Amendment picker is only needed for compare mode.
    if (mode === "compare") {
      if (amendmentField) amendmentField.hidden = false;
      // Start with placeholder — no article chosen yet.
      showAmendmentPlaceholder();

      // Re-populate the amendment list whenever the user picks a different article.
      if (articleSelect) {
        articleSelect.addEventListener("change", () => {
          const article = articleSelect.value;
          if (article) {
            populateAmendments(article);
          } else {
            showAmendmentPlaceholder();
          }
        });
      }
    } else {
      if (amendmentField) amendmentField.hidden = true;
    }

    initSubmit(mode);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
