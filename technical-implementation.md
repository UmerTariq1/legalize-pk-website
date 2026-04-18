# technical-implementation.md

## 1. System Overview

This project is a static, multi-page web application that documents constitutional history using precomputed JSON datasets plus an on-demand Netlify function for GitHub-backed historical content and diffs.

At runtime, the browser serves static HTML/CSS/JS from this repository and calls one serverless endpoint for dynamic GitHub reads:

- Static data:
  - `data/data.json`
  - `data/current-constitution.json`
  - `data/federal-article-summaries/*.md` (used during preprocessing and embedded into `data/data.json` article entries)
- Dynamic API:
  - `/.netlify/functions/github-proxy`

Core idea:

1. Most UI views are powered entirely from local static JSON for speed and reliability.
2. Historical article snapshots and commit-to-commit diffs are fetched on demand through a Netlify proxy to GitHub.

---

## 2. High-Level Architecture

### Frontend shell

- Route folders (`/`, `/constitution`, `/explore`, `/article`, `/amendment`, `/diff`, `/timeline`, `/search`) each have their own `index.html`.
- Each page loads one route controller module from `ui/scripts/pages/*.js`.
- Shared styles are in `ui/styles/main.css`.
- Icons and fonts are loaded from CDNs.

### Client-side module layers

- Shared runtime/core utilities: `ui/scripts/core/*`
  - constants and route definitions
  - data loading and in-memory indexing
  - logging and timers
  - markdown rendering and sanitization
  - route parameter extraction
  - UI helper renderers
  - Netlify proxy API client
- Page controllers: `ui/scripts/pages/*`
  - one controller per route
  - each page calls `initSharedPage()` + route-specific rendering logic

### Backend/serverless layer

- Netlify Functions directory: `netlify/functions`
- Main function: `github-proxy.js`
- Shared GitHub/caching logic: `_shared/github-client.js`

### Data generation pipeline

- Scripts under `preprocessing/scripts/`
  - `generate_static_data.js` for amendment timeline/index from Git history
    - also embeds per-article AI summaries from `data/federal-article-summaries/` into `data.json -> articles[repoPath].summary`
  - `generate_article_summaries.js` to generate summary markdown files for each article
  - `convert_current_const_md_to_json.js` for current constitution JSON from markdown files
  - `test_github_auth.js` for token/repo connectivity checks

---

## 3. Runtime Data Flow

### 3.1 Static data bootstrap

The frontend starts by loading two JSON files once per page session:

- Timeline/index dataset: `DATA_URLS.timeline = /data/data.json`
- Current constitution dataset: `DATA_URLS.constitution = /data/current-constitution.json`

`ui/scripts/core/data-service.js` builds and caches derived indexes:

- `commitByHash`
- `commitsByArticlePath`
- `articleById`
- `articleByRepoPath`
- `amendmentByNumber`

This allows pages to query quickly without refetching.

Each article entry in `data/data.json` also includes:

- `summary`: plain-text AI summary sourced from `data/federal-article-summaries/article-xxx-summary.md` during preprocessing

### 3.2 Derived commit semantics

The data service derives:

- `amendmentNumber` from commit metadata/message, with fallback logic
- `affectedArticles` filtered to constitution article files
- political party tags via `PARTY_BY_AMENDMENT`
- exclusion of non-enacted amendments (`9`, `11`, `15`) from amendment selection lists

### 3.3 Dynamic GitHub reads (proxy)

Article history and diff pages call:

- `getFileAtCommit` action to fetch one markdown file at one commit hash
- `getFileDiff` action to fetch compare patch between two commit hashes

Flow:

1. Browser calls `/.netlify/functions/github-proxy` with query params.
2. Function validates params and path/hash format.
3. Function calls GitHub REST API using `GITHUB_TOKEN`.
4. Response is normalized and returned to frontend.
5. Frontend renders markdown or diff output.

---

## 4. Page-Level Implementation

### Home (`ui/scripts/pages/home.js`)

- Loads dataset stats from `getStats()`.
- Renders amendment/article/year counters.
- Renders rotating editorial callout from configured landmark amendments.
- Builds repository link from `REPO` constants.

### Constitution list (`ui/scripts/pages/constitution.js`)

