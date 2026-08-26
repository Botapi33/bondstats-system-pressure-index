# BondStats System Pressure Index — GitHub Pages

Deployment-safe single-file build.

## Deploy
Upload **the files inside this folder directly to the repository root**. `index.html` must appear at the top level of the GitHub repository, not inside another folder.

GitHub → Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

The entire application (UI + scoring engine + fetch logic) is embedded in `index.html`, so there are no CSS or JavaScript path dependencies to break on GitHub Pages.

Data source:
`https://botapi33.github.io/bondstats-global-yields/global_yields.json`
