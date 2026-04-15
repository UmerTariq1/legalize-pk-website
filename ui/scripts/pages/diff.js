import { getArticleById, getArticleChoices, getArticleCommits } from "../core/data-service.js";
import { logError, logInfo } from "../core/logger.js";
import { fetchDiff } from "../core/proxy-api.js";
import { getDiffArticleIdFromUrl } from "../core/route-params.js";
import {
  createProxyStatusMarkup,
  hydrateIcons,
  routeWithId,
  setPageTitle,
  updateUrl
} from "../core/ui-helpers.js";
import { escapeHtml, parseMaybeHash } from "../core/utils.js";
import { initSharedPage } from "./shared.js";

let articleChoices = [];
let currentCommits = [];

function shortHash(value) {
  return String(value || "").slice(0, 7);
}

function commitMeta(hash) {
  const match = currentCommits.find((item) => item.hash === hash);
  return {
    hash: shortHash(hash),
    date: match?.date ? new Date(match.date).toLocaleDateString("en-GB") : "Unknown date"
  };
}

function setProxyStatus(state, message) {
  const target = document.querySelector("[data-diff-status]");
  if (!target) {
    return;
  }
  target.innerHTML = createProxyStatusMarkup({ state, message });
}

function updateRunButtonState() {
  const from = document.querySelector("#diff-from")?.value;
  const to = document.querySelector("#diff-to")?.value;
  const runButton = document.querySelector("[data-run-diff]");
  if (!runButton) {
    return true;
  }

  const canRun = Boolean(from && to && from !== to);
  runButton.disabled = !canRun;
  runButton.setAttribute("aria-disabled", canRun ? "false" : "true");
  return canRun;
}

function renderUnified(patch) {
  const lines = String(patch || "").split("\n");
  return lines
    .map((line) => {
      let klass = "";
      if (line.startsWith("+")) {
        klass = "diff-line--add";
      } else if (line.startsWith("-")) {
        klass = "diff-line--remove";
      } else if (line.startsWith("@@") || line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) {
        klass = "diff-line--meta";
      }
      return `<span class="diff-line ${klass}">${escapeHtml(line || " ")}</span>`;
    })
    .join("");
}

function renderSplit(patch, fromHash, toHash) {
  const lines = String(patch || "").split("\n");
  const rows = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith("-") && lines[index + 1] && lines[index + 1].startsWith("+")) {
      rows.push({ left: line, right: lines[index + 1], leftClass: "diff-line--remove", rightClass: "diff-line--add" });
      index += 1;
      continue;
    }

    if (line.startsWith("-")) {
      rows.push({ left: line, right: "", leftClass: "diff-line--remove", rightClass: "" });
      continue;
    }

    if (line.startsWith("+")) {
      rows.push({ left: "", right: line, leftClass: "", rightClass: "diff-line--add" });
      continue;
    }

    const isMeta = line.startsWith("@@") || line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++");
    const className = isMeta ? "diff-line--meta" : "";
    rows.push({ left: line, right: line, leftClass: className, rightClass: className });
  }

  const left = rows
    .map((row) => `<span class="diff-line ${row.leftClass}">${escapeHtml(row.left || " ")}</span>`)
    .join("");
  const right = rows
    .map((row) => `<span class="diff-line ${row.rightClass}">${escapeHtml(row.right || " ")}</span>`)
    .join("");

  const beforeMeta = commitMeta(fromHash);
  const afterMeta = commitMeta(toHash);

  return `
    <div class="diff-split">
      <section class="diff-split__col diff-split__col--before">
        <header class="diff-split__title">
          <p class="diff-split__kicker diff-split__kicker--before">Before</p>
          <p class="diff-split__meta"><code>${beforeMeta.hash}</code> ${beforeMeta.date}</p>
        </header>
        <pre class="diff-unified diff-unified--split">${left}</pre>
      </section>
      <section class="diff-split__col diff-split__col--after">
        <header class="diff-split__title">
          <p class="diff-split__kicker diff-split__kicker--after">After</p>
          <p class="diff-split__meta"><code>${afterMeta.hash}</code> ${afterMeta.date}</p>
        </header>
        <pre class="diff-unified diff-unified--split">${right}</pre>
      </section>
    </div>
  `;
}

