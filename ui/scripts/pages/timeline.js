import { loadDatasets } from "../core/data-service.js";
import { LANDMARK_SET } from "../core/constants.js";
import { logError, logInfo } from "../core/logger.js";
import {
  createEditorialCallout,
  createPartyChip,
  hydrateIcons,
  setPageTitle,
  updateUrl
} from "../core/ui-helpers.js";
import { escapeHtml, formatDate } from "../core/utils.js";
import { initSharedPage } from "./shared.js";

let allCommits = [];

function recentFifteenStart() {
  const year = new Date().getUTCFullYear() - 15;
  return `${year}-01-01`;
}

function syncPresetStates(from, to) {
  const checks = {
    all: !from && !to,
    century21: from === "2000-01-01" && !to,
    post18: from === "2010-04-19" && !to,
    recent15: from === recentFifteenStart() && !to
  };

  document.querySelectorAll("[data-range-preset]").forEach((button) => {
    const key = button.getAttribute("data-range-preset") || "";
    const active = Boolean(checks[key]);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.classList.toggle("is-active", active);
  });
}

function applyRangePreset(preset) {
  const fromInput = document.querySelector("#timeline-from");
  const toInput = document.querySelector("#timeline-to");
  if (!fromInput || !toInput) {
    return;
  }

  if (preset === "all") {
    fromInput.value = "";
    toInput.value = "";
  } else if (preset === "century21") {
    fromInput.value = "2000-01-01";
    toInput.value = "";
  } else if (preset === "post18") {
    fromInput.value = "2010-04-19";
    toInput.value = "";
  } else if (preset === "recent15") {
    fromInput.value = recentFifteenStart();
    toInput.value = "";
  }

  logInfo("timeline.filter.preset", {
    preset,
    from: fromInput.value,
    to: toInput.value
  });
  renderTimeline();
}

function partyKey(party) {
  const value = String(party || "").toLowerCase();
  if (["ppp", "military", "pmln", "coalition"].includes(value)) {
    return value;
  }
  return "neutral";
}

function inDateRange(commit, from, to) {
  const value = new Date(commit.date).getTime();
  if (from) {
    const fromValue = new Date(from).getTime();
    if (value < fromValue) {
      return false;
    }
  }

  if (to) {
    const toValue = new Date(to).getTime();
    if (value > toValue) {
      return false;
    }
  }

  return true;
}

function commitTarget(commit) {
  if (!commit.amendmentNumber) {
    return "/constitution";
  }
  return `/amendment/${commit.amendmentNumber}`;
}

