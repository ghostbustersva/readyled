let readyLEDRequestId = 0;
const isString = (value) => typeof value === 'string';
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
    const fontSize = 96;
    const renderWidth = Math.ceil(fontSize * 1.2 * text.length);
    const renderHeight = Math.ceil(fontSize * 0.9);
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
    renderSign({
        data,
        interval: scrollSpeed,
        sampleWidth,
        signWidth: signWidth ?? pixelWidth,
        target: sign,
        width: sampleWidth,
        pixelSize: 1,
    });
    sign.style.width = `${signWidth ?? pixelWidth}px`;
    target.appendChild(sign);
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
const createPixel = (on, size = 1) => {
    const pixel = document.createElement('div');
    pixel.classList.add('readyled-pixel');
    if (on) {
        pixel.classList.add('readyled-pixel-on');
    }
    pixel.style.width = `${size}em`;
    pixel.style.height = `${size}em`;
    return pixel;
};
const createPixelRow = ({ data, rowIndex, rowSize, pixelSize }) => {
    const row = document.createElement('div');
    row.classList.add('readyled-row');
    row.style.width = `${rowSize * 2}em`;
    const rowData = data.slice(rowIndex, rowIndex + rowSize);
    rowData.forEach((rowDatum) => row.appendChild(createPixel(rowDatum, pixelSize)));
    return row;
};
const renderSign = function ({ target, data, width, sampleWidth = Math.round(0.2 * width), pixelSize = 0.5, interval = 300, }) {
    if (sampleWidth <= 0) {
        return;
    }
    for (let i = 0, l = data.length - 1; i < l; i += sampleWidth) {
        const row = createPixelRow({
            data,
            rowIndex: i,
            rowSize: sampleWidth,
            pixelSize,
        });
        target.appendChild(row);
    }
    if (target.getAttribute('data-scrolling') !== 'true') {
        setInterval(() => {
            target.setAttribute('data-scrolling', 'true');
            const rows = document.querySelectorAll('.readyled-row');
            for (let i = 0, l = rows.length; i < l; ++i) {
                const row = rows[i];
                const shiftPixel = row.firstElementChild;
                if (!shiftPixel) {
                    continue;
                }
                row.appendChild(shiftPixel);
            }
        }, interval);
    }
};
const runReadyLEDDemo = () => {
    if (!document.body) {
        console.error('document.body not available');
        return;
    }
    const text = ` WE'RE READY TO BELIEVE YOU! (804) 482-1217 -`;
    let config = {
        pixelHeight: 10,
        scrollSpeed: 150,
        signWidth: 320,
        target: document.body,
        text,
    };
    const readyLEDConfig = document.getElementById('readyled-config');
    if (readyLEDConfig) {
        config = {
            ...config,
            ...JSON.parse(readyLEDConfig.innerText),
        };
    }
    readyLED(config).then();
};
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runReadyLEDDemo, { once: true });
}
else {
    runReadyLEDDemo();
}
//# sourceMappingURL=readyled.js.map