# BondStats System Pressure Index

Production GitHub Pages build.

## Deploy
1. Upload all files to the repository root.
2. GitHub → Settings → Pages.
3. Deploy from branch: `main` / `(root)`.

The application is intentionally a single-file page. CSS, UI logic and the pressure-index engine are embedded in `index.html`; the only live external dependency is the BondStats Global Yields JSON feed.

## Method
- Yield Level: 40%
- Move Intensity: 25%
- Stress Breadth: 20%
- Upward Pressure: 15%
- Eligibility: non-fallback Daily observations with staleness <= 7 days
