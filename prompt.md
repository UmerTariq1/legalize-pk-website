# Cursor Prompt: legalize-pk Constitution Explorer Website

---

## What This Project Is

This is a website for **legalize-pk** — an open-source GitHub repository where the entire Constitution of Pakistan (1973) is stored as a Git repository. Every article is its own Markdown file. Every constitutional amendment is a backdated Git commit that touches only the files of the articles it actually changed. 25 commits total: 1 original commit + 24 enacted amendments spanning 1973 to 2025.

The website makes this git history accessible to non-technical people. No login, no user accounts, no chat history. Pure exploration tool.

The repository structure is:
- Article files live in `federal-constitution/` folder, named `article-001.md` through `article-280.md` (zero-padded three digits)
- Amendment summary files live in `federal-amendment-summaries/` folder, named like `1974-01-first-amendment.md`
- README.md has full documentation

All live data is fetched from the GitHub API via a Netlify serverless function that proxies requests using a `GITHUB_TOKEN` environment variable stored securely in Netlify. The frontend never touches the token directly.

---

## Tech Stack Constraints

- Vanilla HTML, CSS, and JavaScript only. No React, no Angular, no Vue, no build tools.
- CDN libraries are allowed and encouraged: GSAP for animations, Alpine.js for lightweight reactivity if needed, Lenis for smooth scroll, diff2html for rendering diffs, highlight.js for code, Lucide or Phosphor icons, Google Fonts.
- Netlify Functions (Node.js) for the GitHub API proxy.
- Deployed on Netlify.

---

## Design Direction

### Visual Identity

- **Color palette**: Deep forest green (`#1B3A2D`) as the primary brand color. Warm parchment/cream (`#F5F0E8`) as the page background. Aged gold (`#B8860B`) as the accent for highlights, CTAs, and key text. Soft sage (`#8FAF8F`) as a secondary tone. White for cards and panels.
- **Typography**: Use Google Fonts. Headings and display text: Playfair Display — editorial, authoritative, timeless. Body text: Source Serif 4 — readable, legal document feel. Monospace for diffs and commit hashes: JetBrains Mono.
- **Aesthetic direction**: Editorial legal archive meets modern civic tech. It should feel like a beautifully designed law journal crossed with a well-crafted data product. Not a government website. Not generic SaaS. Think: The Economist meets GitHub meets a Lahore law library.
- **Background texture**: Use CSS-generated subtle grain or geometric patterns in parchment tones. No stock photography needed — pure CSS atmosphere.
- **Do not use**: Inter, Roboto, Arial, purple gradients, generic card layouts, or anything that looks like a generic SaaS product.

### Motion and Animation

- Page load: staggered fade and slide-up reveals using GSAP, elements appearing in sequence.
- Card hover: subtle lift with box-shadow deepening and a slight scale transform.
- Diff view: added lines slide in from left with green highlight, removed lines slide in from right with red strikethrough. Animate line by line with small delays.
- Timeline dots: pulse subtly on scroll enter. Connecting vertical line draws downward on scroll using a CSS height animation or GSAP.
- View transitions: smooth cross-fade between pages or sections.
- Smooth scroll: use Lenis for buttery page scrolling.

### Mobile Responsiveness

This is critical. The site must work beautifully on a 375px wide mobile screen.

- On mobile, replace the top navigation with a fixed bottom navigation bar.
- Cards stack vertically on mobile.
- The side-by-side diff comparison view switches to a unified (single column) diff view on mobile, with a toggle to switch back to side-by-side if the user rotates to landscape.
- All touch targets must be at minimum 44px tall.
- Font sizes should scale using fluid typography with clamp().
- The explorer article/amendment selector stacks vertically on mobile.

---

## Pages and Views

### Page 1 — Home (`index.html`)

The landing page. Two visual sections.

