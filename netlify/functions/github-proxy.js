const {
  REPO,
  computeLineDiff,
  decodeBase64Content,
  getCacheHeaders,
  githubRequest,
  isValidArticlePath,
  isValidHash,
  readCache,
  writeCache
} = require("./_shared/github-client");

function logServer(level, event, details = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details
  };

  if (level === "error") {
    console.error("[proxy]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[proxy]", payload);
    return;
  }

  console.info("[proxy]", payload);
}

function jsonResponse(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...getCacheHeaders(),
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

function handlePageLoadReport(params, trace) {
  const pageSession = String(params.pageSession || "").trim();
  const pageRoute = String(params.pageRoute || "unknown");
  const reportedCount = Number(params.count || 0);

  logServer("info", "proxy.page-load.complete", {
    requestId: trace.requestId,
    pageSession,
    pageRoute,
    reportedCount
  });

  return jsonResponse(200, {
    ok: true,
    data: {
      accepted: true,
      pageSession,
      pageRoute
    }
  });
}

function validationError(message, code = "VALIDATION_ERROR") {
  return jsonResponse(400, {
    ok: false,
    error: { code, message }
  });
}

function githubError(error) {
  const statusCode = error.statusCode || 502;
  return jsonResponse(statusCode, {
    ok: false,
    error: {
      code: error.code || "GITHUB_PROXY_ERROR",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.details : undefined
    },
    meta: {
      rateLimitRemaining: error.rateLimit?.remaining || null,
      rateLimitReset: error.rateLimit?.reset || null
    }
  });
}

function encodeRepoPath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function fetchContentAtRef(path, ref) {
  const endpoint = `/repos/${REPO.owner}/${REPO.name}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(ref)}`;
  const { json, rateLimit } = await githubRequest(endpoint);

  return {
    content: decodeBase64Content(json.content),
    sha: json.sha,
    rateLimit
  };
}

async function handleGetFileAtCommit(path, ref, trace) {
  const cacheParams = { path, ref };
  const cached = readCache("getFileAtCommit", cacheParams);
  if (cached) {
    logServer("info", "proxy.getFileAtCommit.cache-hit", {
      requestId: trace.requestId,
      path,
      ref
    });
    return jsonResponse(200, {
      ...cached,
      meta: { ...cached.meta, cached: true }
    });
  }

  logServer("info", "proxy.getFileAtCommit.fetch", {
    requestId: trace.requestId,
    path,
    ref
  });

  const result = await fetchContentAtRef(path, ref);

  const payload = {
    ok: true,
    data: {
      path,
      ref,
      sha: result.sha,
      contentMarkdown: result.content,
      source: "github"
    },
    meta: {
      rateLimitRemaining: result.rateLimit.remaining,
      rateLimitReset: result.rateLimit.reset,
      cached: false
    }
  };

  writeCache("getFileAtCommit", cacheParams, payload);
  logServer("info", "proxy.getFileAtCommit.success", {
    requestId: trace.requestId,
    path,
    ref,
    rateLimitRemaining: result.rateLimit.remaining
  });
  return jsonResponse(200, payload);
}

async function handleGetFileDiff(path, from, to, trace) {
  const cacheParams = { path, from, to };
  const cached = readCache("getFileDiff", cacheParams);
  if (cached) {
    logServer("info", "proxy.getFileDiff.cache-hit", {
      requestId: trace.requestId,
      path,
      from,
      to
    });
    return jsonResponse(200, {
      ...cached,
      meta: { ...cached.meta, cached: true }
    });
  }

  logServer("info", "proxy.getFileDiff.fetch", {
    requestId: trace.requestId,
    path,
    from,
    to
  });

  const compareEndpoint = `/repos/${REPO.owner}/${REPO.name}/compare/${encodeURIComponent(from)}...${encodeURIComponent(to)}`;
  const { json: compareJson, rateLimit } = await githubRequest(compareEndpoint);

  const changedFile = (compareJson.files || []).find((file) => file.filename === path);

  let patch = changedFile?.patch || "";
  let additions = changedFile?.additions || 0;
  let deletions = changedFile?.deletions || 0;
  let changes = changedFile?.changes || 0;
  let isFallbackComputed = false;

  if (!patch) {
    const [fromVersion, toVersion] = await Promise.all([fetchContentAtRef(path, from), fetchContentAtRef(path, to)]);
    const fallback = computeLineDiff(fromVersion.content, toVersion.content);

    patch = fallback.patch;
    additions = fallback.additions;
    deletions = fallback.deletions;
    changes = fallback.changes;
    isFallbackComputed = true;

    logServer("warn", "proxy.getFileDiff.fallback", {
      requestId: trace.requestId,
      path,
      from,
      to
    });
  }

  const payload = {
    ok: true,
    data: {
      path,
      from,
      to,
      patch: `--- a/${path}\n+++ b/${path}\n${patch}`,
      stats: {
        additions,
        deletions,
        changes
      },
      isFallbackComputed
    },
    meta: {
      rateLimitRemaining: rateLimit.remaining,
      rateLimitReset: rateLimit.reset,
      cached: false
    }
  };

  writeCache("getFileDiff", cacheParams, payload);
  logServer("info", "proxy.getFileDiff.success", {
    requestId: trace.requestId,
    path,
    from,
    to,
    additions,
    deletions,
    changes,
    isFallbackComputed,
    rateLimitRemaining: rateLimit.remaining
  });
  return jsonResponse(200, payload);
}

exports.handler = async (event) => {
  const requestId = event.headers?.["x-nf-request-id"] || event.headers?.["X-Nf-Request-Id"] || "unknown";

  const params = event.queryStringParameters || {};
  const action = params.action;
  const path = params.path;

  logServer("info", "proxy.request.received", {
    requestId,
    method: event.httpMethod,
    action,
    path
  });

  if (event.httpMethod !== "GET") {
    logServer("warn", "proxy.request.invalid-method", {
      requestId,
      method: event.httpMethod
    });
    return jsonResponse(405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use GET for github-proxy requests." }
    });
  }

  if (!action) {
    logServer("warn", "proxy.request.missing-action", { requestId, path });
    return validationError("Missing required parameter: action", "MISSING_ACTION");
  }

  if (action === "reportPageLoad") {
    return handlePageLoadReport(params, { requestId });
  }

  try {
    if (action === "getFileAtCommit") {
      if (!isValidArticlePath(path)) {
        logServer("warn", "proxy.request.invalid-path", { requestId, action, path });
        return validationError("Invalid or unsupported article path.", "INVALID_PATH");
      }

      const ref = params.ref;
      if (!isValidHash(ref)) {
        logServer("warn", "proxy.request.invalid-ref", { requestId, path, ref });
        return validationError("Invalid commit hash provided for ref.", "INVALID_REF");
      }

      return await handleGetFileAtCommit(path, ref, { requestId });
    }

    if (action === "getFileDiff") {
      if (!isValidArticlePath(path)) {
        logServer("warn", "proxy.request.invalid-path", { requestId, action, path });
        return validationError("Invalid or unsupported article path.", "INVALID_PATH");
      }

      const from = params.from;
      const to = params.to;
      if (!isValidHash(from) || !isValidHash(to)) {
        logServer("warn", "proxy.request.invalid-hash-range", {
          requestId,
          path,
          from,
          to
        });
        return validationError("Invalid from/to commit hash parameters.", "INVALID_HASH_RANGE");
      }

      return await handleGetFileDiff(path, from, to, { requestId });
    }

    logServer("warn", "proxy.request.unsupported-action", {
      requestId,
      action,
      path
    });

    return validationError("Unsupported action. Use getFileAtCommit or getFileDiff.", "UNSUPPORTED_ACTION");
  } catch (error) {
    logServer("error", "proxy.request.error", {
      requestId,
      action,
      path,
      code: error.code || "GITHUB_PROXY_ERROR",
      statusCode: error.statusCode || 502,
      message: error.message
    });
    return githubError(error);
  }
};
