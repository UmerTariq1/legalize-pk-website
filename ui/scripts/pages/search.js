import { loadDatasets } from "../core/data-service.js";
import { logError, logInfo } from "../core/logger.js";
import { createSearchEngine } from "../core/search-index.js";
import { createPartyChip, setPageTitle, updateUrl } from "../core/ui-helpers.js";
import { escapeHtml } from "../core/utils.js";
import { initSharedPage } from "./shared.js";

let engine;

function syncPresetStates(query) {
  const normalized = String(query || "").trim().toLowerCase();
  document.querySelectorAll("[data-query-preset]").forEach((button) => {
    const value = String(button.getAttribute("data-query-preset") || "").trim().toLowerCase();
    const active = Boolean(normalized && value === normalized);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.classList.toggle("is-active", active);
  });
}

function groupByType(items) {
  return {
    articles: items.filter((item) => item.type === "article"),
    amendments: items.filter((item) => item.type === "amendment")
  };
}

function renderGroup(title, items) {
  if (!items.length) {
    return "";
  }

  return `
    <section class="result-group">
      <h2>${title} (${items.length})</h2>
      ${items
        .map(
          (item) => `
            <article class="result-item">
              <h3><a href="${item.targetUrl}">${escapeHtml(item.title)}</a></h3>
              <p>${escapeHtml(item.subtitle || "")}</p>
              <div class="meta-stack">
                <span class="badge">${escapeHtml(item.dateLabel)}</span>
                ${item.type === "amendment" ? createPartyChip(item.party || "neutral") : ""}
              </div>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function renderResults(results, query = "") {
  const target = document.querySelector("[data-search-results]");
  if (!target) {
    return;
  }

  if (!query) {
    target.innerHTML = '<div class="info-empty">Start typing to search the constitution, or choose a suggested query.</div>';
    return;
  }

  if (!results.length) {
    target.innerHTML = '<div class="info-empty">No matches found. Try article numbers like 63-A or amendment numbers like 18.</div>';
    return;
  }

  const grouped = groupByType(results);
  target.innerHTML = `
    <div class="results-grid">
      ${renderGroup("Articles", grouped.articles)}
      ${renderGroup("Amendments", grouped.amendments)}
    </div>
  `;

  document.dispatchEvent(new CustomEvent("content:updated"));
}

function runSearch() {
  const input = document.querySelector("#global-search");
  if (!input) {
    return;
  }

  const query = input.value.trim();
  logInfo("search.query", { query });
  updateUrl({ q: query });
  syncPresetStates(query);

  if (!query) {
    renderResults([], "");
    return;
  }

  const results = engine.search(query);
  const grouped = groupByType(results);
  logInfo("search.results", {
    query,
    total: results.length,
    articles: grouped.articles.length,
    amendments: grouped.amendments.length
  });
  renderResults(results, query);
}

function wirePresetButtons() {
  const container = document.querySelector("[data-search-presets]");
  const input = document.querySelector("#global-search");
  if (!container || !input) {
    return;
  }

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-query-preset]");
    if (!button) {
      return;
    }

    const preset = button.getAttribute("data-query-preset") || "";
    logInfo("search.preset", { query: preset });
    input.value = preset;
    runSearch();
    input.focus();
  });
}

async function initPage() {
  logInfo("search.init");
  initSharedPage();
  setPageTitle("Search");

  const data = await loadDatasets();
  engine = createSearchEngine(data);
  logInfo("search.engine.ready", {
    articleCount: data.articles.length,
    amendmentCount: data.amendments.length
  });

  const input = document.querySelector("#global-search");
  if (!input) {
    return;
  }

  const initialQuery = new URLSearchParams(window.location.search).get("q") || "";
  input.value = initialQuery;
  input.addEventListener("input", runSearch);
  wirePresetButtons();
  runSearch();
}

initPage().catch((error) => {
  logError("search.init.error", { message: error.message });
  const target = document.querySelector("[data-search-error]");
  if (target) {
    target.innerHTML = `<div class="info-empty">${escapeHtml(error.message)}</div>`;
  }
});
