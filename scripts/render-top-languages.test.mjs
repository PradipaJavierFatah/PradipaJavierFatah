import assert from "node:assert/strict";
import test from "node:test";
import { renderTopLanguages } from "./render-top-languages.mjs";

test("keeps compact Gruvbox styling and normalizes the six displayed languages", () => {
  const svg = renderTopLanguages(new Map([
    ["Python", 600], ["TypeScript", 200], ["JavaScript", 100],
    ["CSS", 50], ["HTML", 30], ["Blade", 20], ["Shell", 1],
  ]));
  assert.match(svg, /width="300"\s+height="165"/);
  assert.match(svg, /fill: #fabd2f/);
  assert.match(svg, /fill: #8ec07c/);
  assert.match(svg, /stroke="#e4e2e2"/);
  assert.match(svg, /Python 60\.00%/);
  assert.match(svg, /Blade 2\.00%/);
  assert.match(svg, /fill="#3572A5"/);
  assert.equal((svg.match(/data-testid="lang-name"/g) ?? []).length, 6);
  assert.equal((svg.match(/data-testid="lang-progress"/g) ?? []).length, 6);
  assert.doesNotMatch(svg, /Shell|\{\{/);
});

test("escapes language names and rejects empty or invalid data", () => {
  const svg = renderTopLanguages(new Map([["A&B<script>", 100]]));
  assert.match(svg, /A&amp;B&lt;script&gt; 100\.00%/);
  assert.match(svg, /height="115"/);
  assert.throws(() => renderTopLanguages(new Map()), /No valid/);
  assert.throws(() => renderTopLanguages(new Map([["Python", -1]])), /No valid/);
  assert.throws(() => renderTopLanguages(new Map([["Python", Number.MAX_SAFE_INTEGER], ["JavaScript", 1]])), /No valid/);
});
