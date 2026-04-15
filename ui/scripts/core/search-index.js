import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs";
import { formatDate } from "./utils.js";

function deriveArticleLabel(pathOrFileName) {
  const raw = String(pathOrFileName || "").trim();
  if (!raw) {
    return "";
  }

  const fileName = raw.includes("/") ? raw.split("/").pop() : raw;
  const stem = String(fileName || "").replace(/\.md$/i, "");

  if (/^preamble$/i.test(stem)) {
    return "PREAMBLE";
  }

  const withoutPrefix = stem.replace(/^article-/i, "");
  const match = withoutPrefix.match(/^(\d+)(?:-([A-Za-z]))?$/);
  if (!match) {
    return "";
  }

  const numeric = String(Number(match[1]));
  const suffix = match[2] ? `-${match[2].toUpperCase()}` : "";
  return `${numeric}${suffix}`;
}

function normalizeArticleQueryLabel(query) {
  const raw = String(query || "")
    .trim()
    .replace(/^article\s+/i, "")
    .replace(/^article-/i, "")
    .trim();

  const match = raw.match(/^(\d+)(?:\s*-\s*([A-Za-z]))?$/);
  if (!match) {
    return "";
  }

  const numeric = String(Number(match[1]));
  const suffix = match[2] ? `-${match[2].toUpperCase()}` : "";
  return `${numeric}${suffix}`;
}

function withUniqueIds(items) {
  return items.map((item, index) => ({
    ...item,
    docId: `${item.type}:${item.id}:${index}`
  }));
}

function buildDocuments(data) {
  const articleDocs = data.articles.map((article) => {
    const derivedLabel = deriveArticleLabel(article.repoPath || article.fileName || "");
    const normalizedLabel = derivedLabel.toLowerCase();

    return {
      type: "article",
      id: article.articleId,
      title: article.articleId === "PREAMBLE" ? "Preamble" : `Article ${article.articleId}`,
      subtitle: article.displayTitle,
      date: article.lastUpdated,
      targetUrl: article.articleId === "PREAMBLE" ? "/article/PREAMBLE" : `/article/${article.articleId}`,
      articleLabel: derivedLabel,
      searchText: [article.articleId, article.displayTitle, derivedLabel, normalizedLabel ? `article ${derivedLabel}` : ""]
        .filter(Boolean)
        .join(" ")
    };
  });

  const amendmentDocs = data.amendments.map((commit) => ({
    type: "amendment",
    id: String(commit.amendmentNumber),
    title: `Amendment ${commit.amendmentNumber}`,
    subtitle: commit.message,
    date: commit.date,
    party: commit.party,
    targetUrl: `/amendment/${commit.amendmentNumber}`,
    articleLabel: "",
    searchText: [commit.amendmentNumber, commit.message].join(" ")
  }));

  return withUniqueIds([...articleDocs, ...amendmentDocs]).map((doc) => ({
    ...doc,
    dateLabel: formatDate(doc.date),
    normalized: [doc.searchText, doc.articleLabel ? `article ${doc.articleLabel}` : ""].filter(Boolean).join(" ").toLowerCase()
  }));
}

export function createSearchEngine(data) {
  const docs = buildDocuments(data);
  const fuse = new Fuse(docs, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.35,
    keys: [
      { name: "title", weight: 0.45 },
      { name: "subtitle", weight: 0.3 },
      { name: "searchText", weight: 0.25 }
    ]
  });

  function search(query) {
    const q = String(query || "").trim();
    if (!q) {
      return [];
    }

    const normalizedArticleLabel = normalizeArticleQueryLabel(q);
    const queryCandidates = [q];

    if (normalizedArticleLabel) {
      queryCandidates.push(normalizedArticleLabel, `article ${normalizedArticleLabel}`);
    }

    const byId = new Map();
    queryCandidates.forEach((candidate) => {
      fuse.search(candidate, { limit: 60 }).forEach((item) => {
        byId.set(item.item.docId, item.item);
      });
    });

    const fuseResults = Array.from(byId.values()).slice(0, 60);
    if (fuseResults.length) {
      return fuseResults;
    }

    const fallbackTokens = new Set(queryCandidates.map((candidate) => candidate.toLowerCase()));
    if (normalizedArticleLabel) {
      fallbackTokens.add(normalizedArticleLabel.toLowerCase());
    }

    return docs
      .filter((doc) => {
        if (normalizedArticleLabel && doc.type === "article" && doc.articleLabel === normalizedArticleLabel) {
          return true;
        }

        for (const token of fallbackTokens) {
          if (token && doc.normalized.includes(token)) {
            return true;
          }
        }

        return false;
      })
      .slice(0, 60);
  }

  return {
    search,
    total: docs.length,
    documents: docs
  };
}
