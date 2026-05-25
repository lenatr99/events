import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharedDir = path.join(repoRoot, "shared", "itinerary");

function usage() {
  console.error("Usage: node tools/build-itinerary.mjs <project/itinerary/config.json>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function indent(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value
    .trimEnd()
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : ""))
    .join("\n");
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.startsWith('"') ? JSON.parse(trimmed) : trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(source, filePath) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`${filePath} is missing frontmatter`);
  }

  const metadata = {};
  let currentObject = null;

  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;

    const nested = line.match(/^  ([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nested) {
      if (!currentObject) throw new Error(`${filePath} has nested frontmatter without a parent`);
      currentObject[nested[1]] = parseScalar(nested[2]);
      continue;
    }

    const topLevel = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!topLevel) throw new Error(`${filePath} has invalid frontmatter line: ${line}`);

    const [, key, value] = topLevel;
    if (value === "") {
      metadata[key] = {};
      currentObject = metadata[key];
    } else {
      metadata[key] = parseScalar(value);
      currentObject = null;
    }
  }

  return {
    metadata,
    content: source.slice(match[0].length).trim()
  };
}

function requireString(value, name, filePath) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${filePath} is missing required frontmatter field: ${name}`);
  }
  return value;
}

function markdownToHtml(markdown, filePath) {
  try {
    return execFileSync("pandoc", ["--from", "markdown+raw_html", "--to", "html"], {
      input: markdown,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 16
    }).trim();
  } catch (error) {
    const detail = error.stderr ? `\n${error.stderr}` : "";
    throw new Error(`pandoc failed while rendering ${filePath}${detail}`);
  }
}

function renderContent(content, metadata, filePath) {
  if (metadata.format === "html") {
    return content.trim();
  }

  return markdownToHtml(content, filePath);
}

function renderWeather(weather, config, filePath) {
  const date = requireString(weather?.date, "weather.date", filePath);
  const lat = requireString(weather?.lat, "weather.lat", filePath);
  const lon = requireString(weather?.lon, "weather.lon", filePath);
  const place = requireString(weather?.place, "weather.place", filePath);
  const timezone = weather?.timezone || config.timezone || "auto";
  const fallbackKind = weather?.fallbackKind || weather?.kind || "is-cloud";
  const fallbackIcon = requireString(weather?.fallbackIcon, "weather.fallbackIcon", filePath);
  const fallbackCopy = requireString(weather?.fallbackCopy, "weather.fallbackCopy", filePath);

  return `<details class="weather" data-weather-date="${escapeHtml(date)}" data-weather-lat="${escapeHtml(lat)}" data-weather-lon="${escapeHtml(lon)}" data-weather-place="${escapeHtml(place)}" data-weather-timezone="${escapeHtml(timezone)}" data-weather-kind="${escapeHtml(fallbackKind)}" data-weather-icon="${escapeHtml(fallbackIcon)}"><summary><div><strong>Weather</strong><span class="weather-row"><span class="weather-icon" aria-hidden="true">${escapeHtml(fallbackIcon)}</span><span class="weather-copy">${escapeHtml(fallbackCopy)}</span></span></div><span class="weather-chevron" aria-hidden="true">›</span></summary><div class="weather-popup" role="dialog" aria-label="Weather details"><div class="weather-popup-body">Loading forecast…</div></div></details>`;
}

function renderDay({ metadata, html, filePath }, config) {
  const id = requireString(metadata.id, "id", filePath);
  requireString(metadata.date, "date", filePath);
  const month = requireString(metadata.month, "month", filePath);
  const day = requireString(metadata.day, "day", filePath);
  const weekday = requireString(metadata.weekday, "weekday", filePath);
  const label = `${day}. ${month} - ${weekday}`;
  const headingId = `${month.toLowerCase()}---${weekday.toLowerCase()}`;

  return `<section class="day" id="${escapeHtml(id)}">
  <aside class="date-card" aria-label="${escapeHtml(label)}">
    <span class="month">${escapeHtml(month)}</span>
    <span class="date">${escapeHtml(day)}</span>
    <span class="weekday">${escapeHtml(weekday)}</span>
    ${renderWeather(metadata.weather, config, filePath)}
  </aside>
  <div class="day-content">
    <h1 id="${escapeHtml(headingId)}">${escapeHtml(label)}</h1>

${html}
  </div>
</section>`;
}

async function readSharedFile(name) {
  return fs.readFile(path.join(sharedDir, name), "utf8");
}

async function main() {
  const configArg = process.argv[2];
  if (!configArg) {
    usage();
    process.exit(1);
  }

  const configPath = path.resolve(process.cwd(), configArg);
  const configDir = path.dirname(configPath);
  const projectRoot = path.dirname(configDir);
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));

  const outputPath = path.resolve(configDir, requireString(config.output, "output", configPath));
  if (!isInside(projectRoot, outputPath)) {
    throw new Error(`Refusing to write outside project directory: ${outputPath}`);
  }

  if (!Array.isArray(config.days) || config.days.length === 0) {
    throw new Error(`${configPath} must configure at least one day`);
  }

  const days = [];
  for (const dayFile of config.days) {
    const dayPath = path.resolve(configDir, dayFile);
    if (!isInside(configDir, dayPath)) {
      throw new Error(`Refusing to read day outside itinerary directory: ${dayFile}`);
    }

    const source = await fs.readFile(dayPath, "utf8");
    const parsed = parseFrontmatter(source, dayPath);
    days.push({
      filePath: dayPath,
      metadata: parsed.metadata,
      html: renderContent(parsed.content, parsed.metadata, dayPath)
    });
  }

  const [layout, styles, weatherScript, lightboxScript] = await Promise.all([
    readSharedFile("layout.html"),
    readSharedFile("styles.css"),
    readSharedFile("weather.js"),
    readSharedFile("lightbox.js")
  ]);

  const rendered = layout
    .replace("{{lang}}", escapeHtml(config.lang || "en"))
    .replace("{{title}}", escapeHtml(requireString(config.title, "title", configPath)))
    .replace("{{styles}}", indent(styles, 4))
    .replace("{{days}}", days.map((day) => renderDay(day, config)).join("\n\n"))
    .replace("{{footerNote}}", escapeHtml(config.footerNote || ""))
    .replace("{{weatherScript}}", indent(weatherScript, 4))
    .replace("{{lightboxScript}}", indent(lightboxScript, 4));

  await fs.writeFile(outputPath, `${rendered}\n`);
  console.log(`Built ${path.relative(repoRoot, outputPath)} from ${days.length} day files.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
