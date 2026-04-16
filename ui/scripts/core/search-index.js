import { formatDate } from "./utils.js";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsWholePhrase(field, phrase) {
  const normalizedField = normalizeText(field);
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedField || !normalizedPhrase) {
    return false;
  }

  if (normalizedField === normalizedPhrase) {
    return true;
  }

  return ` ${normalizedField} `.includes(` ${normalizedPhrase} `);
}

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

function normalizeAmendmentQuery(query) {
  const raw = String(query || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }

  let match = raw.match(/^(\d+)(?:st|nd|rd|th)?\s+amendment$/);
  if (match) {
    return String(Number(match[1]));
  }

  match = raw.match(/^amendment\s+(\d+)(?:st|nd|rd|th)?$/);
  if (match) {
    return String(Number(match[1]));
  }

  return "";
}

function formatOrdinal(numberValue) {
  const n = Number(numberValue);
  if (!Number.isFinite(n)) {
    return "";
  }

  const remainder100 = n % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${n}th`;
  }

  const remainder10 = n % 10;
  if (remainder10 === 1) {
    return `${n}st`;
  }
  if (remainder10 === 2) {
    return `${n}nd`;
  }
  if (remainder10 === 3) {
    return `${n}rd`;
  }
  return `${n}th`;
}

function amendmentSearchAliases(numberValue) {
  const n = Number(numberValue);
  if (!Number.isFinite(n)) {
    return "";
  }

  const ordinal = formatOrdinal(n);
  return [`amendment ${n}`, `${ordinal} amendment`, `${n} amendment`, `${n}th amendment`].join(" ");
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
    const bodySnippet = String(article.body || "").replace(/\s+/g, " ").trim().slice(0, 5000);

    return {
      type: "article",
      id: article.articleId,
      title: article.articleId === "PREAMBLE" ? "Preamble" : `Article ${article.articleId}`,
      subtitle: article.displayTitle,
      date: article.lastUpdated,
      targetUrl: article.articleId === "PREAMBLE" ? "/article/PREAMBLE" : `/article/${article.articleId}`,
      articleLabel: derivedLabel,
      searchText: [article.articleId, article.displayTitle, derivedLabel, normalizedLabel ? `article ${derivedLabel}` : "", bodySnippet]
        .filter(Boolean)
        .join(" ")
    };
  });

  const amendmentDocs = data.amendments.map((commit) => {
    const touchedArticleLabels = (commit.affectedArticles || [])
      .map(deriveArticleLabel)
      .filter(Boolean)
      .map((label) => `article ${label}`)
      .join(" ");

    return {
      type: "amendment",
      id: String(commit.amendmentNumber),
      title: `Amendment ${commit.amendmentNumber}`,
      subtitle: commit.message,
      date: commit.date,
      party: commit.party,
      targetUrl: `/amendment/${commit.amendmentNumber}`,
      articleLabel: "",
      searchText: [
        commit.amendmentNumber,
        amendmentSearchAliases(commit.amendmentNumber),
        commit.message,
        commit.summary || "",
        touchedArticleLabels
      ]
        .filter(Boolean)
        .join(" ")
    };
  });

  return withUniqueIds([...articleDocs, ...amendmentDocs]).map((doc) => {
    const searchFields = [doc.title, doc.subtitle, doc.searchText, doc.articleLabel ? `article ${doc.articleLabel}` : ""]
      .map(normalizeText)
      .filter(Boolean);

    return {
      ...doc,
      dateLabel: formatDate(doc.date),
      searchFields
    };
  });
}

export function createSearchEngine(data) {
  const docs = buildDocuments(data);

  function search(query) {
    const rawQuery = String(query || "").trim();
    const exactQuery = normalizeText(rawQuery);
    if (!exactQuery) {
      return [];
    }

    const normalizedArticleLabel = normalizeArticleQueryLabel(rawQuery);
    const normalizedAmendmentNumber = normalizeAmendmentQuery(rawQuery);

    return docs
      .filter((doc) => {
        if (normalizedArticleLabel && doc.type === "article" && doc.articleLabel === normalizedArticleLabel) {
          return true;
        }

        if (normalizedAmendmentNumber && doc.type === "amendment" && doc.id === normalizedAmendmentNumber) {
          return true;
        }

        return doc.searchFields.some((field) => containsWholePhrase(field, exactQuery));
      })
      .slice(0, 60);
  }

  return {
    search,
    total: docs.length,
    documents: docs
  };
}
