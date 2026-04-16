import { loadDatasets } from "../core/data-service.js";
import { logError, logInfo } from "../core/logger.js";
import { renderMarkdown } from "../core/markdown.js";
import { hydrateIcons, routeWithId, setPageTitle } from "../core/ui-helpers.js";
import { isOmittedBody } from "../core/utils.js";
import { initSharedPage } from "./shared.js";

const expandedSet = new Set();
let allArticles = [];
let searchableByArticleId = new Map();

function articleName(article) {
  return article.articleId === "PREAMBLE" ? "Preamble" : `Article ${article.articleId}`;
}

function buildSearchableText(article) {
  const amendmentText = [...(article.amendments || []), ...(article.amendmentLinks || [])]
    .map((entry) => `${entry?.label || ""} ${entry?.url || ""}`)
    .join(" ");

  return [article.articleId, article.displayTitle, article.fileName, article.repoPath, article.body, amendmentText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function renderArticleRow(article, index) {
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
      <button class="article-row__header" data-article-toggle="${article.articleId}" aria-expanded="false">
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
      <div class="article-row__panel">
        <div class="article-row__markdown">${renderMarkdown(article.body)}</div>
        <h3>Amendment Sources</h3>
        ${amendmentSourceMarkup}
      </div>
    </article>
  `;
}

function ensureEmptyState() {
  const shell = document.querySelector(".constitution-list-shell");
  if (!shell) {
    return null;
  }

  let emptyState = shell.querySelector("[data-constitution-empty]");
  if (!emptyState) {
    emptyState = document.createElement("div");
    emptyState.className = "info-empty";
    emptyState.setAttribute("data-constitution-empty", "");
    emptyState.textContent = "No articles match your filter.";
    emptyState.hidden = true;
    shell.append(emptyState);
  }

  return emptyState;
}

function syncFilterVisibility(rawQuery) {
  const query = String(rawQuery || "").trim().toLowerCase();
  const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

  let visibleCount = 0;
  document.querySelectorAll("[data-constitution-list] [data-article-row]").forEach((row) => {
    const articleId = row.getAttribute("data-article-row") || "";
    const searchable = searchableByArticleId.get(articleId) || "";
    const visible = !tokens.length || tokens.every((token) => searchable.includes(token));

    row.hidden = !visible;
    row.classList.toggle("is-filter-hidden", !visible);
    if (visible) {
      visibleCount += 1;
    }
  });

  const emptyState = ensureEmptyState();
  if (emptyState) {
    emptyState.hidden = visibleCount !== 0;
  }

  logInfo("constitution.search.filtered", {
    query,
    resultCount: visibleCount,
    expandedCount: expandedSet.size
  });
}

function renderListOnce() {
  const list = document.querySelector("[data-constitution-list]");
  if (!list) {
    return;
  }

  searchableByArticleId = new Map(allArticles.map((article) => [article.articleId, buildSearchableText(article)]));
  list.innerHTML = allArticles.map((article, index) => renderArticleRow(article, index)).join("");
  ensureEmptyState();

  logInfo("constitution.render.initial", {
    articleCount: allArticles.length
  });

  document.dispatchEvent(new CustomEvent("content:updated"));
  hydrateIcons();
}

function toggleArticleRow(button) {
  const row = button.closest("[data-article-row]");
  if (!row) {
    return;
  }

  const id = button.getAttribute("data-article-toggle");
  const shouldExpand = !row.classList.contains("is-expanded");

  row.classList.toggle("is-expanded", shouldExpand);
  button.setAttribute("aria-expanded", shouldExpand ? "true" : "false");

  if (shouldExpand) {
    expandedSet.add(id);
    logInfo("constitution.article.expand", { articleId: id });
    return;
  }

  expandedSet.delete(id);
  logInfo("constitution.article.collapse", { articleId: id });
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
      syncFilterVisibility(searchInput.value);
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
      syncFilterVisibility("");
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

    toggleArticleRow(toggle);
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

  renderListOnce();
  attachEvents();
  syncFilterVisibility(document.querySelector("#constitution-search")?.value || "");
}

initPage().catch((error) => {
  logError("constitution.init.error", { message: error.message });
  const target = document.querySelector("[data-constitution-error]");
  if (target) {
    target.textContent = `Unable to load constitution list: ${error.message}`;
  }
});