async function populateCommitSelectors(articleId, fromHash = "", toHash = "") {
  const fromSelect = document.querySelector("#diff-from");
  const toSelect = document.querySelector("#diff-to");
  if (!fromSelect || !toSelect) {
    return;
  }

  currentCommits = await getArticleCommits(articleId);
  logInfo("diff.commits.loaded", {
    articleId,
    commitCount: currentCommits.length
  });
  const options = currentCommits
    .map((commit) => ({
      value: commit.hash,
      label: `${commit.amendmentNumber ? `Amendment ${commit.amendmentNumber}` : "Original"} - ${new Date(commit.date).toLocaleDateString("en-GB")}`
    }))
    .map((item) => `<option value="${item.value}">${item.label}</option>`)
    .join("");

  fromSelect.innerHTML = options;
  toSelect.innerHTML = options;

  if (fromHash && toHash) {
    fromSelect.value = fromHash;
    toSelect.value = toHash;
  } else if (currentCommits.length > 1) {
    fromSelect.value = currentCommits[0].hash;
    toSelect.value = currentCommits[currentCommits.length - 1].hash;
  }
}

function renderArticleChoices(initialArticleId) {
  const select = document.querySelector("#diff-article");
  if (!select) {
    return;
  }

  select.innerHTML = articleChoices
    .map((choice) => `<option value="${choice.articleId}">${choice.label} - ${choice.displayTitle}</option>`)
    .join("");

  if (initialArticleId) {
    select.value = initialArticleId;
  }
}

