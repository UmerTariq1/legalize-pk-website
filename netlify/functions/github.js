const DEFAULT_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, OPTIONS",
  "content-type": "application/json; charset=utf-8",
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...DEFAULT_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function normalizeEndpoint(endpointRaw) {
  if (!endpointRaw || typeof endpointRaw !== "string") return null;
  const endpoint = endpointRaw.trim();
  if (!endpoint) return null;

  // Prevent full URL SSRF; accept only a path like:
  // /repos/OWNER/REPO/commits?...
  if (endpoint.includes("://")) return null;

  const withLeadingSlash = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // Hard block traversal-ish patterns.
  // Block path traversal like "/../" but allow GitHub compare syntax "before...after".
  if (/(^|\/)\.\.(\/|$)/.test(withLeadingSlash)) return null;

  return withLeadingSlash;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: DEFAULT_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const endpoint = normalizeEndpoint(event.queryStringParameters?.endpoint);
  if (!endpoint) {
    return json(400, { error: "Missing or invalid 'endpoint' query parameter", raw: event.queryStringParameters?.endpoint || null });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return json(500, { error: "Server is missing GITHUB_TOKEN" });
  }

  const url = `https://api.github.com${endpoint}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "legalize-pk-website-netlify-proxy",
        "x-github-api-version": "2022-11-28",
      },
    });

    const text = await res.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!res.ok) {
      return json(res.status, {
        error: "GitHub API error",
        status: res.status,
        endpoint,
        details: payload,
      });
    }

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(payload ?? {}),
    };
  } catch (err) {
    return json(502, { error: "Proxy request failed", message: String(err?.message || err) });
  }
};

