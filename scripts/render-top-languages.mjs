import { readFile } from "node:fs/promises";

const template = await readFile(new URL("./templates/top-languages.svg", import.meta.url), "utf8");
const colors = JSON.parse(await readFile(new URL("./templates/language-colors.json", import.meta.url), "utf8"));
const escapeXML = (text) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);

// Matches the original compact card's font measurement and column spacing (MIT).
function measureText(text) {
  const widths = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0.2796875, 0.2765625,
    0.3546875, 0.5546875, 0.5546875, 0.8890625, 0.665625, 0.190625,
    0.3328125, 0.3328125, 0.3890625, 0.5828125, 0.2765625, 0.3328125,
    0.2765625, 0.3015625, 0.5546875, 0.5546875, 0.5546875, 0.5546875,
    0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875, 0.5546875,
    0.2765625, 0.2765625, 0.584375, 0.5828125, 0.584375, 0.5546875,
    1.0140625, 0.665625, 0.665625, 0.721875, 0.721875, 0.665625,
    0.609375, 0.7765625, 0.721875, 0.2765625, 0.5, 0.665625,
    0.5546875, 0.8328125, 0.721875, 0.7765625, 0.665625, 0.7765625,
    0.721875, 0.665625, 0.609375, 0.721875, 0.665625, 0.94375,
    0.665625, 0.665625, 0.609375, 0.2765625, 0.3546875, 0.2765625,
    0.4765625, 0.5546875, 0.3328125, 0.5546875, 0.5546875, 0.5,
    0.5546875, 0.5546875, 0.2765625, 0.5546875, 0.5546875, 0.221875,
    0.240625, 0.5, 0.221875, 0.8328125, 0.5546875, 0.5546875,
    0.5546875, 0.5546875, 0.3328125, 0.5, 0.2765625, 0.5546875,
    0.5, 0.721875, 0.5, 0.5, 0.5, 0.3546875, 0.259375, 0.353125, 0.5890625,
  ];
  return text.split("").reduce((sum, char) => sum + (widths[char.charCodeAt(0)] ?? 0.5279276315789471), 0) * 11;
}

export function renderTopLanguages(languageBytes) {
  const ranked = [...languageBytes].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const totalBytes = ranked.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (!ranked.length || ranked.some(([, bytes]) => !Number.isSafeInteger(bytes) || bytes <= 0) || !Number.isSafeInteger(totalBytes)) {
    throw new Error("No valid repository language data was returned; the existing card was left untouched.");
  }

  const languageColor = (name) => Object.hasOwn(colors, name) ? colors[name] : "#858585";
  let offset = 0;
  const bars = ranked.map(([name, bytes]) => {
    const width = Number(((bytes / totalBytes) * 250).toFixed(2));
    const bar = `<rect mask="url(#rect-mask)" data-testid="lang-progress" x="${offset}" y="0" width="${width < 10 ? width + 10 : width}" height="8" fill="${languageColor(name)}"/>`;
    offset += width;
    return bar;
  }).join("");

  const longest = ranked.reduce((previous, current) => current[0].length > previous[0].length ? current : previous);
  const columnGap = Math.max(150, 20 + measureText(`${longest[0]} ${((longest[1] / totalBytes) * 100).toFixed(2)}%`));
  const rowsPerColumn = Math.ceil(ranked.length / 2);
  const columns = [ranked.slice(0, rowsPerColumn), ranked.slice(rowsPerColumn)].filter((column) => column.length).map((column, columnIndex) => {
    const rows = column.map(([name, bytes], rowIndex) => `<g transform="translate(0, ${rowIndex * 25})"><g class="stagger" style="animation-delay: ${(rowIndex + 3) * 150}ms"><circle cx="5" cy="6" r="5" fill="${languageColor(name)}"/><text data-testid="lang-name" x="15" y="10" class="lang-name">${escapeXML(name)} ${((bytes / totalBytes) * 100).toFixed(2)}%</text></g></g>`).join("");
    return `<g transform="translate(${columnIndex * columnGap}, 0)">${rows}</g>`;
  }).join("");

  return template
    .replaceAll("{{HEIGHT}}", String(90 + Math.round(ranked.length / 2) * 25))
    .replace("{{PROGRESS_BARS}}", bars)
    .replace("{{LANGUAGE_COLUMNS}}", columns);
}