- Loads all current articles from static JSON.
- Renders expandable rows with metadata and markdown body.
- Shows amendment source links available per article.

### Explore (`ui/scripts/pages/explore.js`)

- Populates article/amendment selectors from indexed data.
- Routes user to:
  - `/article/:id`
  - `/amendment/:n`
  - `/diff/:article?from=...&to=...`

### Amendment detail (`ui/scripts/pages/amendment.js`)

- Resolves amendment number from URL.
- Reads amendment commit and affected articles from static data.
- Renders AI summary markdown, article chips, and external source URLs.

### Timeline (`ui/scripts/pages/timeline.js`)

- Displays commit timeline with date-range filters.
- Supports presets (all, 21st century, post-18th amendment, recent 15 years).
- Highlights landmark amendments and party chips.

### Search (`ui/scripts/pages/search.js` + `core/search-index.js`)

- Builds in-memory search docs for articles + amendments.
- Uses Fuse.js with weighted keys and fallback token matching.
- Groups results by type and updates URL query (`?q=`).

### Article history (`ui/scripts/pages/article.js`)

- Resolves article from route.
- Loads commit list for that article from static index.
- Loads the article-level AI summary from static summary data.
- On expand/select of a commit card, fetches markdown snapshot through proxy.
- Uses local content cache and shows proxy status badges.

### Diff (`ui/scripts/pages/diff.js`)

- Resolves article and optional `from`, `to`, `view` from URL.
- Fetches commit list, validates selection state, and requests proxy diff.
- Supports unified and side-by-side views.
- Displays line stats and links back into article history state.

---

## 5. Netlify Function Implementation

### Endpoint and actions

`netlify/functions/github-proxy.js` supports:

- `action=getFileAtCommit`
- `action=getFileDiff`
- `action=reportPageLoad` (analytics/logging helper)

### Validation and safety

Implemented in `_shared/github-client.js`:

- Article path must match `federal-constitution/*.md`
- Hashes must be 7-40 hex chars
- Non-GET requests return 405
- Missing/invalid params return 400

### GitHub API behavior

- Uses `Authorization: Bearer <GITHUB_TOKEN>`
- Calls:
  - `/repos/{owner}/{repo}/contents/{path}?ref={sha}`
  - `/repos/{owner}/{repo}/compare/{from}...{to}`
- If compare patch is absent, computes fallback line diff in function code.

### Caching

In-memory per function instance:

- `getFileAtCommit`: 10 minutes
- `getFileDiff`: 30 minutes

Also returns cache headers:

- `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`

### Repository targeting

Function-side repository defaults:

- `REPO_OWNER` fallback: `UmerTariq1`
- `REPO_NAME` fallback: `legalize-pk`

Set env vars explicitly when deploying a fork or alternate source repo.

---

## 6. Logging and Observability

### Browser-side logs

`ui/scripts/core/logger.js` emits structured console entries with `[journey]` prefix:

- page init events
- render/filter actions
- timing for data and proxy requests
- error events with metadata

### Function-side logs

`github-proxy.js` emits structured logs with `[proxy]` prefix:

- request receive/validate paths
- cache hit/miss
- GitHub request outcomes
- fallback diff usage
- error code/status details

---

## 7. Data Preparation Workflow

Use this only when refreshing dataset content from source markdown/Git history.

### 7.1 Prerequisite

Set `GITHUB_TOKEN` in environment or `.env` at repo root.

If generating article summaries, also set `OPENAI_API_KEY` in `.env`.

Ensure generated summary markdown files exist in:

- `data/federal-article-summaries/`

### 7.2 Generate timeline/index data

Run:

```bash
node preprocessing/scripts/generate_static_data.js
```

Note: this script currently writes to repository root `data.json`.
The runtime app reads `data/data.json`.
If you use this script as-is, move/copy output to `data/data.json` (or update script output path).

`articles` entries in this output include `summary` populated from local files in `data/federal-article-summaries` when present.

### 7.3 Generate article summaries (optional, before static data refresh)

Run:

```bash
node preprocessing/scripts/generate_article_summaries.js
```

This creates one file per article (for example `article-063-summary.md`) that can be copied to:

- `data/federal-article-summaries/`

