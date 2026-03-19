# ReadyLED – Agent Guide

## What This Is
A zero-dependency TypeScript browser library that renders text as a scrolling LED dot-matrix sign. Text is rasterised via the Canvas API into a boolean pixel grid, then turned into a PNG and scrolled using pure DOM + CSS animation.

## Architecture & Data Flow (`src/readyled.ts`)

- **Entry type**: `ReadyLEDParams` – requires `target`, `pixelHeight`, `text`; optional `font`, `fallbackFont`, `fontCheckInterval`, `maxWait`, `scrollSpeed`, `signWidth`.
- **Async entry**: `readyLED(params)` – bumps a module-level request token, waits for fonts, then bails if its token is stale before delegating to `renderReadyLED({ ...params, font })`.
- **Type guard**: `isString(value)` – narrows `font`/`fallbackFont` to `string` before use.
- **CSS helpers**: `getCSSProperty(element, name, default)` + `cssSizeInPixels(value, element)` – read CSS custom properties and convert CSS lengths (including `em`) into device pixels by measuring a hidden DOM node.
- **Font probing**:
  - `isFontAvailable(fontFamily?)` – checks `document.fonts.check` with proper quoting; treats fonts as available if the Font Loading API is missing or `fontFamily` is falsy.
  - `waitForFont(fontFamily, maxWaitMs, fontCheckInterval)` – optionally injects a hidden `.readyled-fontloader` span that uses the font, then polls `isFontAvailable` until timeout; cleans up the loader.
  - `resolveFontFamily({ font, fallbackFont, fontCheckInterval, maxWait })` – waits up to `maxWait` seconds for `font`, then `fallbackFont`, then falls back to `'sans-serif'`. Rendering is never skipped.
- **Raster pipeline**:
  - `renderReadyLED(params & { font: string })`
    - Validates `font` with `isString` at runtime and early-returns if not a string.
    - Reuses an existing `.readyled-sign` under `target` if present (clears `innerHTML`), otherwise creates it, then appends a `.readyled-sign-track` child.
    - Chooses a fixed canvas font size and derives a coarse `renderWidth`/`renderHeight` from `text.length`, then a `pixelWidth` scaled to `pixelHeight`.
    - Calls `renderAndResampleText(...)` to obtain `{ data: boolean[], width: sampleWidth }`.
    - **Zero-width guard**: if `sampleWidth <= 0` or `data.length === 0`, sets `sign.style.width` to `signWidth ?? sampleWidth`, appends the sign, and returns (no scrolling images, no animation).
    - Otherwise appends `sign`, then calls `renderSign(...)` to populate the track with two `<img>` elements.
    - Reads `--readyled-pixel-size` / `--readyled-pixel-gap` via `getCSSProperty` + `cssSizeInPixels`, computes `cellWidth = pixelSize + pixelGap`, and snaps the sign width:
      - `desiredWidth = signWidth ?? pixelWidth`
      - `snappedWidth = snapToClosestEvenMultiple(desiredWidth, cellWidth)`
      - sets `sign.style.width = snappedWidth + 'px'`.
    - Sets scroll CSS variables: `--readyled-columns = sampleWidth`, `--readyled-animation-duration = sampleWidth * scrollSpeed + 'ms'`, then adds `.ready` to the track to start the CSS animation.
  - `renderAndResampleText({ width, height, text, fontFamily, fontSize, sampleWidth, sampleHeight, threshold })`
    - Creates an off-screen `<canvas>`, sets `width`/`height`, and draws text using `${fontSize}px ${fontFamily}`.
    - Uses `ctx.measureText(text).width` as `measuredWidth` and computes `actualSampleWidth` from the measured width and `sampleHeight`, so the boolean grid covers only the drawn text extent (no trailing blank columns).
    - Reads RGBA data via `getImageData`, using `noUncheckedIndexedAccess`-safe reads (`src[idx] ?? 0`). Converts to grayscale luminance and sets each boolean `data[y * actualSampleWidth + x] = luminance < threshold`. Returns `{ data, width: actualSampleWidth }`.
  - `createLEDImage({ data, pixelSize, sampleWidth, target })`
    - Validates the LED grid: if `!sampleWidth` or `data.length === 0`, returns an empty `{ url: '' }`.
    - Computes `pixelHeight = Math.floor(totalCells / sampleWidth)`. If `totalCells % sampleWidth !== 0`, logs a warning (`readyLED: LED grid is not a perfect rectangle`) to flag a shape mismatch.
    - Reads visual parameters from CSS on `target` or document defaults: `--readyled-pixel-size`, `--readyled-pixel-gap`, `--readyled-pixel-color`, `--readyled-pixel-glow`, `--readyled-pixel-glow-size`, `--readyled-bg-color`, `--readyled-pixel-off-color`.
    - Computes the canvas step size (`step = pxSize + pxGap`) and allocates a `canvas` sized to `sampleWidth * step` by `pixelHeight * step`.
    - Draws a dark background, then two passes of circular LEDs: one for unlit dots (grid pattern), one for lit dots (colour + optional glow). Returns a PNG data URL and dimensions.
  - `renderSign({ data, pixelSize, sampleWidth, target, text })`
    - Calls `createLEDImage`, aborts if `url` is empty.
    - Creates two `<img>` elements using the same `url`, scaled to 25% of the raster dimensions via inline `style`; the second image has an empty `alt`. Appends both to the track so CSS can scroll across a doubled strip.

