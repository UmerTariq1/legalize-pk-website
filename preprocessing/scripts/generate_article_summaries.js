// run at the root level and make sure .env file is there : node .\preprocessing\scripts\generate_article_summaries.js 


/* eslint-disable no-console */
const fs = require('node:fs/promises');
const path = require('node:path');

const OWNER = 'UmerTariq1';
const REPO = 'legalize-pk';
const TARGET_DIR = 'federal-constitution';
const OUTPUT_DIR = 'federal-article-summaries';

const GITHUB_API_BASE = 'https://api.github.com';
const OPENAI_API_BASE = 'https://api.openai.com/v1';

const SYSTEM_PROMPT = `You are a constitutional law explainer writing for educated general public readers in Pakistan.
You are given the full amendment history of a single article from the Constitution of Pakistan 1973,
presented as a series of Git diffs — each diff showing exactly what text changed in that article
at the time of each constitutional amendment.

Your task is to write a clear, insightful summary of this article in 1 to 3 paragraphs.

The summary must cover two things:
1. What this article is about — its purpose, what right or rule or institution it establishes,
   and why it matters in the constitutional structure of Pakistan.
2. How this article has evolved — which amendments changed it, what specifically changed,
   and what the practical effect of those changes was on citizens or institutions. if a person changed then why? was there a political reason behind it.

If the article was never amended, focus entirely on what it means and why it matters.

Rules:
- Do not make up facts. Work only from the diff text provided.
- Do not use legal jargon without explaining it.
- Do not reproduce the raw legal text verbatim. Explain it in plain English.
- Do not include headings, bullet points, or any formatting. Return only flowing prose paragraphs.
- Do not add any preamble like "Here is the summary" — return only the summary itself.
- Length: minimum 1 paragraph, maximum 3 paragraphs.
- Do no name the questions that you are answering. for eg "to answer the question ..."`;

function parseDotEnv(content) {
	const env = {};

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const equalsIndex = line.indexOf('=');
		if (equalsIndex === -1) {
			continue;
		}

		const key = line.slice(0, equalsIndex).trim();
		let value = line.slice(equalsIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		env[key] = value;
	}

	return env;
}

async function loadEnvFromDotFile(repoRoot) {
	const envPath = path.join(repoRoot, '.env');

	let envContent;
	try {
		envContent = await fs.readFile(envPath, 'utf8');
	} catch (error) {
		if (error && error.code === 'ENOENT') {
			throw new Error(`.env file not found at ${envPath}`);
		}

		throw error;
	}

	const parsed = parseDotEnv(envContent);

	if (!process.env.GITHUB_TOKEN && parsed.GITHUB_TOKEN) {
		process.env.GITHUB_TOKEN = parsed.GITHUB_TOKEN;
	}

	if (!process.env.OPENAI_API_KEY && parsed.OPENAI_API_KEY) {
		process.env.OPENAI_API_KEY = parsed.OPENAI_API_KEY;
	}

	if (!process.env.GITHUB_TOKEN) {
		throw new Error('GITHUB_TOKEN not found in environment or .env file.');
	}

	if (!process.env.OPENAI_API_KEY) {
		throw new Error('OPENAI_API_KEY not found in environment or .env file.');
	}

	return {
		githubToken: process.env.GITHUB_TOKEN,
		openAiKey: process.env.OPENAI_API_KEY,
	};
}

function parseStartFromArg(argv) {
	let startFrom = null;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--start-from') {
			startFrom = argv[i + 1] || null;
			i += 1;
			continue;
		}

		if (arg.startsWith('--start-from=')) {
			startFrom = arg.slice('--start-from='.length);
		}
	}

	if (startFrom === null) {
		return null;
	}

	if (!/^\d{3}$/.test(startFrom)) {
		throw new Error('Invalid --start-from value. Use a zero-padded 3-digit integer like 045.');
	}

	return startFrom;
}

async function githubRequest(pathname, token) {
	const url = `${GITHUB_API_BASE}${pathname}`;
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': 'legalize-pk-article-summary-generator',
			'X-GitHub-Api-Version': '2022-11-28',
		},
	});

	if (response.status !== 200) {
		const body = await response.text();
		throw new Error(
			[
				'GitHub API request failed.',
				`URL: ${url}`,
				`Status: ${response.status} ${response.statusText}`,
				`Body: ${body}`,
			].join('\n')
		);
	}

	return response.json();
}

async function openAiChatCompletion(systemPrompt, userPrompt, openAiKey) {
	const url = `${OPENAI_API_BASE}/chat/completions`;
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${openAiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'gpt-4o',
			temperature: 0.2,
			messages: [
				{
					role: 'system',
					content: systemPrompt,
				},
				{
					role: 'user',
					content: userPrompt,
				},
			],
		}),
	});

	if (response.status !== 200) {
		const body = await response.text();
		throw new Error(
			[
				'OpenAI API request failed.',
				`URL: ${url}`,
				`Status: ${response.status} ${response.statusText}`,
				`Body: ${body}`,
			].join('\n')
		);
	}

	const payload = await response.json();
	const summary = payload?.choices?.[0]?.message?.content;

	if (!summary || typeof summary !== 'string') {
		throw new Error(`OpenAI API response missing summary text. Response: ${JSON.stringify(payload)}`);
	}

	return summary.trim();
}

