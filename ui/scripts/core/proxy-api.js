import { GITHUB_PROXY_ENDPOINT } from "./constants.js";
import { endTimer, logError, logInfo, startTimer } from "./logger.js";

const pageSession = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const pageRoute = (window.location.pathname.replace(/^\/+/, "") || "home").toLowerCase();

let proxyCallCount = 0;
let pageLoadReported = false;

async function requestProxy(params) {
  proxyCallCount += 1;

  const requestMeta = {
    action: params.action,
    path: params.path,
    ref: params.ref,
    from: params.from,
    to: params.to
  };
  const timer = startTimer("proxy.request", requestMeta);

  const url = new URL(GITHUB_PROXY_ENDPOINT, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  url.searchParams.set("pageSession", pageSession);
  url.searchParams.set("pageRoute", pageRoute);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    logError("proxy.request.error", {
      ...requestMeta,
      status: response.status,
      code: payload?.error?.code || "PROXY_REQUEST_FAILED",
      message: payload?.error?.message || "Unable to complete proxy request."
    });

    const error = new Error(payload?.error?.message || "Unable to complete proxy request.");
    error.code = payload?.error?.code || "PROXY_REQUEST_FAILED";
    error.meta = payload?.meta || null;
    throw error;
  }

  endTimer(timer, {
    ...requestMeta,
    status: response.status,
    cached: Boolean(payload?.meta?.cached)
  });
  logInfo("proxy.request.success", {
    ...requestMeta,
    status: response.status,
    cached: Boolean(payload?.meta?.cached)
  });

  return payload;
}

export async function fetchFileAtCommit({ path, ref }) {
  const payload = await requestProxy({ action: "getFileAtCommit", path, ref });
  return payload;
}

export async function fetchDiff({ path, from, to, viewMode = "unified" }) {
  const payload = await requestProxy({
    action: "getFileDiff",
    path,
    from,
    to,
    viewMode
  });
  return payload;
}

export function getProxyPageCallCount() {
  return proxyCallCount;
}

export async function reportProxyPageLoad({ pageName = "" } = {}) {
  if (pageLoadReported) {
    return;
  }

  pageLoadReported = true;

  const url = new URL(GITHUB_PROXY_ENDPOINT, window.location.origin);
  url.searchParams.set("action", "reportPageLoad");
  url.searchParams.set("pageSession", pageSession);
  url.searchParams.set("pageRoute", String(pageName || pageRoute || "unknown"));
  url.searchParams.set("count", String(proxyCallCount));

  try {
    await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });
  } catch {
    // Intentionally ignore reporting failures. This should not block the UI.
  }
}
