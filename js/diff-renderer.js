/* Unified diff parsing + rendering (no dependencies). */

(function () {
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function parseUnifiedDiff(patch) {
    if (!patch || typeof patch !== "string") return { hunks: [], lines: [] };

    const raw = patch.split("\n");
    const lines = [];
    const hunks = [];
    let currentHunk = null;

    for (const l of raw) {
      if (l.startsWith("diff --git ")) continue;
      if (l.startsWith("--- ") || l.startsWith("+++ ")) continue;
      if (l.startsWith("index ")) continue;

      if (l.startsWith("@@")) {
        currentHunk = { header: l, lines: [] };
        hunks.push(currentHunk);
        continue;
      }

      const ch = l[0];
      if (ch === "+" || ch === "-" || ch === " ") {
        const type = ch === "+" ? "add" : ch === "-" ? "remove" : "context";
        const obj = { type, text: l.slice(1) };
        lines.push(obj);
        if (currentHunk) currentHunk.lines.push(obj);
        continue;
      }

      // Ignore other metadata lines.
    }

    return { hunks, lines };
  }

  function renderUnifiedHtml(patch) {
    const parsed = parseUnifiedDiff(patch);
    if (!parsed.lines.length) {
      return `<div class="diff-block"><div class="diff-loading">No diff available.</div></div>`;
    }

    const rows = parsed.lines
      .map((l) => {
        const gutter = l.type === "add" ? "+" : l.type === "remove" ? "−" : "";
        return (
          `<div class="diff-line ${l.type}">` +
          `<div class="diff-gutter">${escapeHtml(gutter)}</div>` +
          `<div class="diff-text">${escapeHtml(l.text)}</div>` +
          `</div>`
        );
      })
      .join("");

    return `<div class="diff-block"><div class="diff-lines">${rows}</div></div>`;
  }

  function renderSideBySideHtml(patch) {
    const parsed = parseUnifiedDiff(patch);
    if (!parsed.lines.length) {
      return { beforeHtml: `<div class="diff-loading">No diff available.</div>`, afterHtml: `<div class="diff-loading">No diff available.</div>` };
    }

    const beforeRows = [];
    const afterRows = [];

    for (const l of parsed.lines) {
      if (l.type === "context") {
        const html =
          `<div class="diff-line context">` +
          `<div class="diff-gutter"></div>` +
          `<div class="diff-text">${escapeHtml(l.text)}</div>` +
          `</div>`;
        beforeRows.push(html);
        afterRows.push(html);
      } else if (l.type === "remove") {
        beforeRows.push(
          `<div class="diff-line remove">` +
            `<div class="diff-gutter">−</div>` +
            `<div class="diff-text">${escapeHtml(l.text)}</div>` +
            `</div>`
        );
      } else if (l.type === "add") {
        afterRows.push(
          `<div class="diff-line add">` +
            `<div class="diff-gutter">+</div>` +
            `<div class="diff-text">${escapeHtml(l.text)}</div>` +
            `</div>`
        );
      }
    }

    const beforeHtml = `<div class="diff-lines">${beforeRows.join("")}</div>`;
    const afterHtml = `<div class="diff-lines">${afterRows.join("")}</div>`;
    return { beforeHtml, afterHtml };
  }

  function makePatchFromTexts(oldText, newText, headerPath) {
    const oldLines = String(oldText || "").split("\n");
    const newLines = String(newText || "").split("\n");
    const max = Math.max(oldLines.length, newLines.length);
    const lines = [];
    lines.push(`diff --git a/${headerPath} b/${headerPath}`);
    lines.push(`--- a/${headerPath}`);
    lines.push(`+++ b/${headerPath}`);
    lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
    for (let i = 0; i < max; i++) {
      const o = oldLines[i];
      const n = newLines[i];
      if (o === undefined) lines.push(`+${n}`);
      else if (n === undefined) lines.push(`-${o}`);
      else if (o === n) lines.push(` ${o}`);
      else {
        lines.push(`-${o}`);
        lines.push(`+${n}`);
      }
    }
    return lines.join("\n");
  }

  window.DiffRenderer = {
    parseUnifiedDiff,
    renderUnifiedHtml,
    renderSideBySideHtml,
    makePatchFromTexts,
  };
})();

