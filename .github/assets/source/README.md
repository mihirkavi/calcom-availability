# Banner source

`banner.html` is the self-contained design for `../banner-light.png` and `../banner-dark.png`. One file holds both themes: its `@media (prefers-color-scheme: dark)` block switches the palette.

## Re-render

Render it with any headless Chrome at a 1600 × 600 viewport and device scale factor 2, once with `prefers-color-scheme: light` and once with `dark`. For example, with Playwright:

```js
const page = await browser.newPage({ viewport: { width: 1600, height: 600 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await page.goto('file://' + path.resolve('.github/assets/source/banner.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: '.github/assets/banner-dark.png' });
```

Fonts load from Fontsource on jsDelivr (Cal Sans) and Google Fonts (Inter, JetBrains Mono), so rendering needs network access. There is no logo file; the mark is drawn in CSS.

## Notes for agents

- Edit the HTML, then re-render both PNGs. Never edit the PNGs by hand.
- Keep the banner free of personal data, real account content, tokens and invented product output.
- The week grid is illustrative. Busy blocks carry only the word "Busy", matching what the library returns (start and end, no titles). `STATUS:TENTATIVE` and `REFRESH-INTERVAL` are real properties written by `src/ics.ts`.
