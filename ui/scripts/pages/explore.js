import { getAmendmentChoices, getArticleChoices, getArticleCommits } from "../core/data-service.js";
import { logError, logInfo } from "../core/logger.js";
import { routeWithId, setPageTitle } from "../core/ui-helpers.js";
import { initSharedPage } from "./shared.js";

let articleChoices = [];

function fillSelect(select, options, renderLabel) {
  if (!select) {
    return;
  }

  const current = select.value;
  select.innerHTML = options
    .map((option) => `<option value="${option.value}">${renderLabel(option)}</option>`)
    .join("");

  if (current && options.some((option) => option.value === current)) {
    select.value = current;
  }
}

async function fillDiffCommits(articleId) {
  const fromSelect = document.querySelector("#diff-from");
  const toSelect = document.querySelector("#diff-to");
  if (!fromSelect || !toSelect || !articleId) {
    return;
  }

  const commits = await getArticleCommits(articleId);
  logInfo("explore.diff.commits.loaded", { articleId, commitCount: commits.length });
  const options = commits.map((commit) => ({
    value: commit.hash,
    label: `${commit.amendmentNumber ? `Amendment ${commit.amendmentNumber}` : "Original Constitution"} - ${new Date(commit.date).toLocaleDateString("en-GB")}`
  }));

  fillSelect(fromSelect, options, (option) => option.label);
  fillSelect(toSelect, options, (option) => option.label);

  if (options.length > 1) {
    fromSelect.value = options[0].value;
    toSelect.value = options[options.length - 1].value;
  }
}

function wireForms() {
  const articleSelect = document.querySelector("#explore-article");
  const amendmentSelect = document.querySelector("#explore-amendment");
  const diffArticleSelect = document.querySelector("#diff-article");

  document.querySelector("#article-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!articleSelect?.value) {
      return;
    }

    logInfo("explore.navigate.article", { articleId: articleSelect.value });
    window.location.href = routeWithId("/article", articleSelect.value);
  });

  document.querySelector("#amendment-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!amendmentSelect?.value) {
      return;
    }

    logInfo("explore.navigate.amendment", { amendmentNumber: amendmentSelect.value });
    window.location.href = routeWithId("/amendment", amendmentSelect.value);
  });

  document.querySelector("#diff-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const articleId = diffArticleSelect?.value;
    const from = document.querySelector("#diff-from")?.value;
    const to = document.querySelector("#diff-to")?.value;
    if (!articleId || !from || !to) {
      return;
    }

    logInfo("explore.navigate.diff", {
      articleId,
      from,
      to
    });
    const url = new URL(routeWithId("/diff", articleId), window.location.origin);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    window.location.href = url.toString();
  });

  diffArticleSelect?.addEventListener("change", () => {
    logInfo("explore.diff.article.change", { articleId: diffArticleSelect.value });
    fillDiffCommits(diffArticleSelect.value);
  });
}

async function initPage() {
  logInfo("explore.init");
  initSharedPage();
  setPageTitle("Explore Constitution");

  articleChoices = await getArticleChoices();
  const amendmentChoices = await getAmendmentChoices();
  logInfo("explore.choices.loaded", {
    articleCount: articleChoices.length,
    amendmentCount: amendmentChoices.length
  });

  const articleOptions = articleChoices.map((choice) => ({
    value: choice.articleId,
    label: `${choice.label} - ${choice.displayTitle}`
  }));

  fillSelect(document.querySelector("#explore-article"), articleOptions, (option) => option.label);
  fillSelect(document.querySelector("#diff-article"), articleOptions, (option) => option.label);
  fillSelect(
    document.querySelector("#explore-amendment"),
    amendmentChoices.map((choice) => ({ value: String(choice.number), label: `${choice.label} - ${choice.message}` })),
    (option) => option.label
  );

  if (articleOptions.length) {
    await fillDiffCommits(articleOptions[0].value);
  }

  wireForms();
}

initPage().catch((error) => {
  logError("explore.init.error", { message: error.message });
  const target = document.querySelector("[data-explore-error]");
  if (target) {
    target.textContent = `Unable to load explorer selectors: ${error.message}`;
  }
});
