# README images

Images used by the root `README.md`.

| File | What it is | How it was made |
| --- | --- | --- |
| `banner-light.png`, `banner-dark.png` | Title banner for light and dark GitHub themes | Rendered from an HTML template with headless Chrome (Playwright) at 3200 × 1200 |
| `terminal.png` | Terminal card: `npm test`, the MCP server refusing to start without a key, and `buildCalendar` output | Real output from running the commands locally on 2026-10-26 with synthetic data and no API key; the iCalendar output is trimmed to key lines |
| `how-it-works.svg` | Diagram of the read path (Cal.com busy times) and write path (subscribed feed) | Hand-written SVG |

Rules for agents: images must never show a real calendar, event titles, attendees, API keys or feed URLs. Use synthetic data only.