async function listArticleFiles(githubToken) {
	const items = await githubRequest(
		`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_DIR)}`,
		githubToken
	);

	if (!Array.isArray(items)) {
		throw new Error('Unexpected GitHub contents response: expected an array.');
	}

	return items
		.filter(
			(item) =>
				item &&
				item.type === 'file' &&
				typeof item.name === 'string' &&
				/^article-\d{3}(?:-[A-Z]+)?\.md$/.test(item.name)
		)
		.map((item) => item.name)
		.sort((a, b) => a.localeCompare(b));
}

function applyStartFromFilter(fileNames, startFrom) {
	if (!startFrom) {
		return fileNames;
	}

	const threshold = `article-${startFrom}.md`;
	return fileNames.filter((name) => name.localeCompare(threshold) >= 0);
}

async function fetchCommitsForFile(fileName, githubToken) {
	const relativePath = `${TARGET_DIR}/${fileName}`;
	const encodedPath = encodeURIComponent(relativePath);
	const commits = [];
	let page = 1;

	while (true) {
		const pageRows = await githubRequest(
			`/repos/${OWNER}/${REPO}/commits?path=${encodedPath}&per_page=100&page=${page}`,
			githubToken
		);

		if (!Array.isArray(pageRows) || pageRows.length === 0) {
			break;
		}

		commits.push(...pageRows);

		if (pageRows.length < 100) {
			break;
		}

		page += 1;
	}

	return commits;
}

async function fetchCommitPatchForFile(sha, fileName, githubToken) {
	const relativePath = `${TARGET_DIR}/${fileName}`;
	const details = await githubRequest(`/repos/${OWNER}/${REPO}/commits/${sha}`, githubToken);
	const files = Array.isArray(details.files) ? details.files : [];
	const fileEntry = files.find((file) => file && file.filename === relativePath);

	if (!fileEntry) {
		throw new Error(`Commit ${sha} does not include expected file ${relativePath}.`);
	}

	return typeof fileEntry.patch === 'string' ? fileEntry.patch : '';
}

function getCommitTitle(message) {
	return String(message || '').split(/\r?\n/, 1)[0].trim();
}

function formatCommitDate(dateText) {
	const value = String(dateText || '').trim();
	if (value.length >= 10) {
		return value.slice(0, 10);
	}

	return value;
}

async function buildArticleCommitHistory(fileName, githubToken) {
	const commitsDescending = await fetchCommitsForFile(fileName, githubToken);
	const commitsAscending = [...commitsDescending].reverse();
	const rows = [];

	for (const commitRef of commitsAscending) {
		const sha = commitRef.sha;
		const message = getCommitTitle(commitRef?.commit?.message || '');
		const date = formatCommitDate(commitRef?.commit?.author?.date || '');
		const patch = await fetchCommitPatchForFile(sha, fileName, githubToken);

		rows.push({
			sha,
			message,
			date,
			patch,
		});
	}

	return rows;
}

function formatPromptData(fileName, commitRows) {
	const blocks = [];

	for (let i = 0; i < commitRows.length; i += 1) {
		const row = commitRows[i];
		blocks.push(
			[
				'---',
				`Commit ${i + 1}:`,
				`Message: ${row.message}`,
				`Date: ${row.date}`,
				'Diff:',
				row.patch,
			].join('\n')
		);
	}

	return [
		'----',
		`ARTICLE FILENAME: ${fileName}`,
		'',
		'COMMIT HISTORY (oldest to newest):',
		blocks.join('\n'),
		'',
		'----',
	].join('\n');
}

function toSummaryOutputName(fileName) {
	if (fileName.endsWith('.md')) {
		return `${fileName.slice(0, -3)}-summary.md`;
	}

	return `${fileName}-summary.md`;
}

async function ensureOutputDir(repoRoot) {
	const outputPath = path.join(repoRoot, OUTPUT_DIR);
	await fs.mkdir(outputPath, { recursive: true });
	return outputPath;
}

async function processArticle(fileName, outputDir, githubToken, openAiKey, index, total) {
	console.log(`[${index}/${total}] Processing ${fileName}`);
	const commitRows = await buildArticleCommitHistory(fileName, githubToken);
	const promptData = formatPromptData(fileName, commitRows);

	console.log(`[${index}/${total}] Calling OpenAI for ${fileName}`);
	const summaryText = await openAiChatCompletion(SYSTEM_PROMPT, promptData, openAiKey);

	const outputName = toSummaryOutputName(fileName);
	const outputFilePath = path.join(outputDir, outputName);
	await fs.writeFile(outputFilePath, `${summaryText}\n`, 'utf8');

	console.log(`✓ ${fileName} done`);
}

async function main() {
	const repoRoot = path.resolve(__dirname, '..', '..');
	const startFrom = parseStartFromArg(process.argv.slice(2));
	const { githubToken, openAiKey } = await loadEnvFromDotFile(repoRoot);
	const outputDir = await ensureOutputDir(repoRoot);

	console.log('Fetching article list from GitHub...');
	const allArticleFiles = await listArticleFiles(githubToken);
	const filteredFiles = applyStartFromFilter(allArticleFiles, startFrom);

	if (filteredFiles.length === 0) {
		console.log('No article files matched the current filter. Nothing to do.');
		return;
	}

	console.log(`Found ${filteredFiles.length} article files to process.`);
	if (startFrom) {
		console.log(`Resuming from article-${startFrom}.md`);
	}

	for (let i = 0; i < filteredFiles.length; i += 1) {
		const fileName = filteredFiles[i];
		await processArticle(fileName, outputDir, githubToken, openAiKey, i + 1, filteredFiles.length);
	}

	console.log('All done.');
}

main().catch((error) => {
	console.error('Script failed with error:');
	console.error(error);
	process.exitCode = 1;
});
