import { DATA_URLS, NON_ENACTED_AMENDMENTS, PARTY_BY_AMENDMENT } from "./constants.js";
import { endTimer, logError, logInfo, startTimer } from "./logger.js";
import {
  articleIdToFileName,
  compareArticleIds,
  fileNameToArticleId,
  getCommitAmendmentNumber,
  isArticlePath,
  normalizeRepoArticlePath,
  slugToArticleId
} from "./utils.js";

let datasetsPromise;

async function fetchJson(url, label) {
  const timer = startTimer("data.fetch", { label, url });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }

    const json = await response.json();
    endTimer(timer, { label, status: response.status });
    return json;
  } catch (error) {
    logError("data.fetch.error", {
      label,
      url,
      message: error.message
    });
    throw error;
  }
}

function inferTitle(article) {
  if (article.title && String(article.title).trim()) {
    return String(article.title).trim();
  }

  const firstLine = String(article.body || "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return article.fileName;
  }

  const plain = firstLine.replace(/^#+\s*/, "").replace(/[\*_`]/g, "");
  return plain.length > 120 ? `${plain.slice(0, 117)}...` : plain;
}

function buildIndexes(timelineData, constitutionData) {
  const commits = (timelineData.commits || []).map((commit) => {
    const amendmentNumber = getCommitAmendmentNumber(commit);
    const affectedArticles = (commit.filesChanged || [])
      .filter(isArticlePath)
      .map(normalizeRepoArticlePath);

    return {
      ...commit,
      amendmentNumber,
      enactedIndex: commit.commitNumber > 1 ? commit.commitNumber - 1 : null,
      affectedArticles,
      party: amendmentNumber ? PARTY_BY_AMENDMENT[amendmentNumber] || "neutral" : "neutral"
    };
  });

  const commitByHash = new Map(commits.map((commit) => [commit.hash, commit]));

  const commitsByArticlePath = new Map();
  commits.forEach((commit) => {
    commit.affectedArticles.forEach((path) => {
      if (!commitsByArticlePath.has(path)) {
        commitsByArticlePath.set(path, []);
      }
      commitsByArticlePath.get(path).push(commit);
    });
  });

  const rawArticleIndex = timelineData.articles || {};

  const articles = (constitutionData.articles || []).map((article) => {
    const articleId = fileNameToArticleId(article.fileName);
    const repoPath = normalizeRepoArticlePath(article.filePath);
    const indexEntry = rawArticleIndex[repoPath] || { changeCount: 0, amendments: [] };

    return {
      ...article,
      articleId,
      repoPath,
      displayTitle: inferTitle(article),
      changeCount: indexEntry.changeCount || 0,
      amendmentLinks: indexEntry.amendments || []
    };
  });

  articles.sort((a, b) => compareArticleIds(a.articleId, b.articleId));

  const articleById = new Map(articles.map((article) => [article.articleId, article]));
  const articleByRepoPath = new Map(articles.map((article) => [article.repoPath, article]));

  const amendments = commits
    .filter((commit) => commit.amendmentNumber && !NON_ENACTED_AMENDMENTS.has(commit.amendmentNumber))
    .sort((a, b) => a.amendmentNumber - b.amendmentNumber);

  const amendmentByNumber = new Map(amendments.map((commit) => [commit.amendmentNumber, commit]));

  return {
    commits,
    commitByHash,
    commitsByArticlePath,
    articleIndex: rawArticleIndex,
    articles,
    articleById,
    articleByRepoPath,
    amendments,
    amendmentByNumber,
    generatedAt: constitutionData.generatedAt,
    articleCount: constitutionData.count || articles.length
  };
}

export async function loadDatasets() {
  if (datasetsPromise) {
    logInfo("data.load.cache-hit");
    return datasetsPromise;
  }

  const timer = startTimer("data.load");

  if (!datasetsPromise) {
    datasetsPromise = Promise.all([
      fetchJson(DATA_URLS.timeline, "timeline"),
      fetchJson(DATA_URLS.constitution, "constitution")
    ])
      .then(([timelineData, constitutionData]) => {
        const indexed = buildIndexes(timelineData, constitutionData);
        endTimer(timer, {
          commits: indexed.commits.length,
          amendments: indexed.amendments.length,
          articles: indexed.articles.length
        });
        return indexed;
      })
      .catch((error) => {
        logError("data.load.error", { message: error.message });
        throw error;
      });
  }

  return datasetsPromise;
}

export async function getArticleById(articleId) {
  const data = await loadDatasets();
  return data.articleById.get(slugToArticleId(articleId)) || null;
}

export async function getArticleCommits(articleId) {
  const data = await loadDatasets();
  const normalizedId = slugToArticleId(articleId);
  const article = data.articleById.get(normalizedId);
  if (!article) {
    return [];
  }
  return data.commitsByArticlePath.get(article.repoPath) || [];
}

export async function getAmendmentByNumber(numberValue) {
  const data = await loadDatasets();
  const amendmentNumber = Number(numberValue);

  if (!Number.isFinite(amendmentNumber)) {
    return null;
  }

  if (amendmentNumber === 0) {
    const originalCommit = data.commits.find((commit) => Number(commit.commitNumber) === 1) || null;
    if (!originalCommit) {
      return null;
    }

    return {
      ...originalCommit,
      amendmentNumber: 0,
      isOriginalConstitution: true
    };
  }

  return data.amendmentByNumber.get(amendmentNumber) || null;
}

export async function getCommitByHash(hash) {
  const data = await loadDatasets();
  return data.commitByHash.get(hash) || null;
}

export async function getArticleChoices() {
  const data = await loadDatasets();
  return data.articles.map((article) => ({
    articleId: article.articleId,
    label: article.articleId === "PREAMBLE" ? "Preamble" : `Article ${article.articleId}`,
    fileName: article.fileName,
    displayTitle: article.displayTitle
  }));
}

export async function getAmendmentChoices() {
  const data = await loadDatasets();
  return data.amendments.map((commit) => ({
    number: commit.amendmentNumber,
    label: `Amendment ${commit.amendmentNumber}`,
    date: commit.date,
    hash: commit.hash,
    message: commit.message
  }));
}

export async function getStats() {
  const data = await loadDatasets();
  const firstDate = data.commits[0]?.date;
  const lastDate = data.commits[data.commits.length - 1]?.date;

  return {
    enactedAmendments: data.amendments.length,
    articleCount: data.articleCount,
    totalCommits: data.commits.length,
    firstDate,
    lastDate,
    generatedAt: data.generatedAt
  };
}

export function buildArticleRepoPath(articleId) {
  const fileName = articleIdToFileName(articleId);
  return `federal-constitution/${fileName}`;
}
