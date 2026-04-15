/* compare.html logic: render diff in side-by-side and unified modes. */

(function () {
  function isMobileDefault() {
    return window.matchMedia && window.matchMedia("(max-width: 860px)").matches;
  }

  function showError(message) {
    const loading = document.getElementById("diffLoading");
    const shell = document.querySelector(".diff-shell");
    const errorHtml = `
      <div class="error-state" style="margin: 18px;">
        <span class="error-state__icon">!</span>
        <div class="error-state__body">
          <div class="error-state__title">Could not load comparison</div>
          <div class="error-state__text">${message || "An unexpected error occurred. Please go back and try again."}</div>
        </div>
      </div>`;
    if (loading) {
      loading.innerHTML = errorHtml;
    } else if (shell) {
      shell.innerHTML = errorHtml;
    }
  }

  async function resolveBeforeSha(afterSha, beforeSha) {
    if (beforeSha) return beforeSha;
    const amendments = await window.Api.listAmendments();
    const idx = (amendments || []).findIndex((a) => a.sha === afterSha);
    if (idx <= 0) return null;
    return amendments[idx - 1]?.sha || null;
  }

  function setView(view) {
    const panels = document.getElementById("diffPanels");
    const unified = document.getElementById("diffUnified");
    const btns = document.querySelectorAll(".toggle-btn");

    for (const b of btns) b.classList.toggle("is-active", b.getAttribute("data-view") === view);

    if (view === "unified") {
      if (panels) panels.hidden = true;
      if (unified) unified.hidden = false;
    } else {
      if (panels) panels.hidden = false;
      if (unified) unified.hidden = true;
    }
  }

  function wireToggle() {
    const btns = document.querySelectorAll(".toggle-btn");
    for (const b of btns) {
      b.addEventListener("click", () => {
        const view = b.getAttribute("data-view");
        if (typeof window.LPK?.ui === "function") window.LPK.ui("compare: view toggle", { view });
        setView(view);
      });
    }
  }

  function wireCopyLink() {
    const btn = document.getElementById("copyLinkBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (typeof window.LPK?.ui === "function") window.LPK.ui("compare: copy link");
      try {
        await navigator.clipboard.writeText(window.location.href);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy Link"), 1400);
      } catch {
        alert("Copy failed. You can copy from the address bar instead.");
      }
    });
  }

  function setHeading(article, afterSha) {
    const h = document.getElementById("compareHeading");
    if (!h) return;
    const n = parseInt(article, 10);
    const short = afterSha ? afterSha.slice(0, 7) : "—";
    h.textContent = `Comparing Article ${n}: Before & After ${short}`;
  }

  function setLastModified(afterSha) {
    const el = document.getElementById("lastModified");
    if (!el) return;
    el.textContent = afterSha ? afterSha.slice(0, 7) : "—";
    window.Api.listAmendments()
      .then((list) => {
        const hit = (list || []).find((a) => a.sha === afterSha);
        if (hit?.assentDate) el.textContent = window.UI?.formatDateLong?.(hit.assentDate) || hit.assentDate;
        const heading = document.getElementById("compareHeading");
        const articleParam = window.UI.qs("article");
        if (heading && hit?.name) {
          heading.textContent = `Comparing Article ${parseInt(articleParam, 10)}: Before & After ${hit.name}`;
          // Also update page title with amendment name
          document.title = `Article ${parseInt(articleParam, 10)} vs ${hit.name} — legalize-pk`;
        }
      })
      .catch(() => {});
  }

  async function init() {
    const article = (window.UI?.qs?.("article") || "").padStart(3, "0");
    const after = window.UI?.qs?.("after");
    let before = window.UI?.qs?.("before");

    if (typeof window.LPK?.ui === "function") window.LPK.ui("compare: load", { article, after: after?.slice(0, 7), before: before?.slice(0, 7) });

    if (!article || article === "000" || !after) {
      showError("Missing required parameters. Please go back to the Explorer and select an article and amendment to compare.");
      return;
    }

    // Set an initial dynamic title; will be updated once amendment name resolves
    const articleNum = parseInt(article, 10);
    document.title = `Article ${articleNum} Comparison — legalize-pk`;

    // Show spinner while loading
    const loadingEl = document.getElementById("diffLoading");
    if (loadingEl) {
      loadingEl.innerHTML = `<span class="spinner"></span> Loading comparison…`;
    }

    before = await resolveBeforeSha(after, before).catch(() => null);

    setHeading(article, after);
    setLastModified(after);
    wireToggle();
    wireCopyLink();

    setView(isMobileDefault() ? "unified" : "side-by-side");

    let patch = null;
    try {
      if (before) {
        const cmp = await window.Api.compareArticleBetween(article, before, after);
        patch = cmp?.patch || (cmp?.files || [])[0]?.patch || null;
      }
    } catch (err) {
      console.error("[legalize-pk] compare: failed to fetch diff", err);
      showError(err?.message || "Could not fetch the comparison data from GitHub.");
      return;
    }

    if (loadingEl) loadingEl.remove();

    const panels = document.getElementById("diffPanels");
    const beforePanel = document.getElementById("beforePanel");
    const afterPanel = document.getElementById("afterPanel");
    const unified = document.getElementById("diffUnified");

    const headerPath = `federal-constitution/article-${article}.md`;

    // If GitHub compare omits a patch (unchanged file), generate from file contents.
    if (!patch) {
      let beforeText = "";
      let afterText = "";
      try {
        beforeText = before ? await window.Api.getArticleAtSha(article, before) : "";
        afterText = await window.Api.getArticleAtSha(article, after);
      } catch (err) {
        console.error("[legalize-pk] compare: failed to fetch article content", err);
        showError("Could not fetch article content to generate comparison.");
        return;
      }

      if (beforeText === afterText) {
        if (unified) unified.innerHTML = `<div class="diff-loading">No changes found in this article for the selected amendment.</div>`;
        if (panels) panels.hidden = true;
        setView("unified");
        return;
      }
      patch = window.DiffRenderer.makePatchFromTexts(beforeText, afterText, headerPath);
    }

    const { beforeHtml, afterHtml } = window.DiffRenderer.renderSideBySideHtml(patch);
    if (beforePanel) beforePanel.innerHTML = beforeHtml;
    if (afterPanel) afterPanel.innerHTML = afterHtml;
    if (panels) panels.hidden = false;

    if (unified) unified.innerHTML = window.DiffRenderer.renderUnifiedHtml(patch);
    if (typeof window.Animations?.animateDiffLines === "function") window.Animations.animateDiffLines(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
