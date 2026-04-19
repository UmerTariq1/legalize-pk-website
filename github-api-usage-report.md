# GitHub API Usage Report

Generated: 2026-04-19
Scope: Runtime website pages plus repository preprocessing scripts

## Executive Summary

- Runtime GitHub-backed traffic is concentrated in 2 pages only: Article History and Diff.
- 6 pages use local static data only and make zero GitHub proxy requests.
- Runtime frontend requests go to one endpoint: /.netlify/functions/github-proxy.
- Proxy calls GitHub REST API only when in-memory cache is missed.
- Static runtime JSON files are served with immutable 1-year cache headers.
- Proxy responses are served with immutable 10-day cache headers and 10-day in-memory TTLs.

## Request Flow

1. Browser calls /.netlify/functions/github-proxy with an action.
2. Netlify function validates inputs and checks in-memory cache.
3. On cache miss, function calls GitHub REST API.
4. Function returns normalized response to browser.

## Runtime Actions and Endpoints

### Browser to Proxy actions

- action=getFileAtCommit
- action=getFileDiff

### Proxy to GitHub REST endpoints

- GET /repos/{owner}/{repo}/contents/{path}?ref={sha}
- GET /repos/{owner}/{repo}/compare/{from}...{to}

### Fallback behavior for diffs

If compare payload has no patch for the target file, proxy logs an explicit warning and returns compare-derived data without extra contents fetches.

## Grouped by Page

## Home

- Route: /
- Proxy usage: none
- Requests per page load:
  - Browser -> Proxy: 0
  - Proxy -> GitHub: 0
- Request types: none

## Constitution

- Route: /constitution
- Proxy usage: none
- Requests per page load:
  - Browser -> Proxy: 0
  - Proxy -> GitHub: 0
- Request types: none

## Explore

- Route: /explore
- Proxy usage: none
- Requests per page load:
  - Browser -> Proxy: 0
  - Proxy -> GitHub: 0
- Request types: none

## Amendment

- Route: /amendment/:n
- Proxy usage: none
- Requests per page load:
  - Browser -> Proxy: 0
  - Proxy -> GitHub: 0
- Request types: none

## Timeline

- Route: /timeline
- Proxy usage: none
- Requests per page load:
  - Browser -> Proxy: 0
  - Proxy -> GitHub: 0
- Request types: none

## Search

- Route: /search
- Proxy usage: none
- Requests per page load:
  - Browser -> Proxy: 0
  - Proxy -> GitHub: 0
- Request types: none

## Article History

- Route: /article/:id
- Proxy action used: getFileAtCommit
- Trigger behavior:
  - On page init, code prefetches historical content for all commits touching that article.
  - This means requests are not only on expand/click; they are made at load time.
- Requests per page load:
  - Browser -> Proxy: C (where C = commit count for selected article)
  - Proxy -> GitHub on cache miss: C contents calls
- Caching effects:
  - Client-side map avoids duplicate fetches in same page session.
  - Function in-memory cache reduces upstream GitHub calls on repeated requests.

### Average for Article page (current dataset)

Using current data files:

- Total article entries analyzed: 314
- Average commit touches per article: 1.8471
- Median: 1
- Min: 1
- Max: 7

So expected Article page load requests are:

- Browser -> Proxy average: 1.8471
- Proxy -> GitHub average (cold misses): 1.8471

Distribution of commit touches per article:

- 0: 0
- 1: 169
- 2: 83
- 3: 32
- 4: 12
- 5: 11
- 6-10: 7
- 11+: 0

## Diff

- Route: /diff and /diff/:article
- Proxy action used: getFileDiff
- Trigger behavior:
  - runComparison() is called on init.
  - Additional calls happen when article selection changes or user clicks Run compare.
  - No request is sent if from == to.

### Requests per comparison run

- Browser -> Proxy: 1 getFileDiff request
- Proxy -> GitHub on cache miss:
  - Typical: 1 compare call
  - Missing-patch condition: still 1 compare call (no additional upstream calls)

### Initial-load behavior and average

- Default /diff route falls back to first sorted article, which is PREAMBLE.
- PREAMBLE currently has one commit in dataset.
- Selector initialization sets from and to to the same hash when only one commit exists.
- Because from == to, initial runComparison exits without proxy call.

Implication:

- /diff (without explicit article/hash params) usually starts with 0 proxy requests on load.
- /diff/:article with >1 commits usually starts with 1 proxy request on load.

Dataset-based probability approximation (uniform article assumption):

- Articles with more than one commit: 145 of 314
- Expected initial proxy requests for generic article selection: 145/314 = 0.4618

## Page-level Matrix

| Page | Proxy action(s) | Browser -> Proxy per load | Proxy -> GitHub per load (cold misses) | Request type details |
| --- | --- | ---: | ---: | --- |
| Home | None | 0 | 0 | Static JSON only |
| Constitution | None | 0 | 0 | Static JSON only |
| Explore | None | 0 | 0 | Static JSON only |
| Amendment | None | 0 | 0 | Static JSON only |
| Timeline | None | 0 | 0 | Static JSON only |
| Search | None | 0 | 0 | Static JSON only |
| Article | getFileAtCommit | C (avg 1.8471) | C contents (avg 1.8471) | Prefetch all commits for selected article |
| Diff | getFileDiff | 0 or 1 on init, then +1 per compare | 1 compare call | Blocked when from == to |

## Removed Runtime Action

- action=reportPageLoad has been removed from proxy and client runtime utilities.
- Runtime proxy actions are now limited to getFileAtCommit and getFileDiff.

## Caching Summary

Function cache TTLs:

- getFileAtCommit: 10 days (864000000 ms)
- getFileDiff: 10 days (864000000 ms)

Function response cache headers:

- Cache-Control: public, max-age=864000, s-maxage=864000, immutable

Static runtime JSON cache headers:

- /data/data.json: Cache-Control public, max-age=31536000, immutable
- /data/current-constitution.json: Cache-Control public, max-age=31536000, immutable

## Note on Docs vs Current Runtime Behavior

Technical implementation docs are aligned with current runtime behavior, including article prefetch, immutable caching, and the current diff missing-patch warning path.

## Non-page GitHub API Usage (Preprocessing Scripts)

These are not page runtime calls but can be high volume:

### preprocessing/scripts/generate_static_data.js

Main GitHub calls:

- Commits listing pages
- Per-commit detail fetches
- Repo tree fetch
- Per-summary-file content fetch for amendment summaries

Current-data estimate for one full run:

- About 51 GitHub calls
  - 1 commit list page
  - 25 commit detail calls
  - 1 tree call
  - 24 summary content calls (commitNumber > 1)

### preprocessing/scripts/generate_article_summaries.js

Main GitHub calls:

- List files in federal-constitution
- For each article file:
  - list commits by file path
  - fetch commit detail for each touching commit

Current-data estimate for full run:

- About 893 GitHub calls
- Plus 313 OpenAI calls (one per article summary generation)

### preprocessing/scripts/test_github_auth.js

Probe calls:

- /user
- /repos/{owner}/{repo}
- one contents lookup
- optional compare lookup when --from and --to are provided

Call count:

- 3 baseline
- 4 with compare test enabled

## Data Inputs Used for Metrics

- data/data.json
- data/current-constitution.json

All averages and counts in this report were computed from those local files.