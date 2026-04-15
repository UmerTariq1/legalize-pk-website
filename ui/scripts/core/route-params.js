import { getPathTail, slugToArticleId } from "./utils.js";

export function getArticleIdFromUrl() {
  const fromPath = getPathTail(window.location.pathname);
  if (fromPath && fromPath !== "article") {
    return slugToArticleId(decodeURIComponent(fromPath));
  }

  const fromQuery = new URLSearchParams(window.location.search).get("id");
  if (fromQuery) {
    return slugToArticleId(fromQuery);
  }

  return "";
}

export function getAmendmentNumberFromUrl() {
  const fromPath = getPathTail(window.location.pathname);
  if (fromPath && fromPath !== "amendment") {
    const parsed = Number(decodeURIComponent(fromPath));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const fromQuery = new URLSearchParams(window.location.search).get("n");
  if (!fromQuery) {
    return null;
  }

  const parsed = Number(fromQuery);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getDiffArticleIdFromUrl() {
  const fromPath = getPathTail(window.location.pathname);
  if (fromPath && fromPath !== "diff") {
    return slugToArticleId(decodeURIComponent(fromPath));
  }

  const fromQuery = new URLSearchParams(window.location.search).get("article");
  if (!fromQuery) {
    return "";
  }

  return slugToArticleId(fromQuery);
}
