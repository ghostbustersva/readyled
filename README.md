# readyLED

A zero-dependency TypeScript browser library that renders text as a scrolling LED dot-matrix sign.

The specified font is used to render text, followed by operations to convert it into the LED style.

The generated sign image is 4x the necessary size, in order to leverage browser image scaling 
and subpixel rendering for cleaner, mor realistic visuals.

Usage:

```js
import { readyLED } from 'readyled';

readyLED({
  target: document.getElementById('my-led-sign'),
  text: 'Hello, world!',
  font: 'Elan Bold',
  fallbackFont: 'Times New Roman',
  pixelHeight: 12,
  scrollSpeed: 50,
}).then();
```

```css
@import "readyled/dist/readyled.css";

/* CSS custom properties for visual parameters */
.readyled-sign {
    /* base size of each LED */
    --readyled-pixel-size: 4px;
    /* gap between LEDs (can use relative units like em) */
    --readyled-pixel-gap: 0.1em;
    /* color of lit LEDs */
    --readyled-pixel-color: #ff0000;
    /* optional glow color for lit LEDs (set to transparent to disable) */
    --readyled-pixel-glow: #ff6666;
    /* size of the glow around lit LEDs */
    --readyled-pixel-glow-size: 0.2em;
    /* background color of the sign (also the "off" color if --readyled-pixel-off-color isn't 
    set) */
    --readyled-bg-color: #000000;
    /* color of unlit LEDs (optional; defaults to --readyled-bg-color if not set) */
    --readyled-pixel-off-color: #aaaaaa;
}
```