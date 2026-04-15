const DEFAULT_CACHE_TTL_MS = {
  getFileAtCommit: 10 * 60 * 1000,
  getFileDiff: 30 * 60 * 1000
};

const inMemoryCache = new Map();

const REPO = {
  owner: process.env.REPO_OWNER || "UmerTariq1",
  name: process.env.REPO_NAME || "legalize-pk"
};

function isValidArticlePath(path) {
  return /^federal-constitution\/[A-Za-z0-9-_.]+\.md$/i.test(String(path || ""));
}

function isValidHash(value) {
  return /^[a-fA-F0-9]{7,40}$/.test(String(value || ""));
}

function getCacheHeaders() {
  return {
    "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
  };
}

function cacheKey(action, params) {
  return `${action}:${JSON.stringify(params)}`;
}

function readCache(action, params) {
  const key = cacheKey(action, params);
  const hit = inMemoryCache.get(key);
  if (!hit) {
    return null;
  }

  if (Date.now() > hit.expiresAt) {
    inMemoryCache.delete(key);
    return null;
  }

  return hit.payload;
}

function writeCache(action, params, payload) {
  const key = cacheKey(action, params);
  const ttl = DEFAULT_CACHE_TTL_MS[action] || 5 * 60 * 1000;
  inMemoryCache.set(key, {
    expiresAt: Date.now() + ttl,
    payload
  });
}

function decodeBase64Content(content) {
  return Buffer.from(String(content || ""), "base64").toString("utf8");
}

async function githubRequest(pathname, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    const error = new Error("GITHUB_TOKEN is not configured in Netlify environment variables.");
    error.statusCode = 500;
    error.code = "MISSING_GITHUB_TOKEN";
    throw error;
  }

  const url = `https://api.github.com${pathname}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "legalize-pk-netlify-proxy"
    }
  });

  const rateLimit = {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset")
  };

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GitHub API request failed (${response.status}).`);
    error.statusCode = response.status;
    error.code = response.status === 403 ? "GITHUB_RATE_LIMIT_OR_FORBIDDEN" : "GITHUB_REQUEST_FAILED";
    error.details = body;
    error.rateLimit = rateLimit;
    throw error;
  }

  const json = await response.json();
  return { json, rateLimit };
}

function computeLineDiff(beforeContent, afterContent) {
  const before = String(beforeContent || "").split("\n");
  const after = String(afterContent || "").split("\n");

  const dp = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));
  for (let i = 1; i <= before.length; i += 1) {
    for (let j = 1; j <= after.length; j += 1) {
      if (before[i - 1] === after[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops = [];
  let i = before.length;
  let j = after.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
      ops.push({ type: "context", line: before[i - 1] });
      i -= 1;
      j -= 1;
      continue;
    }

    if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "add", line: after[j - 1] });
      j -= 1;
      continue;
    }

    if (i > 0) {
      ops.push({ type: "remove", line: before[i - 1] });
      i -= 1;
    }
  }

  ops.reverse();

  let additions = 0;
  let deletions = 0;

  const body = ops
    .map((op) => {
      if (op.type === "add") {
        additions += 1;
        return `+${op.line}`;
      }
      if (op.type === "remove") {
        deletions += 1;
        return `-${op.line}`;
      }
      return ` ${op.line}`;
    })
    .join("\n");

  return {
    patch: body,
    additions,
    deletions,
    changes: additions + deletions
  };
}

module.exports = {
  REPO,
  isValidArticlePath,
  isValidHash,
  getCacheHeaders,
  readCache,
  writeCache,
  decodeBase64Content,
  githubRequest,
  computeLineDiff
};
