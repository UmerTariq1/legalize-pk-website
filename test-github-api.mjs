#!/usr/bin/env node
/**
 * Minimal GitHub API smoke test (no site, no proxy).
 *
 *   $env:GITHUB_TOKEN="ghp_..."
 *   node .\test-github-api.mjs
 *
 * Optional:
 *   $env:REPO_OWNER="UmerTariq1"
 *   $env:REPO_NAME="legalize-pk"
 */

const token = process.env.GITHUB_TOKEN || "";
const owner = process.env.REPO_OWNER || "UmerTariq1";
const repo = process.env.REPO_NAME || "legalize-pk";

const headers = {
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "user-agent": "legalize-pk-test-github-api",
  "x-github-api-version": "2022-11-28",
};

async function getJson(url) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  if (!token) {
    console.error("Missing GITHUB_TOKEN. Set it in the environment, then run again.");
    process.exit(1);
  }

  console.log("Testing GitHub API…");

  const rate = await getJson("https://api.github.com/rate_limit");
  console.log(`  rate_limit: ${rate.status} ${rate.ok ? "OK" : "FAIL"}`);
  if (rate.ok && rate.data?.resources?.core) {
    const c = rate.data.resources.core;
    console.log(`    core: remaining ${c.remaining}/${c.limit} (resets ${c.reset})`);
  }

  const rep = await getJson(`https://api.github.com/repos/${owner}/${repo}`);
  console.log(`  repo ${owner}/${repo}: ${rep.status} ${rep.ok ? "OK" : "FAIL"}`);
  if (rep.ok && rep.data?.full_name) {
    console.log(`    full_name: ${rep.data.full_name}`);
    console.log(`    default_branch: ${rep.data.default_branch}`);
    console.log(`    open_issues: ${rep.data.open_issues_count}`);
  } else if (!rep.ok) {
    console.log(`    body: ${JSON.stringify(rep.data).slice(0, 400)}`);
    process.exit(1);
  }

  const commits = await getJson(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`);
  console.log(`  commits (sample): ${commits.status} ${commits.ok ? "OK" : "FAIL"}`);
  if (commits.ok && Array.isArray(commits.data)) {
    console.log(`    first commit short SHA: ${commits.data[0]?.sha?.slice(0, 7) || "—"}`);
  }

  console.log("Done — GitHub API is reachable with this token.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
