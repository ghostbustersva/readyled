# ReadyLED – Agent Guide

## What This Is
A zero-dependency TypeScript browser library that renders text as a scrolling LED dot-matrix sign using Canvas API for rasterisation and pure DOM for display.

## Architecture

**Single source file**: `src/readyled.ts` → compiled to `dist/` via `tsc`.

**Data flow** (all inside `readyled.ts`):
1. `readyLED()` *(exported, async)* – increments a request token, resolves which font to render with, then drops stale in-flight calls so older waits do not overwrite newer renders
2. `isFontAvailable()` – checks `document.fonts.check(...)` with font-name normalization; if the Font Loading API is unsupported, it treats the font as available
3. `isString()` – type guard that checks whether a value is a string; used to narrow `font` before rendering
4. `waitForFont()` / `resolveFontFamily()` – poll the requested font for up to `maxWait` seconds at `fontCheckInterval` ms, then fall back to `fallbackFont`, then `'sans-serif'`; rendering is never skipped
5. `renderReadyLED()` *(requires `font: string`)* – accepts a pre-resolved font string, validates it with `isString()`, creates/reuses `.readyled-sign`, clears prior DOM, computes raster + sample dimensions, and appends the sign to `params.target`
6. `renderAndResampleText()` – draws text on an off-screen `<canvas>` at `96px`, uses `ctx.measureText(text).width` to derive the actual sample width, then nearest-neighbour downsamples to a `boolean[]` pixel grid (luminance threshold `< 128` = ON)
7. `renderSign()` – builds DOM rows/pixels and starts a `setInterval` scroll loop that rotates each row's first child to the end (DOM node rotation, not CSS)
8. `createPixelRow()` / `createPixel()` – DOM construction helpers; pixels are `<div class="readyled-pixel">` (and `-on` when lit)

**Standalone demo mode**: at the bottom of `readyled.ts`, `runReadyLEDDemo()` auto-runs on `DOMContentLoaded` (or immediately if the DOM is already ready) using config read from `#readyled-config` in `index.html`.

## Build
```sh
pnpm exec tsc          # compile src/ → dist/
pnpm exec tsc --watch  # watch mode
```
No bundler. Output is plain ESM (`module: esnext`, `target: esnext`). The demo `index.html` imports directly from `./dist/readyled.js`.

There is no test runner (`test` script is a stub).

## Demo
Open `index.html` directly in a browser (or a local static server). The demo auto-runs once the DOM is ready, and **START** reruns it with the current JSON from `#readyled-config`. The editable config exposes `font`, `fallbackFont`, `fontCheckInterval`, and `maxWait`, so you can watch the primary font wait/fallback behavior without changing code.

## Key Conventions

- **Pixel sizing (CSS-driven)**: the visual LED size and gap are controlled via CSS custom properties in `index.html` (e.g. `--readyled-pixel-size`, `--readyled-pixel-gap`), which are read at runtime by `getCSSProperty()` and converted to pixels via `cssSizeInPixels()` inside `createLEDImage()`.
- **`noUncheckedIndexedAccess: true`**: all array reads require a nullish coalescing fallback (e.g. `src[idx] ?? 0`). Failing to do this is a type error.
- **Font waiting**: `readyLED()` waits up to `maxWait` seconds for `params.font`, polling every `fontCheckInterval` ms. If the primary font never becomes available, it renders with `fallbackFont`, then `'sans-serif'`.
- **Font type safety**: `renderReadyLED()` has a narrowed type signature `(params: ReadyLEDParams & { font: string })` and a runtime `isString()` guard to ensure `fontFamily` is never `undefined` when passed to `renderAndResampleText()`.
- **Re-entrant rendering**: `readyLED()` reuses an existing `.readyled-sign` element (clears `innerHTML`) rather than creating a new one on repeated calls.
- **Async stale-call guard**: the module-level request token prevents an older `readyLED()` call from rendering after a newer call starts waiting on a different font.
- **Measured-width sampling**: `renderAndResampleText()` trims trailing blank space by sampling only across `ctx.measureText(text).width`; do not reintroduce a post-process blank-column pass.
- **LED grid invariant**: `createLEDImage()` assumes `data.length === sampleWidth * pixelHeight`; if `data.length % sampleWidth !== 0`, it logs a warning that the grid is not a perfect rectangle. Keep `sampleWidth` in sync with the `width` returned from `renderAndResampleText()`.
- **Scroll guard**: `renderSign()` checks `data-scrolling="true"` before starting a second `setInterval` – do not remove this guard.
- **Zero-width guard**: empty text can produce a zero sample width; `renderReadyLED()` / `renderSign()` explicitly bail out rather than entering a zero-step loop.
- **`nametape.woff2`**: an additional font bundled in the project root but not wired up in `index.html` – it can be used once you add a matching `@font-face` rule and ensure the font is loaded before calling `readyLED({ font: "Nametape", ... })`.
- **Config shape** (`ReadyLEDParams`): `target`, `pixelHeight`, and `text` are required; `font`, `fallbackFont`, `fontCheckInterval`, `maxWait`, `scrollSpeed` (default `150` ms), and `signWidth` are optional.

