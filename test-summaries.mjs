#!/usr/bin/env node
/**
 * Diagnose amendment ↔ summary matching (same rules as js/api.js + js/amendments.js).
 * Summary files are read from default-branch HEAD (same as api.js listAmendmentSummariesLive).
 *
 * Requires a GitHub token with repo read access.
 *
 * PowerShell:
 *   $env:GITHUB_TOKEN="ghp_..."
 *   node .\test-summaries.mjs
 *
 * Optional:
 *   $env:REPO_OWNER="UmerTariq1"
 *   $env:REPO_NAME="legalize-pk"
 *   node .\test-summaries.mjs --no-bodies   # only list summary files; skip fetching .md contents (faster)
 */

const token = process.env.GITHUB_TOKEN || "";
const owner = process.env.REPO_OWNER || "UmerTariq1";
const repo = process.env.REPO_NAME || "legalize-pk";
const noBodies = process.argv.includes("--no-bodies");

const headers = {
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "user-agent": "legalize-pk-test-summaries",
  "x-github-api-version": "2022-11-28",
};

function encodeRepoPath(path) {
  return String(path)
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

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

function toIsoDate(dateTime) {
  if (!dateTime) return null;
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Same as api.js ORDINAL_SLUG_TO_NUM + amendmentNumberFromCommitSubject */
const ORDINAL_SLUG_TO_NUM = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  eigth: 8,
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

function amendmentNumberFromCommitMessage(message) {
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

/** Same as api.js parseSummaryFilenameMeta */
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

/** Same idea as amendments.js extractSummaryText */
function extractSummaryText(md) {
  if (!md) return null;
  const lines = String(md)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const plain = lines.find((l) => !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("|") && !l.startsWith("---"));
  if (plain) return plain.replace(/^[-*•]\s+/, "");
  return null;
}

/** Same idea as history.js firstParagraphFromMarkdown */
function firstParagraphFromMarkdown(md) {
  const lines = String(md || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const plain = lines.find((l) => l && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("|") && !l.startsWith("---"));
  if (plain) return plain.replace(/^[-*•]\s+/, "");
  const bullet = lines.find((l) => l.startsWith("-") || l.startsWith("*") || l.startsWith("•"));
  if (bullet) return bullet.replace(/^[-*•]\s+/, "");
  return null;
}

/** Resolve ref string passed to ?ref= (HEAD SHA or branch name) — mirrors api.js getSummariesTreeRef */
async function getSummariesTreeRef() {
  const metaRes = await getJson(`https://api.github.com/repos/${owner}/${repo}`);
  if (!metaRes.ok) {
    return { ref: "main", sha: null, branch: "main" };
  }
  const branch = metaRes.data?.default_branch || "main";
  const refRes = await getJson(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
  );
  const headSha = refRes.ok ? refRes.data?.object?.sha : null;
  return { ref: headSha || branch, sha: headSha, branch };
}

async function fetchContents(path, ref) {
  const refQ = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}${refQ}`;
  return getJson(url);
}

function decodeBlobContent(b64) {
  const clean = String(b64 || "").replace(/\n/g, "");
  return Buffer.from(clean, "base64").toString("utf8");
}

async function main() {
  if (!token) {
    console.error("Missing GITHUB_TOKEN. Set it in the environment, then run again.");
    console.error("Example: $env:GITHUB_TOKEN=\"ghp_...\"; node .\\test-summaries.mjs");
    process.exit(1);
  }

  console.log(`Repository: ${owner}/${repo}`);
  console.log("—".repeat(60));

  // 1) Commits → amendments
  const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`;
  const commitsRes = await getJson(commitsUrl);
  if (!commitsRes.ok || !Array.isArray(commitsRes.data)) {
    console.error("Failed to list commits:", commitsRes.status, JSON.stringify(commitsRes.data).slice(0, 500));
    process.exit(2);
  }

  const amendments = commitsRes.data.map((c) => {
    const message = c?.commit?.message?.split("\n")[0] || "";
    return {
      sha: c.sha?.slice(0, 7),
      name: message,
      assentDate: toIsoDate(c?.commit?.author?.date || c?.commit?.committer?.date),
      president: c?.commit?.author?.name || c?.commit?.committer?.name || null,
      number: amendmentNumberFromCommitMessage(message),
    };
  });

  const withNum = amendments.filter((a) => a.number != null);
  const withoutNum = amendments.filter((a) => a.number == null);

  console.log("\n## Amendments (from commits)");
  console.log(`  Total commits: ${amendments.length}`);
  console.log(`  With parsed amendment number (ordinal in subject): ${withNum.length}`);
  console.log(`  Without number (e.g. Original / non-ordinal title): ${withoutNum.length}`);
  if (withoutNum.length && withoutNum.length <= 8) {
    for (const a of withoutNum) {
      console.log(`    — ${a.sha}  ${a.name.slice(0, 72)}${a.name.length > 72 ? "…" : ""}`);
    }
  } else if (withoutNum.length) {
    console.log(` (first 5)`);
    for (const a of withoutNum.slice(0, 5)) {
      console.log(`    — ${a.sha}  ${a.name.slice(0, 72)}${a.name.length > 72 ? "…" : ""}`);
    }
  }

  // 2) Summary folder at default-branch HEAD (not tied to individual amendment commits)
  const treeRef = await getSummariesTreeRef();
  console.log("\n## Summary tree ref");
  console.log(`  default_branch: ${treeRef.branch}`);
  console.log(`  HEAD sha: ${treeRef.sha || "—"}`);
  console.log(`  ?ref= ${treeRef.ref}`);

  const folderCandidates = ["federal-ammendment-summaries", "federal-amendment-summaries"];
  let dirPath = folderCandidates[0];
  let dirRes = { ok: false, data: null };
  for (const folder of folderCandidates) {
    dirRes = await fetchContents(folder, treeRef.ref);
    if (dirRes.ok) {
      dirPath = folder;
      break;
    }
  }

  if (!dirRes.ok) {
    console.error("\n## Summary folder");
    console.error(`  FAILED to read summary folders at HEAD: ${dirRes.status}`);
    console.error(`  Body: ${JSON.stringify(dirRes.data).slice(0, 400)}`);
    process.exit(3);
  }

  const items = Array.isArray(dirRes.data) ? dirRes.data : [];
  const mdFiles = items.filter((x) => x?.type === "file" && String(x?.name || "").endsWith(".md"));

  console.log("\n## Summary files");
  console.log(`  Folder used: ${dirPath}`);
  console.log(`  Markdown files: ${mdFiles.length}`);

  const summaryRows = mdFiles.map((f) => {
    const meta = parseSummaryFilenameMeta(f.name);
    return { path: f.path, name: f.name, ...meta };
  });

  const unparsedNames = summaryRows.filter((r) => r.number == null && r.pattern !== null);
  if (unparsedNames.length) {
    console.log(`\n  Summary files with unparsed amendment number (${unparsedNames.length}):`);
    for (const r of unparsedNames.slice(0, 15)) {
      console.log(`    — ${r.name} (pattern: ${r.pattern})`);
    }
    if (unparsedNames.length > 15) console.log(`    … and ${unparsedNames.length - 15} more`);
  }

  const byNumber = new Map();
  for (const r of summaryRows) {
    if (r.number == null) continue;
    if (!byNumber.has(r.number)) byNumber.set(r.number, []);
    byNumber.get(r.number).push(r);
  }

  // 3) Match amendments that have numbers to summary rows
  console.log("\n## Matching (amendment.number === summary.number, word ordinals + MM-YYYY-slug)");
  const amendmentNums = [...new Set(withNum.map((a) => a.number))].sort((x, y) => x - y);
  let matched = 0;
  let missingSummary = [];
  for (const n of amendmentNums) {
    if (byNumber.has(n)) {
      matched++;
    } else {
      const am = withNum.find((a) => a.number === n);
      missingSummary.push({ n, sample: am });
    }
  }

  let orphanSummaries = [];
  for (const n of byNumber.keys()) {
    if (!amendmentNums.includes(n)) orphanSummaries.push(n);
  }
  orphanSummaries.sort((a, b) => a - b);

  console.log(`  Distinct amendment numbers in commits: ${amendmentNums.length}`);
  console.log(`  Distinct summary numbers (strict filename parse): ${byNumber.size}`);
  console.log(`  Amendments with a matching summary file: ${matched}`);
  if (missingSummary.length) {
    console.log(`  Amendments MISSING a summary file (by number): ${missingSummary.length}`);
    for (const { n, sample } of missingSummary.slice(0, 12)) {
      console.log(`    — #${n}  e.g. commit: ${sample?.sha}  ${(sample?.name || "").slice(0, 60)}`);
    }
    if (missingSummary.length > 12) console.log(`    … and ${missingSummary.length - 12} more`);
  }
  if (orphanSummaries.length) {
    console.log(`  Summary file numbers with NO matching amendment number in commits: ${orphanSummaries.length}`);
    console.log(`    — ${orphanSummaries.join(", ")}`);
  }

  // 4) Optional: fetch bodies and test text extraction
  if (noBodies) {
    console.log("\n## Text extraction");
    console.log("  Skipped (--no-bodies). Re-run without flag to fetch each .md and test extractors.");
  } else {
    console.log("\n## Text extraction (per summary file)");
    let emptyExtract = [];
    let okExtract = 0;
    for (const r of summaryRows) {
      if (r.number == null) {
        console.log(`  [skip body] ${r.name} — filename did not yield number`);
        continue;
      }
      const refQ = `?ref=${encodeURIComponent(treeRef.ref)}`;
      const blobUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeRepoPath(r.path)}${refQ}`;
      const br = await getJson(blobUrl);
      if (!br.ok || !br.data?.content) {
        console.log(`  [FAIL fetch] ${r.name} HTTP ${br.status}`);
        continue;
      }
      const text = decodeBlobContent(br.data.content);
      const ex = extractSummaryText(text);
      const fp = firstParagraphFromMarkdown(text);
      if (!ex && !fp) {
        emptyExtract.push(r.name);
      } else {
        okExtract++;
        const preview = (ex || fp || "").slice(0, 90).replace(/\s+/g, " ");
        console.log(`  [ok] #${r.number} ${r.name}`);
        console.log(`       extractSummaryText: ${preview}${(ex || fp || "").length > 90 ? "…" : ""}`);
      }
    }
    if (emptyExtract.length) {
      console.log(`\n  Files with non-empty fetch but BOTH extractors returned null (${emptyExtract.length}):`);
      for (const n of emptyExtract.slice(0, 10)) console.log(`    — ${n}`);
      if (emptyExtract.length > 10) console.log(`    … and ${emptyExtract.length - 10} more`);
    }
    console.log(`\n  Summary: ${okExtract} files produced usable extracted text; ${emptyExtract.length} did not.`);
  }

  // 5) Verdict
  console.log("\n" + "—".repeat(60));
  const strictFailures = missingSummary.length + unparsedNames.length;
  if (strictFailures === 0 && mdFiles.length > 0 && withNum.length > 0) {
    console.log("VERDICT: Commit subjects and summary filenames parse to the same amendment numbers.");
    console.log("If the browser still fails, check Netlify GITHUB_TOKEN and /api/github proxy.");
  } else {
    console.log("VERDICT:");
    if (unparsedNames.length) {
      console.log(`  • ${unparsedNames.length} summary file(s) could not map slug → number (add ORDINAL_SLUG_TO_NUM entry or fix filename).`);
    }
    if (missingSummary.length) {
      console.log("  • Some commits have a parsed number with no matching summary file.");
    }
    if (!withNum.length && mdFiles.length) {
      console.log("  • No amendment numbers parsed from commits — check commit subject format.");
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
