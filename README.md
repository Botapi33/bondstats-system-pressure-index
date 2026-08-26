# BondStats System Pressure Index

Production-ready, dependency-free GitHub Pages application for the BondStats sovereign-rate pressure signal.

## Data source

The application reads the BondStats master dataset directly:

`https://botapi33.github.io/bondstats-global-yields/global_yields.json`

The implementation targets the current BondStats schema exactly:

- `meta.lastUpdated`
- `countries.<market>.label`
- `source`
- `frequency`
- `date`
- `value`
- `previousDate`
- `previousValue`
- `change`
- `stalenessDays`
- `tier`
- `isFallback`

`change` is interpreted as a percentage-point yield change and converted to basis points by multiplying by 100.

## Eligibility rule

The current index intentionally excludes stale or lower-frequency observations. A market enters the index only when all of the following are true:

1. `frequency === "Daily"`
2. `stalenessDays <= 7`
3. `isFallback === false`
4. current yield and change are numeric

At least five eligible markets are required. Monthly and stale observations remain part of the BondStats source dataset, but do not influence the current score.

## Methodology

The index is a weighted current-state snapshot:

- **40% Yield Level** — median 10Y yield across eligible markets, transformed using a published piecewise scale.
- **25% Move Intensity** — median absolute daily yield move in basis points.
- **20% Stress Breadth** — share of eligible markets moving at least 3 bp in either direction.
- **15% Upward Pressure** — share of eligible markets with yields rising at least 1 bp.

State bands:

- 0–24: Contained
- 25–39: Normal
- 40–54: Pressure Building
- 55–69: Elevated
- 70–84: High
- 85–100: Extreme

This is not a probability of crisis and does not claim to measure repo, bank funding, credit or collateral stress that is not present in the source dataset.

## Files

- `index.html` — semantic page structure and SEO metadata
- `styles.css` — institutional responsive interface
- `engine.js` — pure parsing/scoring engine
- `app.js` — data fetching and rendering
- `tests/engine.test.mjs` — deterministic engine tests
- `.nojekyll` — GitHub Pages compatibility
- `robots.txt` — crawl directive

## Deploy

1. Create or use repo `bondstats-system-pressure-index`.
2. Upload all files to the repository root, preserving the `tests` folder.
3. GitHub → Settings → Pages → Deploy from branch → `main` / root.
4. No API key, backend, npm install or build step is required.

Recommended BondStats placement: **Tools → Market Intelligence**.
