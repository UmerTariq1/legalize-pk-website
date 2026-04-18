import { LANDMARK_CALLOUTS, PARTY_LABELS, ROUTES } from "./constants.js";
import { escapeHtml, formatDate } from "./utils.js";

const ROUTE_TO_KEY = {
  [ROUTES.home]: "home",
  [ROUTES.constitution]: "constitution",
  [ROUTES.explore]: "explore",
  [ROUTES.timeline]: "timeline",
  [ROUTES.search]: "search"
};

export function partyClassName(party) {
  if (party === "ppp") {
    return "party-chip--ppp";
  }
  if (party === "military") {
    return "party-chip--military";
  }
  if (party === "pmln") {
    return "party-chip--pmln";
  }
  if (party === "coalition") {
    return "party-chip--coalition";
  }
  return "party-chip--neutral";
}

export function createPartyChip(party) {
  const label = PARTY_LABELS[party] || PARTY_LABELS.neutral;
  return `<span class="party-chip ${partyClassName(party)}">${escapeHtml(label)}</span>`;
}

export function createEditorialCallout(amendmentNumber) {
  const callout = LANDMARK_CALLOUTS[Number(amendmentNumber)];
  if (!callout) {
    return "";
  }

  return `
    <aside class="editorial-callout" role="note" aria-label="Editorial callout">
      <p class="editorial-callout__label">${escapeHtml(callout.title)}</p>
      <h3 class="editorial-callout__title">${escapeHtml(callout.subtitle)}</h3>
      <p class="editorial-callout__body">${escapeHtml(callout.body)}</p>
    </aside>
  `;
}

export function createProxyStatusMarkup({ state = "idle", message = "" } = {}) {
  const stateClass = `proxy-status--${state}`;
  const label = state === "loading" ? "Syncing" : state === "error" ? "Issue" : state === "cached" ? "Cached" : "Ready";

  return `
    <div class="proxy-status ${stateClass}" role="status" aria-live="polite">
      <span class="proxy-status__dot" aria-hidden="true"></span>
      <span class="proxy-status__label">${label}</span>
      <span class="proxy-status__message">${escapeHtml(message)}</span>
    </div>
  `;
}

export function hydrateIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

export function setActiveNav() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const key =
    ROUTE_TO_KEY[path] ||
    (path.startsWith("/article") || path.startsWith("/amendment") || path.startsWith("/diff") ? "explore" : null);
  if (!key) {
    return;
  }

  document.querySelectorAll("[data-nav-key]").forEach((link) => {
    const isActive = link.getAttribute("data-nav-key") === key;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

export function setPageTitle(sectionTitle) {
  document.title = `${sectionTitle} | Legalize PK`;
}

export function updateUrl(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      url.searchParams.delete(key);
      return;
    }

    url.searchParams.set(key, value);
  });

  window.history.replaceState({}, "", url.toString());
}

export function routeWithId(baseRoute, idValue) {
  const rawId = idValue === undefined || idValue === null ? "" : String(idValue).trim();
  const id = encodeURIComponent(rawId);
  return `${baseRoute}/${id}`;
}

export function formatMetaDate(dateValue) {
  return formatDate(dateValue);
}
