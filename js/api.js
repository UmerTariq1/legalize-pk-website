/* GitHub API wrapper via Netlify proxy with dummy fallback. */

(function () {
  function assertConfig() {
    if (!window.APP_CONFIG) throw new Error("Missing APP_CONFIG. Ensure js/config.js is loaded first.");
    return window.APP_CONFIG;
  }

  function getRepo() {
    const { REPO_OWNER, REPO_NAME } = assertConfig();
    if (!REPO_OWNER || !REPO_NAME) return null;
    return { owner: REPO_OWNER, name: REPO_NAME };
  }

  function endpointUrl(endpoint) {
    const encoded = encodeURIComponent(endpoint);
    return `/api/github?endpoint=${encoded}`;
  }

  async function fetchJson(endpoint) {
    if (typeof window.LPK?.api === "function") window.LPK.api("request", endpoint);
    const res = await fetch(endpointUrl(endpoint), { headers: { accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (typeof window.LPK?.api === "function") window.LPK.api("error", { endpoint, status: res.status });
      const msg = data?.error ? `${data.error}` : `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    if (typeof window.LPK?.api === "function") window.LPK.api("ok", { endpoint, status: res.status });
    return data;
  }

  function decodeBase64Utf8(b64) {
    // GitHub uses base64 with newlines.
    const clean = String(b64 || "").replace(/\n/g, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function encodeRepoPath(path) {
    // For GitHub /contents/{path}: keep slashes, encode segments.
    return String(path)
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
  }

  /** Lowercase hyphenated slug → amendment number (matches summary filenames & commit subjects). */
  const ORDINAL_SLUG_TO_NUM = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    eigth: 8, // typo in repo: eleven-1985-eigth-amendment.md
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
    "twenty-seventh": 27,
  };

  /**
   * Commit subject lines like "Twenty-seventh Amendment 2025-11-13 Asif Ali Zardari"
   * or "Original Constitution …" (number 0).
   */
  function amendmentNumberFromCommitSubject(message) {
    const line = String(message || "")
      .split("\n")[0]
      .trim();
    if (!line) return null;
    if (/original/i.test(line) && /constitution/i.test(line)) return 0;
    const digit = line.match(/(\d+)(st|nd|rd|th)\b/i);
    if (digit) return parseInt(digit[1], 10);
    const m = line.match(/^(.+?)\s+Amendment\b/i);
    if (!m) return null;
    const slug = m[1]
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .join("-");
    return ORDINAL_SLUG_TO_NUM[slug] ?? null;
  }

  /**
   * Summary files: MM-YYYY-ordinal-amendment.md (e.g. 11-2025-twenty-seventh-amendment.md)
   * Legacy alternate: YYYY-NN-*.md   */
  function parseSummaryFilenameMeta(name) {
    const s = String(name);
    const legacy = s.match(/^(\d{4})-(\d{2})-(.+)\.md$/i);
    if (legacy) {
      const num = parseInt(legacy[2], 10);
      return {
        year: legacy[1],
        month: null,
        number: Number.isNaN(num) ? null : num,
        pattern: "yyyy-mm-prefix",
      };
    }
    const modern = s.match(/^(\d{2})-(\d{4})-(.+)\.md$/i);
    if (!modern) {
      return { year: null, month: null, number: null, pattern: null };
    }
    const month = modern[1];
    const year = modern[2];
    const rest = modern[3].toLowerCase();
    if (rest === "original-constitution") {
      return { year, month, number: 0, pattern: "mm-yyyy-slug" };
    }
    const amd = rest.match(/^(.+)-amendment$/);
    if (!amd) {
      return { year, month, number: null, pattern: "mm-yyyy-slug" };
    }
    const slug = amd[1];
    const number = ORDINAL_SLUG_TO_NUM[slug] ?? null;
    return { year, month, number, pattern: "mm-yyyy-slug" };
  }

  function articlePathFromParam(articleParam) {
    // Handles both plain numbers ("17" → "article-017.md") and suffixed forms ("270-A" → "article-270-A.md")
    const n = String(articleParam || "").trim();
    if (!n) return null;
    // Check for suffixed form e.g. "270-A" or "017-A"
    const suffixMatch = n.match(/^(\d+)(-[A-Z])$/i);
    if (suffixMatch) {
      const base = suffixMatch[1].padStart(3, "0");
      const suffix = suffixMatch[2].toUpperCase();
      return `federal-constitution/article-${base}${suffix}.md`;
    }
    const three = n.padStart(3, "0");
    return `federal-constitution/article-${three}.md`;
  }

  async function listArticlesLive() {
    const repo = getRepo();
    if (!repo) throw new Error("Missing REPO_OWNER/REPO_NAME");
    const items = await fetchJson(`/repos/${repo.owner}/${repo.name}/contents/federal-constitution`);
    const mdFiles = (items || []).filter((x) => x?.type === "file" && typeof x?.name === "string" && x.name.endsWith(".md"));

    const out = mdFiles
      .map((f) => {
        // Match standard articles (article-017.md) and suffixed ones (article-270-A.md, article-203-C.md)
        const m = f.name.match(/^article-(\d+)(-[A-Z])?\.md$/i);
        if (!m) return null;
        const baseNum = m[1];
        const suffix = m[2] ? m[2].toUpperCase() : "";
        const num = `${baseNum}${suffix}`;
        const displayNum = parseInt(baseNum, 10);
        const displayLabel = suffix ? `Article ${displayNum}${suffix}` : `Article ${displayNum}`;
        return {
          number: num,
          title: null,
          label: displayLabel,
          path: f.path,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const numA = parseInt(a.number, 10);
        const numB = parseInt(b.number, 10);
        if (numA !== numB) return numA - numB;
        return a.number.localeCompare(b.number);
      });

    return out;
  }

  async function listCommitsForFileLive(filePath) {
    const repo = getRepo();
    if (!repo) throw new Error("Missing REPO_OWNER/REPO_NAME");
    const commits = await fetchJson(
      `/repos/${repo.owner}/${repo.name}/commits?path=${encodeURIComponent(filePath)}&per_page=100`
    );
    return commits || [];
  }

  async function getFileContentAtShaLive(filePath, sha) {
    const repo = getRepo();
    if (!repo) throw new Error("Missing REPO_OWNER/REPO_NAME");
    const ref = sha ? `?ref=${encodeURIComponent(sha)}` : "";
    const blob = await fetchJson(`/repos/${repo.owner}/${repo.name}/contents/${encodeRepoPath(filePath)}${ref}`);
    const content = decodeBase64Utf8(blob?.content || "");
    return content;
  }

  async function compareCommitsLive(before, after, filePath) {
    const repo = getRepo();
    if (!repo) throw new Error("Missing REPO_OWNER/REPO_NAME");
    const cmp = await fetchJson(`/repos/${repo.owner}/${repo.name}/compare/${before}...${after}`);
    const file = (cmp?.files || []).find((f) => f?.filename === filePath);
    return {
      status: cmp?.status || null,
      aheadBy: cmp?.ahead_by ?? null,
      behindBy: cmp?.behind_by ?? null,
      totalCommits: cmp?.total_commits ?? null,
      patch: file?.patch || null,
      files: cmp?.files || [],
    };
  }

  // Summaries live in a static folder at repo tip; resolve HEAD once and read that tree (not per-commit).
  let _summariesHeadCache = { ref: null, sha: null, expires: 0 };

  async function getSummariesTreeRef() {
    const now = Date.now();
    if (_summariesHeadCache.ref && now < _summariesHeadCache.expires) {
      return _summariesHeadCache;
    }
    const repo = getRepo();
    if (!repo) throw new Error("Missing REPO_OWNER/REPO_NAME");
    const meta = await fetchJson(`/repos/${repo.owner}/${repo.name}`);
    const branch = meta.default_branch || "main";
    let headSha = null;
    try {
      const ref = await fetchJson(
        `/repos/${repo.owner}/${repo.name}/git/ref/heads/${encodeURIComponent(branch)}`
      );
      headSha = ref?.object?.sha || null;
    } catch {
      headSha = null;
    }
    const ref = headSha || branch;
    _summariesHeadCache = { ref, sha: headSha, expires: now + 120_000 };
    return _summariesHeadCache;
  }

  async function listAmendmentSummariesLive() {
    const repo = getRepo();
    if (!repo) throw new Error("Missing REPO_OWNER/REPO_NAME");

    const { ref } = await getSummariesTreeRef();
    const refQ = `?ref=${encodeURIComponent(ref)}`;

    // Canonical folder in repo is often spelled federal-ammendment-summaries; try both.
    const folderCandidates = ["federal-ammendment-summaries", "federal-amendment-summaries"];
    let items;
    let lastErr;
    for (const folder of folderCandidates) {
      try {
        items = await fetchJson(
          `/repos/${repo.owner}/${repo.name}/contents/${encodeRepoPath(folder)}${refQ}`
        );
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;

    const mdFiles = (items || []).filter((x) => x?.type === "file" && typeof x?.name === "string" && x.name.endsWith(".md"));

    const summaries = [];
    for (const f of mdFiles) {
      const blob = await fetchJson(
        `/repos/${repo.owner}/${repo.name}/contents/${encodeRepoPath(f.path)}${refQ}`
      );
      const text = decodeBase64Utf8(blob?.content || "");
      summaries.push({
        path: f.path,
        name: f.name,
        text,
      });
    }
    return summaries;
  }

  async function listAllCommitsLive() {
    const repo = getRepo();
    if (!repo) throw new Error("Missing REPO_OWNER/REPO_NAME");
    // This repo is small (25 total), but still request generously.
    const commits = await fetchJson(`/repos/${repo.owner}/${repo.name}/commits?per_page=100`);
    return commits || [];
  }

  function toIsoDate(dateTime) {
    if (!dateTime) return null;
    const d = new Date(dateTime);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  // Public API expected by pages.
  window.Api = {
    articlePathFromParam,

    async listArticles() {
      return listArticlesLive();
    },

    async listAmendments() {
      const repo = getRepo();
      const commits = await listAllCommitsLive();

      // For each commit, fetch the list of changed files so we can count articles affected.
      // We do this lazily per-commit via the single-commit detail endpoint.
      const items = await Promise.all(
        (commits || []).map(async (c) => {
          const message = c?.commit?.message?.split("\n")[0] || "Amendment";
          const assentDate = toIsoDate(c?.commit?.author?.date || c?.commit?.committer?.date) || null;
          // Commit author name is the president (backdated commits use president as author).
          const president = c?.commit?.author?.name || c?.commit?.committer?.name || null;
          const number = amendmentNumberFromCommitSubject(message);

          // Count files changed inside federal-constitution/ to get accurate articlesAffected.
          let articlesAffected = null;
          try {
            const detail = await fetchJson(`/repos/${repo.owner}/${repo.name}/commits/${c.sha}`);
            const changedFiles = (detail?.files || []).filter(
              (f) => f?.filename?.startsWith("federal-constitution/") && f?.filename?.endsWith(".md")
            );
            articlesAffected = changedFiles.length || null;
          } catch {
            // Non-fatal — fall back to null so amendments.js uses its fallback.
          }

          return {
            sha: c.sha,
            name: message,
            assentDate,
            president,
            number,
            articlesAffected,
          };
        })
      );

      // Chronological order, oldest first (Original first).
      items.sort((a, b) => {
        if (!a.assentDate && !b.assentDate) return 0;
        if (!a.assentDate) return 1;
        if (!b.assentDate) return -1;
        return new Date(a.assentDate).getTime() - new Date(b.assentDate).getTime();
      });
      return items;
    },

    async listCommitsForArticle(articleNumberOrThreeDigits) {
      const filePath = articlePathFromParam(articleNumberOrThreeDigits);
      if (!filePath) return [];
      return listCommitsForFileLive(filePath);
    },

    async getArticleAtSha(articleNumberOrThreeDigits, sha) {
      const filePath = articlePathFromParam(articleNumberOrThreeDigits);
      return getFileContentAtShaLive(filePath, sha);
    },

    async compareArticleBetween(articleNumberOrThreeDigits, beforeSha, afterSha) {
      const filePath = articlePathFromParam(articleNumberOrThreeDigits);
      return compareCommitsLive(beforeSha, afterSha, filePath);
    },

    async listAmendmentSummaries() {
      const items = await listAmendmentSummariesLive();
      return items.map((x) => {
        const meta = parseSummaryFilenameMeta(x.name);
        return {
          ...x,
          year: meta.year,
          month: meta.month,
          number: meta.number,
          filenamePattern: meta.pattern,
        };
      });
    },

    /** Exposed for history.js / tooling — same logic as listAmendments(). */
    amendmentNumberFromCommitMessage(message) {
      return amendmentNumberFromCommitSubject(message);
    },
  };
})();

