let readyLEDRequestId = 0;
const isString = (value) => typeof value === 'string';
const getCSSProperty = (propertyName, defaultValue) => {
    if (!document.documentElement) {
        return defaultValue;
    }
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim();
    return value === '' ? defaultValue : value;
};
const cssSizeInPixels = (value, element = document.body) => {
    if (!value) {
        return 0;
    }
    const testElement = document.createElement('div');
    testElement.style.position = 'absolute';
    testElement.style.visibility = 'hidden';
    // get subpixel values by multiplying by 100
    testElement.style.width = `calc(${value} * 100)`;
    element.appendChild(testElement);
    const pixels = testElement.getBoundingClientRect().width;
    element.removeChild(testElement);
    return pixels / 100.0;
};
// Snap a value to the closest even multiple of a positive step size
const snapToClosestEvenMultiple = (value, step) => {
    if (step <= 0) {
        return Math.max(0, Math.round(value));
    }
    const k = value / step;
    let n = Math.round(k);
    if (n % 2 !== 0) {
        const down = n - 1;
        const up = n + 1;
        const downErr = Math.abs(k - down);
        const upErr = Math.abs(k - up);
        n = downErr <= upErr ? down : up;
    }
    if (n < 0) {
        n = 0;
    }
    return n * step;
};
const isFontAvailable = (fontFamily) => {
    if (!fontFamily) {
        return true;
    }
    if (!('fonts' in document) || typeof document.fonts.check !== 'function') {
        return true;
    }
    const normalizedFontFamily = fontFamily.includes('"') || fontFamily.includes("'")
        ? fontFamily
        : `"${fontFamily}"`;
    return document.fonts.check(`16px ${normalizedFontFamily}`);
};
const wait = (delay) => new Promise((resolve) => {
    window.setTimeout(resolve, delay);
});
const waitForFont = async (fontFamily, maxWaitMilliseconds, fontCheckInterval) => {
    if (!fontFamily || isFontAvailable(fontFamily)) {
        return true;
    }
    if (maxWaitMilliseconds <= 0) {
        return false;
    }
    // Trigger font loading by adding a hidden element that uses the font
    if (document.body) {
        const loader = document.createElement('span');
        loader.setAttribute('style', `
            position:absolute;
            top:-9999px;
            left:-9999px;
            visibility:hidden;
            font-family:${fontFamily};
        `);
        loader.textContent = fontFamily;
        document.body.appendChild(loader);
    }
    const pollDelay = Math.max(1, fontCheckInterval);
    const deadline = Date.now() + maxWaitMilliseconds;
    while (Date.now() < deadline) {
        await wait(Math.min(pollDelay, Math.max(deadline - Date.now(), 0)));
        if (isFontAvailable(fontFamily)) {
            return true;
        }
    }
    return isFontAvailable(fontFamily);
};
const resolveFontFamily = async ({ fallbackFont, font, fontCheckInterval = 100, maxWait = 3, }) => {
    const maxWaitMilliseconds = Math.max(0, maxWait) * 1000;
    if (isString(font) && await waitForFont(font, maxWaitMilliseconds, fontCheckInterval)) {
        return font;
    }
    if (isString(fallbackFont) && isFontAvailable(fallbackFont)) {
        return fallbackFont;
    }
    return 'sans-serif';
};
const renderReadyLED = (params) => {
    const { font, pixelHeight, scrollSpeed = 150, signWidth, target, text } = params;
    if (!isString(font)) {
        return;
    }
    let sign;
    if (document.querySelector('.readyled-sign')) {
        sign = document.querySelector('.readyled-sign');
        if (sign) {
            sign.innerHTML = '';
        }
    }
    else {
        sign = document.createElement('div');
        sign.classList.add('readyled-sign');
    }
    const track = document.createElement('div');
    track.classList.add('readyled-sign-track');
    sign.appendChild(track);
    const fontSize = 48;
    const renderWidth = Math.ceil(fontSize * 1.2 * text.length);
    const renderHeight = Math.ceil(fontSize * 0.8);
    const pixelWidth = Math.ceil(pixelHeight / renderHeight * renderWidth);
    const { data, width: sampleWidth } = renderAndResampleText({
        width: renderWidth,
        height: renderHeight,
        text,
        fontSize,
        fontFamily: font,
        sampleHeight: pixelHeight,
        sampleWidth: pixelWidth,
        threshold: 128,
    });
    if (sampleWidth <= 0 || data.length === 0) {
        sign.style.width = `${signWidth ?? sampleWidth}px`;
        target.appendChild(sign);
        return;
    }
    target.appendChild(sign);
    renderSign({
        data,
        pixelSize: 1,
        sampleWidth,
        target: track,
        text,
    });
    const cssPixelSize = cssSizeInPixels(getCSSProperty('--readyled-pixel-size', '4'), sign);
    const cssPixelGap = cssSizeInPixels(getCSSProperty('--readyled-pixel-gap', '0.5'), sign);
    const cellWidth = cssPixelSize + cssPixelGap;
    const desiredWidth = signWidth ?? pixelWidth;
    const snappedWidth = snapToClosestEvenMultiple(desiredWidth, cellWidth);
    sign.style.width = `${snappedWidth}px`;
    sign.style.setProperty('--readyled-columns', sampleWidth.toString());
    sign.style.setProperty('--readyled-animation-duration', `${sampleWidth * scrollSpeed}ms`);
    track.classList.add('ready');
};
export const readyLED = async (params) => {
    const requestId = ++readyLEDRequestId;
    const renderFont = await resolveFontFamily(params);
    if (requestId !== readyLEDRequestId) {
        return;
    }
    renderReadyLED({ ...params, font: renderFont });
};
const renderAndResampleText = ({ text, fontSize, fontFamily, sampleWidth, sampleHeight, threshold = 128 // luminance threshold for ON/OFF
 }) => {
    const canvas = document.createElement('canvas');
    const width = canvas.width = Math.ceil(fontSize * 1.2 * text.length);
    const height = canvas.height = fontSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return { data: [], width };
    }
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, height / 2);
    const measuredWidth = ctx.measureText(text).width;
    const actualSampleWidth = Math.min(sampleWidth, Math.ceil((sampleHeight / height) * measuredWidth));
    const src = ctx.getImageData(0, 0, width, height).data;
    const data = new Array(actualSampleWidth * sampleHeight);
    for (let y = 0; y < sampleHeight; y++) {
        for (let x = 0; x < actualSampleWidth; x++) {
            // Map low-res pixel to nearest source pixel within the measured text extent
            const srcX = Math.floor((x / actualSampleWidth) * measuredWidth);
            const srcY = Math.floor((y / sampleHeight) * height);
            const idx = (srcY * width + srcX) * 4;
            const r = src[idx] ?? 0;
            const g = src[idx + 1] ?? 0;
            const b = src[idx + 2] ?? 0;
            // Convert to grayscale luminance
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            // Convert to ON/OFF bit
            data[y * actualSampleWidth + x] = luminance < threshold;
        }
    }
    return {
        data,
        width: actualSampleWidth,
    };
};
const createLEDImage = ({ target, data, pixelSize = 0.5, sampleWidth, }) => {
    const totalCells = data.length;
    if (!sampleWidth || totalCells === 0) {
        return { url: '', height: 0, width: 0 };
    }
    const pixelHeight = Math.floor(totalCells / sampleWidth);
    if (totalCells % sampleWidth !== 0) {
        console.warn('readyLED: LED grid is not a perfect rectangle', {
            totalCells,
            sampleWidth,
            pixelHeight,
        });
    }
    const cssPixelSize = cssSizeInPixels(getCSSProperty('--readyled-pixel-size', '4'), target);
    const cssPixelGap = cssSizeInPixels(getCSSProperty('--readyled-pixel-gap', '0.5'), target);
    const color = getCSSProperty('--readyled-pixel-color', 'red');
    const glow = getCSSProperty('--readyled-pixel-glow', color);
    const glowSize = parseFloat(getCSSProperty('--readyled-pixel-glow-size', '1.2'));
    const bgColor = getCSSProperty('--readyled-bg-color', 'black');
    const offColor = getCSSProperty('--readyled-pixel-off-color', 'black');
    const pxSize = cssPixelSize * pixelSize * 4;
    const pxGap = cssPixelGap * pixelSize * 4;
    const step = pxSize + pxGap;
    const ledCanvas = document.createElement("canvas");
    ledCanvas.width = sampleWidth * step;
    ledCanvas.height = pixelHeight * step;
    const lctx = ledCanvas.getContext("2d");
    if (!lctx) {
        return { url: '', height: 0, width: 0 };
    }
    // Dark housing background
    lctx.fillStyle = bgColor;
    lctx.fillRect(0, 0, ledCanvas.width, ledCanvas.height);
    const half = pxSize / 2;
    const drawGrid = (drawDark) => {
        for (let y = 0; y < pixelHeight; y++) {
            const dataY = y * sampleWidth;
            for (let x = 0; x < sampleWidth; x++) {
                const cx = x * step + step / 2;
                const cy = y * step + step / 2;
                // console.log('cx, cy', cx, cy);
                lctx.beginPath();
                lctx.arc(cx, cy, half, 0, Math.PI * 2);
                if (!drawDark && data[dataY + x]) {
                    // Lit pixel — colour + glow
                    lctx.fillStyle = color;
                    lctx.shadowColor = glow;
                    lctx.shadowBlur = pxSize * glowSize;
                    lctx.fill();
                    lctx.shadowBlur = 0;
                    lctx.shadowColor = 'transparent';
                }
                if (drawDark && !data[dataY + x]) {
                    // Off pixel — faint dot (visible grid pattern)
                    lctx.fillStyle = offColor;
                    lctx.fill();
                }
            }
        }
    };
    drawGrid(true);
    drawGrid(false);
    return {
        url: ledCanvas.toDataURL("image/png"),
        width: ledCanvas.width,
        height: ledCanvas.height,
    };
};
const renderSign = ({ data, pixelSize, sampleWidth, target, text, }) => {
    const { url, width, height } = createLEDImage({ data, pixelSize, sampleWidth, target });
    if (!url) {
        return;
    }
    const img = document.createElement('img');
    img.src = url;
    img.alt = text;
    img.width = width * 0.25;
    img.height = height * 0.25;
    const imgForScroll = document.createElement('img');
    imgForScroll.src = url;
    imgForScroll.alt = '';
    imgForScroll.width = width * 0.25;
    imgForScroll.height = height * 0.25;
    target.appendChild(img);
    target.appendChild(imgForScroll);
};
//# sourceMappingURL=readyled.js.map