function syncDiffViewToggle() {
  const mode = document.querySelector("#diff-mode")?.value || "unified";
  document.querySelectorAll("[data-diff-view]").forEach((button) => {
    const active = button.getAttribute("data-diff-view") === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function initDiffViewToggle() {
  const controls = document.querySelector(".diff-controls");
  const modeSelect = document.querySelector("#diff-mode");
  if (!controls || !modeSelect || document.querySelector(".diff-view-toggle")) {
    syncDiffViewToggle();
    return;
  }

  modeSelect.closest("label")?.classList.add("diff-mode-label");

  const toggle = document.createElement("div");
  toggle.className = "diff-view-toggle";
  toggle.innerHTML = `
    <button type="button" class="button button--ghost" data-diff-view="unified" aria-pressed="false">Unified</button>
    <button type="button" class="button button--ghost" data-diff-view="split" aria-pressed="false">Side-by-Side</button>
  `;

  controls.append(toggle);
  toggle.addEventListener("click", (event) => {
    const target = event.target.closest("[data-diff-view]");
    if (!target) {
      return;
    }

    modeSelect.value = target.getAttribute("data-diff-view");
    syncDiffViewToggle();
    runComparison();
  });

  syncDiffViewToggle();
}

async function runComparison() {
  const articleId = document.querySelector("#diff-article")?.value;
  const from = document.querySelector("#diff-from")?.value;
  const to = document.querySelector("#diff-to")?.value;
  const mode = document.querySelector("#diff-mode")?.value || "unified";
  const output = document.querySelector("[data-diff-output]");

  if (!articleId || !from || !to || !output) {
    return;
  }

  if (from === to) {
    setProxyStatus("idle", "Select two different commits to compare.");
    output.innerHTML = '<div class="info-empty info-empty--warning"><i data-lucide="alert-triangle" aria-hidden="true"></i><span>Select different commits in From and To.</span></div>';
    hydrateIcons();
    return;
  }

  logInfo("diff.compare.start", {
    articleId,
    from,
    to,
    mode
  });

  const article = await getArticleById(articleId);
  if (!article) {
    return;
  }

  setProxyStatus("loading", "Requesting diff through Netlify proxy...");

  try {
    const payload = await fetchDiff({ path: article.repoPath, from, to, viewMode: mode });

    const patch = payload.data.patch || "No diff patch returned by upstream API.";
    const fromMeta = commitMeta(from);
    const toMeta = commitMeta(to);
    const headerMarkup = `
      <div class="diff-toolbar">
        <span class="badge badge--success">+${payload.data.stats.additions} Added</span>
        <span class="badge badge--danger">-${payload.data.stats.deletions} Removed</span>
        <span class="badge badge--count">${payload.data.stats.changes} Changed Lines</span>
        <a class="badge badge--muted" href="${routeWithId("/article", articleId)}?active=${to}">Open Article History</a>
      </div>
    `;

    const compareMarkup = `
      <div class="diff-compare-header">
        <section class="diff-compare-panel diff-compare-panel--before">
          <p class="diff-compare-kicker">Before</p>
          <p class="diff-compare-meta"><code>${fromMeta.hash}</code> ${fromMeta.date}</p>
        </section>
        <section class="diff-compare-panel diff-compare-panel--after">
          <p class="diff-compare-kicker">After</p>
          <p class="diff-compare-meta"><code>${toMeta.hash}</code> ${toMeta.date}</p>
        </section>
      </div>
    `;

    const body =
      mode === "split"
        ? renderSplit(patch, from, to)
        : `${compareMarkup}<pre class="diff-unified">${renderUnified(patch)}</pre>`;

    output.innerHTML = `<section class="diff-output">${headerMarkup}${body}</section>`;
    document.dispatchEvent(new CustomEvent("content:updated"));
    hydrateIcons();
    syncDiffViewToggle();

    logInfo("diff.compare.success", {
      articleId,
      from,
      to,
      mode,
      additions: payload.data.stats.additions,
      deletions: payload.data.stats.deletions,
      changes: payload.data.stats.changes,
      cached: Boolean(payload.meta?.cached)
    });

    setProxyStatus(payload.meta?.cached ? "cached" : "idle", payload.meta?.cached ? "Diff loaded from cache." : "Diff loaded from GitHub.");
    updateUrl({ from, to, view: mode });

    const canonicalPath = routeWithId("/diff", articleId);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({}, "", `${canonicalPath}${window.location.search}`);
    }
  } catch (error) {
    logError("diff.compare.error", {
      articleId,
      from,
      to,
      mode,
      message: error.message
    });
    setProxyStatus("error", error.message);
    output.innerHTML = `<div class="info-empty info-empty--warning"><i data-lucide="alert-triangle" aria-hidden="true"></i><span>${escapeHtml(error.message)}</span></div>`;
    hydrateIcons();
  }
}

async function initPage() {
  logInfo("diff.init");
  initSharedPage();
  setPageTitle("Article Diff");

  const initialArticle = getDiffArticleIdFromUrl();
  const params = new URLSearchParams(window.location.search);
  const initialFrom = parseMaybeHash(params.get("from"));
  const initialTo = parseMaybeHash(params.get("to"));
  const initialMode = params.get("view") === "split" ? "split" : "unified";

  articleChoices = await getArticleChoices();
  const fallbackArticle = initialArticle || articleChoices[0]?.articleId;
  logInfo("diff.initial-state", {
    initialArticle,
    fallbackArticle,
    initialFrom,
    initialTo,
    initialMode
  });

  renderArticleChoices(fallbackArticle);
  await populateCommitSelectors(fallbackArticle, initialFrom, initialTo);
  updateRunButtonState();

  const modeSelect = document.querySelector("#diff-mode");
  if (modeSelect) {
    modeSelect.value = initialMode;
  }

  initDiffViewToggle();

  document.querySelector("#diff-article")?.addEventListener("change", async (event) => {
    logInfo("diff.article.change", { articleId: event.target.value });
    await populateCommitSelectors(event.target.value);
    updateRunButtonState();
    runComparison();
  });

  document.querySelector("#diff-from")?.addEventListener("change", () => {
    updateRunButtonState();
  });

  document.querySelector("#diff-to")?.addEventListener("change", () => {
    updateRunButtonState();
  });

  document.querySelector("[data-run-diff]")?.addEventListener("click", () => {
    logInfo("diff.compare.manual-trigger");
    runComparison();
  });
  document.querySelector("#diff-mode")?.addEventListener("change", (event) => {
    logInfo("diff.mode.change", { mode: event.target.value });
    syncDiffViewToggle();
    runComparison();
  });

  runComparison();
}

initPage().catch((error) => {
  logError("diff.init.error", { message: error.message });
  const target = document.querySelector("[data-diff-error]");
  if (target) {
    target.innerHTML = `<div class="info-empty">${escapeHtml(error.message)}</div>`;
  }
});
