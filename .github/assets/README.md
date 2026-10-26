# README images

Images used by the root `README.md`.

| File | What it is | How it was made |
| --- | --- | --- |
| `banner-light.png`, `banner-dark.png` | Title banner for light and dark GitHub themes | Rendered from [`source/banner.html`](source/banner.html) with headless Chrome (Playwright) at 3200 × 1200. See [`source/README.md`](source/README.md) |
| `terminal.png` | Terminal card: `npm test`, the MCP server refusing to start without a key, and `buildCalendar` output | Real output from running the commands locally on 2026-10-26 with synthetic data and no API key; the iCalendar output is trimmed to key lines |
| `how-it-works.svg` | Diagram of the read path (Cal.com busy times) and write path (subscribed feed) | Hand-written SVG |

## Visual identity

calcom-availability borrows Cal.com's quiet, monochrome product look, since it reads from Cal.com.

- **Colors** from cal.com's live CSS: ink `#242424`, canvas `#F4F4F4`, muted `#898989`, lines `#E0E0E0`, white cards. Dark theme: `#101010` background, `#1B1B1B` cards, `#F4F4F4` text.
- **Type:** Cal Sans (Cal.com's open-source display face, OFL, via Fontsource), Inter (body), JetBrains Mono (iCalendar properties).
- **Motif:** a work-week grid where events show only as hatched "Busy" blocks, plus a dashed `TENTATIVE` hold and a solid `CONFIRMED` plan from the feed.
- **README:** badges in `242424`, status in `898989`; no decorative emoji, matching developer-docs tone.
- No Cal.com logo is used; the project is independent of Cal.com.

Rules for agents: images must never show a real calendar, event titles, attendees, API keys or feed URLs. Use synthetic data only.
