import { getArticleById, getArticleCommits } from "../core/data-service.js";
import { logError, logInfo } from "../core/logger.js";
import { renderMarkdown } from "../core/markdown.js";
import { fetchFileAtCommit } from "../core/proxy-api.js";
import { getArticleIdFromUrl } from "../core/route-params.js";
import { createStore } from "../core/store.js";
import {
  createEditorialCallout,
  createPartyChip,
  createProxyStatusMarkup,
  formatMetaDate,
  hydrateIcons,
  setPageTitle,
  updateUrl
} from "../core/ui-helpers.js";
import { escapeHtml, formatDate } from "../core/utils.js";
import { initSharedPage } from "./shared.js";

const contentCache = new Map();
const store = createStore({
  activeHash: "",
  expanded: new Set(),
  summaryCollapsed: true,
  status: { state: "idle", message: "Historical text is preloaded when this page opens." }
});

let article;
let commits = [];

function escapePipes(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

function convertLeadingMetadataToTable(markdownText) {
  const text = String(markdownText || "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const metadataRows = [];
  const metaPattern = /^([A-Za-z][A-Za-z0-9\s()/.\-]{1,80}):\s*(.+)$/;

  let cursor = 0;
  while (cursor < lines.length && !lines[cursor].trim()) {
    cursor += 1;
  }

  let probe = cursor;
  while (probe < lines.length) {
    const line = lines[probe].trim();
    if (!line) {
      break;
    }

    if (line.startsWith("|") || line.startsWith("#") || /^[-*+]\s/.test(line)) {
      return text;
    }

    const match = line.match(metaPattern);
    if (!match) {
      break;
    }

    metadataRows.push([match[1].trim(), match[2].trim()]);
    probe += 1;
  }

  if (metadataRows.length < 2) {
    return text;
  }

  const tableLines = [
    "| Field | Value |",
    "| --- | --- |",
    ...metadataRows.map(([field, value]) => `| ${escapePipes(field)} | ${escapePipes(value)} |`)
  ];

  const remainder = lines.slice(probe).join("\n").replace(/^\s+/, "");
  return `${tableLines.join("\n")}\n\n${remainder}`.trimEnd();
}

function commitPartyKey(commit) {
  const party = String(commit?.party || "").toLowerCase();
  if (["ppp", "military", "pmln", "coalition"].includes(party)) {
    return party;
  }
  return "neutral";
}

function summaryForCommit(commit) {
  if (!commit) {
    return "Select a commit to read its summary.";
  }

  if (commit.summary) {
    return commit.summary;
  }

  return "This is the original constitution commit entry. No amendment summary is available for this state.";
}

function commitLabel(commit) {
  if (!commit.amendmentNumber) {
    return "Original Constitution";
  }
  return `Amendment ${commit.amendmentNumber}`;
}

function renderProxyStatus() {
  const target = document.querySelector("[data-proxy-status]");
  if (!target) {
    return;
  }

  target.innerHTML = createProxyStatusMarkup(store.getState().status);
}

function syncCommitCardState() {
  const state = store.getState();
  document.querySelectorAll("[data-commit-card]").forEach((card) => {
    const hash = card.getAttribute("data-commit-card") || "";
    const expanded = state.expanded.has(hash);
    const active = state.activeHash === hash;

    card.classList.toggle("is-expanded", expanded);

    const button = card.querySelector("[data-commit-toggle]");
    if (button) {
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      button.classList.toggle("is-active", active);
    }
  });
}

function syncSummaryPanelState() {
  const panel = document.querySelector("[data-summary-panel]");
  if (!panel) {
    return;
  }

  const state = store.getState();
  panel.setAttribute("data-collapsed", state.summaryCollapsed ? "true" : "false");

  const toggle = panel.querySelector("[data-summary-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-expanded", state.summaryCollapsed ? "false" : "true");
  }

  panel.querySelectorAll("[data-summary-card]").forEach((card) => {
    const hash = card.getAttribute("data-summary-card");
    card.classList.toggle("is-active", hash === state.activeHash);
  });
}

function renderSummaryPanelOnce() {
  const panel = document.querySelector("[data-summary-panel]");
  if (!panel) {
    return;
  }

  const state = store.getState();
  const summaryCards = commits
    .map((commit) => {
      const activeClass = state.activeHash === commit.hash ? " is-active" : "";
      return `
        <section class="summary-panel__card${activeClass}" data-summary-card="${commit.hash}">
          <h3 class="summary-panel__title">${commitLabel(commit)}</h3>
          <div class="summary-panel__body">${renderMarkdown(summaryForCommit(commit))}</div>
        </section>
      `;
    })
    .join("");

  panel.innerHTML = `
    <button type="button" class="summary-panel__mobile-toggle" data-summary-toggle aria-expanded="${state.summaryCollapsed ? "false" : "true"}">
      <span>✨ AI Summary. Generated with Gemini</span>
      <i data-lucide="chevron-up" aria-hidden="true"></i>
    </button>
    <div class="summary-panel__content">
      <p class="summary-panel__eyebrow">✨ AI SUMMARY. Generated with Gemini</p>
      <div class="summary-panel__cards">${summaryCards}</div>
    </div>
  `;

  syncSummaryPanelState();
}

async function loadHistoricalMarkup(commit) {
  if (contentCache.has(commit.hash)) {
    return {
      cached: true,
      error: false,
      html: contentCache.get(commit.hash)
    };
  }

  try {
    const payload = await fetchFileAtCommit({
      path: article.repoPath,
      ref: commit.hash
    });

    const normalizedMarkdown = convertLeadingMetadataToTable(payload.data.contentMarkdown || "");

    const html = renderMarkdown(normalizedMarkdown);
    contentCache.set(commit.hash, html);

    return {
      cached: Boolean(payload.meta?.cached),
      error: false,
      html
    };
  } catch (error) {
    logError("article.history.prefetch.error", {
      articleId: article?.articleId,
      commitHash: commit.hash,
      message: error.message
    });

    const html = `<div class="info-empty info-empty--warning"><i data-lucide="alert-triangle" aria-hidden="true"></i><span>Could not load historical text: ${escapeHtml(error.message)}</span></div>`;
    contentCache.set(commit.hash, html);

    return {
      cached: false,
      error: true,
      html
    };
  }
}

async function prefetchHistoricalMarkup() {
  if (!commits.length) {
    return;
  }

  logInfo("article.history.prefetch.start", {
    articleId: article?.articleId,
    commitCount: commits.length
  });

  store.setState((prev) => ({
    ...prev,
    status: {
      state: "loading",
      message: "Prefetching historical text for all commits."
    }
  }));
  renderProxyStatus();

  const outcomes = await Promise.all(commits.map((commit) => loadHistoricalMarkup(commit)));
  const cachedCount = outcomes.filter((outcome) => outcome.cached).length;
  const errorCount = outcomes.filter((outcome) => outcome.error).length;

  if (errorCount) {
    store.setState((prev) => ({
      ...prev,
      status: {
        state: "error",
        message: `Preloaded with ${errorCount} failed commit fetch${errorCount === 1 ? "" : "es"}.`
      }
    }));
  } else {
    const allCached = cachedCount === commits.length;
    store.setState((prev) => ({
      ...prev,
      status: {
        state: allCached ? "cached" : "idle",
        message: allCached ? "All commit text loaded from cache." : "All commit text preloaded from GitHub through Netlify."
      }
    }));
  }

  logInfo("article.history.prefetch.complete", {
    articleId: article?.articleId,
    commitCount: commits.length,
    cachedCount,
    errorCount
  });
}

function renderCommitListOnce() {
  const list = document.querySelector("[data-commit-list]");
  if (!list) {
    return;
  }

  const state = store.getState();

  list.innerHTML = commits
    .map((commit) => {
      const open = state.expanded.has(commit.hash);
      const partyMarkup = createPartyChip(commit.party);
      const callout = commit.amendmentNumber ? createEditorialCallout(commit.amendmentNumber) : "";
      const party = commitPartyKey(commit);
      const historyHtml = contentCache.get(commit.hash) || '<div class="info-empty info-empty--warning"><span>No historical text loaded for this commit.</span></div>';

      return `
        <article class="commit-card commit-card--${party} ${open ? "is-expanded" : ""}" data-party="${party}" data-commit-card="${commit.hash}">
          <button class="commit-card__header ${state.activeHash === commit.hash ? "is-active" : ""}" data-commit-toggle="${commit.hash}" aria-expanded="${open}">
            <span class="article-row__titleline">
              <span>
                <strong class="commit-card__title">${commitLabel(commit)}</strong>
                <div class="commit-card__message">${escapeHtml(commit.message)}</div>
              </span>
              <i data-lucide="chevron-down" aria-hidden="true" class="commit-card__chevron"></i>
            </span>
            <span class="article-row__meta">
              <span class="badge badge--calendar"><i data-lucide="calendar-days" aria-hidden="true"></i>${formatDate(commit.date)}</span>
              <span class="badge badge--president"><i data-lucide="user-round" aria-hidden="true"></i>${escapeHtml(commit.author)}</span>
              ${partyMarkup}
            </span>
          </button>
          <div class="commit-card__panel">
            ${callout}
            <div class="article-row__markdown">${historyHtml}</div>
          </div>
        </article>
      `;
    })
    .join("");

  document.dispatchEvent(new CustomEvent("content:updated"));
  hydrateIcons();
}

function attachEvents() {
  const list = document.querySelector("[data-commit-list]");
  if (!list) {
    return;
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-commit-toggle]");
    if (!button) {
      return;
    }

    const hash = button.getAttribute("data-commit-toggle");
    const expanded = new Set(store.getState().expanded);

    if (expanded.has(hash)) {
      expanded.delete(hash);
      store.setState((prev) => ({ ...prev, expanded }));
      syncCommitCardState();

      logInfo("article.commit.collapse", {
        articleId: article?.articleId,
        commitHash: hash
      });
      return;
    }

    expanded.add(hash);
    store.setState((prev) => ({
      ...prev,
      activeHash: hash,
      expanded
    }));

    syncCommitCardState();
    syncSummaryPanelState();
    updateUrl({ active: hash });

    logInfo("article.commit.expand", {
      articleId: article?.articleId,
      commitHash: hash
    });
  });

  const panel = document.querySelector("[data-summary-panel]");
  panel?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-summary-toggle]");
    if (!toggle) {
      return;
    }

    store.setState((prev) => ({
      ...prev,
      summaryCollapsed: !prev.summaryCollapsed
    }));
    syncSummaryPanelState();
  });

  const mobileQuery = window.matchMedia("(max-width: 980px)");
  const syncSummaryLayout = () => {
    const isMobile = mobileQuery.matches;
    document.body.classList.toggle("has-mobile-summary", isMobile);

    if (!isMobile && store.getState().summaryCollapsed) {
      store.setState((prev) => ({
        ...prev,
        summaryCollapsed: false
      }));
    }

    syncSummaryPanelState();
  };

  syncSummaryLayout();
  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncSummaryLayout);
  } else {
    mobileQuery.addListener(syncSummaryLayout);
  }
}