**Hero section (above the fold):**
- Large headline split across two lines: "Understand how our" on one line, then "laws evolved." on the next — with "laws evolved." rendered in the gold accent color.
- Subtext below: "A tool to explore the 50-year history of the Constitution of Pakistan (1973), powered by the legalize-pk open-source archive."
- A floating stats card overlapping the hero visual area: "24 Amendments · 280 Articles · 1973–2025"
- A label in small caps: "TRUSTED CONSTITUTIONAL RESOURCE"
- The hero visual side (right on desktop, behind content on mobile): a CSS-generated architectural/geometric composition in dark green tones — no image file required, pure CSS shapes and gradients evoking columns or archival depth.
- "Start Over" button in the top right nav resets to home.

**Objective selector section (below the fold):**
- Section heading: "Select your objective"
- Subtext: "Choose how you would like to interact with the constitutional timeline."
- Four feature cards in a 2x2 grid on desktop, stacked on mobile. Each card has an icon, a bold title, a one-sentence description, and a CTA link in small caps with an arrow.
- Card 1: "When was this article last changed?" — links to `explorer.html?mode=last-changed`
- Card 2: "See the full history of an article" — links to `explorer.html?mode=history`
- Card 3: "Compare article before and after an amendment" — links to `explorer.html?mode=compare`
- Card 4: "Browse all amendments by year" — links to `amendments.html`

**Footer:**
- Left: Last update date and source data attribution
- Right: "GitHub Repository" links
- Bottom bar: "© 2025 legalize-pk · For educational and research purposes only"

---

### Page 2 — Constitutional Explorer (`explorer.html`)

The selection interface. This is the gateway page users land on after choosing an objective from home. The `mode` query parameter (last-changed, history, compare) determines what controls appear and what happens on submit.

**Layout:**
- Left/main panel: selection controls
- Right/sidebar panel (desktop only): "Constitutional Context" info card explaining the data is live from the legalize-pk GitHub repo, with a link to GitHub

**Controls:**
- "Select an Article" — a styled dropdown showing article numbers and names (e.g. "Article 17 — Freedom of Association"). Populated from dummy data by default, replaced by live API data when available.
- If mode is compare: also show "Select an Amendment" — a scrollable styled list of all 25 commits. Each item shows the amendment name and year. The 1973 Original is always first.
- If mode is history or last-changed: only the article selector is needed.
- "View Results →" primary button at the bottom.

**Navigation:**
- A breadcrumb at the top: Home → [mode label, e.g. "Article History"]
- Back arrow button that goes to index.html

**Submit behavior:**
- If mode is history or last-changed: redirect to `history.html?article=017`
- If mode is compare: redirect to `compare.html?article=017&after=SHA_OF_SELECTED_AMENDMENT`

---

### Page 3 — Article History (`history.html`)

Reached after selecting an article and submitting from explorer in history or last-changed mode. Shows the complete amendment history for one article as a vertical timeline.

**Header area:**
- Breadcrumb: Home → Explorer → Article History
- Tag showing the article's topic (e.g. "FREEDOM OF ASSOCIATION")
- Large heading: "History of Article 17"
- Subtext: "Tracking the legislative evolution from the original 1973 enactment to present."

**Timeline:**
- Vertical timeline with a drawn connecting line down the left side.
- Each node represents one commit that touched this file.
- Node contents:
  - Date in small caps (e.g. APRIL 19, 2010)
  - Amendment name as heading (e.g. "18th Amendment Act") with a CURRENT badge in green on the most recent one
  - The git diff for that file — added lines with green left border and light green background, removed lines with red left border and light red background, strikethrough on removed text. Monospace font.
  - Short commit hash shown as a small monospace badge
  - A "Compare with Previous Version" button that links to `compare.html?article=017&before=SHA1&after=SHA2`
- Oldest entry at the bottom is always the 1973 Original Enactment

**Sidebar (desktop) / below timeline (mobile):**
- Amendment summary card for whichever timeline entry the user last hovered or tapped
- Shows amendment number, date, plain-English summary, articles affected

---

### Page 4 — Article Comparison (`compare.html`)

Reached after selecting an article and an amendment in compare mode, or from the "Compare with Previous Version" button in history view. Query parameters: `?article=017&before=SHA1&after=SHA2`

