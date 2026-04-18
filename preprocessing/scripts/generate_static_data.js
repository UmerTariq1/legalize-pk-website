// run at the root level and make sure .env file is there : node .\preprocessing\scripts\generate_static_data.js 




/* eslint-disable no-console */
const fs = require('node:fs/promises');
const path = require('node:path');

const OWNER = 'UmerTariq1';
const REPO = 'legalize-pk';
const TARGET_COMMIT_COUNT = 25;
const CONSTITUTION_DIR = 'federal-constitution/';
const PREAMBLE_PATH = `${CONSTITUTION_DIR}preamble.md`;
const AMENDMENT_SUMMARY_DIR = 'federal-ammendment-summaries/';
const ARTICLE_SUMMARY_DIR = path.join('data', 'federal-article-summaries');

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

async function loadGitHubToken(repoRoot) {
	if (process.env.GITHUB_TOKEN) {
		return process.env.GITHUB_TOKEN;
	}

	const envPath = path.join(repoRoot, '.env');

	try {
		const envContent = await fs.readFile(envPath, 'utf8');
		const parsed = parseDotEnv(envContent);
		if (parsed.GITHUB_TOKEN) {
			process.env.GITHUB_TOKEN = parsed.GITHUB_TOKEN;
			return parsed.GITHUB_TOKEN;
		}
	} catch (error) {
		if (error && error.code !== 'ENOENT') {
			throw error;
		}
	}

	throw new Error('GITHUB_TOKEN not found. Add it to environment or .env file at repository root.');
}

async function githubRequest(pathname, token) {
	const url = `https://api.github.com${pathname}`;
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': 'legalize-pk-static-data-generator',
			'X-GitHub-Api-Version': '2022-11-28',
		},
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} for ${pathname}\n${body}`);
	}

	return response.json();
}

async function fetchAllCommits(token) {
	const commits = [];
	let page = 1;

	while (true) {
		const pageData = await githubRequest(
			`/repos/${OWNER}/${REPO}/commits?per_page=100&page=${page}`,
			token
		);

		if (!Array.isArray(pageData) || pageData.length === 0) {
			break;
		}

		commits.push(...pageData);
		if (pageData.length < 100) {
			break;
		}

		page += 1;
	}

	return commits;
}

async function fetchCommitDetails(sha, token) {
	return githubRequest(`/repos/${OWNER}/${REPO}/commits/${sha}`, token);
}

async function fetchAllConstitutionArticleFiles(token) {
	const tree = await githubRequest(`/repos/${OWNER}/${REPO}/git/trees/HEAD?recursive=1`, token);
	const allPaths = Array.isArray(tree.tree) ? tree.tree : [];
	const articlePathSet = new Set(
		allPaths
			.filter((item) => item.type === 'blob' && item.path.startsWith(CONSTITUTION_DIR) && item.path.endsWith('.md'))
			.map((item) => item.path)
	);

	// Keep preamble as a first-class constitutional entry even if upstream listing changes.
	articlePathSet.add(PREAMBLE_PATH);

	return Array.from(articlePathSet).sort();
}

async function fetchFileContentAtCommit(filePath, ref, token) {
	const encodedPath = filePath
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');

	const data = await githubRequest(
		`/repos/${OWNER}/${REPO}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
		token
	);

	if (!data || typeof data.content !== 'string') {
		throw new Error(`Could not read file content for ${filePath} at ${ref}`);
	}

	return Buffer.from(data.content, 'base64').toString('utf8');
}

function isTrackedFile(filePath) {
	return filePath.startsWith(CONSTITUTION_DIR) || filePath.startsWith(AMENDMENT_SUMMARY_DIR);
}

function isConstitutionMarkdownFile(filePath) {
	return String(filePath || '').startsWith(CONSTITUTION_DIR) && String(filePath || '').endsWith('.md');
}

function titleLine(message) {
	return String(message || '').split(/\r?\n/, 1)[0].trim();
}

