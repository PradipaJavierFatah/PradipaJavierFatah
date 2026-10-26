import { mkdir, writeFile } from "node:fs/promises";
import { renderTopLanguages } from "./render-top-languages.mjs";

const token = process.env.LANGUAGE_STATS_TOKEN;
const username = process.env.GITHUB_USERNAME;

if (!token || !username) throw new Error("Set LANGUAGE_STATS_TOKEN and GITHUB_USERNAME.");

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2026-03-10",
};

async function getJSON(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API request failed (${response.status}).`);
  return response.json();
}

const authenticatedUser = await getJSON("/user");
if (authenticatedUser.login?.toLowerCase() !== username.toLowerCase()) {
  throw new Error("The token belongs to a different GitHub account.");
}

const repositories = [];
for (let page = 1; ; page += 1) {
  const query = new URLSearchParams({ visibility: "all", affiliation: "owner", per_page: "100", page: String(page) });
  const results = await getJSON(`/user/repos?${query}`);
  if (!Array.isArray(results)) throw new Error("GitHub returned an invalid repository list.");
  repositories.push(...results.filter((repo) => !repo.fork && repo.owner?.login?.toLowerCase() === username.toLowerCase()));
  if (results.length < 100) break;
}
if (!repositories.some((repo) => repo.private)) {
  throw new Error("The token cannot access a private repository; check its repository access settings.");
}

const languageBytes = new Map();
for (const repo of repositories) {
  const languages = await getJSON(`/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/languages`);
  for (const [language, bytes] of Object.entries(languages)) {
    if (Number.isSafeInteger(bytes) && bytes > 0) languageBytes.set(language, (languageBytes.get(language) ?? 0) + bytes);
  }
}

const svg = renderTopLanguages(languageBytes);

await mkdir("profile", { recursive: true });
await writeFile("profile/most-used-languages.svg", svg);