**Header area:**
- Breadcrumb: Home → Explorer → Compare
- Label: "LEGISLATIVE COMPARISON"
- Large heading: "Comparing Article [N]: Before & After [Amendment Name]"
- Action bar: "Copy Link" button, "Last Modified: [date]"
- Toggle: "Side-by-Side" / "Unified" — switches the diff layout

**Diff view (side-by-side, default on desktop):**
- Left panel labeled "HISTORICAL STATE" with a LEGACY badge — shows the article text from the commit immediately before the amendment
- Right panel labeled "ENACTED LEGISLATION" with an ACTIVE badge in green — shows the article text at the amendment commit
- Removed text in the left panel: red background highlight block, strikethrough
- Added text in the right panel: green background highlight block
- Unchanged text renders normally in both panels

**Unified view (default on mobile, togglable on desktop):**
- Single column with + and - line markers
- Added lines: green background, + prefix
- Removed lines: red background with strikethrough, - prefix

---

### Page 5 — Amendments Browse (`amendments.html`)

A chronological archive of all 24 enacted amendments.

**Header:**
- Heading: "Constitutional Amendments Archive"
- Subtext: "All 24 enacted amendments to the Constitution of Pakistan, from 1974 to 2025."

**Filter bar:**
- Era filter buttons: All · Bhutto Era (1974–77) · Zia Era (1985–87) · Democratic Era (1991–99) · Musharraf Era (2003) · Modern Era (2010–2025)
- Active filter highlighted in green

**Amendment cards:**
- One card per amendment in chronological order
- Each card: amendment number, ordinal name, enactment date, one-line summary, number of articles affected, president who signed, era tag
- Click or tap to expand: reveals full plain-English summary, with a link to the original source text

---

## Navigation Structure and Linking

All pages must be linked correctly and must work fully with dummy data so the UI can be reviewed without a live GitHub token.

**Top navigation (desktop):**
- Logo/wordmark "legalize-pk" links to index.html
- Nav links: Home · Explorer · Amendments · GitHub (external, opens in new tab)
- "Start Over" button always links to index.html

**Bottom navigation (mobile only, fixed to bottom of screen):**
- Home icon → index.html
- Explorer icon → explorer.html (no mode param, shows mode selection first)
- Amendments icon → amendments.html
- GitHub icon → external repo link (opens in new tab)

**Internal linking rules — every link must be correct and functional:**
- Home feature cards link to explorer.html with the correct `?mode=` query parameter
- Explorer submit button reads the mode parameter and redirects to history.html or compare.html with article number and commit SHAs as query parameters
- History timeline "Compare with Previous Version" buttons link to compare.html with `?article=` and `?before=` and `?after=` parameters pre-filled from the dummy data commit SHAs
- All inner pages have breadcrumbs with working back links
- "Start Over" always returns to index.html

**On mobile, the bottom nav must be visible on all five pages.**

---

## Dummy Data Layer

Because the GitHub API requires a live token, build a complete dummy data layer that activates automatically when the API call fails or when a `?demo=true` query parameter is present. This lets every page be fully navigated and visually reviewed without any backend or token.

Store all dummy data in `js/dummy-data.js`. It must include:

- A list of at least 10 sample articles with realistic names matching the real constitution (Article 6 — High Treason, Article 17 — Freedom of Association, Article 51 — Composition of National Assembly, Article 63 — Disqualifications for Membership, Article 90 — Federal Government, Article 106 — Composition of Provincial Assemblies, Article 140 — Local Government, Article 184 — Original Jurisdiction of Supreme Court, Article 239 — Amendment of Constitution, Article 245 — Functions of Armed Forces)
- All 24 real amendment names with their real enactment dates and the real president who signed each one (this is static known data, hardcode it)
- Dummy commit SHAs for each amendment (can be fake but consistent, e.g. "a1b2c3d")
- 3 to 5 sample diff entries for at least two articles showing realistic constitutional text changes — use actual text from the constitution if you know it, otherwise use plausible legal language
- Sample plain-English summaries for at least 5 amendments
- The dummy data must be realistic enough that a user looking at the demo cannot immediately tell it is fake