async function initPage() {
  logInfo("article.init");
  initSharedPage();

  const articleId = getArticleIdFromUrl();
  if (!articleId) {
    throw new Error("Missing article identifier in URL.");
  }

  const canonicalPath = `/article/${encodeURIComponent(articleId)}`;
  if (window.location.pathname !== canonicalPath) {
    window.history.replaceState({}, "", `${canonicalPath}${window.location.search}`);
  }

  article = await getArticleById(articleId);
  if (!article) {
    throw new Error(`Article ${articleId} was not found.`);
  }

  logInfo("article.loaded", {
    articleId: article.articleId,
    path: article.repoPath
  });

  commits = await getArticleCommits(articleId);
  if (!commits.length) {
    throw new Error(`No commit history found for article ${articleId}.`);
  }

  logInfo("article.commits.loaded", {
    articleId,
    commitCount: commits.length
  });

  setPageTitle(articleId === "PREAMBLE" ? "Preamble History" : `Article ${articleId}`);

  const heading = document.querySelector("[data-article-heading]");
  if (heading) {
    heading.textContent = articleId === "PREAMBLE" ? "Preamble History" : `Article ${article.articleId}`;
  }

  const subtitle = document.querySelector("[data-article-subtitle]");
  if (subtitle) {
    subtitle.textContent = article.displayTitle;
  }

  const meta = document.querySelector("[data-article-meta]");
  if (meta) {
    meta.innerHTML = `
      <span class="badge badge--calendar"><i data-lucide="calendar-days" aria-hidden="true"></i>First Added: ${escapeHtml(article.firstAdded || "Unknown")}</span>
      <span class="badge badge--updated"><i data-lucide="clock-3" aria-hidden="true"></i>Last Updated: ${escapeHtml(article.lastUpdated || "Unknown")}</span>
      <span class="badge badge--count"><i data-lucide="pen-square" aria-hidden="true"></i>${article.amendmentLinks.length} Amendments</span>
      <span class="badge badge--muted"><i data-lucide="database" aria-hidden="true"></i>Generated ${formatMetaDate(article.lastUpdated)}</span>
    `;
  }

  const requestedActive = new URLSearchParams(window.location.search).get("active");
  const initialCommit = commits.find((commit) => commit.hash === requestedActive) || commits[commits.length - 1];
  logInfo("article.initial-commit", {
    articleId,
    requestedActive,
    selectedHash: initialCommit.hash
  });

  store.setState((prev) => ({
    ...prev,
    activeHash: initialCommit.hash,
    expanded: new Set([initialCommit.hash])
  }));

  await prefetchHistoricalMarkup();

  renderSummaryPanelOnce();
  renderCommitListOnce();
  renderProxyStatus();
  attachEvents();
  syncCommitCardState();
  syncSummaryPanelState();
  updateUrl({ active: initialCommit.hash });
}

initPage().catch((error) => {
  logError("article.init.error", { message: error.message });
  const target = document.querySelector("[data-article-error]");
  if (target) {
    target.innerHTML = `<div class="info-empty">${escapeHtml(error.message)}</div>`;
  }
});
