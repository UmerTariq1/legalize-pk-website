/* eslint-disable no-console */
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_INPUT_DIR = path.join('data', 'federal-constitution');
const DEFAULT_OUTPUT_FILE = path.join('data', 'current-constitution.json');

function normalizeLineEndings(text) {
	return text.replace(/\r\n/g, '\n');
}

function splitMarkdownTableRow(line) {
	return line
		.trim()
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split('|')
		.map((cell) => cell.trim());
}

function isTableSeparatorLine(line) {
	return /^\|?\s*:?[-]+:?\s*(\|\s*:?[-]+:?\s*)+\|?$/.test(line.trim());
}

function parseHeaderTable(content) {
	const lines = normalizeLineEndings(content).split('\n');
	const metadata = {};
	const amendments = [];
	let bodyStartIndex = 0;
	let inTable = false;
	let sawTableRow = false;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];

		if (!inTable) {
			if (line.trim().startsWith('|')) {
				inTable = true;
				sawTableRow = true;
			} else {
				bodyStartIndex = 0;
				break;
			}
		}

		if (isTableSeparatorLine(line)) {
			continue;
		}

		if (!line.trim()) {
			bodyStartIndex = index + 1;
			break;
		}

		if (!line.trim().startsWith('|')) {
			bodyStartIndex = index;
			break;
		}

		const cells = splitMarkdownTableRow(line);
		if (cells.length < 2) {
			continue;
		}

		const key = cells[0];
		const value = cells.slice(1).join(' | ');

		if (key.toLowerCase().startsWith('amendment ')) {
			amendments.push({
				label: key,
				url: value,
			});
			continue;
		}

		metadata[key] = value;
	}

	if (!sawTableRow) {
		bodyStartIndex = 0;
	}

	return {
		metadata,
		amendments,
		body: lines.slice(bodyStartIndex).join('\n').trimEnd(),
	};
}

function parseArticleNumber(fileName) {
	if (fileName === 'preamble.md') {
		return {
			order: -1,
			base: 'preamble',
			suffix: '',
		};
	}

	const match = fileName.match(/^article-(\d{3})(?:-([A-Z]+))?\.md$/);
	if (!match) {
		return {
			order: Number.MAX_SAFE_INTEGER,
			base: fileName,
			suffix: '',
		};
	}

	return {
		order: Number.parseInt(match[1], 10),
		base: match[1],
		suffix: match[2] || '',
	};
}

function compareFileNames(left, right) {
	const leftInfo = parseArticleNumber(left);
	const rightInfo = parseArticleNumber(right);

	if (leftInfo.order !== rightInfo.order) {
		return leftInfo.order - rightInfo.order;
	}

	if (leftInfo.base !== rightInfo.base) {
		return leftInfo.base.localeCompare(rightInfo.base);
	}

	if (leftInfo.suffix !== rightInfo.suffix) {
		if (!leftInfo.suffix) {
			return -1;
		}
		if (!rightInfo.suffix) {
			return 1;
		}

		return leftInfo.suffix.localeCompare(rightInfo.suffix);
	}

	return left.localeCompare(right);
}

async function loadMarkdownFiles(inputDir) {
	const entries = await fs.readdir(inputDir, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
		.map((entry) => entry.name)
		.sort(compareFileNames);
}

function buildNormalizedArticle(fileName, rawContent) {
	const { metadata, amendments, body } = parseHeaderTable(rawContent);
	const title = metadata.Title || metadata.title || null;
	const firstAdded = metadata['First Added'] || null;
	const lastUpdated = metadata['Last Updated'] || null;
	const source = metadata.Source || null;

	const extraMetadata = { ...metadata };
	delete extraMetadata.Title;
	delete extraMetadata.title;
	delete extraMetadata['First Added'];
	delete extraMetadata['Last Updated'];
	delete extraMetadata.Source;

	return {
		fileName,
		filePath: path.posix.join('data', 'federal-constitution', fileName),
		title,
		firstAdded,
		lastUpdated,
		source,
		amendments,
		metadata: extraMetadata,
		body,
	};
}

async function main() {
	const repoRoot = path.resolve(__dirname, '..', '..');
	const inputDir = path.join(repoRoot, DEFAULT_INPUT_DIR);
	const outputFile = path.join(repoRoot, DEFAULT_OUTPUT_FILE);

	const files = await loadMarkdownFiles(inputDir);
	const articles = [];

	for (const fileName of files) {
		const filePath = path.join(inputDir, fileName);
		const rawContent = await fs.readFile(filePath, 'utf8');
		articles.push(buildNormalizedArticle(fileName, rawContent));
	}

	if (articles.length !== files.length) {
		throw new Error(`Expected ${files.length} articles, but generated ${articles.length}.`);
	}

	const output = {
		generatedAt: new Date().toISOString(),
		count: articles.length,
		articles,
	};

	await fs.writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
	console.log(`Wrote ${articles.length} constitution entries to ${outputFile}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
