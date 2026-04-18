import { loadDatasets, getStats } from "../core/data-service.js";
import { LANDMARK_CALLOUTS, REPO } from "../core/constants.js";
import { logError, logInfo } from "../core/logger.js";
import { createEditorialCallout, formatMetaDate, setPageTitle } from "../core/ui-helpers.js";
import { formatNumber } from "../core/utils.js";
import { animateIn } from "../core/motion.js";
import { initSharedPage } from "./shared.js";

function renderStats(stats) {
  const amendmentsEl = document.querySelector("[data-stat='amendments']");
  const articlesEl = document.querySelector("[data-stat='articles']");
  const yearsEl = document.querySelector("[data-stat='years']");

  if (amendmentsEl) {
    amendmentsEl.textContent = `${formatNumber(stats.enactedAmendments)} Enacted Amendments`;
  }

  if (articlesEl) {
    articlesEl.textContent = `${formatNumber(stats.articleCount)}+ Articles`;
  }

  if (yearsEl) {
    const firstYear = new Date(stats.firstDate).getUTCFullYear();
    const lastYear = new Date(stats.lastDate).getUTCFullYear();
    yearsEl.textContent = `${Math.max(0, lastYear - firstYear)} Years of History`;
  }

  const generatedEl = document.querySelector("[data-generated-at]");
  if (generatedEl) {
    generatedEl.textContent = `Current constitution dataset generated ${formatMetaDate(stats.generatedAt)}.`;
  }
}

function renderCallout() {
  const target = document.querySelector("[data-home-callout]");
  if (!target) {
    return;
  }

  const options = Object.keys(LANDMARK_CALLOUTS)
    .map(Number)
    .filter((value) => LANDMARK_CALLOUTS[value]);

  if (!options.length) {
    return;
  }

  const featuredIndex = Math.floor(Math.random() * options.length);
  const featuredNumber = options[featuredIndex];
  const featured = LANDMARK_CALLOUTS[featuredNumber];
  if (!featured) {
    return;
  }

  target.innerHTML = createEditorialCallout(featuredNumber);
  document.dispatchEvent(new CustomEvent("content:updated"));
}

function renderRepoLink() {
  const link = document.querySelector("[data-home-repo]");
  if (!link) {
    return;
  }

  if (!REPO.owner || REPO.owner === "YOUR_GITHUB_OWNER") {
    link.textContent = "Set REPO.owner in constants.js to enable repository link";
    link.removeAttribute("href");
    link.removeAttribute("target");
    return;
  }

  link.href = `https://github.com/${REPO.owner}/${REPO.name}`;
}

async function initPage() {
  logInfo("home.init");
  initSharedPage();
  setPageTitle("Home");

  await loadDatasets();
  const stats = await getStats();
  logInfo("home.stats.loaded", {
    enactedAmendments: stats.enactedAmendments,
    articleCount: stats.articleCount,
    totalCommits: stats.totalCommits
  });
  renderStats(stats);
  renderCallout();
  renderRepoLink();

  animateIn(".hero [data-animate]");
  animateIn(".card-grid .card");
}

initPage().catch((error) => {
  logError("home.init.error", { message: error.message });
  const outlet = document.querySelector("[data-home-error]");
  if (outlet) {
    outlet.textContent = `Unable to load home data: ${error.message}`;
    outlet.hidden = false;
  }
});