## Build, Bundle & Demo Workflow (Rollup)

- **Build tool**: Rollup (ESM output).
- **Config**: `rollup.config.mjs`
  - `input: 'src/readyled.ts'`.
  - `output.file: 'dist/readyled.js'`, `format: 'esm'`.
  - Plugins:
    - `@rollup/plugin-node-resolve` – resolves `.ts` / `.js` module imports.
    - `@rollup/plugin-typescript` – compiles TypeScript via Rollup.
    - `rollup-plugin-copy` – copies `styles/readyled.css` into `dist/` on build.
- **CSS handling**:
  - Source stylesheet: `styles/readyled.css`.
  - Build step copies it verbatim to `dist/readyled.css`.
  - The demo `index.html` links `<link rel="stylesheet" href="./dist/readyled.css">`.
- **Demo entry**: `index.html`
  - Defines base CSS custom properties for LED sizing, margins, colours, and scroll behavior using `--readyled-*` variables.
  - Provides a `@font-face` for the demo font (e.g. `"Elan"` via `elan.woff2`).
  - Loads the built module with `<script type="module"> import { readyLED } from './dist/readyled.js'; … </script>` and passes JSON from `#readyled-config` into `readyLED`.

## Key Behaviors & Conventions

- **Functional / declarative style**: prefer small, focused functions (<100 lines) and pure helpers (e.g. `getCSSProperty`, `cssSizeInPixels`, `isFontAvailable`, `waitForFont`). Avoid mixing DOM mutation, rendering, and calculations in the same function.
- **Font loading / waiting**: `readyLED()` never skips rendering. It waits up to `maxWait` seconds for `font`, then `fallbackFont`, polling every `fontCheckInterval` ms. If neither loads in time, it renders with `'sans-serif'`.
- **Async stale-call guard**: every `readyLED()` call increments a module-level request id; after awaiting font resolution it checks whether its id is still current. If not, it returns without rendering, so older calls cannot overwrite newer ones.
- **Re-entrant DOM behavior**: `renderReadyLED()` reuses an existing `.readyled-sign` within `params.target`, clearing its `innerHTML` instead of creating duplicate containers.
- **CSS-driven pixel sizing**: both the LED raster (`createLEDImage`) and viewport width snapping (`renderReadyLED`) derive their notion of “pixel size” and “gap” from CSS (`--readyled-pixel-size`, `--readyled-pixel-gap`, etc.) via `getCSSProperty` + `cssSizeInPixels`. Visual size is controlled in CSS; JS adapts to whatever units/styles are in force.
- **Width snapping**: the visible sign width is snapped to the closest even multiple of the LED cell width (`pixel size + gap`) using a helper such as `snapToClosestEvenMultiple`. This ensures the viewport shows a whole number of LED columns and aligns with the `steps(--readyled-columns)` animation.
- **LED grid invariant**: `createLEDImage()` expects `data.length === sampleWidth * pixelHeight`. If `totalCells % sampleWidth !== 0`, it still renders but logs a warning to aid debugging sampling/width bugs.
- **Zero-width handling**: if text rasterisation yields a zero or empty sample (`sampleWidth <= 0` or `data.length === 0`), the code sets a minimal sign width (from `signWidth` or the computed width), appends the sign, and returns—no images, no animation, and no risk of zero-step scroll loops.
- **TypeScript strictness**: downsampling respects `noUncheckedIndexedAccess` by using `src[idx] ?? 0` for all raw RGBA reads.
- **Config-driven demo**: the editable JSON in `#readyled-config` exposes `font`, `fallbackFont`, `fontCheckInterval`, `maxWait`, `pixelHeight`, `scrollSpeed`, and `signWidth`. Changing these and re-running the START button re-invokes `readyLED()` with a fresh request id`.
