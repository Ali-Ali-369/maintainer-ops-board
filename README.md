# Maintainer Ops Board

Maintainer Ops Board is a static, browser-based dashboard for open-source
maintainers. It combines triage, release readiness, and review-risk signals in
one local-first interface.

The MVP is intentionally dependency-free:

- Works from a static file server.
- Loads bundled JSON sample data.
- Filters issues by priority, owner, and search text.
- Updates queue counts and release readiness in the browser.
- Includes a review-risk panel and weekly activity chart.
- Persists local edits in browser storage.
- Imports and exports board JSON for local maintainer workflows.
- Exports Markdown handoff notes for release and review planning.

## Run

```bash
python -m http.server 4175
```

Then open:

```text
http://localhost:4175
```

## Project Shape

- `index.html` - app shell.
- `styles.css` - responsive dashboard layout.
- `app.js` - state, filtering, rendering, and interactions.
- `data/sample-board.json` - sample maintainer operations data.

Board JSON uses this shape:

```json
{
  "project": {},
  "metrics": [],
  "activity": [],
  "issues": [],
  "release": [],
  "risks": []
}
```

## Roadmap

- Import data from GitHub issue and PR exports.
- Add local policy packs for different project types.
- Export maintainer handoff notes as Markdown.
- Add optional Codex/API-assisted summaries for long queues.

## License

MIT