### 7.4 Generate current constitution JSON

Run:

```bash
node preprocessing/scripts/convert_current_const_md_to_json.js
```

This writes `data/current-constitution.json`.

### 7.5 Optional auth/repo probe

Run:

```bash
node preprocessing/scripts/test_github_auth.js --owner <owner> --repo <repo>
```

---

## 8. Netlify Deployment (Step by Step)

### 8.1 Connect repository

1. Push this project to GitHub.
2. In Netlify, create a new site from Git.
3. Select the repository and branch.

### 8.2 Configure build settings

Use these values:

- Base directory: leave empty
- Build command: leave empty (no build step required)
- Publish directory: `.`
- Functions directory: `netlify/functions`

These match `netlify.toml`:

```toml
[build]
  publish = "."
  functions = "netlify/functions"
```

### 8.3 Configure environment variables

In Netlify Site settings -> Environment variables, configure:

- `GITHUB_TOKEN` (required)
- `REPO_OWNER` (optional, recommended for clarity)
- `REPO_NAME` (optional, recommended for clarity)

Recommended token permissions:

- For public repo reads: minimal read access to repository contents
- For private repos: token must have access to repo contents and compare endpoints

### 8.4 Keep clean URL routing enabled

The app relies on redirect/rewrite rules for route folders and param routes.

Required routes are already present in:

- `netlify.toml`
- `_redirects`

Important dynamic rewrites include:

- `/article/:id -> /article/index.html`
- `/amendment/:n -> /amendment/index.html`
- `/diff/:article -> /diff/index.html`

### 8.5 Deploy

1. Trigger first deploy from Netlify UI.
2. Wait for deploy complete.
3. Open deployed URL and test route navigation directly (hard refresh each route):
   - `/constitution`
   - `/article/63`
   - `/amendment/18`
   - `/diff/63`
   - `/timeline`
   - `/search`

### 8.6 Validate proxy after deploy

Run a simple proxy ping in browser (replace host):

```text
https://<your-site>.netlify.app/.netlify/functions/github-proxy?action=reportPageLoad&pageSession=test&pageRoute=health&count=0
```

Expected: JSON response with `ok: true`.

Then verify dynamic pages:

- Open an article page and expand a commit card (should load historical text).
- Open diff page, choose two different commits, and run comparison.

### 8.7 Optional local Netlify dev

From repo root:

```bash
npx netlify-cli@latest dev
```

Ensure local `.env` includes `GITHUB_TOKEN` so function calls succeed.

---

## 9. Netlify Configuration Checklist

Use this as a quick pre-go-live checklist:

- [ ] `publish` is `.`
- [ ] `functions` is `netlify/functions`
- [ ] `GITHUB_TOKEN` is configured in Netlify
- [ ] `REPO_OWNER` and `REPO_NAME` set to intended source repo
- [ ] Redirects from `netlify.toml` and `_redirects` are active
- [ ] `data/data.json` exists and is current
- [ ] `data/current-constitution.json` exists and is current
- [ ] Article history page can fetch commit content
- [ ] Diff page can compare two hashes

---

## 10. Common Failure Modes and Fixes

### Symptom: proxy returns 500 with missing token message

Cause: `GITHUB_TOKEN` not configured in Netlify env.
Fix: add token and redeploy.

### Symptom: proxy returns GitHub 404 for valid paths

Cause: wrong `REPO_OWNER`/`REPO_NAME` target repo.
Fix: set correct values in Netlify environment variables.

### Symptom: dynamic pages load shell but no article/diff content

Cause: function failing or blocked by missing token/permissions.
Fix: check Netlify function logs for `[proxy]` entries.

### Symptom: timeline/search data fails to load

Cause: missing or stale static JSON files.
Fix: regenerate data and ensure files are present at:

- `data/data.json`
- `data/current-constitution.json`

---

## 11. Implementation Notes for Maintainers

- There is no bundler or package-managed frontend build; browser imports ESM modules directly.
- Runtime dependencies (Fuse, marked, DOMPurify, motion) are pulled from CDNs.
- Frontend `REPO` constants control only display links; function env vars control actual GitHub source for proxy data.
- If you automate data regeneration, align output path from `generate_static_data.js` with runtime path `data/data.json`.