function renderTimeline() {
  const from = document.querySelector("#timeline-from")?.value || "";
  const to = document.querySelector("#timeline-to")?.value || "";
  const invalidRange = Boolean(from && to && new Date(from).getTime() > new Date(to).getTime());

  const track = document.querySelector("[data-timeline-track]");
  if (!track) {
    return;
  }

  const count = document.querySelector("[data-range-count]");

  if (invalidRange) {
    logInfo("timeline.render.invalid-range", { from, to });
    track.innerHTML = '<div class="info-empty info-empty--warning"><i data-lucide="alert-triangle" aria-hidden="true"></i><span>"From" date cannot be after "To" date.</span></div>';
    if (count) {
      count.textContent = "Invalid date range";
    }

    syncPresetStates(from, to);
    document.dispatchEvent(new CustomEvent("content:updated"));
    updateUrl({ from, to });
    hydrateIcons();
    return;
  }

  const filtered = allCommits.filter((commit) => inDateRange(commit, from, to));
  logInfo("timeline.render", {
    from,
    to,
    resultCount: filtered.length
  });

  if (!filtered.length) {
    track.innerHTML = '<div class="info-empty">No constitutional events in this date range.</div>';
    if (count) {
      count.textContent = "0 Constitutional Events";
    }
    syncPresetStates(from, to);
    document.dispatchEvent(new CustomEvent("content:updated"));
    updateUrl({ from, to });
    hydrateIcons();
    return;
  }

  track.innerHTML = filtered
    .map((commit) => {
      const title = commit.amendmentNumber ? `Amendment ${commit.amendmentNumber}` : "Original Constitution";
      const landmarkCallout = commit.amendmentNumber && LANDMARK_SET.has(commit.amendmentNumber) ? createEditorialCallout(commit.amendmentNumber) : "";
      const isLandmark = Boolean(commit.amendmentNumber && LANDMARK_SET.has(commit.amendmentNumber));
      const party = partyKey(commit.party);

      return `
        <article class="timeline-node ${isLandmark ? "timeline-node--landmark" : ""}" data-party="${party}">
          <span class="timeline-node__dot" aria-hidden="true"></span>
          <a class="timeline-node__card" href="${commitTarget(commit)}">
            ${isLandmark ? '<span class="badge badge--landmark">Landmark</span>' : ""}
            <h3>${title}</h3>
            <p>${escapeHtml(commit.message)}</p>
            <div class="timeline-node__meta">
              <span class="badge badge--calendar"><i data-lucide="calendar-days" aria-hidden="true"></i>${formatDate(commit.date)}</span>
              <span class="badge badge--president"><i data-lucide="user-round" aria-hidden="true"></i>${escapeHtml(commit.author)}</span>
              ${createPartyChip(commit.party)}
              <span class="badge badge--count"><i data-lucide="pen-square" aria-hidden="true"></i>${commit.affectedArticles.length} Articles Changed</span>
            </div>
            ${landmarkCallout}
          </a>
        </article>
      `;
    })
    .join("");

  if (count) {
    count.textContent = `${filtered.length} Constitutional Events`;
  }

  syncPresetStates(from, to);

  document.dispatchEvent(new CustomEvent("content:updated"));
  updateUrl({ from, to });
  hydrateIcons();

  track.querySelectorAll(".timeline-node__dot").forEach((dot, index) => {
    dot.style.setProperty("--dot-delay", `${Math.min(index * 55, 550)}ms`);
  });
}

function wireInputs() {
  document.querySelector("#timeline-from")?.addEventListener("change", (event) => {
    logInfo("timeline.filter.from", { value: event.target.value || "" });
    renderTimeline();
  });
  document.querySelector("#timeline-to")?.addEventListener("change", (event) => {
    logInfo("timeline.filter.to", { value: event.target.value || "" });
    renderTimeline();
  });

  document.querySelector("[data-timeline-presets]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-range-preset]");
    if (!button) {
      return;
    }

    applyRangePreset(button.getAttribute("data-range-preset") || "all");
  });

  document.querySelector("[data-reset-range]")?.addEventListener("click", () => {
    logInfo("timeline.filter.reset");
    const from = document.querySelector("#timeline-from");
    const to = document.querySelector("#timeline-to");
    if (from) {
      from.value = "";
    }
    if (to) {
      to.value = "";
    }
    renderTimeline();
  });
}

async function initPage() {
  logInfo("timeline.init");
  initSharedPage();
  setPageTitle("Constitution Timeline");

  const data = await loadDatasets();
  allCommits = data.commits;
  logInfo("timeline.data.loaded", { commitCount: allCommits.length });

  const params = new URLSearchParams(window.location.search);
  const from = params.get("from") || "";
  const to = params.get("to") || "";

  const fromInput = document.querySelector("#timeline-from");
  const toInput = document.querySelector("#timeline-to");
  if (fromInput) {
    fromInput.value = from;
  }
  if (toInput) {
    toInput.value = to;
  }

  wireInputs();
  renderTimeline();
}

initPage().catch((error) => {
  logError("timeline.init.error", { message: error.message });
  const target = document.querySelector("[data-timeline-error]");
  if (target) {
    target.innerHTML = `<div class="info-empty">${escapeHtml(error.message)}</div>`;
  }
});
