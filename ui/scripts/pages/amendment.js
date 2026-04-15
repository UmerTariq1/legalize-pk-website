import { loadDatasets, getAmendmentByNumber } from "../core/data-service.js";
import { logError, logInfo } from "../core/logger.js";
import { renderMarkdown } from "../core/markdown.js";
import { getAmendmentNumberFromUrl } from "../core/route-params.js";
import { createPartyChip, hydrateIcons, routeWithId, setPageTitle } from "../core/ui-helpers.js";
import { escapeHtml, formatDate, fileNameToArticleId, normalizeRepoArticlePath } from "../core/utils.js";
import { initSharedPage } from "./shared.js";

function partyKey(value) {
  const party = String(value || "").toLowerCase();
  if (["ppp", "military", "pmln", "coalition"].includes(party)) {
    return party;
  }
  return "neutral";
}

function collectExternalSources(data, amendmentNumber, affectedArticles) {
  const sources = new Set();
  const affectedSet = new Set(affectedArticles.map((path) => normalizeRepoArticlePath(path)));

  data.articles.forEach((article) => {
    if (!affectedSet.has(article.repoPath)) {
      return;
    }

    (article.amendments || []).forEach((entry) => {
      const match = String(entry.label || "").match(/Amendment\s+(\d+)/i);
      if (!match || Number(match[1]) !== amendmentNumber || !entry.url) {
        return;
      }

      sources.add(entry.url);
    });
  });

  return Array.from(sources);
}

function renderPage(data, amendmentCommit) {
  const outlet = document.querySelector("[data-amendment-content]");
  if (!outlet) {
    return;
  }

  const affectedArticles = amendmentCommit.affectedArticles || [];
  logInfo("amendment.render", {
    amendmentNumber: amendmentCommit.amendmentNumber,
    affectedCount: affectedArticles.length
  });
  const sourceLinks = collectExternalSources(data, amendmentCommit.amendmentNumber, affectedArticles);
  const party = partyKey(amendmentCommit.party);

  const articleChips = affectedArticles.length
    ? affectedArticles
        .map((path) => {
          const articleId = fileNameToArticleId(path.split("/").pop());
          const label = articleId === "PREAMBLE" ? "Preamble" : `Article ${articleId}`;
          return `<a class="article-chip" href="${routeWithId("/article", articleId)}">${escapeHtml(label)}</a>`;
        })
        .join("")
    : '<p class="badge badge--muted">No article-level file changes recorded.</p>';

  const sourceMarkup = sourceLinks.length
    ? sourceLinks
        .map((url) => `<a class="article-chip" href="${url}" target="_blank" rel="noreferrer">Official Source</a>`)
        .join("")
    : '<span class="badge badge--muted">No external source URL found in local JSON.</span>';

  outlet.innerHTML = `
    <section class="card amendment-hero" data-party="${party}">
      <p class="page-kicker">Amendment Detail</p>
      <h1 class="page-title">Amendment ${amendmentCommit.amendmentNumber}</h1>
      <p class="page-subtitle">${escapeHtml(amendmentCommit.message)}</p>
      <div class="meta-stack">
        <span class="badge badge--calendar"><i data-lucide="calendar-days" aria-hidden="true"></i>Date: ${formatDate(amendmentCommit.date)}</span>
        <span class="badge badge--president"><i data-lucide="user-round" aria-hidden="true"></i>President: ${escapeHtml(amendmentCommit.author)}</span>
        ${createPartyChip(amendmentCommit.party)}
        <span class="badge badge--count"><i data-lucide="pen-square" aria-hidden="true"></i>${affectedArticles.length} Article Files Changed</span>
      </div>
    </section>

    <section class="card card--pale">
      <h2>Affected Articles</h2>
      <div class="article-chip-grid">${articleChips}</div>
    </section>

    <section class="card ai-summary ai-summary--amendment">
      <h2 class="ai-summary-label">✨ AI Summary</h2>
      <div>${renderMarkdown(amendmentCommit.summary || "No summary available for this commit.")}</div>
    </section>

    <section class="card card--cream">
      <h2>External Sources</h2>
      <div class="article-chip-grid">${sourceMarkup}</div>
    </section>
  `;

  document.dispatchEvent(new CustomEvent("content:updated"));
  hydrateIcons();
}

async function initPage() {
  logInfo("amendment.init");
  initSharedPage();

  const amendmentNumber = getAmendmentNumberFromUrl();
  if (!amendmentNumber) {
    throw new Error("Missing amendment number in URL.");
  }

  const canonicalPath = `/amendment/${amendmentNumber}`;
  if (window.location.pathname !== canonicalPath) {
    window.history.replaceState({}, "", canonicalPath);
  }

  const data = await loadDatasets();
  const amendmentCommit = await getAmendmentByNumber(amendmentNumber);
  if (!amendmentCommit) {
    throw new Error(`Amendment ${amendmentNumber} not found in local data.`);
  }

  setPageTitle(`Amendment ${amendmentNumber}`);
  logInfo("amendment.loaded", {
    amendmentNumber,
    commitHash: amendmentCommit.hash
  });
  renderPage(data, amendmentCommit);
}

initPage().catch((error) => {
  logError("amendment.init.error", { message: error.message });
  const outlet = document.querySelector("[data-amendment-error]");
  if (outlet) {
    outlet.innerHTML = `<div class="info-empty">${escapeHtml(error.message)}</div>`;
  }
});
