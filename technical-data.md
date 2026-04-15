# technical-data.md

This document explains the structure of the two generated JSON data files in simple terms and how to use them for website features.

## What these files are

`data.json` is a precomputed, static dataset built from the legalize-pk Git history.

`data/current-constitution.json` is a precomputed dataset built directly from the markdown files in `data/federal-constitution`.

It has two top-level sections:

- `commits`: timeline of constitutional commits (oldest to newest)
- `articles`: per-article change index across all commits

The constitution text dataset has one top-level section:

- `articles`: one object per markdown file, including `preamble.md` and sub-articles such as `article-025-A.md`

## Top-level shape

```json
{
  "commits": [ ... ],
  "articles": {
    "federal-constitution/article-001.md": {
      "changeCount": 3,
      "amendments": [
        { "commitHash": "abc...", "amendmentNumber": 1 }
      ]
    }
  }
}
```

## current-constitution.json top-level shape

```json
{
  "generatedAt": "2026-04-15T00:00:00.000Z",
  "count": 314,
  "articles": [ ... ]
}
```

Field notes:

- `generatedAt`: timestamp for the most recent generation run
- `count`: number of markdown files processed
- `articles`: ordered array of normalized markdown documents

## commits[] schema

Each item in `commits` is one commit in chronological order.

```json
{
  "hash": "full git sha",
  "commitNumber": 1,
  "message": "commit title line only",
  "author": "author name",
  "date": "ISO datetime string",
  "filesChanged": [
    "federal-constitution/article-001.md",
    "federal-ammendment-summaries/05-1974-first-amendment.md"
  ],
  "summary": null
}
```

Field notes:

- `hash`: unique commit id.
- `commitNumber`: 1-based order from oldest to newest.
- `message`: first line of commit message only.
- `author`: commit author name (used here as signing authority/president label).
- `date`: ISO timestamp (`YYYY-MM-DDTHH:mm:ssZ`).
- `filesChanged`: list of changed file paths in that commit.
- `summary`:
  - `null` for commit `1` (original constitution)
  - markdown text for amendment commits when a summary file was part of that commit

### Commit to amendment mapping

- Commit `1` = original constitution (not an amendment)
- Commit `2` = amendment `1`
- Commit `3` = amendment `2`
- Formula: `amendmentNumber = commitNumber - 1` for commitNumber > 1

## articles schema

`articles` is an object keyed by article path.

Key example:

- `federal-constitution/article-001.md`

Value shape:

```json
{
  "changeCount": 4,
  "amendments": [
    { "commitHash": "...", "amendmentNumber": 1 },
    { "commitHash": "...", "amendmentNumber": 7 }
  ]
}
```

Field notes:

- `changeCount`: how many commits changed this article (includes commit 1 initial add).
- `amendments`: only amendment commits (commitNumber > 1). Original commit is intentionally excluded here.

## current constitution article schema

Each item in `data/current-constitution.json.articles` is one markdown file normalized into JSON.

```json
{
  "fileName": "article-177.md",
  "filePath": "data/federal-constitution/article-177.md",
  "title": "Appointment of Supreme Court judges.",
  "firstAdded": "14 August 1973",
  "lastUpdated": "13 November 2025",
  "source": "https://factfocus.com/wp-content/uploads/2021/03/Original-Constitution-of-1973-Pakistan.pdf",
  "amendments": [
    { "label": "Amendment 18", "url": "https://pakistani.org/pakistan/constitution/amendments/18amendment.html" }
  ],
  "body": "(1) ..."
}
```

Field notes:

- `fileName`: source markdown filename.
- `filePath`: canonical relative path under `data/federal-constitution`.
- `title`: the table `Title` value when present.
- `firstAdded`: the table `First Added` value when present.
- `lastUpdated`: the table `Last Updated` value when present.
- `source`: the table `Source` value when present.
- `amendments`: an array of amendment table rows preserved as `{ label, url }`.
- `body`: the markdown body after the header table, preserved as plain markdown text.

## Common usage patterns

### 1) Show article history timeline

Input: article path (for example `federal-constitution/article-017.md`)

Steps:

1. Find all commits where `filesChanged` includes that article path.
2. Sort is already chronological in `commits`.
3. Render date, title (`message`), and optional `summary`.

### 2) Show "last changed" info for an article

1. Filter commits that include the article path.
2. Take the last one in that filtered list.
3. Display its `date`, `message`, and `hash`.

### 3) Build amendment detail view

1. Find commit by `commitNumber` (or `hash`).
2. Compute amendment number with `commitNumber - 1`.
3. Use:
   - `summary` for plain-language text
   - `filesChanged` filtered to `federal-constitution/` for affected articles

### 4) Show "most amended articles"

1. Iterate `articles` entries.
2. Sort by `changeCount` descending.
3. Render top N.

### 5) Render the current constitution text

1. Load `data/current-constitution.json`.
2. Find the object by `fileName`.
3. Render the `body` as markdown and display `title` plus the standard metadata fields.
4. Use `amendments` to render amendment source links when available.

## Example helper functions (plain JS)

```js
function getAmendmentNumber(commit) {
  return commit.commitNumber > 1 ? commit.commitNumber - 1 : null;
}

function getArticleCommits(data, articlePath) {
  return data.commits.filter((c) => c.filesChanged.includes(articlePath));
}

function getLastChangedCommit(data, articlePath) {
  const hits = getArticleCommits(data, articlePath);
  return hits.length ? hits[hits.length - 1] : null;
}

function getAffectedArticles(commit) {
  return commit.filesChanged.filter((p) =>
    p.startsWith("federal-constitution/") && p.endsWith(".md")
  );
}
```

## Important implementation notes for LLMs

- Treat `hash` as the primary id for commit-level linking.
- Do not parse amendment number from `message`; use `commitNumber - 1`.
- `summary` is markdown text; render as markdown when possible.
- `filesChanged` can include non-article files (for example `README.md`, images). Filter by folder when needed.
- `articles` is an index for fast lookups. Prefer it for aggregate views instead of recomputing every time.

## File location guidance

- Canonical generated static file: `data.json` at repository root.
- There may also be a `data/data.json` path in the repo, but the generation script writes to root `data.json`.
- Canonical current constitution text file: `data/current-constitution.json` at repository root.

Use root `data.json` for amendment history and root `data/current-constitution.json` for the current constitution text unless project code explicitly points elsewhere.
