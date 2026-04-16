import { loadDatasets } from "../core/data-service.js";
import { logError, logInfo } from "../core/logger.js";
import { renderMarkdown } from "../core/markdown.js";
import { hydrateIcons, routeWithId, setPageTitle } from "../core/ui-helpers.js";
import { isOmittedBody } from "../core/utils.js";
import { initSharedPage } from "./shared.js";

const expandedSet = new Set();
let allArticles = [];

function articleName(article) {
  return article.articleId === "PREAMBLE" ? "Preamble" : `Article ${article.articleId}`;
}

function matchesQuery(article, rawQuery) {
  const query = String(rawQuery || "").trim().toLowerCase();
  if (!query) {
    return true;
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  const amendmentText = [...(article.amendments || []), ...(article.amendmentLinks || [])]
    .map((entry) => `${entry?.label || ""} ${entry?.url || ""}`)
    .join(" ");

  const searchable = [article.articleId, article.displayTitle, article.fileName, article.repoPath, article.body, amendmentText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return tokens.every((token) => searchable.includes(token));
}

function renderArticleRow(article, index) {
  const open = expandedSet.has(article.articleId);
  const omitted = isOmittedBody(article.body);
  const surfaceClass = index % 2 === 0 ? "article-row--pale" : "article-row--cream";

  const amendmentSourceMarkup = (article.amendments || []).length
    ? `<div class="article-chip-grid">${article.amendments
        .map(
          (amendment) =>
            `<a class="article-chip" href="${amendment.url}" target="_blank" rel="noreferrer">${amendment.label}</a>`
        )
        .join("")}</div>`
    : `<p class="badge badge--muted">No source links listed for this article.</p>`;

  return `
    <article class="article-row card ${surfaceClass}" data-article-row="${article.articleId}">
      <button class="article-row__header" data-article-toggle="${article.articleId}" aria-expanded="${open}">
        <span class="article-row__titleline">
          <span class="article-row__title-group">
            <h2 class="article-row__title">
              <a href="${routeWithId("/article", article.articleId)}" onclick="event.stopPropagation()">${articleName(article)}</a>
            </h2>
            <span class="article-row__display-title">${article.displayTitle}</span>
          </span>
          <i data-lucide="chevron-down" aria-hidden="true" class="article-row__chevron"></i>
        </span>
        <span class="article-row__meta">
          <span class="badge badge--calendar"><i data-lucide="calendar-days" aria-hidden="true"></i>First Added: ${article.firstAdded || "Unknown"}</span>
          <span class="badge badge--updated"><i data-lucide="clock-3" aria-hidden="true"></i>Last Updated: ${article.lastUpdated || "Unknown"}</span>
          <span class="badge badge--count"><i data-lucide="pen-square" aria-hidden="true"></i>${article.amendmentLinks.length} Amendments</span>
          ${omitted ? '<span class="omitted-flag badge badge--danger"><i data-lucide="slash"></i> Omitted text marker</span>' : ""}
        </span>
      </button>
      ${
        open
          ? `
        <div class="article-row__panel">
          <div class="article-row__markdown">${renderMarkdown(article.body)}</div>
          <h3>Amendment Sources</h3>
          ${amendmentSourceMarkup}
        </div>
      `
          : ""
      }
    </article>
  `;
}

function renderList() {
  const query = document.querySelector("#constitution-search")?.value.trim() || "";
  const list = document.querySelector("[data-constitution-list]");
  if (!list) {
    return;
  }

  const filtered = allArticles.filter((article) => matchesQuery(article, query));
  logInfo("constitution.render", {
    query,
    resultCount: filtered.length,
    expandedCount: expandedSet.size
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="info-empty">No articles match your filter.</div>';
    return;
  }

  list.innerHTML = filtered.map((article, index) => renderArticleRow(article, index)).join("");
  document.dispatchEvent(new CustomEvent("content:updated"));
  hydrateIcons();
}

function attachEvents() {
  const searchInput = document.querySelector("#constitution-search");
  const clearButton = document.querySelector("[data-clear-constitution-search]");

  const syncClearState = () => {
    if (!searchInput || !clearButton) {
      return;
    }

    const disabled = !searchInput.value.trim();
    clearButton.disabled = disabled;
    clearButton.setAttribute("aria-disabled", disabled ? "true" : "false");
  };

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      logInfo("constitution.search.input", { query: searchInput.value.trim() });
      renderList();
      syncClearState();
    });
  }

  if (searchInput && clearButton) {
    clearButton.addEventListener("click", () => {
      if (!searchInput.value) {
        return;
      }

      searchInput.value = "";
      logInfo("constitution.search.clear");
      renderList();
      syncClearState();
      searchInput.focus();
    });

    syncClearState();
  }

  const list = document.querySelector("[data-constitution-list]");
  if (!list) {
    return;
  }

  list.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-article-toggle]");
    if (!toggle) {
      return;
    }

    const id = toggle.getAttribute("data-article-toggle");
    if (expandedSet.has(id)) {
      expandedSet.delete(id);
      logInfo("constitution.article.collapse", { articleId: id });
    } else {
      expandedSet.add(id);
      logInfo("constitution.article.expand", { articleId: id });
    }
    renderList();
  });
}

async function initPage() {
  logInfo("constitution.init");
  initSharedPage();
  setPageTitle("Current Constitution");

  const data = await loadDatasets();
  allArticles = data.articles;
  logInfo("constitution.data.loaded", { articleCount: allArticles.length });

  const count = document.querySelector("[data-article-count]");
  if (count) {
    count.textContent = `${allArticles.length} articles and sub-articles currently in effect.`;
  }

  renderList();
  attachEvents();
}

initPage().catch((error) => {
  logError("constitution.init.error", { message: error.message });
  const target = document.querySelector("[data-constitution-error]");
  if (target) {
    target.textContent = `Unable to load constitution list: ${error.message}`;
  }
});
