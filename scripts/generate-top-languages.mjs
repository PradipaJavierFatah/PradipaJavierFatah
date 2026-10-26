import { mkdir, writeFile } from "node:fs/promises";

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

const ranked = [...languageBytes].sort((a, b) => b[1] - a[1]);
const totalBytes = ranked.reduce((total, [, bytes]) => total + bytes, 0);
if (!ranked.length || !Number.isSafeInteger(totalBytes) || totalBytes <= 0) {
  throw new Error("No repository language data was returned; the existing card was left untouched.");
}

const colors = ["#fabd2f", "#83a598", "#d3869b", "#8ec07c", "#fe8019"];
const escapeXML = (text) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
const rows = ranked.slice(0, 5).map(([language, bytes], index) => {
  const percent = (bytes / totalBytes) * 100;
  const y = 58 + index * 24;
  const barWidth = Math.max(2, (432 * percent) / 100);
  return `<text x="24" y="${y}" fill="#ebdbb2" font-size="12">${escapeXML(language)}</text><text x="456" y="${y}" fill="#bdae93" font-size="12" text-anchor="end">${percent.toFixed(1)}%</text><rect x="24" y="${y + 6}" width="432" height="6" rx="3" fill="#3c3836"/><rect x="24" y="${y + 6}" width="${barWidth.toFixed(2)}" height="6" rx="3" fill="${colors[index]}"/>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="184" viewBox="0 0 480 184" role="img" aria-labelledby="title desc"><title id="title">Most Used Languages</title><desc id="desc">Top programming languages by code size.</desc><rect width="480" height="184" rx="8" fill="#282828" stroke="#504945"/><text x="24" y="32" fill="#ebdbb2" font-size="16" font-weight="600">Most Used Languages</text>${rows}</svg>`;

await mkdir("profile", { recursive: true });
await writeFile("profile/most-used-languages.svg", svg);
