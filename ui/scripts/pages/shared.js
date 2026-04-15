import { hydrateIcons, setActiveNav } from "../core/ui-helpers.js";
import { logInfo } from "../core/logger.js";

const REVEAL_SELECTOR =
  ".page-intro, .timeline-filter, .diff-controls, .search-toolbar, .explore-hero, .github-band, .result-group, .card, .article-row, .commit-card, .timeline-node__card, .result-item, .explore-card, .editorial-callout, .summary-panel, .diff-output";

let revealObserver = null;
let mutationObserver = null;
let revealSequence = 0;
let contentRefreshBound = false;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function queueReveal(element) {
  if (!(element instanceof HTMLElement) || element.classList.contains("reveal-ready") || element.classList.contains("is-visible")) {
    return;
  }

  element.classList.add("reveal-ready");
  element.style.setProperty("--reveal-delay", `${Math.min(revealSequence * 32, 280)}ms`);
  revealSequence += 1;

  if (revealObserver) {
    revealObserver.observe(element);
  }
}

function queueRevealInNode(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  if (node.matches(REVEAL_SELECTOR)) {
    queueReveal(node);
  }

  node.querySelectorAll(REVEAL_SELECTOR).forEach(queueReveal);
}

function initRevealSystem() {
  if (prefersReducedMotion()) {
    document.querySelectorAll(REVEAL_SELECTOR).forEach((element) => {
      element.classList.add("is-visible");
    });
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px"
      }
    );
  }

  document.querySelectorAll(REVEAL_SELECTOR).forEach(queueReveal);

  if (!mutationObserver) {
    mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(queueRevealInNode);
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (!contentRefreshBound) {
    document.addEventListener("content:updated", () => {
      document.querySelectorAll(REVEAL_SELECTOR).forEach(queueReveal);
    });
    contentRefreshBound = true;
  }
}

function initHeaderScrollState() {
  const header = document.querySelector(".site-header");
  if (!header) {
    return;
  }

  const sync = () => {
    header.classList.toggle("scrolled", window.scrollY > 4);
  };

  sync();
  window.addEventListener("scroll", sync, { passive: true });
}

function resolvePageKey(pathname) {
  const trimmed = String(pathname || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!trimmed) {
    return "home";
  }

  return trimmed.split("/")[0].toLowerCase();
}

function applyPageContext() {
  if (!document.body) {
    return;
  }

  document.body.dataset.page = resolvePageKey(window.location.pathname);
}

export function initSharedPage() {
  logInfo("page.shared.init", { path: window.location.pathname });
  applyPageContext();
  setActiveNav();
  initHeaderScrollState();
  initRevealSystem();
  hydrateIcons();
}
