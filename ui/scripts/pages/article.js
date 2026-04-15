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
  status: { state: "idle", message: "Historical text will load when you expand a commit." }
});

let article;
let commits = [];

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

function renderSummaryPanel() {
  const panel = document.querySelector("[data-summary-panel]");
  if (!panel) {
    return;
  }

  const state = store.getState();
  const commit = commits.find((item) => item.hash === state.activeHash);

  if (panel.dataset.ready === "true") {
    panel.classList.add("is-updating");
  }

  panel.setAttribute("data-collapsed", state.summaryCollapsed ? "true" : "false");

  panel.innerHTML = `
    <button type="button" class="summary-panel__mobile-toggle" data-summary-toggle aria-expanded="${!state.summaryCollapsed}">
      <span>✨ AI Summary</span>
      <i data-lucide="chevron-up" aria-hidden="true"></i>
    </button>
    <div class="summary-panel__content">
      <p class="summary-panel__eyebrow">✨ AI SUMMARY</p>
      <h3 class="summary-panel__title">${commit ? commitLabel(commit) : "No commit selected"}</h3>
      <div class="summary-panel__body">${renderMarkdown(summaryForCommit(commit))}</div>
    </div>
  `;

  panel.dataset.ready = "true";
  requestAnimationFrame(() => {
    panel.classList.remove("is-updating");
  });
}

async function getHistoricalMarkup(commit) {
  if (contentCache.has(commit.hash)) {
    logInfo("article.history.cache.hit", {
      articleId: article?.articleId,
      commitHash: commit.hash
    });
    return contentCache.get(commit.hash);
  }

  logInfo("article.history.fetch", {
    articleId: article?.articleId,
    commitHash: commit.hash,
    path: article?.repoPath
  });

  store.setState((prev) => ({
    ...prev,
    status: { state: "loading", message: "Fetching article text from Netlify proxy." }
  }));
  renderProxyStatus();

  try {
    const payload = await fetchFileAtCommit({
      path: article.repoPath,
      ref: commit.hash
    });

    const html = renderMarkdown(payload.data.contentMarkdown || "");
    contentCache.set(commit.hash, html);

    store.setState((prev) => ({
      ...prev,
      status: {
        state: payload.meta?.cached ? "cached" : "idle",
        message: payload.meta?.cached ? "Loaded from cache." : "Loaded from GitHub through Netlify."
      }
    }));

    logInfo("article.history.loaded", {
      articleId: article?.articleId,
      commitHash: commit.hash,
      cached: Boolean(payload.meta?.cached)
    });

    return html;
  } catch (error) {
    logError("article.history.error", {
      articleId: article?.articleId,
      commitHash: commit.hash,
      message: error.message
    });
    store.setState((prev) => ({
      ...prev,
      status: { state: "error", message: error.message }
    }));
    return `<div class="info-empty info-empty--warning"><i data-lucide="alert-triangle" aria-hidden="true"></i><span>Could not load historical text: ${escapeHtml(error.message)}</span></div>`;
  }
}

function renderProxyStatus() {
  const target = document.querySelector("[data-proxy-status]");
  if (!target) {
    return;
  }

  target.innerHTML = createProxyStatusMarkup(store.getState().status);
}

async function renderCommitList() {
  const list = document.querySelector("[data-commit-list]");
  if (!list) {
    return;
  }

  const state = store.getState();

  const cards = await Promise.all(
    commits.map(async (commit) => {
      const open = state.expanded.has(commit.hash);
      const partyMarkup = createPartyChip(commit.party);
      const callout = commit.amendmentNumber ? createEditorialCallout(commit.amendmentNumber) : "";
      const party = commitPartyKey(commit);

      let panelMarkup = "";
      if (open) {
        const historyHtml = await getHistoricalMarkup(commit);
        panelMarkup = `
          <div class="commit-card__panel">
            ${callout}
            <div class="article-row__markdown">${historyHtml}</div>
          </div>
        `;
      }

      return `
        <article class="commit-card commit-card--${party}" data-party="${party}">
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
          ${panelMarkup}
        </article>
      `;
    })
  );

  list.innerHTML = cards.join("");
  document.dispatchEvent(new CustomEvent("content:updated"));
  hydrateIcons();
}

async function setActiveCommit(hash, shouldExpand = true) {
  logInfo("article.commit.select", {
    articleId: article?.articleId,
    commitHash: hash,
    shouldExpand
  });

  const nextExpanded = new Set(store.getState().expanded);
  if (shouldExpand) {
    nextExpanded.add(hash);
  }

  store.setState((prev) => ({
    ...prev,
    activeHash: hash,
    expanded: nextExpanded
  }));

  updateUrl({ active: hash });
  renderSummaryPanel();
  renderProxyStatus();
  await renderCommitList();
}

function attachEvents() {
  const list = document.querySelector("[data-commit-list]");
  if (!list) {
    return;
  }

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-commit-toggle]");
    if (!button) {
      return;
    }

    const hash = button.getAttribute("data-commit-toggle");
    const expanded = new Set(store.getState().expanded);

    if (expanded.has(hash)) {
      expanded.delete(hash);
      logInfo("article.commit.collapse", {
        articleId: article?.articleId,
        commitHash: hash
      });
      store.setState((prev) => ({ ...prev, expanded }));
      await renderCommitList();
      return;
    }

    logInfo("article.commit.expand", {
      articleId: article?.articleId,
      commitHash: hash
    });
    store.setState((prev) => ({ ...prev, expanded }));
    await setActiveCommit(hash, true);
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
    renderSummaryPanel();
    hydrateIcons();
  });

  const mobileQuery = window.matchMedia("(max-width: 980px)");
  const syncSummaryLayout = () => {
    const isMobile = mobileQuery.matches;
    document.body.classList.toggle("has-mobile-summary", isMobile);

    if (!isMobile) {
      store.setState((prev) => ({
        ...prev,
        summaryCollapsed: false
      }));
      renderSummaryPanel();
      hydrateIcons();
      return;
    }

    renderSummaryPanel();
    hydrateIcons();
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

  renderSummaryPanel();
  renderProxyStatus();
  attachEvents();
  await setActiveCommit(initialCommit.hash, true);
}

initPage().catch((error) => {
  logError("article.init.error", { message: error.message });
  const target = document.querySelector("[data-article-error]");
  if (target) {
    target.innerHTML = `<div class="info-empty">${escapeHtml(error.message)}</div>`;
  }
});
