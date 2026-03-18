# ReadyLED – Agent Guide

## What This Is
A zero-dependency TypeScript browser library that renders text as a scrolling LED dot-matrix sign using Canvas API for rasterisation and pure DOM for display.

## Architecture

- **Source**: `src/readyled.ts` is the single TS source file for the library logic.
- **Bundled output**: Parcel uses `index.html` as the entry point and produces a browser-ready bundle in `dist/`.

**Data flow** (all inside `readyled.ts`):
1. `readyLED()` *(exported, async)* – increments a request token, resolves which font to render with, then drops stale in-flight calls so older waits do not overwrite newer renders
2. `isFontAvailable()` – checks `document.fonts.check(...)` with font-name normalization; if the Font Loading API is unsupported, it treats the font as available
3. `isString()` – type guard that checks whether a value is a string; used to narrow `font` before rendering
4. `waitForFont()` / `resolveFontFamily()` – poll the requested font for up to `maxWait` seconds at `fontCheckInterval` ms, then fall back to `fallbackFont`, then `'sans-serif'`; rendering is never skipped
5. `renderReadyLED()` *(requires `font: string`)* – accepts a pre-resolved font string, validates it with `isString()`, creates/reuses `.readyled-sign`, clears prior DOM, computes raster + sample dimensions, snaps the sign width (or configured `signWidth`) to the closest even multiple of the LED pixel+gap width, and appends the sign to `params.target`
6. `renderAndResampleText()` – draws text on an off-screen `<canvas>` at `96px`, uses `ctx.measureText(text).width` to derive the actual sample width, then nearest-neighbour downsamples to a `boolean[]` pixel grid (luminance threshold `< 128` = ON)
7. `renderSign()` – renders a rasterised LED image into an `<img>` pair and relies on CSS animation (driven by `--readyled-columns` and `--readyled-animation-duration`) for scrolling
8. `createLEDImage()` – raster helper that converts the boolean pixel grid into a PNG data URL using circular LEDs, CSS-driven sizing, and optional glow

**Standalone demo/bundle**: `index.html` is the HTML entry; Parcel discovers and bundles `src/readyled.ts` (via its script imports) into `dist/`, wiring up the correct script tags in the output HTML.

## Build

```sh
pnpm run build   # Parcel build of index.html → dist/
pnpm run dev     # Parcel dev server for the demo (hot reload)
```

- Parcel is the primary build tool; TypeScript is used via Parcel’s TS pipeline (no separate `tsc` step for the main build).
- Output is a browser-ready bundle (JS/CSS/assets) emitted to `dist/`.

There is no test runner (`test` script is a stub).

## Demo

- Use `pnpm run dev` for a live-reloading dev server; open the printed localhost URL.
- For a static build, run `pnpm run build` and then serve the `dist/` directory with any static server.

The editable config in `#readyled-config` exposes `font`, `fallbackFont`, `fontCheckInterval`, `maxWait`, `pixelHeight`, `scrollSpeed`, and `signWidth`.

## Key Conventions

- **Pixel sizing (CSS-driven)**: the visual LED size and gap are controlled via CSS custom properties in `styles/readyled.css` (e.g. `--readyled-pixel-size`, `--readyled-pixel-gap`), which are read at runtime by `getCSSProperty()` and converted to pixels via `cssSizeInPixels()` inside `createLEDImage()` and width snapping logic in `renderReadyLED()`.
- **Width snapping**: when `signWidth` is provided (or when the content-derived width is used), `renderReadyLED()` snaps the sign's `style.width` to the closest even multiple of the LED cell width (pixel size + gap) so the viewport always shows a whole number of LED columns.
- **`noUncheckedIndexedAccess: true`**: all array reads require a nullish coalescing fallback (e.g. `src[idx] ?? 0`). Failing to do this is a type error.
- **Font waiting**: `readyLED()` waits up to `maxWait` seconds for `params.font`, polling every `fontCheckInterval` ms. If the primary font never becomes available, it renders with `fallbackFont`, then `'sans-serif'`.
- **Font type safety**: `renderReadyLED()` has a narrowed type signature `(params: ReadyLEDParams & { font: string })` and a runtime `isString()` guard to ensure `fontFamily` is never `undefined` when passed to `renderAndResampleText()`.
- **Re-entrant rendering**: `readyLED()` reuses an existing `.readyled-sign` element (clears `innerHTML`) rather than creating a new one on repeated calls.
- **Async stale-call guard**: the module-level request token prevents an older `readyLED()` call from rendering after a newer call starts waiting on a different font.
- **Measured-width sampling**: `renderAndResampleText()` trims trailing blank space by sampling only across `ctx.measureText(text).width`; do not reintroduce a post-process blank-column pass.
- **LED grid invariant**: `createLEDImage()` assumes `data.length === sampleWidth * pixelHeight`; if `data.length % sampleWidth !== 0`, it logs a warning that the grid is not a perfect rectangle. Keep `sampleWidth` in sync with the `width` returned from `renderAndResampleText()`.
- **Scroll control**: scrolling is driven by a CSS animation on `.readyled-sign-track.ready`, parameterised by `--readyled-columns` and `--readyled-animation-duration`; `renderReadyLED()` is responsible for setting these custom properties.
- **Zero-width guard**: empty text can produce a zero sample width; `renderReadyLED()` / `renderSign()` explicitly bail out rather than entering a zero-step loop.
- **`nametape.woff2`**: an additional font bundled in the project root but not wired up in `index.html` – it can be used once you add a matching `@font-face` rule (e.g. in `styles/readyled.css`) and ensure the font is loaded before calling `readyLED({ font: "Nametape", ... })`.
- **Config shape** (`ReadyLEDParams`): `target`, `pixelHeight`, and `text` are required; `font`, `fallbackFont`, `fontCheckInterval`, `maxWait`, `scrollSpeed` (default `150` ms), and `signWidth` are optional.
