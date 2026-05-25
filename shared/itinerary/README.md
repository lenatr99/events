# Shared Itinerary Generator

Build an event itinerary from a project config and ordered day files:

```sh
node tools/build-itinerary.mjs germany2026/itinerary/config.json
```

Each project keeps its own `itinerary/config.json` and `itinerary/days/*.md`.
Day files use frontmatter for date/weather metadata. Body content can be regular
Markdown, or `format: "html"` when a migrated day needs complex raw HTML blocks
such as maps, timed plans, photo grids, or accommodation details.

Shared presentation and behavior live here:

- `layout.html` assembles the generated page.
- `styles.css` owns the itinerary UI.
- `weather.js` refreshes weather cards through Open-Meteo.
- `lightbox.js` powers local photo galleries.