function summaryFileNameFromArticlePath(articlePath) {
	const articleFileName = path.posix.basename(articlePath);
	const baseName = articleFileName.endsWith('.md')
		? articleFileName.slice(0, -3)
		: articleFileName;

	return `${baseName}-summary.md`;
}

async function loadArticleSummaries(repoRoot, articlePaths) {
	const articleSummaryRoot = path.join(repoRoot, ARTICLE_SUMMARY_DIR);
	const summaryByArticlePath = new Map();

	for (const articlePath of articlePaths) {
		const summaryFileName = summaryFileNameFromArticlePath(articlePath);
		const summaryPath = path.join(articleSummaryRoot, summaryFileName);

		try {
			const summaryText = await fs.readFile(summaryPath, 'utf8');
			summaryByArticlePath.set(articlePath, summaryText.trim() || null);
		} catch (error) {
			if (error && error.code === 'ENOENT') {
				summaryByArticlePath.set(articlePath, null);
				continue;
			}

			throw error;
		}
	}

	return summaryByArticlePath;
}

async function buildStaticData() {
	const repoRoot = path.resolve(__dirname, '..', '..');
	const outputPath = path.join(repoRoot, 'data.json');
	const token = await loadGitHubToken(repoRoot);

	console.log('Fetching commits from GitHub...');
	const allCommitsDesc = await fetchAllCommits(token);
	const allCommitsChronological = [...allCommitsDesc].reverse();

	const relevantCommitRows = [];
	for (const commitRef of allCommitsChronological) {
		const details = await fetchCommitDetails(commitRef.sha, token);
		const changedFiles = (details.files || []).map((file) => file.filename);
		if (changedFiles.some(isTrackedFile)) {
			relevantCommitRows.push({
				sha: details.sha,
				details,
				changedFiles,
			});
		}
	}

	if (relevantCommitRows.length !== TARGET_COMMIT_COUNT) {
		throw new Error(
			`Expected ${TARGET_COMMIT_COUNT} relevant commits, found ${relevantCommitRows.length}. ` +
				'Please verify repository history or filtering logic.'
		);
	}

	const articleFiles = await fetchAllConstitutionArticleFiles(token);
	const articleSummaries = await loadArticleSummaries(repoRoot, articleFiles);
	const articlesIndex = {};
	for (const filePath of articleFiles) {
		articlesIndex[filePath] = {
			changeCount: 0,
			amendments: [],
			summary: articleSummaries.get(filePath) || null,
		};
	}

	const commitsOutput = [];

	for (let i = 0; i < relevantCommitRows.length; i += 1) {
		const commitNumber = i + 1;
		const amendmentNumber = commitNumber - 1;
		const { sha, details, changedFiles } = relevantCommitRows[i];

		for (const filePath of changedFiles) {
			if (isConstitutionMarkdownFile(filePath)) {
				if (!articlesIndex[filePath]) {
					articlesIndex[filePath] = {
						changeCount: 0,
						amendments: [],
						summary: articleSummaries.get(filePath) || null,
					};
				}

				articlesIndex[filePath].changeCount += 1;
				if (commitNumber > 1) {
					articlesIndex[filePath].amendments.push({
						commitHash: sha,
						amendmentNumber,
					});
				}
			}
		}

		let summary = null;
		if (commitNumber > 1) {
			const summaryFilePath = changedFiles.find((filePath) =>
				filePath.startsWith(AMENDMENT_SUMMARY_DIR) && filePath.endsWith('.md')
			);

			if (summaryFilePath) {
				summary = await fetchFileContentAtCommit(summaryFilePath, sha, token);
			}
		}

		commitsOutput.push({
			hash: sha,
			commitNumber,
			message: titleLine(details.commit.message),
			author: details.commit.author ? details.commit.author.name : null,
			date: details.commit.author ? details.commit.author.date : null,
			filesChanged: changedFiles,
			summary,
		});
	}

	const output = {
		commits: commitsOutput,
		articles: articlesIndex,
	};

	await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
	console.log(`Wrote static data to ${outputPath}`);
}

buildStaticData().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
