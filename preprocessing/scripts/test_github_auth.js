/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");

function parseDotEnv(content) {
  const env = {};

  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
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

async function loadDotEnv(repoRoot) {
  const envPath = path.join(repoRoot, ".env");

  try {
    const content = await fs.readFile(envPath, "utf8");
    const parsed = parseDotEnv(content);

    Object.entries(parsed).forEach(([key, value]) => {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }
}

function parseArgs(argv) {
  const args = {
    owner: "",
    repo: "",
    path: "federal-constitution/article-001.md",
    from: "",
    to: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--owner" && next) {
      args.owner = next;
      index += 1;
      continue;
    }

    if (token === "--repo" && next) {
      args.repo = next;
      index += 1;
      continue;
    }

    if (token === "--path" && next) {
      args.path = next;
      index += 1;
      continue;
    }

    if (token === "--from" && next) {
      args.from = next;
      index += 1;
      continue;
    }

    if (token === "--to" && next) {
      args.to = next;
      index += 1;
      continue;
    }
  }

  return args;
}

function encodeRepoPath(filePath) {
  return String(filePath || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const args = parseArgs(process.argv.slice(2));

  if (args.owner) {
    process.env.REPO_OWNER = args.owner;
  }

  if (args.repo) {
    process.env.REPO_NAME = args.repo;
  }

  await loadDotEnv(repoRoot);

  const { REPO, githubRequest } = require("../../netlify/functions/_shared/github-client");

  console.log("GitHub auth probe started");
  console.log(`Target repo: ${REPO.owner}/${REPO.name}`);

  const { json: user } = await githubRequest("/user");
  console.log(`Auth OK as: ${user.login}`);

  const { json: repo } = await githubRequest(`/repos/${REPO.owner}/${REPO.name}`);
  console.log(`Repo lookup OK: ${repo.full_name} (default branch: ${repo.default_branch})`);

  const contentEndpoint = `/repos/${REPO.owner}/${REPO.name}/contents/${encodeRepoPath(args.path)}?ref=${encodeURIComponent(
    repo.default_branch || "main"
  )}`;
  const { json: contentData } = await githubRequest(contentEndpoint);
  console.log(`Content lookup OK for ${args.path} at ${repo.default_branch || "main"} (sha: ${contentData.sha})`);

  if (args.from && args.to) {
    const compareEndpoint = `/repos/${REPO.owner}/${REPO.name}/compare/${encodeURIComponent(args.from)}...${encodeURIComponent(
      args.to
    )}`;
    const { json: compareData } = await githubRequest(compareEndpoint);
    const files = Array.isArray(compareData.files) ? compareData.files : [];
    const hasTargetFile = files.some((file) => file.filename === args.path);

    console.log(`Compare lookup OK: ${args.from.slice(0, 7)}...${args.to.slice(0, 7)} (${files.length} files)`);
    console.log(`Target file in compare result: ${hasTargetFile ? "yes" : "no"}`);
  } else {
    console.log("Skipping compare check. Provide --from <sha> --to <sha> to test diff endpoint inputs.");
  }

  console.log("GitHub auth probe passed.");
}

main().catch((error) => {
  const status = error.statusCode ? ` status=${error.statusCode}` : "";
  const code = error.code ? ` code=${error.code}` : "";
  console.error(`GitHub auth probe failed:${status}${code}`);
  console.error(error.message || String(error));

  if (error.details) {
    const detailPreview = String(error.details).slice(0, 500);
    console.error(`details: ${detailPreview}`);
  }

  process.exitCode = 1;
});