import { DATE_FORMAT_OPTIONS, NON_ENACTED_AMENDMENTS } from "./constants.js";

const ORDINAL_WORD_TO_NUMBER = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty-first": 21,
  "twenty-second": 22,
  "twenty-third": 23,
  "twenty-fourth": 24,
  "twenty-fifth": 25,
  "twenty-sixth": 26,
  "twenty-seventh": 27
};

function toSafeUpper(value) {
  return String(value || "").toUpperCase();
}

export function slugToArticleId(value) {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }

  if (/^preamble$/i.test(input)) {
    return "PREAMBLE";
  }

  const cleaned = input.replace(/^article[-_\s]*/i, "").replace(/\.md$/i, "").trim();
  const match = cleaned.match(/^(\d{1,3})(?:[-_\s]*([A-Za-z]))?$/);
  if (!match) {
    return toSafeUpper(cleaned);
  }

  const numeric = String(Number(match[1]));
  const suffix = match[2] ? `-${match[2].toUpperCase()}` : "";
  return `${numeric}${suffix}`;
}

export function articleIdToFileName(articleId) {
  const normalized = slugToArticleId(articleId);
  if (!normalized || normalized === "PREAMBLE") {
    return "preamble.md";
  }

  const [n, suffix] = normalized.split("-");
  const padded = n.padStart(3, "0");
  return suffix ? `article-${padded}-${suffix}.md` : `article-${padded}.md`;
}

export function fileNameToArticleId(fileName) {
  if (/^preamble\.md$/i.test(fileName)) {
    return "PREAMBLE";
  }

  const match = String(fileName || "").match(/^article-(\d{3})(?:-([A-Za-z]))?\.md$/i);
  if (!match) {
    return slugToArticleId(fileName);
  }

  const numeric = String(Number(match[1]));
  const suffix = match[2] ? `-${match[2].toUpperCase()}` : "";
  return `${numeric}${suffix}`;
}

export function normalizeRepoArticlePath(path) {
  return String(path || "").replace(/^data\//, "").replace(/^\/+/, "");
}

export function isArticlePath(path) {
  const normalized = normalizeRepoArticlePath(path);
  return normalized.startsWith("federal-constitution/") && normalized.endsWith(".md");
}

export function extractAmendmentNumberFromMessage(message) {
  const m = String(message || "").match(/^([A-Za-z-]+)\s+Amendment\b/i);
  if (!m) {
    return null;
  }

  const ordinalWord = m[1].toLowerCase();
  return ORDINAL_WORD_TO_NUMBER[ordinalWord] || null;
}

export function getCommitAmendmentNumber(commit) {
  if (!commit || Number(commit.commitNumber) <= 1) {
    return null;
  }

  const parsed = extractAmendmentNumberFromMessage(commit.message);
  if (parsed) {
    return parsed;
  }

  const fallback = Number(commit.commitNumber) - 1;
  return NON_ENACTED_AMENDMENTS.has(fallback) ? null : fallback;
}

export function formatDate(dateInput) {
  if (!dateInput) {
    return "Unknown date";
  }

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", DATE_FORMAT_OPTIONS).format(date);
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

export function pluralize(word, count) {
  return Number(count) === 1 ? word : `${word}s`;
}

export function compareArticleIds(a, b) {
  if (a === "PREAMBLE") {
    return -1;
  }

  if (b === "PREAMBLE") {
    return 1;
  }

  const parse = (value) => {
    const match = String(value || "").match(/^(\d+)(?:-([A-Z]))?$/i);
    if (!match) {
      return { n: Number.MAX_SAFE_INTEGER, s: "" };
    }

    return { n: Number(match[1]), s: (match[2] || "").toUpperCase() };
  };

  const pa = parse(a);
  const pb = parse(b);

  if (pa.n !== pb.n) {
    return pa.n - pb.n;
  }

  return pa.s.localeCompare(pb.s);
}

export function isOmittedBody(body) {
  const text = String(body || "");
  return /\bomitted\b/i.test(text) || /\[omitted\]/i.test(text);
}

export function getPathTail(pathname) {
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export function escapeHtml(input) {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseMaybeHash(value) {
  const hash = String(value || "").trim();
  return /^[a-fA-F0-9]{7,40}$/.test(hash) ? hash : "";
}