In `js/api.js`, every function that calls the GitHub API must catch errors and fall back to returning the equivalent dummy data. Show a small non-intrusive "Demo Mode" badge fixed to the bottom-left corner of the screen when dummy data is being used, so a developer reviewing the UI knows the difference.

---

## GitHub API Integration

Create a Netlify serverless function at `netlify/functions/github.js` that:
- Accepts an `endpoint` query parameter containing the GitHub REST API path
- Adds the Authorization header using `process.env.GITHUB_TOKEN`
- Returns the GitHub API response as JSON with CORS headers allowing all origins

The frontend module `js/api.js` must abstract all GitHub calls into named functions:
- Get list of article files from the federal-constitution folder
- Get all commits for a specific file path to build article history
- Get file content at a specific commit SHA to show article text at a point in time
- Get the diff between two commit SHAs for a specific file to render the comparison view
- Get all files from federal-amendment-summaries folder and their contents

All API calls route through `/api/github?endpoint=...` which Netlify redirects to the function.

---

## Configuration File

Create `js/config.js` with:
- REPO_OWNER (empty string by default, to be filled in)
- REPO_NAME (empty string by default, to be filled in)
- DEMO_MODE flag (set to true by default until real credentials are configured)

No repository owner or name should ever be hardcoded in any other file.

---

## File Structure to Create

```
legalize-pk-website/
├── index.html
├── explorer.html
├── history.html
├── compare.html
├── amendments.html
├── css/
│   ├── main.css          (CSS variables, reset, global typography, layout utilities)
│   ├── components.css    (cards, buttons, badges, nav, breadcrumbs, tags)
│   ├── diff.css          (diff view styling, added/removed line colors, timeline)
│   └── animations.css    (keyframes, GSAP targets, scroll-triggered classes)
├── js/
│   ├── config.js         (repo owner, repo name, demo mode flag)
│   ├── api.js            (all GitHub API calls, falls back to dummy data on error)
│   ├── dummy-data.js     (complete offline dataset for demo and development)
│   ├── diff-renderer.js  (parses unified diff format and renders highlighted HTML)
│   ├── animations.js     (GSAP setup, scroll triggers, page load sequences)
│   ├── home.js           (index.html specific logic)
│   ├── explorer.js       (explorer.html logic, reads mode param, builds selectors)
│   ├── history.js        (history.html logic, builds timeline from commit list)
│   ├── compare.js        (compare.html logic, renders side-by-side and unified diff)
│   └── amendments.js     (amendments.html logic, era filtering)
├── netlify/
│   └── functions/
│       └── github.js
└── netlify.toml
```

No inline styles in HTML. No inline scripts in HTML. All styles in CSS files. All logic in JS files.

---

## Netlify Configuration (`netlify.toml`)

- Publish directory: root folder (`.`)
- Functions directory: `netlify/functions`
- Redirect rule: `/api/*` routes to `/.netlify/functions/:splat` with status 200
- No build command needed

---

## Environment Variables

Set these in the Netlify dashboard. Never put them in code.

- `GITHUB_TOKEN` — GitHub personal access token with read-only repo scope
- `REPO_OWNER` — the GitHub username owning the legalize-pk repository
- `REPO_NAME` — the repository name

---

## Final Build Instructions

Build all five HTML pages and all supporting CSS and JS files. Verify the following before finishing:

1. Every link on every page points to a real file that exists in the project.
2. Every page renders correctly with dummy data — open each HTML file directly in a browser with no server and no API, and everything should be visible and navigable.
3. Every page has working top nav on desktop and working bottom nav on mobile.
4. Breadcrumbs on inner pages have working links back to the correct parent pages.
5. The explorer page correctly reads the `?mode=` query parameter and shows the right controls and submit behavior for each mode.
6. The history page correctly reads `?article=` and renders the dummy timeline.
7. The compare page correctly reads `?article=`, `?before=`, and `?after=` and renders the dummy diff.
8. The amendments page filter buttons work with dummy data.
9. The "Demo Mode" badge appears on all pages when dummy data is active.
10. The site looks excellent at both 1440px desktop width and 375px mobile width.

The diff view and the article history timeline are the most important visual elements — give them the most design care and polish.